# Email verification setup (Step 3 onwards)

This guide walks you through setting up the **verification email** (Path2ai.tech), **SMTP**, and the **6-digit code** flow.

---

## Step 3: What the verification email is

When a merchant completes “Let’s get started” (email + password), the backend:

1. Saves their details and creates a **6-digit verification code** (valid 15 minutes).
2. Sends **one email** to the address they entered.

**The email:**

- **From:** `Path Boarding <noreply@path2ai.tech>` (or whatever you set in `.env`)
- **Subject:** `Your verification code - Path Boarding`
- **Content:**
  - Path logo (image loaded from a URL you control)
  - Short text: “You started signing up for Path Boarding. Click the link below to verify your email address and continue.”
  - A green **“Verify my email”** button
  - Note that the link expires in 24 hours
  - “Path2ai.tech” at the bottom

**The link in the email** looks like:

```text
https://your-frontend-domain.com/board/INVITE_TOKEN/verify?token=VERIFY_TOKEN
```

- `INVITE_TOKEN` = the boarding invite (from the original link the partner sent).
- `VERIFY_TOKEN` = a one-time token for that email.

So the email **must come from your domain (Path2ai.tech)** and the **link must point to where your frontend is actually hosted** (e.g. `https://app.path2ai.tech` or your Fasthosts site). That’s why we set SMTP and `FRONTEND_BASE_URL` below.

---

## Step 4: SMTP – where the email is sent from

The backend sends the verification email using **SMTP**. You need:

- An **SMTP server** that can send as `noreply@path2ai.tech` (or similar @path2ai.tech).
- **Host, port, username, password** for that server.

You have two practical options: **Fasthosts** (your host) or **WP Mail SMTP Pro** (WordPress). Use one of them and put the same details into the backend `.env`.

---

### Option A: Fasthosts SMTP

Fasthosts lets you send mail for your domain (e.g. path2ai.tech). You use an **email account** (e.g. `noreply@path2ai.tech`) and its password as the SMTP password.

