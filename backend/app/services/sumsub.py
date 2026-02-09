"""SumSub identity verification service."""
import hashlib
import hmac
import time
from typing import Dict, Any, Optional

import httpx

from app.core.config import settings


def _generate_signature(
    secret_key: str,
    method: str,
    path: str,
    timestamp: int,
    body: bytes = b""
) -> str:
    """
    Generate HMAC SHA256 signature for SumSub API requests.
    
    Args:
        secret_key: SumSub secret key
        method: HTTP method (GET, POST, etc.)
        path: Request path including query params
        timestamp: Unix timestamp in seconds
        body: Request body as bytes
    
    Returns:
        Hex signature (lowercase)
    """
    message = f"{timestamp}{method.upper()}{path}".encode() + body
    signature = hmac.new(
        secret_key.encode(),
        message,
        hashlib.sha256
    ).hexdigest()
    return signature


def _get_headers(method: str, path: str, body: bytes = b"") -> Dict[str, str]:
    """
    Generate headers for SumSub API requests.
    
    Args:
        method: HTTP method
        path: Request path including query params
        body: Request body as bytes
    
    Returns:
        Dictionary of headers
    """
    timestamp = int(time.time())
    signature = _generate_signature(
        settings.SUMSUB_SECRET_KEY,
        method,
        path,
        timestamp,
        body
    )
    
    return {
        "X-App-Token": settings.SUMSUB_APP_TOKEN,
        "X-App-Access-Sig": signature,
        "X-App-Access-Ts": str(timestamp),
        "Content-Type": "application/json"
    }


async def generate_access_token(
    user_id: str,
    level_name: Optional[str] = None,
    ttl_seconds: int = 600
) -> Dict[str, Any]:
    """
    Generate a SumSub access token for an applicant.
    
    Args:
        user_id: Unique identifier for the user (e.g. boarding_event_id)
        level_name: SumSub verification level (defaults to SUMSUB_LEVEL_NAME)
        ttl_seconds: Token time-to-live in seconds (default 600 = 10 minutes)
    
    Returns:
        Dict with 'token' and 'userId' fields
    
    Raises:
        httpx.HTTPError: If the request fails
    """
    from urllib.parse import urlencode
    
    level = level_name or settings.SUMSUB_LEVEL_NAME
    
    # Build query parameters - all params go in the query string, not body
    params = {
        "userId": user_id,
        "levelName": level,
        "ttlInSecs": str(ttl_seconds)
    }
    query_string = urlencode(params)
    path = f"/resources/accessTokens?{query_string}"
    
    # No body for this endpoint
    headers = _get_headers("POST", path, b"")
    url = f"{settings.SUMSUB_BASE_URL}{path}"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        # Log the response for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"SumSub API error: {e.response.status_code} - {e.response.text}")
        raise
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"SumSub request failed: {str(e)}")
        raise


async def get_applicant_status(user_id: str) -> Dict[str, Any]:
    """
    Get the verification status of an applicant.
    
    Args:
        user_id: Unique identifier for the user
    
    Returns:
        Dict with applicant status information
    
    Raises:
        httpx.HTTPError: If the request fails
    """
    path = f"/resources/applicants/-;userId={user_id}/one"
    headers = _get_headers("GET", path)
    url = settings.SUMSUB_BASE_URL + path
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
