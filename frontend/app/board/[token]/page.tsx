"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { API_BASE, apiGet, apiPost } from "@/lib/api";

type InviteInfo = {
  partner: { name: string; logo_url?: string | null };
  merchant_name?: string | null;
  boarding_event_id: string;
  valid: boolean;
};

function BoardingRightPanel({ partner }: { partner: { name: string; logo_url?: string | null } }) {
  return (
    <aside className="w-1/3 min-h-screen bg-path-primary flex flex-col p-8 text-white shrink-0">
      <div className="flex justify-end">
        {partner.logo_url ? (
          <img
            src={`${API_BASE}${partner.logo_url}`}
            alt={partner.name}
            className="h-12 w-auto object-contain max-w-[180px]"
          />
        ) : (
          <span className="text-xl font-semibold font-poppins">{partner.name}</span>
        )}
      </div>
      <div className="mt-14">
        <p className="text-lg font-poppins leading-snug">
          {partner.name} partners with Path for secure financial services.
        </p>
      </div>
      <div className="flex-1 min-h-0" />
      <nav className="flex flex-col gap-2 text-path-p2 text-white/90 pt-8">
        <a href="#" className="hover:underline">Help</a>
        <a href="#" className="hover:underline">Privacy</a>
        <a href="#" className="hover:underline">Terms and Conditions</a>
        <div className="flex items-center gap-1">
          <span>Language</span>
          <select
            className="bg-transparent border border-white/70 rounded px-2 py-1 text-sm cursor-pointer"
            defaultValue="en"
            aria-label="Language"
          >
            <option value="en">English</option>
          </select>
        </div>
      </nav>
    </aside>
  );
}

