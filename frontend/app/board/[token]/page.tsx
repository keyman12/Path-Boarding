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
  const [logoError, setLogoError] = useState(false);
  const logoUrl = partner.logo_url
    ? `${API_BASE.replace(/\/$/, "")}${partner.logo_url.startsWith("/") ? "" : "/"}${partner.logo_url}`
    : null;
  const showLogo = logoUrl && !logoError;
  return (
    <aside className="w-1/3 min-h-screen bg-path-primary flex flex-col p-8 text-white shrink-0">
      <div className="flex justify-start mt-1">
        {showLogo ? (
          <img
            src={logoUrl}
            alt={partner.name}
            className="h-12 w-auto object-contain max-w-[180px]"
            onError={() => setLogoError(true)}
          />
        ) : (
          <span className="text-xl font-semibold font-poppins">{partner.name}</span>
        )}
      </div>
      <div className="mt-8">
        <p className="text-xl font-poppins leading-snug">
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

  const [step, setStep] = useState<"form" | "verify" | "done" | "step2" | "step3">("form");
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
  const [step1VerifiedFields, setStep1VerifiedFields] = useState<Record<string, boolean>>({});

  // Personal details (step 2)
  const [legalFirstName, setLegalFirstName] = useState("");
  const [legalLastName, setLegalLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [addressCountry, setAddressCountry] = useState("United Kingdom");
  const [addressPostcode, setAddressPostcode] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressTown, setAddressTown] = useState("");
  const [emailPersonal, setEmailPersonal] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+44");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [personalDetailsError, setPersonalDetailsError] = useState<string | null>(null);
  const [dateOfBirthError, setDateOfBirthError] = useState<string | null>(null);
  const [addressLookupResults, setAddressLookupResults] = useState<{ addressLine1: string; addressLine2: string; town: string; postcode: string }[]>([]);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [addressLookupError, setAddressLookupError] = useState<string | null>(null);
  const [verifiedFields, setVerifiedFields] = useState<Record<string, boolean>>({});
  const [legalFirstNameError, setLegalFirstNameError] = useState<string | null>(null);
  const [legalLastNameError, setLegalLastNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [personalDetailsSubmitting, setPersonalDetailsSubmitting] = useState(false);

  // Telephone: digits only, 10–15 digits (e.g. UK mobile 07943 490 548 = 11 digits)
  function validatePhoneNumber(value: string): string | null {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0) return "Please enter your telephone number.";
    if (digits.length < 10) return "Enter at least 10 digits (e.g. 07943 490 548).";
    if (digits.length > 15) return "Number is too long.";
    return null;
  }

  // Legal name: not blank, no digits
  function validateLegalName(value: string): string | null {
    const t = value.trim();
    if (!t) return "This field is required.";
    if (/\d/.test(t)) return "Please enter a name without numbers.";
    return null;
  }

  // Valid email: has @ and a TLD like .com, .co.uk, .org, etc.
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.([a-z]{2,})(\.[a-z]{2,})?$/i;
  function isValidEmail(value: string): boolean {
    return EMAIL_REGEX.test(value.trim());
  }

  // Date of birth: DD/MM/YYYY or DD-MM-YYYY. Day 1-31, month 1-12, year >= 1915, age >= 18.
  function validateDateOfBirth(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return "Please enter your date of birth.";
    const parts = trimmed.split(/[/\-.\s]+/).map((p) => parseInt(p, 10));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
      return "Enter a valid date in DD / MM / YYYY format.";
    }
    const [day, month, year] = parts;
    if (day < 1 || day > 31) return "Day must be between 1 and 31.";
    if (month < 1 || month > 12) return "Month must be between 1 and 12.";
    if (year < 1915) return "Year must be 1915 or later.";
    const now = new Date();
    if (year > now.getFullYear()) return "Date of birth cannot be in the future.";
    const birth = new Date(year, month - 1, day);
    if (birth.getDate() !== day || birth.getMonth() !== month - 1 || birth.getFullYear() !== year) {
      return "Enter a valid date (e.g. 31 days only in some months).";
    }
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const birthDateOnly = new Date(year, month - 1, day);
    const ageMs = today.getTime() - birthDateOnly.getTime();
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 18) return "You must be at least 18 years old.";
    return null;
  }

  // UK postcode: basic format (e.g. SW1A 1AA, M1 1AA, B1 1AA)
  const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
  function isValidUkPostcode(value: string): boolean {
    return UK_POSTCODE_REGEX.test(value.trim().replace(/\s+/g, " "));
  }

  const EUROPEAN_COUNTRIES = [
    "United Kingdom", "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina",
    "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France",
    "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Liechtenstein",
    "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia",
    "Norway", "Poland", "Portugal", "Romania", "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia",
    "Spain", "Sweden", "Switzerland", "Ukraine", "Vatican City",
  ];

  const postcodeLookupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchAddressLookup(postcodeValue: string) {
    const pc = postcodeValue.trim();
    if (!pc || !isValidUkPostcode(pc)) return;
    setAddressLookupError(null);
    setAddressLookupLoading(true);
    setAddressLookupResults([]);
    try {
      const res = await apiGet<{ addressLine1: string; addressLine2: string; town: string; postcode: string }[]>(
        `/boarding/address-lookup?postcode=${encodeURIComponent(pc)}`
      );
      if (res.error) {
        const msg = typeof res.error === "string" ? res.error : "Could not load addresses.";
        setAddressLookupError(msg);
        return;
      }
      const list = Array.isArray(res.data) ? res.data : [];
      setAddressLookupResults(list);
      if (list.length === 0) setAddressLookupError("No addresses found for this postcode.");
    } catch {
      setAddressLookupError("Could not load addresses. Please enter your address manually.");
    } finally {
      setAddressLookupLoading(false);
    }
  }

  useEffect(() => {
    if (addressCountry !== "United Kingdom") {
      setAddressLookupResults([]);
      setAddressLookupError(null);
      return;
    }
    const pc = addressPostcode.trim();
    if (!pc || !isValidUkPostcode(pc)) {
      setAddressLookupResults([]);
      setAddressLookupError(null);
      return;
    }
    if (postcodeLookupDebounceRef.current) clearTimeout(postcodeLookupDebounceRef.current);
    postcodeLookupDebounceRef.current = setTimeout(() => fetchAddressLookup(pc), 400);
    return () => {
      if (postcodeLookupDebounceRef.current) {
        clearTimeout(postcodeLookupDebounceRef.current);
        postcodeLookupDebounceRef.current = null;
      }
    };
  }, [addressCountry, addressPostcode]);

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
          setEmailPersonal(email);
          if (email && isValidEmail(email)) setVerifiedFields((f) => ({ ...f, email: true }));
          setStep("step2");
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
      setEmailPersonal(email);
      if (email && isValidEmail(email)) setVerifiedFields((f) => ({ ...f, email: true }));
      setStep("step2");
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

  async function handlePersonalDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPersonalDetailsError(null);
    setDateOfBirthError(null);
    setLegalFirstNameError(null);
    setLegalLastNameError(null);
    setPhoneError(null);
    const first = legalFirstName.trim();
    const last = legalLastName.trim();
    const firstErr = validateLegalName(legalFirstName);
    const lastErr = validateLegalName(legalLastName);
    if (firstErr) setLegalFirstNameError(firstErr);
    if (lastErr) setLegalLastNameError(lastErr);
    if (firstErr || lastErr) {
      setPersonalDetailsError(firstErr || lastErr || "Please correct the legal name fields.");
      return;
    }
    const dob = dateOfBirth.trim();
    const country = addressCountry.trim();
    const postcode = addressPostcode.trim();
    const line1 = addressLine1.trim();
    const town = addressTown.trim();
    const em = emailPersonal.trim();
    const phone = phoneNumber.trim();
    const dobErr = validateDateOfBirth(dob);
    if (dobErr) {
      setDateOfBirthError(dobErr);
      setPersonalDetailsError(dobErr);
      return;
    }
    if (!line1 || !town) {
      setPersonalDetailsError("Please enter address line 1 and town.");
      return;
    }
    if (country === "United Kingdom") {
      if (!postcode) {
        setPersonalDetailsError("Please enter your postcode.");
        return;
      }
      if (!isValidUkPostcode(postcode)) {
        setPersonalDetailsError("Please enter a valid UK postcode (e.g. SW1A 1AA).");
        return;
      }
    }
    if (!em || !isValidEmail(em)) {
      setPersonalDetailsError("Please enter a valid email address.");
      return;
    }
    const phoneErr = validatePhoneNumber(phone);
    if (phoneErr) {
      setPhoneError(phoneErr);
      setPersonalDetailsError(phoneErr);
      return;
    }
    setPersonalDetailsSubmitting(true);
    setPersonalDetailsError(null);
    const line2 = addressLine2.trim();
    const res = await apiPost<{ saved?: boolean }>(
      `/boarding/step/2?token=${encodeURIComponent(token)}`,
      {
        legal_first_name: first,
        legal_last_name: last,
        date_of_birth: dob,
        address_country: country,
        address_postcode: country === "United Kingdom" ? postcode : undefined,
        address_line1: line1,
        address_line2: line2 || undefined,
        address_town: town,
        email: em,
        phone_country_code: phoneCountryCode,
        phone_number: phone,
      }
    );
    setPersonalDetailsSubmitting(false);
    if (res.error) {
      setPersonalDetailsError(res.error);
      return;
    }
    setStep("step3");
  }

  const PHONE_COUNTRY_CODES = [
    { code: "+44", label: "United Kingdom", flag: "🇬🇧" },
    { code: "+353", label: "Ireland", flag: "🇮🇪" },
    { code: "+1", label: "United States", flag: "🇺🇸" },
    { code: "+49", label: "Germany", flag: "🇩🇪" },
    { code: "+33", label: "France", flag: "🇫🇷" },
  ];
  const selectedPhoneFlag = PHONE_COUNTRY_CODES.find((c) => c.code === phoneCountryCode)?.flag ?? "🇬🇧";

  if (step === "step2") {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900 min-w-0">
          <header className="flex items-center gap-4 mb-8">
            <Image src="/logo-path.png" alt="Path" width={140} height={40} />
          </header>
          <div className="flex-1 max-w-md mx-auto w-full">
          <nav className="flex items-center flex-wrap gap-1 text-path-p2 text-path-grey-600 mb-6" aria-label="Breadcrumb">
            <span className="flex items-center gap-1.5 text-path-grey-400">
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                <Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" />
              </span>
              Account
            </span>
            <span className="mx-1 text-path-grey-400">/</span>
            <span className="flex items-center gap-1.5 font-medium text-path-primary">
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                <Image src="/icons/form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              </span>
              Personal Details
            </span>
            <span className="mx-1 text-path-grey-400">/</span>
            <span className="flex items-center gap-1.5 text-path-grey-400">
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                <Image src="/icons/form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain opacity-50" />
              </span>
              Verify
            </span>
          </nav>
            <h1 className="text-path-h2 font-poppins text-path-primary mb-2">Input your personal details</h1>
            <p className="text-path-p1 text-path-grey-700 mb-6">
              We collect this information to confirm your identity, keep your account secure, and comply with legal and regulatory obligations.{" "}
              <a href="#" className="text-path-primary underline hover:no-underline">Privacy Policy</a>.
            </p>
            <form onSubmit={handlePersonalDetailsSubmit} className="space-y-5">
              <div>
                <label className="block text-path-p2 font-medium text-path-grey-700 mb-2">Your legal name:</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={legalFirstName}
                      onChange={(e) => { setLegalFirstName(e.target.value); setLegalFirstNameError(null); }}
                      onBlur={() => {
                        const err = validateLegalName(legalFirstName);
                        setLegalFirstNameError(err);
                        if (!err && legalFirstName.trim()) setVerifiedFields((f) => ({ ...f, legalFirst: true }));
                      }}
                      placeholder="Legal First Name"
                      className={`w-full border rounded-lg px-3 py-2 text-path-p1 pr-9 ${legalFirstNameError ? "border-path-secondary" : "border-path-grey-300"}`}
                    />
                    {verifiedFields.legalFirst && !legalFirstNameError && (
                      <span className="field-verified-tick" aria-hidden>✓</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={legalLastName}
                      onChange={(e) => { setLegalLastName(e.target.value); setLegalLastNameError(null); }}
                      onBlur={() => {
                        const err = validateLegalName(legalLastName);
                        setLegalLastNameError(err);
                        if (!err && legalLastName.trim()) setVerifiedFields((f) => ({ ...f, legalLast: true }));
                      }}
                      placeholder="Legal Last Name"
                      className={`w-full border rounded-lg px-3 py-2 text-path-p1 pr-9 ${legalLastNameError ? "border-path-secondary" : "border-path-grey-300"}`}
                    />
                    {verifiedFields.legalLast && !legalLastNameError && (
                      <span className="field-verified-tick" aria-hidden>✓</span>
                    )}
                  </div>
                </div>
                {(legalFirstNameError || legalLastNameError) && (
                  <p className="mt-1 text-path-p2 text-path-secondary">{legalFirstNameError || legalLastNameError}</p>
                )}
              </div>
              <div>
                <label className="block text-path-p2 font-medium text-path-grey-700 mb-2">Date of birth:</label>
                <div className="relative">
                <input
                  type="text"
                  value={dateOfBirth}
                  onChange={(e) => {
                    const val = e.target.value;
                    const raw = val.replace(/\D/g, "").slice(0, 8);
                    let formatted = "";
                    if (raw.length > 0) formatted = raw.slice(0, 2);
                    if (raw.length > 2) formatted += "/" + raw.slice(2, 4);
                    if (raw.length > 4) formatted += "/" + raw.slice(4, 8);
                    if (val.trim().endsWith("/") && (raw.length === 2 || raw.length === 4)) formatted += "/";
                    setDateOfBirth(formatted);
                    setDateOfBirthError(null);
                  }}
                  onBlur={() => {
                    const err = dateOfBirth.trim() ? validateDateOfBirth(dateOfBirth) : null;
                    setDateOfBirthError(err);
                    if (!err && dateOfBirth.trim()) setVerifiedFields((f) => ({ ...f, dob: true }));
                  }}
                  placeholder="DD / MM / YYYY"
                  className={`w-full border rounded-lg px-3 py-2 text-path-p1 board-focus pr-9 ${dateOfBirthError ? "border-path-secondary" : "border-path-grey-300"}`}
                />
                {verifiedFields.dob && !dateOfBirthError && (
                  <span className="field-verified-tick" aria-hidden>✓</span>
                )}
                </div>
                {dateOfBirthError && (
                  <p className="mt-1 text-path-p2 text-path-secondary">{dateOfBirthError}</p>
                )}
              </div>
              <div>
                <label className="block text-path-p2 font-medium text-path-grey-700 mb-2">Home address:</label>
                <div className="space-y-3">
                  <select
                    value={addressCountry}
                    onChange={(e) => { setAddressCountry(e.target.value); setVerifiedFields((f) => ({ ...f, country: true })); }}
                    onBlur={() => setVerifiedFields((f) => ({ ...f, country: true }))}
                    className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 bg-white h-11 board-focus"
                    style={{ minHeight: "2.75rem" }}
                    aria-label="Country"
                  >
                    {EUROPEAN_COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {addressCountry === "United Kingdom" && (
                    <>
                      <div className="relative">
                        <input
                          type="text"
                          value={addressPostcode}
                          onChange={(e) => {
                            setAddressPostcode(e.target.value);
                            setAddressLookupError(null);
                            setAddressLookupResults([]);
                          }}
                          onBlur={() => {
                            const pc = addressPostcode.trim();
                            if (pc && isValidUkPostcode(pc)) {
                              fetchAddressLookup(pc);
                              setVerifiedFields((f) => ({ ...f, postcode: true }));
                            }
                          }}
                          placeholder="Postcode"
                          className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 board-focus pr-9"
                          autoComplete="postal-code"
                        />
                        {verifiedFields.postcode && addressPostcode.trim() && isValidUkPostcode(addressPostcode) && (
                          <span className="field-verified-tick" aria-hidden>✓</span>
                        )}
                      </div>
                      {addressLookupLoading && (
                        <p className="text-path-p2 text-path-grey-600">Loading addresses...</p>
                      )}
                      {addressLookupError && !addressLookupLoading && (
                        <p className="text-path-p2 text-path-secondary">{addressLookupError}</p>
                      )}
                      {addressLookupResults.length > 0 && !addressLookupLoading && (
                        <div>
                          <label htmlFor="address-picker" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                            Select your address
                          </label>
                          <select
                            id="address-picker"
                            className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 bg-white board-focus"
                            value=""
                            onChange={(e) => {
                              const idx = e.target.value ? parseInt(e.target.value, 10) : -1;
                              if (idx >= 0 && addressLookupResults[idx]) {
                                const a = addressLookupResults[idx];
                                setAddressLine1(a.addressLine1);
                                setAddressLine2(a.addressLine2 || "");
                                setAddressTown(a.town);
                                setAddressLookupResults([]);
                                setAddressLookupError(null);
                                setVerifiedFields((f) => ({
                                  ...f,
                                  line1: true,
                                  town: !!a.town,
                                  line2: !!a.addressLine2,
                                }));
                              }
                            }}
                            aria-label="Select your address"
                          >
                            <option value="">Select your address</option>
                            {addressLookupResults.map((a, i) => (
                              <option key={i} value={i}>
                                {[a.addressLine1, a.town, a.postcode].filter(Boolean).join(", ")}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}
                  <div className="relative">
                    <input
                      type="text"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      onBlur={() => { if (addressLine1.trim()) setVerifiedFields((f) => ({ ...f, line1: true })); }}
                      placeholder="Address Line 1"
                      className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 board-focus pr-9"
                    />
                    {verifiedFields.line1 && (
                      <span className="field-verified-tick" aria-hidden>✓</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      onBlur={() => setVerifiedFields((f) => ({ ...f, line2: true }))}
                      placeholder="Address Line 2"
                      className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 board-focus pr-9"
                    />
                    {verifiedFields.line2 && (
                      <span className="field-verified-tick" aria-hidden>✓</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={addressTown}
                      onChange={(e) => setAddressTown(e.target.value)}
                      onBlur={() => { if (addressTown.trim()) setVerifiedFields((f) => ({ ...f, town: true })); }}
                      placeholder="Town"
                      className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 board-focus pr-9"
                    />
                    {verifiedFields.town && (
                      <span className="field-verified-tick" aria-hidden>✓</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-path-p2 font-medium text-path-grey-700 mb-2">Email address:</label>
                <div className="relative">
                  <input
                    type="email"
                    value={emailPersonal}
                    onChange={(e) => setEmailPersonal(e.target.value)}
                    onBlur={() => { if (emailPersonal.trim() && isValidEmail(emailPersonal)) setVerifiedFields((f) => ({ ...f, email: true })); }}
                    placeholder="youraddress@domain.com"
                    className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 board-focus pr-9"
                  />
                  {verifiedFields.email && emailPersonal.trim() && isValidEmail(emailPersonal) && (
                    <span className="field-verified-tick" aria-hidden>✓</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-path-p2 font-medium text-path-grey-700 mb-2">Telephone number:</label>
                <div className={`relative flex border rounded-lg overflow-hidden board-focus ${phoneError ? "border-path-secondary" : "border-path-grey-300"}`}>
                  <span className="flex items-center justify-center px-2.5 py-2 bg-path-grey-50 border-r border-path-grey-300 text-lg shrink-0" aria-hidden>
                    {selectedPhoneFlag}
                  </span>
                  <select
                    value={phoneCountryCode}
                    onChange={(e) => setPhoneCountryCode(e.target.value)}
                    className="px-2 py-2 text-path-p1 bg-path-grey-50 border-r border-path-grey-300 min-w-[90px]"
                    aria-label="Country code"
                  >
                    {PHONE_COUNTRY_CODES.map(({ code, label }) => (
                      <option key={code} value={code}>{code} {label}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => { setPhoneNumber(e.target.value); setPhoneError(null); }}
                    onBlur={() => {
                      const err = validatePhoneNumber(phoneNumber.trim());
                      setPhoneError(err);
                      if (!err && phoneNumber.trim()) setVerifiedFields((f) => ({ ...f, phone: true }));
                    }}
                    placeholder="07943 490 548"
                    className="flex-1 px-3 py-2 text-path-p1 min-w-0 pr-9 border-0 bg-transparent board-focus rounded-none"
                  />
                  {verifiedFields.phone && !phoneError && phoneNumber.trim() && !validatePhoneNumber(phoneNumber.trim()) && (
                    <span className="field-verified-tick" aria-hidden>✓</span>
                  )}
                </div>
                {phoneError && (
                  <p className="mt-1 text-path-p2 text-path-secondary">{phoneError}</p>
                )}
              </div>
              {personalDetailsError && (
                <p className="text-path-p2 text-path-secondary">{personalDetailsError}</p>
              )}
              <button
                type="submit"
                disabled={personalDetailsSubmitting}
                className="w-full px-6 py-3 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {personalDetailsSubmitting ? "Saving..." : "Continue"}
              </button>
            </form>
          </div>
          <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500 text-center">
            © 2026 Path2ai.tech
          </footer>
        </main>
        {inviteInfo && <BoardingRightPanel partner={inviteInfo.partner} />}
      </div>
    );
  }

  if (step === "step3") {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900">
          <header className="flex items-center gap-4 mb-8">
            <Image src="/logo-path.png" alt="Path" width={140} height={40} />
          </header>
          <div className="flex-1 max-w-md mx-auto w-full">
          <nav className="flex items-center flex-wrap gap-1 text-path-p2 text-path-grey-600 mb-6" aria-label="Breadcrumb">
            <span className="flex items-center gap-1.5 text-path-grey-400">
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                <Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" />
              </span>
              Account
            </span>
            <span className="mx-1 text-path-grey-400">/</span>
            <span className="flex items-center gap-1.5 text-path-grey-400">
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                <Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" />
              </span>
              Personal Details
            </span>
            <span className="mx-1 text-path-grey-400">/</span>
            <span className="flex items-center gap-1.5 font-medium text-path-primary">
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                <Image src="/icons/form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              </span>
              Verify
            </span>
          </nav>
            <h1 className="text-path-h2 font-poppins text-path-primary mb-4">Time to verify your identity</h1>
            <div className="space-y-4 text-path-p1 text-path-grey-700">
              <p>
                In the next step, Path will ask you to take a photo of your passport or driving licence, 
                followed by a selfie to confirm your identity.
              </p>
              <p className="font-medium text-path-grey-900">
                Path will only have access to the results of this verification.
              </p>
              <p>
                We partner with Sumsub to complete this process using biometric technology to confirm 
                the documents and photos belong to you. You can delete your verification data at any time.
              </p>
              <p>
                For more information on how your data is handled, please see the Path{" "}
                <a href="#" className="text-path-primary hover:underline">Privacy Policy</a>.
              </p>
            </div>
            <button
              onClick={() => {
                // TODO: Initialize SumSub verification
                console.log("Starting identity verification...");
                // For now, just log - we'll implement SumSub integration next
              }}
              className="w-full mt-8 bg-path-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors"
            >
              Continue
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

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900 min-w-0">
        <header className="flex items-center gap-4 mb-8">
          <Image src="/logo-path.png" alt="Path" width={140} height={40} />
        </header>

        <div className="flex-1 max-w-md mx-auto w-full">
        <nav className="flex items-center flex-wrap gap-1 text-path-p2 text-path-grey-600 mb-6" aria-label="Breadcrumb">
          <span className="flex items-center gap-1.5 font-medium text-path-primary">
            <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
              <Image src="/icons/form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" />
            </span>
            Account
          </span>
          <span className="mx-1 text-path-grey-400">/</span>
          <span className="flex items-center gap-1.5 text-path-grey-400">
            <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
              <Image src="/icons/form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain opacity-50" />
            </span>
            Personal Details
          </span>
          <span className="mx-1 text-path-grey-400">/</span>
          <span className="flex items-center gap-1.5 text-path-grey-400">
            <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
              <Image src="/icons/form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain opacity-50" />
            </span>
            Verify
          </span>
        </nav>
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
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                  onBlur={() => {
                    if (email.trim() && !isValidEmail(email)) setEmailError("Enter a valid email (e.g. name@company.com)");
                    else setEmailError(null);
                    if (email.trim() && isValidEmail(email)) setStep1VerifiedFields((f) => ({ ...f, email: true }));
                  }}
                  required
                  className={`w-full border rounded-lg px-3 py-2 text-path-p1 pr-9 ${emailError ? "border-path-secondary" : "border-path-grey-300"}`}
                  placeholder="you@example.com"
                />
                {step1VerifiedFields.email && !emailError && (
                  <span className="field-verified-tick" aria-hidden>✓</span>
                )}
              </div>
              {emailError && <p className="mt-1 text-path-p2 text-path-secondary">{emailError}</p>}
            </div>
            <div>
              <label htmlFor="password" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                  onBlur={() => {
                    if (password && password.length < 8) setPasswordError("At least 8 characters");
                    else setPasswordError(null);
                    if (password && password.length >= 8) setStep1VerifiedFields((f) => ({ ...f, password: true }));
                  }}
                  required
                  minLength={8}
                  className={`w-full border rounded-lg px-3 py-2 text-path-p1 pr-9 ${passwordError ? "border-path-secondary" : "border-path-grey-300"}`}
                  placeholder="At least 8 characters"
                />
                {step1VerifiedFields.password && !passwordError && (
                  <span className="field-verified-tick" aria-hidden>✓</span>
                )}
              </div>
              {passwordError && <p className="mt-1 text-path-p2 text-path-secondary">{passwordError}</p>}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setConfirmPasswordError(null); }}
                  onBlur={() => {
                    if (confirmPassword && password !== confirmPassword) setConfirmPasswordError("Passwords do not match");
                    else setConfirmPasswordError(null);
                    if (confirmPassword && password === confirmPassword && password.length >= 8) setStep1VerifiedFields((f) => ({ ...f, confirmPassword: true }));
                  }}
                  required
                  minLength={8}
                  className={`w-full border rounded-lg px-3 py-2 text-path-p1 pr-9 ${confirmPasswordError ? "border-path-secondary" : "border-path-grey-300"}`}
                  placeholder="Confirm your password"
                />
                {step1VerifiedFields.confirmPassword && !confirmPasswordError && (
                  <span className="field-verified-tick" aria-hidden>✓</span>
                )}
              </div>
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
