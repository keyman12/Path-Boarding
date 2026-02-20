# TrueLayer Bank Account Verification – Integration Plan

**Status: Implemented.** See `backend/app/services/truelayer_verification.py` and `backend/app/routers/boarding.py`.

Integration of TrueLayer for bank account verification in the Path Boarding flow. Goals:
1. **Fuzzy match** company name to bank account holder name
2. **Check control** – verify account holder(s) align with director name(s)

---

## TrueLayer APIs Overview

### 1. Verification API (`/verification/v1/verify`)

**Purpose:** Compare a name you provide against the account holder name(s) returned by the bank.

**Flow:** User must connect their bank first via the Data API auth flow. You then POST with a name; TrueLayer returns which accounts match and a confidence score.

| Input | Output |
|-------|--------|
| `name` (string) – e.g. company name or director name | `verified` (bool), `match_score` (0–100), `account_holder_name` (array for joint accounts), `report` with per-account details |

**Report structure (per account):**
- `account_holders`: `[{ name, verified, match_score }]`
- `sort_code`, `account_number`, `iban`
- `display_name` (account nickname from bank)
- `verifiable` (true for CURRENT/SAVINGS with sort code or IBAN)

**Requires:** `verification` scope in auth link (contact TrueLayer to enable in production; enabled in sandbox by default).

---

### 2. Data API – Accounts (`GET /data/v1/accounts`)

**Purpose:** List connected accounts (sort code, account number, display name, currency, type).

**Does NOT return** account holder name. Use `/info` or Verification API for that.

---

### 3. Data API – User Info (`GET /data/v1/info`)

**Purpose:** Identity of the person who connected the bank.

**Returns:** `full_name` (and rarely emails/phones). This is the **connected user** – typically the director who is authenticating.

**Use case:** Compare `full_name` with director name (e.g. `legal_first_name` + `legal_last_name`).

---

### 4. Account Holder Verification API (v3 – Payouts)

**Purpose:** Verify a name against a specific account (sort code + account number or IBAN) for payout flows.

**Input:** Account identifiers + account holder name.  
**Output:** `match`, `partial_match`, `no_match`, or `match_not_possible`.

**Note:** This is for payout verification (e.g. before sending money). It may require a different product/scope. Check with TrueLayer if you want to verify **without** the user connecting their bank (i.e. server-side only with user-entered details).

---

## Recommended Flow: Connect Bank After Step 6

### User Journey

1. User completes **Step 6** (Bank Details): account name, sort code, account number (UK) or IBAN.
2. User clicks **"Verify with my bank"** (or similar).
3. Redirect to **TrueLayer auth link** (auth dialog).
4. User selects bank, authenticates, consents.
5. TrueLayer redirects to our callback with `code`.
6. Backend exchanges `code` for `access_token`.
7. Backend calls Verification API and/or Data API.
8. Backend performs checks and stores verification result.
9. User returns to boarding flow (step6 or review).

### Backend Checks

| Check | Data source | Method |
|-------|------------|--------|
| **Company name ↔ account holder** | Verification API `account_holder_name` | POST `/verification/v1/verify` with `name = company_name`; get `match_score`; optionally fuzzy-match (e.g. "ACME LTD" vs "ACME LIMITED") |
| **Director ↔ account controller** | Data API `/info` `full_name` | Compare with `legal_first_name` + `legal_last_name`; fuzzy match (e.g. "John Smith" vs "J SMITH") |
| **Account match** | Verification API `report` | Find account in report where `sort_code` + `account_number` match user-entered values |

### Fuzzy Matching

TrueLayer’s Verification API returns `match_score` (0–100). For extra control:

- Normalize: uppercase, strip punctuation, expand "LTD" ↔ "LIMITED", "&" ↔ "AND".
- Use a library (e.g. `rapidfuzz`, `fuzzywuzzy`) for similarity.
- Define thresholds: e.g. `match_score >= 80` or similarity >= 0.85.

---

## Implementation Components

### 1. Config & Env

Add to `backend/.env` and `config.py`:

```
TRUELAYER_CLIENT_ID=
TRUELAYER_CLIENT_SECRET=
TRUELAYER_REDIRECT_URI=https://boarding.path2ai.tech/boarding/truelayer-callback
# Sandbox: https://auth.truelayer-sandbox.com, https://api.truelayer-sandbox.com
# Live: https://auth.truelayer.com, https://api.truelayer.com
TRUELAYER_AUTH_URL=https://auth.truelayer-sandbox.com
TRUELAYER_API_URL=https://api.truelayer-sandbox.com
```

**Console:** Add redirect URI `https://boarding.path2ai.tech/boarding/truelayer-callback` (and localhost for dev).

---

### 2. Auth Link Generation

**Endpoint:** `GET /boarding/truelayer-auth-url?token={invite_token}`

**Logic:**
- Build auth URL with `client_id`, `redirect_uri`, `scope=info accounts verification` (or `info accounts` if verification not yet enabled).
- `state = token` (or `token|nonce`) to resume session.
- Return `{ auth_url: "..." }`.

