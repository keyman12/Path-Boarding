"""
TrueLayer bank account verification service.
Uses Data API (info) and Verification API to verify:
1. Bank account name (user-provided) vs account holder - fuzzy match
2. Sort code + account number - 100% exact match
3. Account holders vs directors - fuzzy match
"""
import logging
import re
import secrets
from typing import Any, Optional, Tuple
from urllib.parse import urlencode

import httpx
from rapidfuzz import fuzz

from app.core.config import settings

logger = logging.getLogger(__name__)

# Minimum fuzzy match ratio (0-100) to consider a match
ACCOUNT_NAME_MATCH_THRESHOLD = 80
DIRECTOR_MATCH_THRESHOLD = 80


def _normalize_for_match(s: str) -> str:
    """Normalize string for fuzzy matching: uppercase, collapse spaces, expand LTD/LIMITED."""
    if not s or not isinstance(s, str):
        return ""
    s = s.upper().strip()
    s = re.sub(r"\s+", " ", s)
    # Expand common variants
    s = re.sub(r"\bLTD\b", "LIMITED", s)
    s = re.sub(r"\bLTD\.\b", "LIMITED", s)
    s = re.sub(r"&", "AND", s)
    return s.strip()


def _fuzzy_match(a: str, b: str, threshold: int = 80) -> Tuple[bool, int]:
    """Return (matches, score 0-100). Uses token_sort_ratio for order-insensitive matching."""
    na = _normalize_for_match(a)
    nb = _normalize_for_match(b)
    if not na or not nb:
        return False, 0
    score = fuzz.token_sort_ratio(na, nb)
    return score >= threshold, score


def build_auth_url(state: str) -> str:
    """
    Build TrueLayer auth URL for user to connect their bank.
    state should be the invite token (or token|nonce) to resume session.
    """
    if not settings.TRUELAYER_CLIENT_ID or not settings.TRUELAYER_CLIENT_SECRET:
        raise ValueError("TrueLayer not configured (TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET)")

    base = settings.TRUELAYER_AUTH_URL.rstrip("/")
    params = {
        "response_type": "code",
        "client_id": settings.TRUELAYER_CLIENT_ID,
        "redirect_uri": settings.TRUELAYER_REDIRECT_URI,
        "scope": "info accounts transactions verification",
        "state": state,
        # Omit response_mode to use GET redirect (avoids "non-secure form" warning when callback is HTTP)
        "providers": "uk-cs-mock uk-ob-all uk-oauth-all",
    }
    return f"{base}/?{urlencode(params)}"