1. **Log in to Fasthosts**
   - Go to [Fasthosts](https://www.fasthosts.co.uk) and sign in.

2. **Create or choose an email account for sending**
   - In the control panel, open **Email** (or **Email & Office**).
   - Select the domain **path2ai.tech**.
   - Create a new mailbox, e.g.:
     - **Address:** `noreply`
     - **Domain:** path2ai.tech  
     → so the full address is `noreply@path2ai.tech`.
   - Set a **password** for this mailbox (you’ll use it as `SMTP_PASSWORD`).
   - If you already have an address you want to use (e.g. `boarding@path2ai.tech`), use that instead and note its password.

3. **Find Fasthosts’ SMTP server**
   - In the Fasthosts help or control panel, look for “SMTP” or “Outgoing server”.
   - Typical values:
     - **Server:** `mail.path2ai.tech` or `smtp.fasthosts.co.uk`
     - **Port:** `587` (TLS) or `465` (SSL)
   - If you’re not sure, check:
     - [Fasthosts email settings](https://www.fasthosts.co.uk/help/article/email-settings) or
     - Your control panel under “Email settings” / “SMTP”.

4. **Fill your backend `.env`** (see “Step 5: Add these to `.env`” below) using:
   - `SMTP_HOST` = the SMTP server (e.g. `mail.path2ai.tech` or `smtp.fasthosts.co.uk`)
   - `SMTP_PORT` = `587` (or `465` if Fasthosts says so)
   - `SMTP_USER` = full email address, e.g. `noreply@path2ai.tech`
   - `SMTP_PASSWORD` = the password for that mailbox
   - `SMTP_FROM_EMAIL` = same as `SMTP_USER`, e.g. `noreply@path2ai.tech`

---

### Option B: WP Mail SMTP Pro (WordPress)

If your **website is on WordPress** and you use **WP Mail SMTP Pro**, you can send from Path2ai.tech through the same SMTP account. The backend doesn’t talk to WordPress; it uses the **same SMTP credentials** in `.env`.

1. **In WordPress**
   - Install and set up **WP Mail SMTP** / **WP Mail SMTP Pro**.
   - In the plugin, choose “Other SMTP” (or the option that lets you enter host/port/user/pass).
   - Configure it to send **from** something like `noreply@path2ai.tech` (your domain).
   - Enter the **SMTP server**, **port**, **username** (usually full email), and **password**.
   - Send a test email from WordPress to confirm it works.

2. **Use the same details in the backend**
   - In the WP Mail SMTP settings you’ll see something like:
     - SMTP host (e.g. `mail.path2ai.tech` or a third-party host)
     - Port (often `587` or `465`)
     - Username (e.g. `noreply@path2ai.tech`)
     - Password
   - Copy those **exactly** into your backend `.env` as in “Step 5” below.

3. **Why this works**
   - WordPress and the Path Boarding backend both send **via SMTP**.
   - Same server, same credentials = both can send as `noreply@path2ai.tech`. No WordPress API needed.

---

## Step 5: Add these to your backend `.env`

In your **backend** folder you have (or create) a file named **`.env`** (copy from `.env.example` if needed). Add or edit these lines.

**Required for sending the verification email:**

```env
# --- Email (verification link) ---
# SMTP server for path2ai.tech (from Fasthosts or WP Mail SMTP)
SMTP_HOST=mail.path2ai.tech
SMTP_PORT=587
SMTP_USER=noreply@path2ai.tech
SMTP_PASSWORD=your_email_account_password_here

# Address that appears as "From" (should be @path2ai.tech)
SMTP_FROM_EMAIL=noreply@path2ai.tech
SMTP_FROM_NAME=Path Boarding
```

**Replace:**

- `SMTP_HOST` – your actual SMTP server (e.g. `mail.path2ai.tech` or `smtp.fasthosts.co.uk`).
- `SMTP_PORT` – usually `587`; use `465` if your provider says SSL.
- `SMTP_USER` – full email (e.g. `noreply@path2ai.tech`).
- `SMTP_PASSWORD` – the password for that email account.
- `SMTP_FROM_EMAIL` – same as `SMTP_USER` so the email is “from” Path2ai.tech.

**Important for the link in the email:**

The verification link is built using `FRONTEND_BASE_URL`. It must point to where your **boarding app** really lives (so when the user clicks “Verify my email”, they hit your app, not localhost).

- **Local testing:**  
  `FRONTEND_BASE_URL=http://localhost:3000`  
  (Links in the email will be `http://localhost:3000/board/.../verify?token=...`. Only works if the person opening the email is on the same machine as the frontend.)

- **Production (e.g. app on path2ai.tech or Fasthosts):**  
  `FRONTEND_BASE_URL=https://your-actual-domain.com`  
  Example: `FRONTEND_BASE_URL=https://app.path2ai.tech`  
  So the link in the email is `https://your-actual-domain.com/board/.../verify?token=...`.

**Optional – logo in the email:**

The email HTML loads the Path logo from a URL. By default the app uses:

`FRONTEND_BASE_URL` + `/logo-path.png`

So if `FRONTEND_BASE_URL=https://app.path2ai.tech`, the logo URL is `https://app.path2ai.tech/logo-path.png`. If your logo is elsewhere (e.g. WordPress), set:

```env
EMAIL_LOGO_URL=https://path2ai.tech/wp-content/uploads/logo-path.png
```

(Use your real logo URL.)

---

## Step 6: What happens when the user clicks the link (verify flow)

1. **User receives the email** and clicks **“Verify my email”** (or the plain link).
2. **Browser opens:**  
   `https://your-frontend/board/INVITE_TOKEN/verify?token=VERIFY_TOKEN`
3. **Frontend (Next.js)** loads the page `/board/[token]/verify` with:
   - `token` in the path = invite token
   - `token` in the query = verification token from the email
4. **Frontend calls the backend:**  
   `POST /boarding/verify-email-link?invite_token=INVITE_TOKEN`  
   with body: `{ "token": "VERIFY_TOKEN" }`
5. **Backend:**
   - Checks the verification token and that it matches the contact for that invite.
   - Marks the email as verified.
   - Creates the merchant and merchant user.
   - Advances the boarding to step 2.
6. **Frontend** then **redirects** the user to:  
   `https://your-frontend/board/INVITE_TOKEN?verified=1`
7. The **main boarding page** sees `?verified=1`, shows “Email verified” and continues to the next step.

So the “verify” page is only a short stop: call API → redirect back to the main flow.

---

## Step 7: Testing

1. **Backend**
   - `.env` has SMTP and `FRONTEND_BASE_URL` set.
   - Run: `alembic upgrade head` (if you haven’t already).
   - Start backend: `uvicorn app.main:app --reload --port 8000`.

2. **Frontend**
   - Start frontend (e.g. `npm run dev` in `frontend/`).
   - If testing locally, keep `FRONTEND_BASE_URL=http://localhost:3000` and open the boarding link on the same machine.

3. **Get a boarding link**
   - Log in to **Boarding API** (or Admin → create partner, then Boarding API → generate link).
   - Open the generated link (e.g. `http://localhost:3000/board/abc123...`).

4. **Step 1**
   - Enter a **real email address you can access** (e.g. your own).
   - Confirm email, set password, submit.

5. **Check email**
   - Inbox (and spam) for the address you used.
   - You should see “Verify your email - Path Boarding” from `noreply@path2ai.tech` (or your `SMTP_FROM_EMAIL`).
   - Open the email and click **“Verify my email”**.

6. **After clicking**
   - You should be taken to the verify page, then redirected to the boarding page with “Email verified” and the next step.

---

## Troubleshooting

**No email received**

- Check `.env`: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` must be set (no quotes around the password unless it contains spaces).
- Check backend logs when you submit step 1: you should see either “Verification email sent to …” or “SMTP not configured” / an error.
- Try sending a test from the same SMTP account (e.g. WP Mail SMTP test or another client) to confirm the account works.
- Check spam/junk and “Promotions” (Gmail).

**“Invalid or expired link” when clicking the button**

- Verification links expire after **24 hours**. Generate a new boarding link and complete step 1 again.
- Make sure `FRONTEND_BASE_URL` matches where you’re actually opening the link (e.g. not `localhost` if you’re on your phone).
- If you’re on localhost, the link in the email will be `http://localhost:3000/...`; only use it on the same computer that’s running the frontend.

**Logo not showing in the email**

- Many clients block images by default; user may need to “Show images”.
- Logo URL must be **public** (no login). Test by opening `EMAIL_LOGO_URL` or `FRONTEND_BASE_URL/logo-path.png` in a browser.
- If the logo is on a different domain, set `EMAIL_LOGO_URL` to that full URL.

**SMTP connection error in logs**

- Double-check `SMTP_HOST` and `SMTP_PORT` (587 vs 465).
- Some networks block outbound SMTP; try from another connection or server.
- Fasthosts may require you to use their SMTP only from their hosting; if the backend runs elsewhere, you might need a relay or WP Mail SMTP with a provider that allows external SMTP (e.g. SendGrid, Mailgun) and set that in `.env` instead.

---

## Quick reference – all email-related env vars

| Variable           | Example                          | Purpose |
|--------------------|----------------------------------|--------|
| `SMTP_HOST`        | `mail.path2ai.tech`              | SMTP server hostname |
| `SMTP_PORT`        | `587`                           | Usually 587 (TLS) or 465 (SSL) |
| `SMTP_USER`        | `noreply@path2ai.tech`          | SMTP login (usually full email) |
| `SMTP_PASSWORD`    | (your password)                 | SMTP password |
| `SMTP_FROM_EMAIL`  | `noreply@path2ai.tech`          | “From” address (Path2ai.tech) |
| `SMTP_FROM_NAME`   | `Path Boarding`                 | “From” display name |
| `FRONTEND_BASE_URL`| `https://app.path2ai.tech`      | Base URL for logo in email (and any links; we now use 6-digit codes) |
| `CORS_ORIGINS`     | (see below)                     | Only needed in production if frontend and API use **different origins** (e.g. app.example.com and api.example.com). When deployed same-origin on AWS (see docs/DEPLOYMENT.md), CORS is not required. For local Mac dev use the backend `.env.example` defaults. Comma-separated or JSON. |
| `EMAIL_LOGO_URL`   | (optional)                      | Full URL for logo image in email |

If you tell me whether you’re using **Fasthosts** or **WP Mail SMTP Pro** (and what host/port they show), I can give you an exact `.env` block with placeholders for you to fill in.
