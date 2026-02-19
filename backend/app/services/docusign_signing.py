"""
DocuSign embedded signing service using JWT authentication.
Creates envelopes, gets signing URLs, and downloads completed documents.
"""
import base64
import logging
import os
from pathlib import Path

from docusign_esign import (
    ApiClient,
    DateSigned,
    EnvelopeDefinition,
    EnvelopesApi,
    Document,
    Signer,
    SignHere,
    Tabs,
    Recipients,
    RecipientViewRequest,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

# Scopes for eSignature
SCOPES = ["signature", "impersonation"]

# Embedded signing client user ID (identifies signer in our app)
SIGNER_CLIENT_ID = "1000"


def _get_private_key() -> bytes:
    """Load RSA private key from env (contents or file path)."""
    key = (settings.DOCUSIGN_PRIVATE_KEY or "").strip()
    if not key:
        raise ValueError("DOCUSIGN_PRIVATE_KEY not configured")
    # If it looks like a path, load from file
    if "\n" not in key and len(key) < 200 and os.path.isfile(key):
        with open(key, "r") as f:
            return f.read().encode("ascii")
    return key.encode("ascii")


def _get_access_token() -> str:
    """Obtain JWT access token for DocuSign API."""
    from docusign_esign.client.api_exception import ApiException

    api_client = ApiClient()
    api_client.set_base_path(settings.DOCUSIGN_AUTH_SERVER)
    private_key = _get_private_key()
    try:
        response = api_client.request_jwt_user_token(
            client_id=settings.DOCUSIGN_INTEGRATION_KEY,
            user_id=settings.DOCUSIGN_USER_ID,
            oauth_host_name=settings.DOCUSIGN_AUTH_SERVER,
            private_key_bytes=private_key,
            expires_in=4000,
            scopes=SCOPES,
        )
        return response.access_token
    except ApiException as e:
        body = e.body.decode("utf-8") if e.body else str(e)
        if "consent_required" in body:
            raise ValueError(
                "DocuSign JWT consent required. Open the consent URL in your browser, "
                "log in, and click ACCEPT. See docs/DOCUSIGN_INTEGRATION_PLAN.md"
            ) from e
        raise


def _get_api_client() -> ApiClient:
    """Create DocuSign API client with JWT token."""
    token = _get_access_token()
    api_client = ApiClient()
    base = settings.DOCUSIGN_BASE_PATH.rstrip("/")
    if not base.startswith("http"):
        base = f"https://{base}"
    api_client.host = f"{base}/restapi"
    api_client.set_default_header("Authorization", f"Bearer {token}")
    return api_client


def _get_account_id() -> str:
    """Get DocuSign account ID from settings or userinfo API."""
    if settings.DOCUSIGN_ACCOUNT_ID:
        return settings.DOCUSIGN_ACCOUNT_ID
    import httpx

    token = _get_access_token()
    auth_server = settings.DOCUSIGN_AUTH_SERVER
    url = f"https://{auth_server}/oauth/userinfo"
    resp = httpx.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    accounts = data.get("accounts", [])
    if not accounts:
        raise ValueError("No DocuSign accounts found for user. Set DOCUSIGN_ACCOUNT_ID in .env.")
    # Prefer default account
    for acc in accounts:
        if acc.get("is_default"):
            return acc["account_id"]
    return accounts[0]["account_id"]


def create_envelope_and_get_signing_url(
    pdf_path: str,
    signer_email: str,
    signer_name: str,
    return_url: str,
    services_agreement_path: str | None = None,
) -> tuple[str, str]:
    """
    Create a DocuSign envelope with the Path Agreement (and optionally Services Agreement).
    Returns (envelope_id, signing_url).
    Uses anchors /sn1/, [Date] for Path Agreement; /sn2/, [Date2] for Services Agreement.
    """
    if not settings.DOCUSIGN_INTEGRATION_KEY or not settings.DOCUSIGN_USER_ID:
        raise ValueError("DocuSign not configured (DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID)")

    documents = []
    with open(pdf_path, "rb") as f:
        doc1_bytes = base64.b64encode(f.read()).decode("ascii")
    documents.append(
        Document(
            document_base64=doc1_bytes,
            name="Path Merchant Agreement",
            file_extension="pdf",
            document_id="1",
        )
    )

    # Add Services Agreement with signature block if available
    services_pdf_path = None
    if services_agreement_path and os.path.isfile(services_agreement_path):
        import tempfile
        from app.services.agreement_pdf import add_signature_block_to_services_agreement

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            services_pdf_path = tmp.name
        try:
            add_signature_block_to_services_agreement(
                source_path=services_agreement_path,
                output_path=services_pdf_path,
                applicant_name=signer_name,
            )
            with open(services_pdf_path, "rb") as f:
                doc2_bytes = base64.b64encode(f.read()).decode("ascii")
            documents.append(
                Document(
                    document_base64=doc2_bytes,
                    name="Services Agreement",
                    file_extension="pdf",
                    document_id="2",
                )
            )
        finally:
            if services_pdf_path and os.path.isfile(services_pdf_path):
                try:
                    os.unlink(services_pdf_path)
                except OSError:
                    pass

    signer = Signer(
        email=signer_email,
        name=signer_name,
        recipient_id="1",
        routing_order="1",
        client_user_id=SIGNER_CLIENT_ID,
    )

    # Path Agreement: /sn1/, [Date]
    sign_here_tabs = [
        SignHere(
            anchor_string="/sn1/",
            anchor_units="pixels",
            anchor_y_offset="10",
            anchor_x_offset="0",
        ),
    ]
    date_signed_tabs = [
        DateSigned(
            anchor_string="[Date]",
            anchor_units="pixels",
            anchor_y_offset="0",
            anchor_x_offset="0",
        ),
    ]
    if len(documents) > 1:
        # Services Agreement: /sn2/, [Date2]
        sign_here_tabs.append(
            SignHere(
                anchor_string="/sn2/",
                anchor_units="pixels",
                anchor_y_offset="10",
                anchor_x_offset="0",
            )
        )
        date_signed_tabs.append(
            DateSigned(
                anchor_string="[Date2]",
                anchor_units="pixels",
                anchor_y_offset="0",
                anchor_x_offset="0",
            )
        )

    signer.tabs = Tabs(
        sign_here_tabs=sign_here_tabs,
        date_signed_tabs=date_signed_tabs,
    )

    envelope_definition = EnvelopeDefinition(
        email_subject="Please sign your Path Merchant Agreement",
        documents=documents,
        recipients=Recipients(signers=[signer]),
        status="sent",
    )

    api_client = _get_api_client()
    account_id = _get_account_id()
    envelope_api = EnvelopesApi(api_client)

    envelope = envelope_api.create_envelope(
        account_id=account_id,
        envelope_definition=envelope_definition,
    )
    envelope_id = envelope.envelope_id

    recipient_view_request = RecipientViewRequest(
        authentication_method="none",
        client_user_id=SIGNER_CLIENT_ID,
        recipient_id="1",
        return_url=return_url,
        user_name=signer_name,
        email=signer_email,
    )

    view_result = envelope_api.create_recipient_view(
        account_id=account_id,
        envelope_id=envelope_id,
        recipient_view_request=recipient_view_request,
    )
    signing_url = view_result.url

    return envelope_id, signing_url


def download_completed_document(envelope_id: str, output_path: str) -> bool:
    """
    Download the completed document from a DocuSign envelope.
    Uses document_id='combined' to get all signed docs + CoC in one PDF.
    Returns True if successful.
    """
    api_client = _get_api_client()
    account_id = _get_account_id()
    envelope_api = EnvelopesApi(api_client)

    doc_bytes = envelope_api.get_document(
        account_id=account_id,
        envelope_id=envelope_id,
        document_id="combined",
    )

    # SDK may return bytes or file-like; handle both
    if hasattr(doc_bytes, "read"):
        data = doc_bytes.read()
    else:
        data = doc_bytes

    with open(output_path, "wb") as f:
        f.write(data)

    logger.info("Downloaded signed document to %s", output_path)
    return True