**Auth URL format:**
```
https://auth.truelayer-sandbox.com/connect/authorize
  ?response_type=code
  &client_id={TRUELAYER_CLIENT_ID}
  &redirect_uri={TRUELAYER_REDIRECT_URI}
  &scope=info%20accounts%20verification
  &state={token}
  &providers=uk-cs-mock
```

Sandbox: `providers=uk-cs-mock` for Mock Bank. Live: `uk-ob-all` or specific providers.

---

### 3. Callback Endpoint

**Endpoint:** `GET /boarding/truelayer-callback?code=...&state={token}`

**Logic:**
1. Validate `state` = invite token; load contact/merchant.
2. Exchange `code` for `access_token` (POST to token URL with `client_id`, `client_secret`, `redirect_uri`, `code`).
3. Call `GET /data/v1/info` → `full_name` (director check).
4. Call `POST /verification/v1/verify` with `name = company_name` → `report`, `account_holder_name`, `match_score`.
5. Find account in `report` where `sort_code` + `account_number` match stored bank details.
6. Run fuzzy match: company vs `account_holder_name`; director vs `full_name`.
7. Store result (e.g. `truelayer_verified_at`, `truelayer_match_score`, `truelayer_account_holder`).
8. Redirect to frontend: `/board/{token}?step=step6&verified=1` or similar.

---

### 4. Database

Add to `boarding_contact` (or new table):

| Column | Type | Purpose |
|--------|------|---------|
| `truelayer_verified_at` | datetime | When verification completed |
| `truelayer_match_score` | int | Company name match score (0–100) |
| `truelayer_account_holder` | string | Bank-returned account holder name |
| `truelayer_director_match` | bool | Director name matched `/info` full_name |

---

### 5. Frontend Changes

**Step 6 (Bank Details):**
- Add button: **"Verify with my bank"** after user enters details.
- On click: call `GET /boarding/truelayer-auth-url?token=...` → redirect to `auth_url`.
- After callback: show success/warning (e.g. "Account verified" or "Name mismatch – please confirm").

**Optional:** Block "Continue" until verified, or allow continue with a warning.

---

## Scopes Summary

| Scope | Purpose |
|-------|---------|
| `info` | `/data/v1/info` – director `full_name` |
| `accounts` | `/data/v1/accounts` – account list (sort code, number) |
| `verification` | `/verification/v1/verify` – name vs account holder |

Request: `scope=info accounts verification`

---

## Sandbox Notes

- Use **Mock Bank** (`uk-cs-mock`) in sandbox. Log in with **john** / **doe**.
- Auth URL: `https://auth.truelayer-sandbox.com`
- API base: `https://api.truelayer-sandbox.com`
- Verification API: `https://api.truelayer-sandbox.com/verification/v1/verify`

### Mock Bank – Account Details for Step 6

The sort code and account number you enter in Step 6 must match what the Mock Bank returns. Try these test values (format is flexible, e.g. `04-11-34` or `041134`):

- **Sort code:** `04-11-34` (or `041134`)
- **Account number:** `53920022`

If you get "Account not found", check the backend logs – they show the actual `sort_code` and `account_number` from the report so you can enter matching values.

### TrueLayer auth page hanging on "Connecting..."

If the TrueLayer auth page loads but hangs on "Connecting..." when selecting Mock Bank:
- Try an **incognito/private window** (extensions can block bank connections)
- Try a **different browser**
- Check [TrueLayer status](https://status.truelayer.com/) for sandbox issues

---

## Limitations & Considerations

1. **Verification scope:** May need TrueLayer to enable `verification` in production.
2. **Account holder for business accounts:** Some banks return company name, others a person. Behaviour varies by provider.
3. **Joint accounts:** `account_holder_name` can be an array; check if any holder matches company or director.
4. **IBAN-only accounts:** Verification API supports IBAN; ensure we pass the right identifier when matching.
5. **No-connect path:** Account Holder Verification (v3) might support server-side verification without user connecting; confirm with TrueLayer if that’s required.

---

## Implementation Order

1. Add env vars and config.
2. Implement auth URL endpoint.
3. Implement callback: token exchange, `/info`, `/verification/v1/verify`.
4. Add DB columns and migration.
5. Add "Verify with my bank" button and redirect flow.
6. Implement fuzzy matching and thresholds.
7. Add UI feedback (verified / mismatch).

---

## References

- [Verify an account](https://docs.truelayer.com/docs/verify-an-account)
- [Account holder verification](https://docs.truelayer.com/docs/account-holder-verification-1)
- [Build a Data auth link](https://docs.truelayer.com/docs/build-data-auth-links)
- [Generate an auth link](https://docs.truelayer.com/docs/generate-an-auth-link)
- [Get accounts](https://docs.truelayer.com/reference/getaccounts)
- [User info](https://docs.truelayer.com/reference/getinfo)
- [Scopes](https://docs.truelayer.com/docs/scopes)
