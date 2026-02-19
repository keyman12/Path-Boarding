# DocuSign E-Signature Integration Plan

Integration of DocuSign embedded signing into the Path Boarding flow, using the Path-python demo material as reference.

---

## Current Flow (to be modified)

1. User clicks **Review & Submit**
2. Backend generates PDF → stores path → marks completed → sends completion email → returns success
3. Frontend shows **done** page (portal)

---

## New Flow (with DocuSign)

1. User clicks **Review & Submit**
2. Backend generates PDF (unchanged)
3. **NEW:** Backend creates DocuSign envelope with the PDF, gets embedded signing URL
4. Backend stores PDF path and **envelope_id** (does NOT mark completed yet)
5. Backend returns `{ redirect_to_signing: true, signing_url: "..." }`
6. Frontend redirects user to DocuSign signing page
7. User signs in DocuSign
8. DocuSign redirects to our **return URL** (e.g. `/board/[token]/signing-complete`)
9. Backend: mark completed, send completion email, optionally download & store signed PDF
10. Frontend shows **done** page

---

## Configuration (from ds_config.py)

**Move to backend `.env` (never commit secrets):**

| Env var | From ds_config | Purpose |
|---------|----------------|---------|
| `DOCUSIGN_INTEGRATION_KEY` | ds_client_id | Integration key |
| `DOCUSIGN_USER_ID` | ds_impersonated_user_id | User ID for JWT |
| `DOCUSIGN_ACCOUNT_ID` | (from JWT userinfo) | Target account |
| `DOCUSIGN_PRIVATE_KEY` | private.key contents | RSA private key (or path) |
| `DOCUSIGN_AUTH_SERVER` | account-d.docusign.com | Demo: account-d, Prod: account |

**DocuSign Developer Console:**
- Add redirect URI: `https://boarding.path2ai.tech/board/[token]/signing-complete` (or a generic callback that accepts token as query param)
- DocuSign requires one redirect URI per app; we may need: `https://boarding.path2ai.tech/boarding/docusign-callback` and pass token in state

---

## Implementation Components

### 1. Backend: DocuSign Service

**New file:** `backend/app/services/docusign_signing.py`

- `get_jwt_token()` – JWT auth (from jwt_helper.py)
- `create_envelope(pdf_path, signer_email, signer_name, return_url)` – create envelope, return envelope_id
- `get_recipient_view_url(envelope_id, signer_email, signer_name, return_url)` – get embedded signing URL
- Uses `docusign-esign` Python SDK

### 2. PDF Anchor for Sign Tab

**Modify:** `backend/app/services/agreement_pdf.py`

- Replace `"[E-signature will be integrated here]"` with anchor text `"/sn1/"` so DocuSign can place the SignHere tab
- Or use coordinate-based tab (x, y) if anchor is unreliable

### 3. Submit-Review Flow Change

**Modify:** `backend/app/routers/boarding.py` – `submit_review()`

**Current:** Generate PDF → save → complete → email → return success

**New:**
1. Generate PDF, save path
2. Create DocuSign envelope with PDF
3. Store `envelope_id` on merchant or boarding_event (new column)
4. Get signing URL
5. Return `{ success: true, redirect_to_signing: true, signing_url: "..." }` (new response shape)
6. Do NOT mark completed, do NOT send email yet

### 4. Signing Callback Endpoint

**New:** `GET /boarding/signing-complete?token=...&event=signing_complete`

- DocuSign redirects here with `?event=signing_complete` (configurable)
- Verify envelope is completed (optional: call DocuSign API to confirm)
- Mark boarding completed, send completion email
- Redirect user to `/board/[token]` (done page)

### 5. Database

**New column (optional):** `merchant.docusign_envelope_id` or `boarding_event.docusign_envelope_id` – store envelope ID for reference and to download signed doc later.

### 6. Frontend

**Modify:** Review & Submit button handler

- If response has `signing_url`, redirect: `window.location.href = res.data.signing_url`
- If no signing (fallback/error), show done page as today

**New page:** `/board/[token]/signing-complete` – or handle via redirect from backend callback

---

## Emails

**Option A – DocuSign sends:** DocuSign automatically emails the signer when envelope is completed. We could skip our completion email or send a shorter “you’re all set” with portal link.

**Option B – We send after callback:** When user returns from DocuSign, we send our completion email. We can attach the **unsigned** PDF (we have it) or **signed** PDF (requires downloading from DocuSign).

**Option C – Both:** DocuSign sends its standard completion email. We also send ours with portal link. Redundant but ensures they get our branded email.

**Recommendation:** Option B or C. Send our completion email when they hit the callback. Attach the unsigned PDF for now (simpler). Later: add webhook to download signed PDF and attach that.

---

## Storing the Signed Document

