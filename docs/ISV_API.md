# Path Boarding API – ISV developer guide

This is the **external API** for third-party developers. It lets an ISV (e.g. Order Champ) generate merchant boarding links and hand merchants off to the Path Boarding Site.

**Purpose:** So the third-party ISV can **consume and embed** the API in their own website, ISV software, and sales flows (e.g. “Onboard merchant” in their CRM or checkout). The ISV’s backend calls this API; the merchant then completes onboarding on the Path-hosted boarding site.

**Registration first:** Third-party developers must **register as a partner** before they can call the API. There is no public, unauthenticated access. After registration, the partner uses login to obtain a token and then calls the invite endpoint from their systems. This keeps usage attributable and allows Path to manage partners (e.g. rate limits, support, compliance).

**API tester:** A simple web page is available so ISVs can try the APIs in one place: register, login, and generate a boarding link. In production this is hosted at **boardingapi.path2ai.tech** (or your deployed URL). From there you can also open Swagger and ReDoc.

---

## Base URL

- **Production**: `https://your-path-boarding-api.example.com` (replace with your deployed API URL)
- **Local / staging**: `http://localhost:8000`

All paths below are relative to the base URL.

---

## Flow (high level)

1. **Register** as a partner (one-time per ISV; required before using the API).
2. **Authenticate** – login to get an access token.
3. **Request a boarding link** – `POST /partners/boarding/invite` with optional merchant details.
4. **Use the link** in your flows – return `invite_url` to your backend or UI; send it to the merchant (email, in-app, CRM, etc.).
5. **Merchant** opens the link and completes onboarding on the Path Boarding Site. No further API calls from the ISV for the merchant journey.

---

## 1. Partner registration (required – one-time per ISV)

Third-party developers must register first. Create your partner account once (or when onboarding a new ISV tenant). Without this, you cannot call the invite or other partner endpoints.

**Request**

```http
POST /auth/partner/register
Content-Type: application/json

{
  "name": "Order Champ",
  "email": "api@orderchamp.com",
  "password": "your-secure-password"
}
```

**Response** `200 OK`

```json
{
  "id": "uuid",
  "name": "Order Champ",
  "email": "api@orderchamp.com",
  "is_active": true
}
```

- **409 / 400** – Email already registered or validation error.

---

## 2. Partner login (get access token)

Call this whenever you need to create new boarding links (e.g. on each request, or after token expiry).

**Request**

```http
POST /auth/partner/login
Content-Type: application/json

{
  "email": "api@orderchamp.com",
  "password": "your-secure-password"
}
```

**Response** `200 OK`

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

- Use `access_token` in the `Authorization` header for all partner-only endpoints.
- **401** – Invalid email or password.

---

## 3. Create a merchant boarding link

Creates a new boarding journey and returns a unique URL to send to the merchant. The link expires after a set period (e.g. 3 days) or when boarding is completed.

**Request**

```http
POST /partners/boarding/invite
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "merchant@example.com",
  "merchant_name": "Acme Ltd"
}
```

- **email** (optional) – Merchant email; can be used for prefill or display.
- **merchant_name** (optional) – Merchant business name; can be shown on the Path Boarding Site.

**Response** `200 OK`

```json
{
  "invite_url": "https://boarding.path.example.com/board/abc123...",
  "expires_at": "2025-02-02T12:00:00",
  "boarding_event_id": "uuid",
  "token": "abc123..."
}
```

- **invite_url** – Send this to the merchant. They open it in a browser to start onboarding.
- **expires_at** – Link validity; after this (or when boarding is complete), the page is effectively torn down.
- **401** – Missing or invalid Bearer token.

**Example (curl)**

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:8000/auth/partner/login \
  -H "Content-Type: application/json" \
  -d '{"email":"api@orderchamp.com","password":"your-password"}' \
  | jq -r '.access_token')

# 2. Create invite
curl -X POST http://localhost:8000/partners/boarding/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"merchant_name":"Acme Ltd","email":"merchant@example.com"}'
```

---

## 4. Embedding in your website and sales flows

The API is designed so you can **embed consumption** in your own systems:

- **Website / ISV software** – e.g. “Onboard this merchant” in your dashboard; your backend calls `POST /partners/boarding/invite`, then you show or email the `invite_url` to the merchant.
- **Sales flows** – e.g. after a deal is signed, your CRM or billing flow calls the API to create a boarding link and sends it to the new merchant.
- **Self-serve** – your customer clicks “Start onboarding”; your backend creates a link and redirects them (or emails the link).

You do **not** expose Path credentials in the browser. Your backend (or a secure server-to-server integration) holds partner credentials, logs in, and calls the invite endpoint. Your frontend only talks to your backend.

---

## 5. Integration patterns

- **Server-side (recommended)**  
  Your backend holds partner credentials. When a merchant needs to be onboarded, your backend calls `POST /auth/partner/login` (if needed) then `POST /partners/boarding/invite`, and returns `invite_url` to your frontend or sends it by email.

- **From your frontend**  
  Your frontend calls your own backend; your backend calls the Path API (so the Path API token is never exposed in the browser).

- **Link lifetime**  
  Each link is tied to one boarding journey. Use a new invite for each new merchant. Do not reuse links.

---

## 6. Error handling

- **401 Unauthorized** – Invalid or expired token; login again.
- **403 Forbidden** – Partner account inactive.
- **422 Unprocessable Entity** – Validation error on request body; check the response for field-level details.

---

## 7. OpenAPI (Swagger) docs

When the API is running, interactive docs are available at:

- **Swagger UI**: `{BASE_URL}/docs`
- **ReDoc**: `{BASE_URL}/redoc`

Use these to explore request/response schemas and try requests from the browser.