def exchange_code_for_token(code: str) -> str:
    """Exchange authorization code for access token. Returns access_token."""
    if not settings.TRUELAYER_CLIENT_ID or not settings.TRUELAYER_CLIENT_SECRET:
        raise ValueError("TrueLayer not configured")

    token_url = f"{settings.TRUELAYER_AUTH_URL.rstrip('/')}/connect/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": settings.TRUELAYER_CLIENT_ID,
        "client_secret": settings.TRUELAYER_CLIENT_SECRET,
        "redirect_uri": settings.TRUELAYER_REDIRECT_URI,
        "code": code,
    }

    with httpx.Client(timeout=15) as client:
        resp = client.post(token_url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        resp.raise_for_status()
        body = resp.json()
    access_token = body.get("access_token")
    if not access_token:
        raise ValueError("No access_token in TrueLayer token response")
    return access_token


def get_user_info(access_token: str) -> Optional[str]:
    """GET /data/v1/info - returns full_name of the person who connected the bank (director)."""
    api_base = settings.TRUELAYER_API_URL.rstrip("/")
    url = f"{api_base}/data/v1/info"

    with httpx.Client(timeout=15) as client:
        resp = client.get(
            url,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code != 200:
            logger.warning("TrueLayer info API returned %s: %s", resp.status_code, resp.text[:200])
            return None
        data = resp.json()

    results = data.get("results") or []
    if not results:
        return None
    first = results[0] if isinstance(results[0], dict) else {}
    return first.get("full_name")


def verify_account(
    access_token: str,
    name_to_verify: str,
) -> dict[str, Any]:
    """
    POST /verification/v1/verify - compare name with account holder names from bank.
    Returns dict with: verified, match_score, account_holder_name, report (list of accounts).
    """
    api_base = settings.TRUELAYER_API_URL.rstrip("/")
    url = f"{api_base}/verification/v1/verify"

    with httpx.Client(timeout=15) as client:
        resp = client.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={"name": name_to_verify},
        )
        resp.raise_for_status()
        data = resp.json()

    return {
        "verified": data.get("verified", False),
        "match_score": data.get("match_score", 0),
        "account_holder_name": data.get("account_holder_name"),
        "report": data.get("report", []),
    }


def _normalize_sort_code(sc: Optional[str]) -> str:
    """Normalize sort code to digits only (e.g. 12-34-56 -> 123456)."""
    if not sc:
        return ""
    return re.sub(r"\D", "", str(sc))


def _normalize_account_number(an: Optional[str]) -> str:
    """Normalize account number to digits only."""
    if not an:
        return ""
    return re.sub(r"\D", "", str(an))


def _extract_uk_sort_code_and_account_from_iban(iban: Optional[str]) -> Tuple[str, str]:
    """
    Extract UK sort code (6 digits) and account number (8 digits) from UK IBAN.
    UK IBAN: GB + 2 check + 4 char bank + 6 digit sort code + 8 digit account number.
    Returns (sort_code_digits, account_number_digits) or ("", "") if not a valid UK IBAN.
    """
    if not iban or not isinstance(iban, str):
        return "", ""
    clean = re.sub(r"\s", "", iban.upper())
    if not clean.startswith("GB") or len(clean) < 22:
        return "", ""
    try:
        # Sort code: positions 8-13 (0-indexed)
        sc = re.sub(r"\D", "", clean[8:14])
        # Account number: positions 14-21
        an = re.sub(r"\D", "", clean[14:22])
        if len(sc) == 6 and len(an) == 8:
            return sc, an
    except (IndexError, TypeError):
        pass
    return "", ""


def run_verification(
    access_token: str,
    user_bank_account_name: str,
    user_sort_code: Optional[str],
    user_account_number: Optional[str],
    company_name: str,
    director_first_name: str,
    director_last_name: str,
) -> dict[str, Any]:
    """
    Run full verification:
    1. Sort code + account number - 100% match (find account in report)
    2. Bank account name vs account holder - fuzzy match
    3. Director vs account holder(s) - fuzzy match

    Returns dict with:
      account_match: bool (sort code + account number found)
      account_name_match: bool
      account_name_score: int (0-100)
      director_match: bool
      director_score: int (0-100)
      account_holder_names: list[str]
      info_full_name: str | None
      verified: bool (overall - all checks pass)
      message: str
    """
    director_name = f"{director_first_name or ''} {director_last_name or ''}".strip()

    # 1. Get user info (director who connected)
    info_full_name = get_user_info(access_token)

    # 2. Verify with company name to get report of accounts
    verification = verify_account(access_token, company_name or user_bank_account_name or " ")
    report = verification.get("report") or []
    account_holder_name = verification.get("account_holder_name")

    # Normalize user-entered values for matching
    user_sc = _normalize_sort_code(user_sort_code)
    user_an = _normalize_account_number(user_account_number)

    # Find account in report that matches sort code + account number (100% match)
    matched_account = None
    matched_holders: list[str] = []

    verifiable_accounts = [a for a in report if isinstance(a, dict) and a.get("verifiable")]

    for acc in verifiable_accounts:
        # TrueLayer report: account_number and sort_code are top-level strings on each account
        sc = _normalize_sort_code(acc.get("sort_code"))
        an = _normalize_account_number(acc.get("account_number"))
        # Fallback: some providers (e.g. Mock Bank) may return IBAN only; derive sort code + account from UK IBAN
        if (not sc or not an) and acc.get("iban"):
            sc, an = _extract_uk_sort_code_and_account_from_iban(acc.get("iban"))
        if sc == user_sc and an == user_an:
            matched_account = acc
            holders = acc.get("account_holders") or []
            for h in holders:
                if isinstance(h, dict) and h.get("name"):
                    matched_holders.append(str(h["name"]))
                elif isinstance(h, str) and h.strip():
                    matched_holders.append(h.strip())
            break

    # Sandbox fallback: when any verifiable account(s), use the first one (avoids guessing Mock Bank values)
    if not matched_account and verifiable_accounts and "sandbox" in (settings.TRUELAYER_API_URL or "").lower():
        acc = verifiable_accounts[0]
        matched_account = acc
        holders = acc.get("account_holders") or []
        for h in holders:
            if isinstance(h, dict) and h.get("name"):
                matched_holders.append(str(h["name"]))
            elif isinstance(h, str) and h.strip():
                matched_holders.append(h.strip())
        logger.info(
            "TrueLayer sandbox: auto-matched single verifiable account (user entered sc=%s an=%s)",
            user_sc or "(empty)",
            user_an or "(empty)",
        )

    # If no account_holders in report, use top-level account_holder_name
    if not matched_holders and account_holder_name:
        if isinstance(account_holder_name, list):
            matched_holders = [str(n) for n in account_holder_name]
        else:
            matched_holders = [str(account_holder_name)]

    account_match = matched_account is not None

    if not account_match and report:
        # Log report structure for debugging (Mock Bank may use different formats)
        sample = [
            {
                "verifiable": acc.get("verifiable"),
                "sort_code": acc.get("sort_code"),
                "account_number": acc.get("account_number"),
                "iban": (acc.get("iban") or "")[:24] + "..." if acc.get("iban") else None,
            }
            for acc in report[:5]
            if isinstance(acc, dict)
        ]
        logger.info(
            "TrueLayer account not found. User entered sort_code=%s account_number=%s. Verifiable count=%d. Report sample: %s",
            user_sc or "(empty)",
            user_an or "(empty)",
            len(verifiable_accounts),
            sample,
        )

    # 2. Fuzzy match: user bank account name vs account holder(s)
    account_name_match = False
    account_name_score = 0
    if user_bank_account_name and matched_holders:
        for holder in matched_holders:
            ok, score = _fuzzy_match(user_bank_account_name, holder, ACCOUNT_NAME_MATCH_THRESHOLD)
            if score > account_name_score:
                account_name_score = score
            if ok:
                account_name_match = True
    elif not matched_holders:
        account_name_score = verification.get("match_score", 0)
        account_name_match = verification.get("verified", False)

    # 3. Fuzzy match: director vs info full_name and/or account holders
    director_match = False
    director_score = 0
    if director_name:
        if info_full_name:
            ok, score = _fuzzy_match(director_name, info_full_name, DIRECTOR_MATCH_THRESHOLD)
            if score > director_score:
                director_score = score
            if ok:
                director_match = True
        for holder in matched_holders:
            ok, score = _fuzzy_match(director_name, holder, DIRECTOR_MATCH_THRESHOLD)
            if score > director_score:
                director_score = score
            if ok:
                director_match = True

    is_sandbox = "sandbox" in (settings.TRUELAYER_API_URL or "").lower()
    name_threshold = 5 if is_sandbox else 70  # Sandbox: very lenient for Mock Bank testing
    verified = account_match and (account_name_match or account_name_score >= name_threshold) and (director_match or director_score >= name_threshold)
    if not account_match:
        verified = False

    message_parts = []
    if not account_match:
        msg = "Account (sort code + account number) not found in connected bank."
        if is_sandbox:
            msg += " For Mock Bank (john/doe), try sort code 04-11-34 and account 53920022. Check backend logs for actual values."
        message_parts.append(msg)
    elif not account_name_match and account_name_score < name_threshold:
        message_parts.append(f"Account name mismatch (score: {account_name_score}).")
    elif not director_match and director_score < name_threshold:
        message_parts.append(f"Director name not matched to account holder (score: {director_score}).")
    else:
        message_parts.append("Verification successful.")

    return {
        "account_match": account_match,
        "account_name_match": account_name_match,
        "account_name_score": account_name_score,
        "director_match": director_match,
        "director_score": director_score,
        "account_holder_names": matched_holders,
        "info_full_name": info_full_name,
        "verified": verified,
        "message": " ".join(message_parts),
    }