**DocuSign Connect (webhook):** Configure webhook to receive `envelope-completed` event. When received:
1. Call DocuSign API to download completed document
2. Store in `uploads/agreements/signed-{merchant_id}-{envelope_id}.pdf`
3. Update `merchant.signed_agreement_pdf_path`

**Simpler approach:** When user hits return URL, call DocuSign API to get document list, download the signed PDF, store it. No webhook needed for MVP.

---

## Security Notes

1. **Never commit:** `ds_config.py`, `private.key`, or any file with secrets
2. **Add to .gitignore:** `Docusign/Path-python/app/ds_config.py`, `Docusign/Path-python/app/private.key`
3. **Use env vars** for production: `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_PRIVATE_KEY`, etc.
4. **Return URL validation:** DocuSign validates redirect URI. Add `https://boarding.path2ai.tech/boarding/docusign-callback` in DocuSign console. Use `state` param to pass token so we know which boarding to complete.

---

## Dependencies

Add to `backend/requirements.txt`:
```
docusign-esign>=5.4.0
```

We do **not** need Flask, Flask-OAuthlib, etc. from the Path-python demo – we use JWT only.

---

## DocuSign Redirect URI

DocuSign allows multiple redirect URIs. For embedded signing return:
- Local: `http://localhost:3000/board/TOKEN_PLACEHOLDER/signing-complete` – DocuSign may not support dynamic URLs
- Standard approach: Use one callback URL like `https://boarding.path2ai.tech/boarding/docusign-callback` and pass `state=token` so we know which boarding to complete.

---

## Questions Before Implementation

1. **Redirect URI:** Can we use a single callback URL with `state` for the token, or do you need a different pattern?
2. **Signed PDF:** Do you want to store the signed PDF in our system (requires download from DocuSign), or is DocuSign’s copy sufficient?
3. **Email:** Prefer our completion email only, DocuSign’s only, or both?
4. **Demo vs Production:** The ds_config uses `account-d.docusign.com` (demo). For production we’ll need `account.docusign.com`. Should we support both via env?
5. **Consent:** JWT requires one-time admin consent in DocuSign. Have you already run the consent flow? (Open the consent URL, log in, Accept.)

---

## Suggested Implementation Order

1. ✅ Add `docusign-esign` to backend, create `docusign_signing.py` service with JWT + create envelope + get view URL
2. ✅ Add anchor `/sn1/` to agreement PDF
3. ✅ Add env vars for DocuSign config
4. ✅ Modify submit-review to create envelope and return signing_url
5. ✅ Add callback endpoint and complete flow
6. ✅ Frontend: redirect to signing_url when returned
7. ✅ Download signed PDF from DocuSign on callback, attach to completion email

---

## Implementation Complete (2026-01-30)

### What was built

- **`backend/app/services/docusign_signing.py`** – JWT auth, create envelope, get signing URL, download completed document
- **`backend/app/services/agreement_pdf.py`** – Added `/sn1/` anchor for SignHere tab
- **`backend/app/routers/boarding.py`** – Submit-review creates envelope when DocuSign configured; new `GET /boarding/docusign-callback`
- **`backend/app/models/merchant.py`** – Added `docusign_envelope_id`
- **Frontend** – Redirects to `signing_url` when `redirect_to_signing` is true

### Setup checklist

1. **Run migration:** `alembic upgrade head` (adds `docusign_envelope_id` to merchants)
2. **Install deps:** `pip install docusign-esign>=5.4.0`
3. **Add to `.env`** (from `Docusign/Path-python/app/ds_config.py` and `app/private.key`):
   - `DOCUSIGN_INTEGRATION_KEY`
   - `DOCUSIGN_USER_ID`
   - `DOCUSIGN_ACCOUNT_ID` (optional; fetched from userinfo if not set)
   - `DOCUSIGN_PRIVATE_KEY` (full RSA key or path to `private.key`)
   - `DOCUSIGN_RETURN_URL_BASE=http://localhost:8000` (or your backend URL)
4. **DocuSign Apps and Keys** – Add redirect URI: `http://localhost:8000/boarding/docusign-callback` (and production URL when deployed)
5. **JWT consent** – One-time; open consent URL in browser and Accept (see earlier in this doc)

### Date format (dd/mm/yyyy – UK format)

The DateSigned tab format **cannot be set via API**; it is controlled by DocuSign account settings. To show dates as 19/02/2026 (dd/mm/yyyy) instead of 2/19/2026 (mm/dd/yyyy):

1. Log in to **DocuSign Admin** (admindemo.docusign.com for demo, admin.docusign.com for production)
2. Go to **Settings** → **Signing and Sending** → **Document Formatting**
3. Set **Date format** to **DD/MM/YYYY**
4. Save

This applies to all DateSigned tabs in envelopes sent from that account.
