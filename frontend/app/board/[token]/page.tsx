"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type InviteInfo = {
  partner: { name: string; logo_url?: string | null };
  merchant_name?: string | null;
  boarding_event_id: string;
  valid: boolean;
};

export default function BoardingEntryPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [step, setStep] = useState<"form" | "verify" | "done">("form");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setLinkError("Missing link");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<InviteInfo>(`/boarding/invite-info?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (res.error) {
          setLinkError(typeof res.error === "string" ? res.error : "Invalid or expired link");
          return;
        }
        if (res.data) setInviteInfo(res.data);
      } catch (err) {
        if (cancelled) return;
        setLinkError("Could not load. Check that the API is running (e.g. http://localhost:8000) and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (email !== confirmEmail) {
      setSubmitError("Email and confirm email must match");
      return;
    }
    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    const res = await apiPost<{ sent: boolean; message?: string }>(
      `/boarding/step/1?token=${encodeURIComponent(token)}`,
      { email, confirm_email: confirmEmail, password }
    );
    setSubmitting(false);
    if (res.error) {
      setSubmitError(res.error);
      return;
    }
    setStep("verify");
    setVerifyMessage(res.data?.message ?? "Verification email sent. Check your inbox.");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!code.trim()) {
      setSubmitError("Enter the code from your email");
      return;
    }
    setSubmitting(true);
    const res = await apiPost<{ verified: boolean }>(
      `/boarding/verify-email?token=${encodeURIComponent(token)}`,
      { code: code.trim() }
    );
    setSubmitting(false);
    if (res.error) {
      setSubmitError(res.error);
      return;
    }
    setStep("done");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 font-roboto bg-white">
        <Image src="/logo-path.png" alt="Path" width={140} height={40} className="mb-8" />
        <p className="text-path-p1 text-path-grey-600">Loading...</p>
      </main>
    );
  }

  if (linkError || !inviteInfo) {
    const isNetworkError = linkError?.includes("Could not load");
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const testUrl = token ? `${apiBase}/boarding/invite-info?token=${encodeURIComponent(token)}` : null;

    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 font-roboto bg-white">
        <header className="absolute top-8 left-8">
          <Image src="/logo-path.png" alt="Path" width={140} height={40} />
        </header>
        <div className="text-center max-w-lg">
          <h1 className="text-path-h3 font-poppins text-path-primary mb-4">
            {isNetworkError ? "Couldn't reach the API" : "Link expired or invalid"}
          </h1>
          <p className="text-path-p1 text-path-grey-700 mb-4">{linkError ?? "This boarding link is no longer valid."}</p>
          {isNetworkError && (
            <div className="text-left text-path-p2 text-path-grey-600 mb-6 p-4 bg-path-grey-100 rounded-lg">
              <p className="font-medium mb-2">Check:</p>
              <ul className="list-disc list-inside space-y-1 mb-2">
                <li>Backend is running: <code className="bg-white px-1 rounded">uvicorn app.main:app --reload --port 8000</code></li>
                <li>You're opening the link from the same place as the frontend (e.g. <code className="bg-white px-1 rounded">http://localhost:3000/board/...</code>)</li>
              </ul>
              <p className="mb-1">API base: <code className="bg-white px-1 rounded break-all">{apiBase}</code></p>
              {testUrl && (
                <p>
                  <a href={testUrl} target="_blank" rel="noopener noreferrer" className="text-path-primary hover:underline break-all">
                    Test invite in new tab
                  </a>
                </p>
              )}
            </div>
          )}
          <Link href="/" className="text-path-primary hover:underline font-medium">Return home</Link>
        </div>
      </main>
    );
  }

  if (step === "done") {
    return (
      <main className="min-h-screen flex flex-col p-8 font-roboto bg-white">
        <header className="flex items-center gap-4 mb-8">
          <Image src="/logo-path.png" alt="Path" width={140} height={40} />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto">
          <h1 className="text-path-h3 font-poppins text-path-primary mb-4">Email verified</h1>
          <p className="text-path-p1 text-path-grey-700 mb-6 text-center">
            You can now continue to the next step. (Step 2 will be implemented next.)
          </p>
          <button
            type="button"
            className="px-6 py-3 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors"
            onClick={() => setStep("verify")}
          >
            Continue to step 2
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900">
      <header className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-4">
          <Image src="/logo-path.png" alt="Path" width={140} height={40} />
          {inviteInfo.partner.logo_url ? (
            <img src={inviteInfo.partner.logo_url} alt="" className="h-8 w-auto object-contain" />
          ) : null}
        </div>
        <p className="text-path-p2 text-path-grey-600">
          In partnership with <strong>{inviteInfo.partner.name}</strong>
        </p>
      </header>

      <div className="flex-1 max-w-md mx-auto w-full">
        <h1 className="text-path-h2 font-poppins text-path-primary mb-2">Let&apos;s get started</h1>
        {inviteInfo.merchant_name ? (
          <p className="text-path-p1 text-path-grey-700 mb-6">
            Welcome, <strong>{inviteInfo.merchant_name}</strong>. Create your account to continue.
          </p>
        ) : (
          <p className="text-path-p1 text-path-grey-700 mb-6">
            Enter your email and password to create your account. We&apos;ll send a verification code to your email.
          </p>
        )}

        {step === "form" ? (
          <form onSubmit={handleStep1} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="confirmEmail" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                Confirm email address
              </label>
              <input
                id="confirmEmail"
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                required
                className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1"
                placeholder="At least 8 characters"
              />
              <p className="text-path-p2 text-path-grey-500 mt-1">
                Use this to resume later if you leave mid-way.
              </p>
            </div>
            {submitError && (
              <p className="text-path-p2 text-path-secondary">{submitError}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-3 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-path-p1 text-path-grey-700">{verifyMessage}</p>
            <div>
              <label htmlFor="code" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                Verification code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={6}
                className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 font-mono"
                placeholder="000000"
              />
            </div>
            {submitError && (
              <p className="text-path-p2 text-path-secondary">{submitError}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-3 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors disabled:opacity-60"
            >
              {submitting ? "Verifying..." : "Verify email"}
            </button>
            <button
              type="button"
              onClick={() => setStep("form")}
              className="w-full text-path-p2 text-path-grey-600 hover:underline"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>

      <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500 text-center">
        © {new Date().getFullYear()} Path. path2ai.tech
      </footer>
    </main>
  );
}
