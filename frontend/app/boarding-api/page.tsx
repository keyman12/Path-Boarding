"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE, apiGet, apiPost } from "@/lib/api";

const PARTNER_TOKEN_KEY = "path_partner_token";

type InviteResponse = { invite_url: string; expires_at: string; boarding_event_id: string; token: string };

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function clearPartnerAndRedirect(router: ReturnType<typeof useRouter>, setToken: (t: string | null) => void) {
  localStorage.removeItem(PARTNER_TOKEN_KEY);
  setToken(null);
  router.replace("/");
}

export default function BoardingApiPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showResetHelp, setShowResetHelp] = useState(false);

  const [merchantName, setMerchantName] = useState("");
  const [merchantEmail, setMerchantEmail] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem(PARTNER_TOKEN_KEY) : null;
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) {
      setPartnerName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await apiGet<{ name: string }>("/auth/partner/me", { headers: authHeaders(token) });
      if (cancelled) return;
      if (res.error && (res as { statusCode?: number }).statusCode === 401) {
        clearPartnerAndRedirect(router, setToken);
        return;
      }
      if (res.data) setPartnerName(res.data.name);
    })();
    return () => { cancelled = true; };
  }, [token, router]);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError(null);
      const res = await apiPost<{ access_token: string }>("/auth/partner/login", { email, password });
      if (res.error) {
        setLoginError(res.error);
        return;
      }
      if (res.data?.access_token) {
        localStorage.setItem(PARTNER_TOKEN_KEY, res.data.access_token);
        setToken(res.data.access_token);
      }
    },
    [email, password]
  );

  function handleLogout() {
    localStorage.removeItem(PARTNER_TOKEN_KEY);
    setToken(null);
    setGeneratedUrl(null);
    setGenerateMessage(null);
    setGenerateError(null);
  }

  async function handleGenerateLink(e: React.FormEvent) {
    e.preventDefault();
    setGenerateError(null);
    setGenerateMessage(null);
    if (!token) return;
    const res = await apiPost<InviteResponse>(
      "/partners/boarding/invite",
      { merchant_name: merchantName || undefined, email: merchantEmail || undefined },
      { headers: authHeaders(token) }
    );
      if (res.error) {
      if ((res as { statusCode?: number }).statusCode === 401) {
        clearPartnerAndRedirect(router, setToken);
        return;
      }
      setGenerateError(res.error);
      return;
    }
    if (res.data?.invite_url) {
      setGeneratedUrl(res.data.invite_url);
      setGenerateMessage("Boarding link generated. Copy and share it with the merchant.");
    }
  }

  async function handleRegenerateLink() {
    setGenerateError(null);
    setGenerateMessage(null);
    if (!token) return;
    const res = await apiPost<InviteResponse>(
      "/partners/boarding/invite",
      { merchant_name: merchantName || undefined, email: merchantEmail || undefined },
      { headers: authHeaders(token) }
    );
    if (res.error) {
      if ((res as { statusCode?: number }).statusCode === 401) {
        clearPartnerAndRedirect(router, setToken);
        return;
      }
      setGenerateError(res.error);
      return;
    }
    if (res.data?.invite_url) {
      setGeneratedUrl(res.data.invite_url);
      setGenerateMessage("New boarding link generated. Previous link remains valid until it expires.");
    }
  }

  function copyToClipboard() {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setGenerateMessage("Link copied to clipboard.");
  }

  const apiDocsBase = typeof window !== "undefined" ? API_BASE.replace(/\/$/, "") : "";

  if (token === null) {
    return (
      <main className="min-h-screen flex flex-col p-8 font-roboto bg-white">
        <header className="flex items-center gap-4 mb-8">
          <Image src="/logo-path.png" alt="Path" width={140} height={40} />
        </header>
        <div className="max-w-md mx-auto w-full">
          <h1 className="text-path-h2 font-poppins text-path-primary mb-6">Path Boarding Integration</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1"
                placeholder="partner@example.com"
              />
            </div>
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1"
              />
            </div>
            {loginError && <p className="text-path-p2 text-path-secondary">{loginError}</p>}
            <button
              type="submit"
              className="w-full px-4 py-3 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors"
            >
              Log in
            </button>
          </form>
          <p className="mt-4 text-path-p2 text-path-grey-500">
            <button
              type="button"
              onClick={() => setShowResetHelp(!showResetHelp)}
              className="text-path-primary hover:underline"
            >
              Reset password
            </button>
          </p>
          {showResetHelp && (
            <p className="mt-2 text-path-p2 text-path-grey-600 bg-path-grey-100 rounded-lg p-3">
              Contact your Path administrator to reset your password. Partners are managed in the Path Admin dashboard.
            </p>
          )}
          <p className="mt-6 text-path-p2 text-path-grey-500">
            <Link href="/" className="text-path-primary hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900">
      <header className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-4">
          <Image src="/logo-path.png" alt="Path" width={140} height={40} />
        </div>
        <nav className="flex items-center gap-4 text-path-p2 flex-wrap">
          <a
            href={`${apiDocsBase}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-path-primary hover:underline"
          >
            API Docs (Swagger)
          </a>
          <a
            href={`${apiDocsBase}/redoc`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-path-primary hover:underline"
          >
            ReDoc
          </a>
          <Link href="/" className="text-path-grey-600 hover:underline">
            Home
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 border border-path-grey-300 rounded-lg hover:bg-path-grey-100"
          >
            Log out
          </button>
        </nav>
      </header>

      <div className="max-w-3xl space-y-8">
        <div className="mb-2">
          <h1 className="text-path-h2 font-poppins text-path-primary">
            Welcome, {partnerName ?? "…"}
          </h1>
          <p className="text-path-p2 text-path-grey-600 mt-1">Boarding Administration</p>
        </div>

        {/* API docs */}
        <section className="border border-path-grey-300 rounded-lg p-4">
          <h2 className="text-path-h4 font-poppins text-path-primary mb-2">API documentation</h2>
          <p className="text-path-p2 text-path-grey-600 mb-3">
            You can automate the invite process using the API. Open the docs to see request/response schemas and try requests.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`${apiDocsBase}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors inline-block"
            >
              Open Swagger UI
            </a>
            <a
              href={`${apiDocsBase}/redoc`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-path-primary text-path-primary rounded-lg font-medium hover:bg-path-grey-100 transition-colors inline-block"
            >
              Open ReDoc
            </a>
          </div>
        </section>

        {/* Generate boarding link */}
        <section className="border border-path-grey-300 rounded-lg p-4">
          <h2 className="text-path-h4 font-poppins text-path-primary mb-2">Generate boarding link</h2>
          <p className="text-path-p2 text-path-grey-600 mb-4">
            Enter the merchant details and generate a unique link. Send this link to the merchant (e.g. by email or embed in your system). They use it to complete onboarding.
          </p>
          {generateMessage && <p className="text-path-p2 text-path-primary font-medium mb-2">{generateMessage}</p>}
          {generateError && <p className="text-path-p2 text-path-secondary mb-2">{generateError}</p>}
          <form onSubmit={handleGenerateLink} className="space-y-4 max-w-md">
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Merchant name (optional)</label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="e.g. Acme Ltd"
                className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1"
              />
            </div>
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Merchant email (optional)</label>
              <input
                type="email"
                value={merchantEmail}
                onChange={(e) => setMerchantEmail(e.target.value)}
                placeholder="merchant@example.com"
                className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1"
              >
                Generate boarding link
              </button>
              {generatedUrl && (
                <button
                  type="button"
                  onClick={handleRegenerateLink}
                  className="px-4 py-2 border border-path-grey-300 rounded-lg font-medium hover:bg-path-grey-100"
                >
                  Generate another link
                </button>
              )}
            </div>
          </form>
          {generatedUrl && (
            <div className="mt-4 max-w-2xl">
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Boarding link (copy and share)</label>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  readOnly
                  value={generatedUrl}
                  className="flex-1 min-w-0 border border-path-grey-300 rounded-lg px-3 py-2 text-path-p2 font-mono bg-path-grey-100"
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="px-4 py-2 border border-path-primary text-path-primary rounded-lg font-medium hover:bg-path-grey-100 whitespace-nowrap"
                >
                  Copy link
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500">
        © 2026 Path2ai.tech
      </footer>
    </main>
  );
}