export default function BoardingEntryPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [step, setStep] = useState<"form" | "verify" | "done" | "step2">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [codeDigits, setCodeDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [clearEmailLoading, setClearEmailLoading] = useState(false);
  const [clearEmailMessage, setClearEmailMessage] = useState<string | null>(null);

  // Valid email: has @ and a TLD like .com, .co.uk, .org, etc.
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.([a-z]{2,})(\.[a-z]{2,})?$/i;
  function isValidEmail(value: string): boolean {
    return EMAIL_REGEX.test(value.trim());
  }

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

  // If user already verified (e.g. refreshed), show done
  useEffect(() => {
    if (!token || !inviteInfo) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{ verified: boolean }>(`/boarding/verify-status?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (res.data?.verified) {
          setStep("done");
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, inviteInfo]); // run once when we have inviteInfo

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeError(null);
    const digits = codeDigits.join("").replace(/\D/g, "");
    if (digits.length !== 6) {
      setCodeError("Enter the 6-digit code from your email.");
      return;
    }
    setVerifying(true);
    try {
      const res = await apiPost<{ verified: boolean }>(
        `/boarding/verify-email-code?invite_token=${encodeURIComponent(token)}`,
        { code: digits }
      );
      if (res.error) {
        setCodeError(res.error);
        return;
      }
      setStep("done");
    } catch (err) {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const isNetworkError =
        err instanceof Error &&
        (err.message === "Load failed" || err.message === "Failed to fetch" || err.message.includes("NetworkError"));
      setCodeError(
        isNetworkError
          ? `Could not reach the server at ${apiBase}. Check the backend is running (e.g. run: uvicorn app.main:app --reload --port 8000). Open ${apiBase}/health in a new tab to test.`
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again."
      );
    } finally {
      setVerifying(false);
    }
  }

  async function handleTestClearEmail() {
    const emailToClear = (step === "verify" ? email : email.trim()) || "";
    if (!emailToClear) return;
    const confirmed = typeof window !== "undefined" && window.confirm(
      `Remove existing registration for ${emailToClear}? You can then use this email again to test.`
    );
    if (!confirmed) return;
    setClearEmailMessage(null);
    setClearEmailLoading(true);
    try {
      const res = await apiPost<{ cleared: boolean; message: string }>(
        "/boarding/test-clear-email",
        { email: emailToClear }
      );
      if (res.error) {
        setClearEmailMessage(res.error);
        return;
      }
      setClearEmailMessage(res.data?.message ?? "Registration cleared.");
      setStep("form");
      setCodeDigits(["", "", "", "", "", ""]);
      setCodeError(null);
      setVerifyMessage(null);
    } catch {
      setClearEmailMessage("Could not clear. Check the backend is running.");
    } finally {
      setClearEmailLoading(false);
    }
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setClearEmailMessage(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    if (!email.trim()) {
      setEmailError("Enter your email address");
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address (e.g. name@company.com or name@company.co.uk)");
      return;
    }
    if (!password) {
      setPasswordError("Enter a password");
      return;
    }
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const res = await apiPost<{ sent: boolean; message?: string }>(
        `/boarding/step/1?token=${encodeURIComponent(token)}`,
        { email, confirm_email: email, password },
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.error) {
        setSubmitError(res.error);
        return;
      }
      setStep("verify");
      setVerifyMessage(
        "We've sent a 6-digit verification code to your email. Enter it below. The code expires in 15 minutes."
      );
    } catch (err) {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      let message: string;
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          message = "Request took too long. Please check your connection and try again.";
        } else if (
          err.message === "Load failed" ||
          err.message === "Failed to fetch" ||
          err.message.includes("NetworkError")
        ) {
          message = `Could not reach the server. Check that the backend is running (e.g. at ${apiBase}) and try again.`;
        } else {
          message = err.message;
        }
      } else {
        message = "Something went wrong. Please check your connection and try again.";
      }
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
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
      <div className="flex min-h-screen">
        <main className="flex-1 flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900">
          <header className="flex items-center gap-4 mb-8">
            <Image src="/logo-path.png" alt="Path" width={140} height={40} />
          </header>
          <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
            <h1 className="text-path-h3 font-poppins text-path-primary mb-4">Email verified</h1>
            <p className="text-path-p1 text-path-grey-700 mb-6 text-center">
              Continue to the next step below.
            </p>
            <button
              type="button"
              className="px-6 py-3 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors"
              onClick={() => setStep("step2")}
            >
              Continue to step 2
            </button>
          </div>
          <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500 text-center">
            © 2026 Path2ai.tech
          </footer>
        </main>
        {inviteInfo && <BoardingRightPanel partner={inviteInfo.partner} />}
      </div>
    );
  }

  if (step === "step2") {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900">
          <header className="flex items-center gap-4 mb-8">
            <Image src="/logo-path.png" alt="Path" width={140} height={40} />
          </header>
          <div className="flex-1 max-w-md mx-auto w-full">
            <h1 className="text-path-h2 font-poppins text-path-primary mb-2">Next steps</h1>
            <p className="text-path-p1 text-path-grey-700 mb-6">
              You&apos;re on the first input page. More steps will appear here as the flow is built out.
            </p>
          </div>
          <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500 text-center">
            © 2026 Path2ai.tech
          </footer>
        </main>
        {inviteInfo && <BoardingRightPanel partner={inviteInfo.partner} />}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900 min-w-0">
        <header className="flex items-center gap-4 mb-8">
          <Image src="/logo-path.png" alt="Path" width={140} height={40} />
        </header>

        <div className="flex-1 max-w-md mx-auto w-full">
        <h1 className="text-path-h2 font-poppins text-path-primary mb-2">Let&apos;s get started</h1>
        {inviteInfo.merchant_name ? (
          <p className="text-path-p1 text-path-grey-700 mb-6">
            Welcome, <strong>{inviteInfo.merchant_name}</strong>. Create your account to continue.
          </p>
        ) : (
          <p className="text-path-p1 text-path-grey-700 mb-6">
            Enter your email and password to create your account. We&apos;ll send a 6-digit verification code to your email.
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
                onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                onBlur={() => { if (email.trim() && !isValidEmail(email)) setEmailError("Enter a valid email (e.g. name@company.com)"); else setEmailError(null); }}
                required
                className={`w-full border rounded-lg px-3 py-2 text-path-p1 ${emailError ? "border-path-secondary" : "border-path-grey-300"}`}
                placeholder="you@example.com"
              />
              {emailError && <p className="mt-1 text-path-p2 text-path-secondary">{emailError}</p>}
            </div>
            <div>
              <label htmlFor="password" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                onBlur={() => { if (password && password.length < 8) setPasswordError("At least 8 characters"); else setPasswordError(null); }}
                required
                minLength={8}
                className={`w-full border rounded-lg px-3 py-2 text-path-p1 ${passwordError ? "border-path-secondary" : "border-path-grey-300"}`}
                placeholder="At least 8 characters"
              />
              {passwordError && <p className="mt-1 text-path-p2 text-path-secondary">{passwordError}</p>}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setConfirmPasswordError(null); }}
                onBlur={() => { if (confirmPassword && password !== confirmPassword) setConfirmPasswordError("Passwords do not match"); else setConfirmPasswordError(null); }}
                required
                minLength={8}
                className={`w-full border rounded-lg px-3 py-2 text-path-p1 ${confirmPasswordError ? "border-path-secondary" : "border-path-grey-300"}`}
                placeholder="Confirm your password"
              />
              {confirmPasswordError && <p className="mt-1 text-path-p2 text-path-secondary">{confirmPasswordError}</p>}
            </div>
            {submitError && (
              <p className="text-path-p2 text-path-secondary">{submitError}</p>
            )}
            {clearEmailMessage && (
              <p className="text-path-p2 text-path-primary bg-path-grey-100 p-2 rounded">{clearEmailMessage}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-3 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors disabled:opacity-60"
            >
              {submitting ? "Sending..." : "Continue"}
            </button>
            {email.trim() && (
              <p className="text-path-p2 text-path-grey-500 pt-2">
                <button
                  type="button"
                  onClick={handleTestClearEmail}
                  disabled={clearEmailLoading}
                  className="hover:underline disabled:opacity-60"
                >
                  {clearEmailLoading ? "Clearing…" : "Testing: clear this email to re-use it"}
                </button>
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <p className="text-path-p1 text-path-grey-700">{verifyMessage}</p>
            <div className="w-full" role="group" aria-label="Verification code">
              <div className="flex gap-2 w-full">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    ref={(el) => { codeInputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    maxLength={6}
                    value={codeDigits[i]}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      if (v.length > 1) {
                        const digits = v.slice(0, 6).split("");
                        const next = [...codeDigits];
                        digits.forEach((d, j) => { if (i + j < 6) next[i + j] = d; });
                        setCodeDigits(next);
                        setCodeError(null);
                        const focusIdx = Math.min(i + digits.length, 5);
                        codeInputRefs.current[focusIdx]?.focus();
                        return;
                      }
                      const next = [...codeDigits];
                      next[i] = v;
                      setCodeDigits(next);
                      setCodeError(null);
                      if (v && i < 5) codeInputRefs.current[i + 1]?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !codeDigits[i] && i > 0) {
                        const next = [...codeDigits];
                        next[i - 1] = "";
                        setCodeDigits(next);
                        codeInputRefs.current[i - 1]?.focus();
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                      const next = [...codeDigits];
                      pasted.split("").forEach((d, j) => { if (i + j < 6) next[i + j] = d; });
                      setCodeDigits(next);
                      setCodeError(null);
                      const focusIdx = Math.min(i + pasted.length, 5);
                      codeInputRefs.current[focusIdx]?.focus();
                    }}
                    className={`flex-1 min-w-0 h-12 border rounded-lg text-path-p1 text-center text-xl font-semibold ${codeError ? "border-path-secondary" : "border-path-grey-300"}`}
                    aria-label={`Digit ${i + 1}`}
                  />
                ))}
              </div>
              {codeError && <p className="mt-2 text-path-p2 text-path-secondary text-center">{codeError}</p>}
            </div>
            <button
              type="submit"
              disabled={verifying || codeDigits.join("").length !== 6}
              className="w-full px-6 py-3 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors disabled:opacity-60"
            >
              {verifying ? "Verifying..." : "Verify and Continue"}
            </button>
            <button
              type="button"
              onClick={() => setStep("form")}
              className="text-path-p2 text-path-primary hover:underline"
            >
              Use a different email
            </button>
            {email && (
              <p className="text-path-p2 text-path-grey-500 pt-2">
                <button
                  type="button"
                  onClick={handleTestClearEmail}
                  disabled={clearEmailLoading}
                  className="hover:underline disabled:opacity-60"
                >
                  {clearEmailLoading ? "Clearing…" : "Testing: clear this email to re-use it"}
                </button>
              </p>
            )}
          </form>
        )}
        </div>

        <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500 text-center">
          © 2026 Path2ai.tech
        </footer>
      </main>
      {inviteInfo && <BoardingRightPanel partner={inviteInfo.partner} />}
    </div>
  );
}
