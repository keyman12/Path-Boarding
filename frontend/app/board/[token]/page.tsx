"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, apiGet, apiPost } from "@/lib/api";

const SumsubWebSdk = dynamic(
  () => import("@sumsub/websdk-react").then((mod) => mod.default ?? mod),
  { ssr: false, loading: () => <p className="text-path-p2 text-path-grey-600">Loading verification...</p> }
);
import { PurchasedProductsSummary } from "@/components/PurchasedProductsSummary";

type MccItem = { mcc: string; label: string };
type UxGroup = { id: string; label: string; items: MccItem[] };
type UxTaxonomyTier = { id: string; label: string; children: UxGroup[] };
type MccTaxonomy = { ux_taxonomy: UxTaxonomyTier[] };

type ProductPackageItemDisplay = {
  id: string;
  product_code: string;
  product_name: string;
  product_type: string;
  config?: Record<string, unknown>;
  store_name?: string | null;
  store_address?: string | null;
  epos_terminal?: string | null;
};

type ProductPackageDisplay = {
  id: string;
  uid: string;
  name: string;
  description?: string | null;
  items: ProductPackageItemDisplay[];
};

type InviteInfo = {
  partner: { name: string; logo_url?: string | null; merchant_support_email?: string | null; merchant_support_phone?: string | null };
  merchant_name?: string | null;
  boarding_event_id: string;
  valid: boolean;
  product_package?: ProductPackageDisplay | null;
};

function BoardingRightPanel({ 
  partner, 
  onBack,
  onSaveForLater,
  productPackage,
  productSummaryTitle,
  showSupportInfo = false
}: { 
  partner: { name: string; logo_url?: string | null; merchant_support_email?: string | null; merchant_support_phone?: string | null };
  onBack?: { label: string; onClick: () => void; isForward?: boolean };
  onSaveForLater?: () => void;
  productPackage?: ProductPackageDisplay | null;
  productSummaryTitle?: string;
  showSupportInfo?: boolean;
}) {
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
        {showSupportInfo && (partner.merchant_support_email || partner.merchant_support_phone) && (
          <div className="mt-4 space-y-2 text-path-p2 text-white/90">
            {partner.merchant_support_email && (
              <p>
                Support Email:{" "}
                <a href={`mailto:${partner.merchant_support_email}`} className="underline hover:text-white transition-colors">
                  {partner.merchant_support_email}
                </a>
              </p>
            )}
            {partner.merchant_support_phone && (
              <p>
                Support Telephone Number: {partner.merchant_support_phone}
              </p>
            )}
          </div>
        )}
        {onBack && (
          <button
            onClick={onBack.onClick}
            className="mt-6 flex items-center gap-2 text-path-p2 text-white/90 hover:text-white transition-colors"
          >
            {onBack.isForward ? (
              <>
                <span>Continue to {onBack.label}</span>
                <span>→</span>
              </>
            ) : (
              <>
                <span>←</span>
                <span>Return to {onBack.label}</span>
              </>
            )}
          </button>
        )}
      </div>
      {productPackage && productPackage.items.length > 0 && (
        <div className="mt-6 flex-1 min-h-0 flex flex-col min-w-0">
          <PurchasedProductsSummary
            productPackage={productPackage}
            partnerName={partner.name}
            variant="sidebar"
            title={productSummaryTitle}
          />
        </div>
      )}
      {(!productPackage || productPackage.items.length === 0) && <div className="flex-1 min-h-0" />}
      <div className="flex flex-col gap-2 pt-8 text-path-p2 text-white/90">
        {onSaveForLater && (
          <button
            onClick={onSaveForLater}
            className="text-left hover:text-white transition-colors underline"
          >
            Save for later
          </button>
        )}
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
      </div>
    </aside>
  );
}

export default function BoardingEntryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = typeof params.token === "string" ? params.token : "";

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [step, setStep] = useState<"form" | "verify" | "done" | "step2" | "step3" | "step4" | "step5" | "step6" | "review">("form");
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

  // Save for later modal
  const [showSaveForLaterModal, setShowSaveForLaterModal] = useState(false);
  const [saveForLaterLoading, setSaveForLaterLoading] = useState(false);
  const [saveForLaterSuccess, setSaveForLaterSuccess] = useState(false);

  // SumSub identity verification
  const [sumsubToken, setSumsubToken] = useState<string | null>(null);
  const [sumsubLoading, setSumsubLoading] = useState(false);
  const [sumsubError, setSumsubError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"pending" | "completed" | "rejected" | null>(null);
  const [lastVerifiedIdentityCritical, setLastVerifiedIdentityCritical] = useState<{
    first: string; last: string; dob: string; country: string; postcode: string; line1: string; line2: string; town: string;
  } | null>(null);

  // Step 4: Business information
  const [businessType, setBusinessType] = useState<"ltd" | "llp" | "sole_trader" | "">("");
  const [companySearchText, setCompanySearchText] = useState("");
  const [companySearchResults, setCompanySearchResults] = useState<Array<{
    name: string;
    number: string;
    status: "Active" | "Dissolved";
    registeredOffice: string;
    fullAddress: string;
    incorporated: string;
    industry: string;
  }>>([]);
  const [companySearchLoading, setCompanySearchLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<{
    name: string;
    number: string;
    status: "Active" | "Dissolved";
    fullAddress: string;
    incorporated: string;
    industry: string;
    hasCorporateShareholders?: boolean;
  } | null>(null);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const companySearchRef = useRef<HTMLDivElement>(null);
  const [companyDetailsConfirmed, setCompanyDetailsConfirmed] = useState(false);
  const [companyDetailsEditing, setCompanyDetailsEditing] = useState(false);
  const [pscConfirmed, setPscConfirmed] = useState<boolean | null>(null);
  const [pscs, setPscs] = useState<Array<{
    id: string;
    fullLegalName: string;
    dateOfBirth: string;
    residentialPostcode: string;
    residentialLine1: string;
    residentialLine2: string;
    residentialTown: string;
    nationality: string;
    ownership: number;
  }>>([
    { id: "1", fullLegalName: "David Key", dateOfBirth: "", residentialPostcode: "", residentialLine1: "", residentialLine2: "", residentialTown: "", nationality: "", ownership: 50 },
    { id: "2", fullLegalName: "Louise Key", dateOfBirth: "", residentialPostcode: "", residentialLine1: "", residentialLine2: "", residentialTown: "", nationality: "", ownership: 50 },
  ]);
  const [corporateShareholders, setCorporateShareholders] = useState<
    Array<{
      id: string;
      name: string;
      companyNumber: string;
      ownership: number;
      beneficialOwners: Array<{
        id: string;
        fullLegalName: string;
        dateOfBirth: string;
        residentialPostcode: string;
        residentialLine1: string;
        residentialLine2: string;
        residentialTown: string;
        nationality: string;
        ownership: number;
      }>;
    }>
  >([
    {
      id: "corp-1",
      name: "HOLDCO LTD",
      companyNumber: "98765432",
      ownership: 25,
      beneficialOwners: [],
    },
  ]);

  // Business details (step5)
  const [vatNumber, setVatNumber] = useState("");
  const [customerIndustry, setCustomerIndustry] = useState("");
  const [customerIndustryTier1, setCustomerIndustryTier1] = useState("");
  const [customerIndustryTier2, setCustomerIndustryTier2] = useState("");
  const [estimatedMonthlyCardVolume, setEstimatedMonthlyCardVolume] = useState("");
  const [averageTransactionValue, setAverageTransactionValue] = useState("");
  const [deliveryTimeframe, setDeliveryTimeframe] = useState("");
  const [customerSupportEmail, setCustomerSupportEmail] = useState("");
  const [customerWebsites, setCustomerWebsites] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [mccTaxonomy, setMccTaxonomy] = useState<MccTaxonomy | null>(null);
  const [vatNumberError, setVatNumberError] = useState<string | null>(null);
  const [customerSupportEmailError, setCustomerSupportEmailError] = useState<string | null>(null);
  const [customerWebsitesError, setCustomerWebsitesError] = useState<string | null>(null);

  // Bank details (step6)
  const [accountName, setAccountName] = useState("");
  const [bankCurrency, setBankCurrency] = useState("GBP");
  const [bankCountry, setBankCountry] = useState("United Kingdom");
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [iban, setIban] = useState("");
  const [bankConfirmationChecked, setBankConfirmationChecked] = useState(false);
  const [sortCodeError, setSortCodeError] = useState<string | null>(null);
  const [accountNumberError, setAccountNumberError] = useState<string | null>(null);
  const [ibanError, setIbanError] = useState<string | null>(null);
  const [step6Submitting, setStep6Submitting] = useState(false);
  const [bankVerifying, setBankVerifying] = useState(false);
  const [bankVerificationMessage, setBankVerificationMessage] = useState<string | null>(null);
  const [bankVerified, setBankVerified] = useState<boolean | null>(null);
  const [reviewAgreeChecked, setReviewAgreeChecked] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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

  // UK VAT: GB123456789, 123456789, GBGD001, GBHA123, XI123456789
  const UK_VAT_REGEX = /^(GB\d{9}|GBGD\d{3}|GBHA\d{3}|XI\d{9}|\d{9})$/i;
  function validateVatNumber(value: string): string | null {
    const t = value.trim();
    if (!t) return null; // optional field
    if (!UK_VAT_REGEX.test(t)) {
      return "Enter a valid VAT number (e.g. GB123456789, 123456789, GBGD001, GBHA123, XI123456789).";
    }
    return null;
  }

  // Website: accepts www.name.com, name.com, or http(s)://... (supports comma-separated)
  function validateWebsite(value: string): string | null {
    const t = value.trim();
    if (!t) return null; // optional
    const urls = t.split(",").map((u) => u.trim()).filter(Boolean);
    // Domain with TLD: www.example.com, example.com, example.co.uk
    const domainOnly = /^(www\.)?[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/i;
    const withProtocol = /^https?:\/\/[^\s]+$/i;
    const hasTld = (u: string) => {
      const withoutProtocol = u.replace(/^https?:\/\//i, "").split("/")[0];
      return /\.[a-z]{2,}(\.[a-z]{2,})?$/i.test(withoutProtocol);
    };
    for (const url of urls) {
      if (domainOnly.test(url)) continue; // www.name.com or name.com
      if (withProtocol.test(url) && hasTld(url)) continue; // http(s)://...
      return "Enter a valid URL (e.g. www.example.com or https://www.example.com)";
    }
    return null;
  }

  // UK sort code: 6 digits, format as XX-XX-XX. Accepts 334455 or 33-44-55.
  function formatSortCode(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  }
  function validateSortCode(value: string): string | null {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0) return "Enter your sort code (6 digits).";
    if (digits.length !== 6) return "Sort code must be exactly 6 digits.";
    return null;
  }

  // UK account number: 8 digits. Note: full UK validation is sort-code dependent (VocaLink Mod 10/11/DB1A1)
  // and uses different weight tables per bank, so we only validate length to avoid rejecting valid accounts.
  function validateAccountNumber(value: string): string | null {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0) return "Enter your account number (8 digits).";
    if (digits.length !== 8) return "Account number must be exactly 8 digits.";
    return null;
  }

  // IBAN for EUR / non-UK: 2 letters + 2 digits + 4–30 alphanumeric (ISO 13616)
  const IBAN_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/;
  function validateIban(value: string): string | null {
    const normalised = value.replace(/\s/g, "").toUpperCase();
    if (normalised.length === 0) return "Enter your IBAN.";
    if (!IBAN_REGEX.test(normalised)) return "Enter a valid IBAN (e.g. GB82WEST12345698765432).";
    return null;
  }

  const EUROPEAN_CURRENCIES: { code: string; name: string }[] = [
    { code: "GBP", name: "British Pound" },
    { code: "EUR", name: "Euro" },
    { code: "SEK", name: "Swedish Krona" },
    { code: "NOK", name: "Norwegian Krone" },
    { code: "DKK", name: "Danish Krone" },
    { code: "CHF", name: "Swiss Franc" },
    { code: "PLN", name: "Polish Złoty" },
    { code: "CZK", name: "Czech Koruna" },
    { code: "HUF", name: "Hungarian Forint" },
    { code: "RON", name: "Romanian Leu" },
    { code: "BGN", name: "Bulgarian Lev" },
    { code: "HRK", name: "Croatian Kuna" },
    { code: "ISK", name: "Icelandic Króna" },
  ];

  const EUROPEAN_COUNTRIES = [
    "United Kingdom", "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina",
    "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France",
    "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Liechtenstein",
    "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia",
    "Norway", "Poland", "Portugal", "Romania", "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia",
    "Spain", "Sweden", "Switzerland", "Ukraine", "Vatican City",
  ];

  const postcodeLookupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Owner address lookup (for directors/beneficial owners - used when editing owner details)
  const [ownerAddressLookupTarget, setOwnerAddressLookupTarget] = useState<{ type: "psc"; id: string } | { type: "ubo"; corpId: string; uboId: string } | null>(null);
  const [ownerAddressLookupResults, setOwnerAddressLookupResults] = useState<{ addressLine1: string; addressLine2: string; town: string; postcode: string }[]>([]);
  const [ownerAddressLookupLoading, setOwnerAddressLookupLoading] = useState(false);
  const [ownerAddressLookupError, setOwnerAddressLookupError] = useState<string | null>(null);

  async function fetchAddressLookupForOwner(postcodeValue: string, target: { type: "psc"; id: string } | { type: "ubo"; corpId: string; uboId: string }) {
    const pc = postcodeValue.trim();
    if (!pc || !isValidUkPostcode(pc)) return;
    setOwnerAddressLookupError(null);
    setOwnerAddressLookupLoading(true);
    setOwnerAddressLookupResults([]);
    setOwnerAddressLookupTarget(target);
    try {
      const res = await apiGet<{ addressLine1: string; addressLine2: string; town: string; postcode: string }[]>(
        `/boarding/address-lookup?postcode=${encodeURIComponent(pc)}`
      );
      if (res.error) {
        const msg = typeof res.error === "string" ? res.error : "Could not load addresses.";
        setOwnerAddressLookupError(msg);
        return;
      }
      const list = Array.isArray(res.data) ? res.data : [];
      setOwnerAddressLookupResults(list);
      if (list.length === 0) setOwnerAddressLookupError("No addresses found for this postcode.");
    } catch {
      setOwnerAddressLookupError("Could not load addresses. Please enter your address manually.");
    } finally {
      setOwnerAddressLookupLoading(false);
    }
  }

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

  // Load saved data and pre-populate forms
  useEffect(() => {
    if (!token || !inviteInfo) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<{
          has_data: boolean;
          current_step?: string;
          email?: string;
          email_verified: boolean;
          legal_first_name?: string;
          legal_last_name?: string;
          date_of_birth?: string;
          address_country?: string;
          address_postcode?: string;
          address_line1?: string;
          address_line2?: string;
          address_town?: string;
          phone_country_code?: string;
          phone_number?: string;
          sumsub_verification_status?: string | null;
          vat_number?: string;
          customer_industry?: string;
          estimated_monthly_card_volume?: string;
          average_transaction_value?: string;
          delivery_timeframe?: string;
          customer_support_email?: string;
          customer_websites?: string;
          product_description?: string;
          bank_account_name?: string;
          bank_currency?: string;
          bank_country?: string;
          bank_sort_code?: string;
          bank_account_number?: string;
          bank_iban?: string;
          truelayer_verified_at?: string | null;
          truelayer_verified?: boolean | null;
          truelayer_verification_message?: string | null;
        }>(`/boarding/saved-data?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (res.data?.has_data) {
          // Pre-populate email from step 1
          if (res.data.email) {
            setEmail(res.data.email);
            setEmailPersonal(res.data.email);
            if (isValidEmail(res.data.email)) {
              setStep1VerifiedFields((f) => ({ ...f, email: true }));
              setVerifiedFields((f) => ({ ...f, email: true }));
            }
          }
          
          // Pre-populate step 2 personal details
          if (res.data.legal_first_name) {
            setLegalFirstName(res.data.legal_first_name);
            setVerifiedFields((f) => ({ ...f, legalFirst: true }));
          }
          if (res.data.legal_last_name) {
            setLegalLastName(res.data.legal_last_name);
            setVerifiedFields((f) => ({ ...f, legalLast: true }));
          }
          if (res.data.date_of_birth) {
            setDateOfBirth(res.data.date_of_birth);
            setVerifiedFields((f) => ({ ...f, dob: true }));
          }
          if (res.data.address_country) {
            setAddressCountry(res.data.address_country);
            setVerifiedFields((f) => ({ ...f, country: true }));
          }
          if (res.data.address_postcode) {
            setAddressPostcode(res.data.address_postcode);
            setVerifiedFields((f) => ({ ...f, postcode: true }));
          }
          if (res.data.address_line1) {
            setAddressLine1(res.data.address_line1);
            setVerifiedFields((f) => ({ ...f, line1: true }));
          }
          if (res.data.address_line2) {
            setAddressLine2(res.data.address_line2);
            setVerifiedFields((f) => ({ ...f, line2: true }));
          }
          if (res.data.address_town) {
            setAddressTown(res.data.address_town);
            setVerifiedFields((f) => ({ ...f, town: true }));
          }
          if (res.data.phone_country_code) {
            setPhoneCountryCode(res.data.phone_country_code);
          }
          if (res.data.phone_number) {
            setPhoneNumber(res.data.phone_number);
            setVerifiedFields((f) => ({ ...f, phone: true }));
          }
          if (res.data.sumsub_verification_status != null) {
            setVerificationStatus(res.data.sumsub_verification_status as "pending" | "completed" | "rejected");
            if (res.data.sumsub_verification_status === "completed" && res.data.legal_first_name != null && res.data.legal_last_name != null) {
              setLastVerifiedIdentityCritical({
                first: res.data.legal_first_name,
                last: res.data.legal_last_name,
                dob: res.data.date_of_birth ?? "",
                country: res.data.address_country ?? "",
                postcode: res.data.address_postcode ?? "",
                line1: res.data.address_line1 ?? "",
                line2: res.data.address_line2 ?? "",
                town: res.data.address_town ?? "",
              });
            }
          } else {
            setVerificationStatus(null);
            setLastVerifiedIdentityCritical(null);
          }
          
          // Pre-populate step 5 business details
          if (res.data.vat_number != null) setVatNumber(res.data.vat_number);
          if (res.data.customer_industry != null) setCustomerIndustry(res.data.customer_industry);
          if (res.data.estimated_monthly_card_volume != null) setEstimatedMonthlyCardVolume(res.data.estimated_monthly_card_volume);
          if (res.data.average_transaction_value != null) setAverageTransactionValue(res.data.average_transaction_value);
          if (res.data.delivery_timeframe != null) setDeliveryTimeframe(res.data.delivery_timeframe);
          if (res.data.customer_support_email != null) setCustomerSupportEmail(res.data.customer_support_email);
          if (res.data.customer_websites != null) setCustomerWebsites(res.data.customer_websites);
          if (res.data.product_description != null) setProductDescription(res.data.product_description);
          if (res.data.bank_account_name != null) setAccountName(res.data.bank_account_name);
          if (res.data.bank_currency != null) setBankCurrency(res.data.bank_currency);
          if (res.data.bank_country != null) setBankCountry(res.data.bank_country);
          if (res.data.bank_sort_code != null) setSortCode(formatSortCode(res.data.bank_sort_code));
          if (res.data.bank_account_number != null) setAccountNumber(res.data.bank_account_number);
          if (res.data.bank_iban != null) setIban(res.data.bank_iban);
          if (res.data.truelayer_verified_at != null) {
            setBankVerified(res.data.truelayer_verified ?? false);
            setBankVerificationMessage(res.data.truelayer_verification_message ?? null);
          }
          
          // Navigate to the correct step based on current_step
          if (res.data.email_verified && res.data.current_step) {
            setStep(res.data.current_step as any);
          } else if (res.data.email_verified) {
            setStep("step2");
          }
        }
      } catch {
        // ignore - user might not have saved data yet
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, inviteInfo]); // run once when we have inviteInfo

  // Handle return from TrueLayer bank verification callback
  useEffect(() => {
    const stepParam = searchParams.get("step");
    const verifiedParam = searchParams.get("bank_verified");
    const messageParam = searchParams.get("bank_verification_message");
    const errorParam = searchParams.get("error");
    const errorDetailParam = searchParams.get("error_detail");
    if (stepParam === "step6" && token) {
      setStep("step6");
      setBankConfirmationChecked(true); // restore – user had it checked to reach Verify
      if (verifiedParam !== null) {
        setBankVerified(verifiedParam === "1");
        if (messageParam) setBankVerificationMessage(decodeURIComponent(messageParam));
      }
      if (errorParam) {
        let msg = "Bank verification failed. Please try again.";
        if (errorParam === "token_exchange") {
          msg = "Could not complete bank connection. Check that your redirect URI is whitelisted in TrueLayer Console.";
        } else if (errorParam === "verification_failed") {
          msg = "Verification API failed. Please try again.";
        }
        if (errorDetailParam) {
          try {
            const detail = decodeURIComponent(errorDetailParam);
            if (detail && detail.length < 150) msg += ` (${detail})`;
          } catch {
            /* ignore */
          }
        }
        setBankVerificationMessage(msg);
      }
      if (verifiedParam !== null || errorParam) {
        router.replace(`/board/${token}`, { scroll: false });
      }
    }
  }, [searchParams, token, router]);

  // Pre-populate directors when company is confirmed: matching verified user + Louise for demo
  const verifiedUserName = [legalFirstName.trim(), legalLastName.trim()].filter(Boolean).join(" ");
  useEffect(() => {
    if (!companyDetailsConfirmed) return;
    setPscs((prev) => {
      // First pass: fill matching verified user
      let updated = prev.map((p) => {
        const nameMatch = verifiedUserName && p.fullLegalName.trim().toLowerCase() === verifiedUserName.toLowerCase();
        if (!nameMatch) return p;
        return {
          ...p,
          dateOfBirth: p.dateOfBirth || dateOfBirth,
          residentialPostcode: p.residentialPostcode || addressPostcode,
          residentialLine1: p.residentialLine1 || addressLine1,
          residentialLine2: p.residentialLine2 || addressLine2,
          residentialTown: p.residentialTown || addressTown,
          nationality: p.nationality || addressCountry,
        };
      });
      // Demo: pre-fill Louise Key with DOB 12/02/1978, same address/nationality as David (or personal details / demo fallback)
      const david = updated.find((p) => p.fullLegalName.toLowerCase().includes("david key"));
      const louise = updated.find((p) => p.fullLegalName.toLowerCase().includes("louise key"));
      if (louise) {
        const demoPostcode = david?.residentialPostcode || addressPostcode || "SS1 3QU";
        const demoLine1 = david?.residentialLine1 || addressLine1 || "1 Example Street";
        const demoLine2 = david?.residentialLine2 || addressLine2 || "";
        const demoTown = david?.residentialTown || addressTown || "Southend-on-Sea";
        const demoNationality = david?.nationality || addressCountry || "United Kingdom";
        updated = updated.map((p) => {
          if (p.id !== louise.id) return p;
          return {
            ...p,
            dateOfBirth: p.dateOfBirth || "12/02/1978",
            residentialPostcode: p.residentialPostcode || demoPostcode,
            residentialLine1: p.residentialLine1 || demoLine1,
            residentialLine2: p.residentialLine2 || demoLine2,
            residentialTown: p.residentialTown || demoTown,
            nationality: p.nationality || demoNationality,
          };
        });
      }
      return updated;
    });
  }, [companyDetailsConfirmed, verifiedUserName, dateOfBirth, addressPostcode, addressLine1, addressLine2, addressTown, addressCountry]);

  // Mock company data for Step 4 (Companies House API to be connected later)
  const MOCK_COMPANIES = [
    {
      name: "PATHCAFE LTD",
      number: "13377890",
      status: "Active" as const,
      registeredOffice: "Southend-on-Sea",
      fullAddress: "87 Broadclyst Gardens\nSouthend-on-Sea\nSS1 3QU",
      incorporated: "10 April 2021",
      industry: "Restaurants and mobile food service",
      hasCorporateShareholders: false,
    },
    {
      name: "PATH PAYMENTS LTD",
      number: "12345678",
      status: "Active" as const,
      registeredOffice: "London",
      fullAddress: "10 Example Street\nLondon\nSW1A 1AA",
      incorporated: "12 March 2021",
      industry: "Financial intermediation",
      hasCorporateShareholders: true,
    },
    {
      name: "DJIL LTD",
      number: "11223344",
      status: "Active" as const,
      registeredOffice: "London",
      fullAddress: "15 Demo Road\nLondon\nE1 6AN",
      incorporated: "5 June 2020",
      industry: "Information technology",
      hasCorporateShareholders: false,
    },
    {
      name: "EXAMPLE DISSOLVED LTD",
      number: "87654321",
      status: "Dissolved" as const,
      registeredOffice: "Manchester",
      fullAddress: "5 Old Road\nManchester\nM1 2AB",
      incorporated: "1 January 2015",
      industry: "Retail trade",
      hasCorporateShareholders: false,
    },
  ];


  // Debounced company search (mock - returns mock results when text matches)
  useEffect(() => {
    if (businessType !== "ltd" || !companySearchText.trim()) {
      setCompanySearchResults([]);
      setShowCompanyDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      setCompanySearchLoading(true);
      // Mock: return companies if search matches name or number
      const query = companySearchText.trim().toUpperCase().replace(/\s/g, "");
      const matches = MOCK_COMPANIES.filter((c) =>
        c.name.toUpperCase().replace(/\s/g, "").includes(query) || c.number.includes(query)
      );
      setCompanySearchResults(matches);
      setCompanySearchLoading(false);
      setShowCompanyDropdown(matches.length > 0);
    }, 400);
    return () => clearTimeout(timer);
  }, [companySearchText, businessType]);

  // Close company dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (companySearchRef.current && !companySearchRef.current.contains(e.target as Node)) {
        setShowCompanyDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // MCC taxonomy for step5 – must run before any early returns (hooks rules)
  const uxTaxonomy = mccTaxonomy?.ux_taxonomy ?? [];
  useEffect(() => {
    fetch("/mcc_taxonomy_uk_prototype.json")
      .then((r) => r.json())
      .then((data) => setMccTaxonomy(data as MccTaxonomy))
      .catch(() => setMccTaxonomy({ ux_taxonomy: [] }));
  }, []);
  const selectedTier1 = useMemo(
    () => uxTaxonomy.find((t) => t.id === customerIndustryTier1),
    [uxTaxonomy, customerIndustryTier1]
  );
  const selectedTier2 = useMemo(
    () => selectedTier1?.children.find((c) => c.id === customerIndustryTier2),
    [selectedTier1, customerIndustryTier2]
  );
  useEffect(() => {
    if (customerIndustry && !customerIndustryTier1 && uxTaxonomy.length > 0) {
      for (const t1 of uxTaxonomy) {
        for (const t2 of t1.children) {
          if (t2.items.some((i) => i.mcc === customerIndustry)) {
            setCustomerIndustryTier1(t1.id);
            setCustomerIndustryTier2(t2.id);
            return;
          }
        }
      }
    }
  }, [customerIndustry, customerIndustryTier1, uxTaxonomy]);

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

  async function handleSaveForLater() {
    setSaveForLaterLoading(true);
    try {
      const payload: { current_step: string; vat_number?: string; customer_industry?: string; estimated_monthly_card_volume?: string; average_transaction_value?: string; delivery_timeframe?: string; customer_support_email?: string; customer_websites?: string; product_description?: string; bank_account_name?: string; bank_currency?: string; bank_country?: string; bank_sort_code?: string; bank_account_number?: string; bank_iban?: string } = {
        current_step: step,
      };
      if (step === "step5" || step === "review") {
        payload.vat_number = vatNumber;
        payload.customer_industry = customerIndustry;
        payload.estimated_monthly_card_volume = estimatedMonthlyCardVolume;
        payload.average_transaction_value = averageTransactionValue;
        payload.delivery_timeframe = deliveryTimeframe;
        payload.customer_support_email = customerSupportEmail;
        payload.customer_websites = customerWebsites;
        payload.product_description = productDescription;
      }
      if (step === "step6" || step === "review") {
        payload.bank_account_name = accountName;
        payload.bank_currency = bankCurrency;
        payload.bank_country = bankCountry;
        payload.bank_sort_code = sortCode.replace(/\D/g, "") ? sortCode : undefined;
        payload.bank_account_number = accountNumber.replace(/\D/g, "") ? accountNumber : undefined;
        payload.bank_iban = iban ? iban.replace(/\s/g, "").toUpperCase() : undefined;
      }
      const res = await apiPost<{ sent: boolean; message: string }>(
        `/boarding/save-for-later?token=${encodeURIComponent(token)}`,
        payload
      );
      if (res.error) {
        alert(res.error);
        setSaveForLaterLoading(false);
        return;
      }
      setSaveForLaterSuccess(true);
      setSaveForLaterLoading(false);
    } catch {
      alert("Failed to send email. Please try again.");
      setSaveForLaterLoading(false);
    }
  }

  async function initializeSumSub() {
    setSumsubLoading(true);
    setSumsubError(null);
    try {
      const res = await apiPost<{ token: string; user_id: string }>(
        `/boarding/sumsub/generate-token?token=${encodeURIComponent(token ?? "")}`,
        {}
      );

      console.log("[SumSub] Response:", res);

      if (res.error) {
        const msg = res.error + (res.statusCode ? ` (HTTP ${res.statusCode})` : "");
        setSumsubError(msg);
        setSumsubLoading(false);
        return;
      }
      if (!res.data?.token) {
        setSumsubError("No token received from server.");
        setSumsubLoading(false);
        return;
      }
      setSumsubToken(res.data.token);
      setSumsubLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to initialize verification. Please try again.";
      console.error("[SumSub] Error:", err);
      setSumsubError(msg);
      setSumsubLoading(false);
    }
  }

  function handleSumsubMessage(type: string, payload: any) {
    console.log("SumSub message:", type, payload);
    
    if (type === "idCheck.onReady") {
      // Verification widget loaded
      console.log("SumSub widget ready");
    }
    
    if (type === "idCheck.onApplicantSubmitted") {
      // User submitted documents - check review status
      console.log("User submitted verification, status:", payload?.reviewStatus);
      
      // Check the actual review status
      const reviewStatus = payload?.reviewStatus;
      
      if (reviewStatus === "completed") {
        // Auto-check approved immediately
        handleVerificationComplete("completed");
      } else if (reviewStatus === "pending") {
        // Waiting for review (manual or auto-check in progress)
        console.log("Verification submitted, pending review");
        // Mark as pending and show appropriate message
        setVerificationStatus("pending");
        handleVerificationComplete("completed"); // Still move to next step
      } else {
        // Other statuses
        console.log("Unexpected review status:", reviewStatus);
        handleVerificationComplete("completed"); // Default: move forward
      }
    }
    
    if (type === "idCheck.onApplicantReviewed") {
      // Final review decision from SumSub
      console.log("Review completed:", payload);
      const reviewResult = payload?.reviewResult?.reviewAnswer;
      
      if (reviewResult === "GREEN") {
        handleVerificationComplete("completed");
      } else if (reviewResult === "RED") {
        handleVerificationComplete("rejected");
      }
    }
    
    if (type === "idCheck.onError") {
      // Verification encountered an error
      console.error("SumSub error:", payload);
      setSumsubError("Verification encountered an error. Please try again.");
    }
  }

  async function handleVerificationComplete(status: "completed" | "rejected") {
    try {
      const res = await apiPost(
        `/boarding/sumsub/complete?token=${encodeURIComponent(token)}&status=${status}`,
        {}
      );
      if (res.error) {
        console.error("Failed to update verification status:", res.error);
        return;
      }
      
      setVerificationStatus(status);
      
      if (status === "completed") {
        setLastVerifiedIdentityCritical({
          first: legalFirstName.trim(),
          last: legalLastName.trim(),
          dob: dateOfBirth.trim(),
          country: addressCountry.trim(),
          postcode: addressPostcode.trim(),
          line1: addressLine1.trim(),
          line2: addressLine2.trim(),
          town: addressTown.trim(),
        });
        setTimeout(() => {
          setStep("step4");
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to complete verification:", err);
    }
  }

  async function handlePersonalDetailsSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
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
    const identityUnchanged =
      verificationStatus === "completed" &&
      lastVerifiedIdentityCritical &&
      first === lastVerifiedIdentityCritical.first &&
      last === lastVerifiedIdentityCritical.last &&
      dob === lastVerifiedIdentityCritical.dob &&
      country === lastVerifiedIdentityCritical.country &&
      postcode === lastVerifiedIdentityCritical.postcode &&
      line1 === lastVerifiedIdentityCritical.line1 &&
      (line2 || "") === lastVerifiedIdentityCritical.line2 &&
      town === lastVerifiedIdentityCritical.town;
    if (identityUnchanged) {
      setStep("step4");
    } else {
      setVerificationStatus(null);
      setLastVerifiedIdentityCritical(null);
      setSumsubToken(null);
      setSumsubError(null);
      setStep("step3");
    }
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
            <button
              onClick={handlePersonalDetailsSubmit}
              className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                <Image src="/icons/form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain opacity-50" />
              </span>
              Verify
            </button>
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
                            className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 bg-white h-11 board-focus"
                            style={{ minHeight: "2.75rem" }}
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
        {inviteInfo && (
          <BoardingRightPanel 
            partner={inviteInfo.partner}
            onSaveForLater={() => setShowSaveForLaterModal(true)}
          />
        )}
        
        {/* Save for Later Modal */}
        {showSaveForLaterModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              {!saveForLaterSuccess ? (
                <>
                  <h2 className="text-path-h3 font-poppins text-path-primary mb-4">Save for later</h2>
                  <p className="text-path-p1 text-path-grey-700 mb-4">
                    Your progress has been saved and is available for the next 14 days for you to return and complete.
                  </p>
                  <p className="text-path-p1 text-path-grey-700 mb-6">
                    We'll send an email to your email address with a link that will take you to the merchant boarding login screen.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSaveForLaterModal(false)}
                      className="flex-1 px-4 py-2 border border-path-grey-300 rounded-lg text-path-grey-700 hover:bg-path-grey-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveForLater}
                      disabled={saveForLaterLoading}
                      className="flex-1 px-4 py-2 bg-path-primary text-white rounded-lg hover:bg-path-primary-light-1 transition-colors disabled:opacity-50"
                    >
                      {saveForLaterLoading ? "Sending..." : "Continue"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-path-h3 font-poppins text-path-primary mb-4">Email sent!</h2>
                  <p className="text-path-p1 text-path-grey-700 mb-6">
                    We've sent a link to your email address. You can use it to return and complete your boarding anytime within the next 14 days.
                  </p>
                  <button
                    onClick={() => {
                      setShowSaveForLaterModal(false);
                      setSaveForLaterSuccess(false);
                      router.push("/");
                    }}
                    className="w-full px-4 py-2 bg-path-primary text-white rounded-lg hover:bg-path-primary-light-1 transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        )}
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
            <button
              onClick={() => setStep("step2")}
              className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                <Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" />
              </span>
              Personal Details
            </button>
            <span className="mx-1 text-path-grey-400">/</span>
            <span className="flex items-center gap-1.5 font-medium text-path-primary">
              <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                <Image src="/icons/form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" />
              </span>
              Verify
            </span>
          </nav>
            <h1 className="text-path-h2 font-poppins text-path-primary mb-4">Time to verify your identity</h1>
            
            {!sumsubToken && !verificationStatus ? (
              <>
                <div className="space-y-4 text-path-p1 text-path-grey-700 mb-8">
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
                
                {sumsubError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-path-p2">
                    {sumsubError}
                  </div>
                )}
                
                <button
                  onClick={initializeSumSub}
                  disabled={sumsubLoading}
                  className="w-full bg-path-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sumsubLoading ? "Loading..." : "Start Verification"}
                </button>
              </>
            ) : verificationStatus === "pending" ? (
              <div className="space-y-4">
                <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <h2 className="text-path-h3 font-poppins text-blue-800">Verification Submitted!</h2>
                  </div>
                  <p className="text-path-p1 text-blue-700 mb-2">
                    Thank you for submitting your documents. Your verification is being reviewed.
                  </p>
                  <p className="text-path-p2 text-blue-600">
                    This typically takes 1-5 minutes. You can continue with the application, and we'll notify you once the review is complete.
                  </p>
                </div>
                <p className="text-path-p2 text-path-grey-600 text-center">
                  Redirecting to next step...
                </p>
              </div>
            ) : verificationStatus === "completed" ? (
              <div className="space-y-4">
                <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-path-h3 font-poppins text-green-800">Verification Complete!</h2>
                  </div>
                  <p className="text-path-p1 text-green-700">
                    Thank you for completing your identity verification. We're now processing your information.
                  </p>
                </div>
                <button
                  onClick={() => setStep("step4")}
                  className="w-full bg-path-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors"
                >
                  Continue
                </button>
              </div>
            ) : verificationStatus === "rejected" ? (
              <div className="space-y-4">
                <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <h2 className="text-path-h3 font-poppins text-red-800">Verification Not Approved</h2>
                  </div>
                  <p className="text-path-p1 text-red-700 mb-4">
                    Unfortunately, we were unable to verify your identity at this time. This could be due to:
                  </p>
                  <ul className="list-disc list-inside text-path-p2 text-red-700 space-y-1 mb-4">
                    <li>Document quality issues</li>
                    <li>Document expiration</li>
                    <li>Photo clarity concerns</li>
                  </ul>
                  <p className="text-path-p2 text-red-700">
                    Please contact support for assistance at{" "}
                    <a href="mailto:support@path2ai.tech" className="text-red-800 underline">
                      support@path2ai.tech
                    </a>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setVerificationStatus(null);
                    setSumsubToken(null);
                    setSumsubError(null);
                  }}
                  className="w-full bg-path-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : sumsubToken ? (
              <div className="space-y-4">
                <p className="text-path-p2 text-path-grey-600">
                  Please complete the verification steps below:
                </p>
                <div className="border border-path-grey-200 rounded-lg overflow-hidden">
                  <SumsubWebSdk
                    accessToken={sumsubToken}
                    expirationHandler={() => {
                      console.log("Token expired, refreshing...");
                      initializeSumSub();
                    }}
                    config={{
                      lang: "en",
                      theme: "light",
                    }}
                    options={{
                      addViewportTag: false,
                      adaptIframeHeight: true,
                    }}
                    onMessage={handleSumsubMessage}
                    onError={(error: any) => {
                      console.error("SumSub error:", error);
                      setSumsubError("An error occurred during verification. Please try again.");
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500 text-center">
            © 2026 Path2ai.tech
          </footer>
        </main>
        {inviteInfo && (
          <BoardingRightPanel 
            partner={inviteInfo.partner}
            onBack={{
              label: "Personal Details",
              onClick: () => setStep("step2")
            }}
            onSaveForLater={() => setShowSaveForLaterModal(true)}
          />
        )}
        
        {/* Save for Later Modal */}
        {showSaveForLaterModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              {!saveForLaterSuccess ? (
                <>
                  <h2 className="text-path-h3 font-poppins text-path-primary mb-4">Save for later</h2>
                  <p className="text-path-p1 text-path-grey-700 mb-4">
                    Your progress has been saved and is available for the next 14 days for you to return and complete.
                  </p>
                  <p className="text-path-p1 text-path-grey-700 mb-6">
                    We'll send an email to your email address with a link that will take you to the merchant boarding login screen.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSaveForLaterModal(false)}
                      className="flex-1 px-4 py-2 border border-path-grey-300 rounded-lg text-path-grey-700 hover:bg-path-grey-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveForLater}
                      disabled={saveForLaterLoading}
                      className="flex-1 px-4 py-2 bg-path-primary text-white rounded-lg hover:bg-path-primary-light-1 transition-colors disabled:opacity-50"
                    >
                      {saveForLaterLoading ? "Sending..." : "Continue"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-path-h3 font-poppins text-path-primary mb-4">Email sent!</h2>
                  <p className="text-path-p1 text-path-grey-700 mb-6">
                    We've sent a link to your email address. You can use it to return and complete your boarding anytime within the next 14 days.
                  </p>
                  <button
                    onClick={() => {
                      setShowSaveForLaterModal(false);
                      setSaveForLaterSuccess(false);
                      router.push("/");
                    }}
                    className="w-full px-4 py-2 bg-path-primary text-white rounded-lg hover:bg-path-primary-light-1 transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === "step4") {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900">
          <header className="flex items-center gap-4 mb-8">
            <Image src="/logo-path.png" alt="Path" width={140} height={40} />
          </header>
          <div className="flex-1 max-w-md mx-auto w-full">
            <nav className="flex items-center flex-wrap gap-1 text-path-p2 text-path-grey-600 mb-6" aria-label="Breadcrumb">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                  <Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" />
                </span>
                Account
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button
                type="button"
                onClick={() => setStep("step2")}
                className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                  <Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" />
                </span>
                Personal Details
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button
                type="button"
                onClick={() => setStep("step3")}
                className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                  <Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" />
                </span>
                Verify
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <span className="flex items-center gap-1.5 font-medium text-path-primary">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                  <Image src="/icons/form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                </span>
                Business
              </span>
            </nav>
            <h1 className="text-path-h2 font-poppins text-path-primary mb-6">Business Information</h1>

            {/* Business type */}
            <div className="mb-8">
              <h2 className="text-path-h3 font-poppins text-path-grey-900 mb-4">What type of business are you?</h2>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer p-4 border border-path-grey-200 rounded-lg hover:border-path-primary hover:bg-path-grey-50 transition-colors has-[:checked]:border-path-primary has-[:checked]:bg-path-primary/5">
                  <input
                    type="radio"
                    name="businessType"
                    value="ltd"
                    checked={businessType === "ltd"}
                    onChange={() => setBusinessType("ltd")}
                    className="w-5 h-5 text-path-primary border-path-grey-300 focus:ring-path-primary"
                  />
                  <span className="text-path-p1 text-path-grey-900 font-medium">Limited Company (Ltd)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-4 border border-path-grey-200 rounded-lg hover:border-path-primary hover:bg-path-grey-50 transition-colors has-[:checked]:border-path-primary has-[:checked]:bg-path-primary/5">
                  <input
                    type="radio"
                    name="businessType"
                    value="llp"
                    checked={businessType === "llp"}
                    onChange={() => setBusinessType("llp")}
                    className="w-5 h-5 text-path-primary border-path-grey-300 focus:ring-path-primary"
                  />
                  <span className="text-path-p1 text-path-grey-900 font-medium">Limited Liability Partnership (LLP)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-4 border border-path-grey-200 rounded-lg hover:border-path-primary hover:bg-path-grey-50 transition-colors has-[:checked]:border-path-primary has-[:checked]:bg-path-primary/5">
                  <input
                    type="radio"
                    name="businessType"
                    value="sole_trader"
                    checked={businessType === "sole_trader"}
                    onChange={() => setBusinessType("sole_trader")}
                    className="w-5 h-5 text-path-primary border-path-grey-300 focus:ring-path-primary"
                  />
                  <span className="text-path-p1 text-path-grey-900 font-medium">Sole Trader</span>
                </label>
              </div>
            </div>

            {/* Company search - shown for Ltd and LLP */}
            {(businessType === "ltd" || businessType === "llp") && !selectedCompany && (
              <div className="mb-8" ref={companySearchRef}>
                <h2 className="text-path-h3 font-poppins text-path-grey-900 mb-4">Find your registered company</h2>
                <div className="relative">
                  <label htmlFor="companyName" className="block text-path-p2 text-path-grey-600 mb-2">
                    Company name
                  </label>
                  <div className="relative">
                    <input
                      id="companyName"
                      type="text"
                      value={companySearchText}
                      onChange={(e) => setCompanySearchText(e.target.value)}
                      onFocus={() => companySearchResults.length > 0 && setShowCompanyDropdown(true)}
                      placeholder="e.g. PATH PAYMENTS LTD"
                      className="w-full px-4 py-3 pr-12 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 placeholder-path-grey-400 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-path-grey-600 pointer-events-none">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                  </div>
                  {companySearchLoading && (
                    <p className="mt-2 text-path-p2 text-path-grey-500">Searching...</p>
                  )}
                  {showCompanyDropdown && companySearchResults.length > 0 && (
                    <div className="mt-2 border border-path-grey-200 rounded-lg divide-y divide-path-grey-100 overflow-hidden bg-white shadow-lg">
                      {companySearchResults.map((company) => (
                        <button
                          key={company.number}
                          type="button"
                          onClick={() => {
                            const c = company as typeof company & { hasCorporateShareholders?: boolean };
                            setSelectedCompany(c);
                            setCompanySearchText(c.name);
                            setCompanyDetailsEditing(false);
                            setShowCompanyDropdown(false);
                            setCompanySearchResults([]);
                            setPscConfirmed(null);
                            setPscs([
                              { id: "1", fullLegalName: "David Key", dateOfBirth: "", residentialPostcode: "", residentialLine1: "", residentialLine2: "", residentialTown: "", nationality: "", ownership: 50 },
                              { id: "2", fullLegalName: "Louise Key", dateOfBirth: "", residentialPostcode: "", residentialLine1: "", residentialLine2: "", residentialTown: "", nationality: "", ownership: 50 },
                            ]);
                            setCorporateShareholders(
                              c.hasCorporateShareholders
                                ? [{ id: "corp-1", name: "HOLDCO LTD", companyNumber: "98765432", ownership: 25, beneficialOwners: [] }]
                                : []
                            );
                          }}
                          className={`w-full text-left p-4 hover:bg-path-grey-50 transition-colors ${company.status === "Dissolved" ? "opacity-60" : ""}`}
                        >
                          <div className="font-medium text-path-grey-900">{company.name}</div>
                          <div className="text-path-p2 text-path-grey-600 mt-1">
                            Company number: {company.number}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              company.status === "Active" ? "bg-green-100 text-green-800" : "bg-path-grey-200 text-path-grey-600"
                            }`}>
                              {company.status}
                            </span>
                            <span className="text-path-p2 text-path-grey-600">
                              Registered office: {company.registeredOffice}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Company confirmation - shown when company selected */}
            {selectedCompany && (
              <div className="mb-8">
                <h2 className="text-path-h3 font-poppins text-path-grey-900 mb-4">
                  {companyDetailsEditing ? "Edit your company details" : "Confirm your company details"}
                </h2>
                <div className="p-6 border border-path-grey-200 rounded-lg space-y-4 bg-path-grey-50/50">
                  <div>
                    <label className="block text-path-p2 text-path-grey-600 mt-1 mb-1">Legal name</label>
                    {companyDetailsEditing ? (
                      <input
                        type="text"
                        value={selectedCompany.name}
                        onChange={(e) => setSelectedCompany((prev) => prev ? { ...prev, name: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                      />
                    ) : (
                      <div className="text-path-p1 font-medium text-path-grey-900">{selectedCompany.name}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-path-p2 text-path-grey-600 mt-1 mb-1">Company number</label>
                    {companyDetailsEditing ? (
                      <input
                        type="text"
                        value={selectedCompany.number}
                        onChange={(e) => setSelectedCompany((prev) => prev ? { ...prev, number: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                      />
                    ) : (
                      <div className="text-path-p1 font-medium text-path-grey-900">{selectedCompany.number}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-path-p2 text-path-grey-600 mt-1 mb-1">Registered address</label>
                    {companyDetailsEditing ? (
                      <textarea
                        value={selectedCompany.fullAddress}
                        onChange={(e) => setSelectedCompany((prev) => prev ? { ...prev, fullAddress: e.target.value } : null)}
                        rows={4}
                        className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                      />
                    ) : (
                      <div className="text-path-p1 text-path-grey-900 whitespace-pre-line">{selectedCompany.fullAddress}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-path-p2 text-path-grey-600 mt-1 mb-1">Incorporated (DD/MM/YYYY)</label>
                    {companyDetailsEditing ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={selectedCompany.incorporated}
                        onChange={(e) => {
                          const val = e.target.value;
                          const raw = val.replace(/\D/g, "").slice(0, 8);
                          let formatted = "";
                          if (raw.length > 0) formatted = raw.slice(0, 2);
                          if (raw.length > 2) formatted += "/" + raw.slice(2, 4);
                          if (raw.length > 4) formatted += "/" + raw.slice(4, 8);
                          if (val.trim().endsWith("/") && (raw.length === 2 || raw.length === 4)) formatted += "/";
                          setSelectedCompany((prev) => prev ? { ...prev, incorporated: formatted } : null);
                        }}
                        placeholder="DD/MM/YYYY"
                        maxLength={10}
                        className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                      />
                    ) : (
                      <div className="text-path-p1 text-path-grey-900">{selectedCompany.incorporated}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-path-p2 text-path-grey-600 mt-1 mb-1">Industry (SIC)</label>
                    {companyDetailsEditing ? (
                      <input
                        type="text"
                        value={selectedCompany.industry}
                        onChange={(e) => setSelectedCompany((prev) => prev ? { ...prev, industry: e.target.value } : null)}
                        className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                      />
                    ) : (
                      <div className="text-path-p1 text-path-grey-900">{selectedCompany.industry}</div>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCompanyDetailsConfirmed(true);
                      setCompanyDetailsEditing(false);
                    }}
                    className="w-full py-3 px-4 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors"
                  >
                    These details are correct
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCompanyDetailsEditing(true);
                      // Convert "12 March 2021" style to DD/MM/YYYY when entering edit mode
                      setSelectedCompany((prev) => {
                        if (!prev?.incorporated) return prev;
                        const s = prev.incorporated.trim();
                        const ddmm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
                        if (ddmm) return prev;
                        const months: Record<string, string> = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
                        const match = /^(\d{1,2})\s+(\w+)\s+(\d{4})$/.exec(s);
                        if (match) {
                          const [, day, month, year] = match;
                          const m = months[month.toLowerCase()];
                          if (m) {
                            const d = day.padStart(2, "0");
                            return { ...prev, incorporated: `${d}/${m}/${year}` };
                          }
                        }
                        return prev;
                      });
                    }}
                    className="w-full py-3 px-4 border border-path-grey-300 text-path-grey-700 rounded-lg font-medium hover:bg-path-grey-100 transition-colors"
                  >
                    Something is incorrect
                  </button>
                </div>
              </div>
            )}

            {/* Ownership & control (PSC) - shown only after company details confirmed */}
            {selectedCompany && companyDetailsConfirmed && (() => {
              const isBeneficialOwnerComplete = (ubo: { fullLegalName: string; dateOfBirth: string; residentialPostcode: string; residentialLine1: string; residentialTown: string; nationality: string; ownership: number }) =>
                !!ubo.fullLegalName?.trim() && !!ubo.dateOfBirth?.trim() && !!ubo.residentialPostcode?.trim() &&
                !!ubo.residentialLine1?.trim() && !!ubo.residentialTown?.trim() && !!ubo.nationality?.trim() && ubo.ownership > 0;
              const allCorpsComplete = corporateShareholders.length === 0 || corporateShareholders.every(
                (c) => c.beneficialOwners.length > 0 && c.beneficialOwners.some(isBeneficialOwnerComplete)
              );
              const directorsEditable = pscConfirmed === false;
              const canContinue = pscConfirmed === true && (corporateShareholders.length === 0 || allCorpsComplete);
              return (
              <div className="mb-8 pt-8 border-t border-path-grey-200">
                <h2 className="text-path-h3 font-poppins text-path-grey-900 mb-4">Ownership & control</h2>
                <p className="text-path-p1 text-path-grey-700 mb-6">
                  We've identified the following individuals as persons with significant control:
                </p>
                <div className="space-y-6 mb-6">
                  {pscs.map((psc) => (
                    <div key={psc.id} className="p-4 border border-path-grey-200 rounded-lg bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <span className="flex items-center gap-2 text-path-p1 font-medium text-path-grey-900">
                          <span className="w-5 h-5 flex items-center justify-center bg-path-primary/10 rounded text-path-primary shrink-0">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                          {directorsEditable ? "Owner details" : (psc.fullLegalName || "Unnamed") + ` – ${psc.ownership}%`}
                        </span>
                        {directorsEditable && (
                          <button
                            type="button"
                            onClick={() => setPscs((prev) => prev.filter((p) => p.id !== psc.id))}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove director"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {directorsEditable ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-path-p2 text-path-grey-600 mb-1">Full legal name</label>
                            <input
                              type="text"
                              value={psc.fullLegalName}
                              onChange={(e) => setPscs((prev) => prev.map((p) => (p.id === psc.id ? { ...p, fullLegalName: e.target.value } : p)))}
                              placeholder="Full legal name"
                              className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-path-p2 text-path-grey-600 mb-1">Date of birth</label>
                            <input
                              type="text"
                              value={psc.dateOfBirth}
                              onChange={(e) => {
                                const val = e.target.value;
                                const raw = val.replace(/\D/g, "").slice(0, 8);
                                let formatted = "";
                                if (raw.length > 0) formatted = raw.slice(0, 2);
                                if (raw.length > 2) formatted += "/" + raw.slice(2, 4);
                                if (raw.length > 4) formatted += "/" + raw.slice(4, 8);
                                if (val.trim().endsWith("/") && (raw.length === 2 || raw.length === 4)) formatted += "/";
                                setPscs((prev) => prev.map((p) => (p.id === psc.id ? { ...p, dateOfBirth: formatted } : p)));
                              }}
                              placeholder="DD / MM / YYYY"
                              className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-path-p2 text-path-grey-600 mb-1">Residential address</label>
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={psc.residentialPostcode}
                                onChange={(e) => {
                                  setPscs((prev) => prev.map((p) => (p.id === psc.id ? { ...p, residentialPostcode: e.target.value } : p)));
                                  if (ownerAddressLookupTarget?.type === "psc" && ownerAddressLookupTarget.id === psc.id) {
                                    setOwnerAddressLookupResults([]);
                                    setOwnerAddressLookupError(null);
                                  }
                                }}
                                onBlur={() => {
                                  const pc = psc.residentialPostcode.trim();
                                  if (pc && isValidUkPostcode(pc)) {
                                    fetchAddressLookupForOwner(pc, { type: "psc", id: psc.id });
                                  }
                                }}
                                placeholder="Postcode"
                                className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                              />
                              {ownerAddressLookupTarget?.type === "psc" && ownerAddressLookupTarget.id === psc.id && ownerAddressLookupLoading && (
                                <p className="text-path-p2 text-path-grey-600">Loading addresses...</p>
                              )}
                              {ownerAddressLookupTarget?.type === "psc" && ownerAddressLookupTarget.id === psc.id && ownerAddressLookupError && !ownerAddressLookupLoading && (
                                <p className="text-path-p2 text-path-secondary">{ownerAddressLookupError}</p>
                              )}
                              {ownerAddressLookupTarget?.type === "psc" && ownerAddressLookupTarget.id === psc.id && ownerAddressLookupResults.length > 0 && !ownerAddressLookupLoading && (
                                <div>
                                  <label className="block text-path-p2 text-path-grey-600 mb-1">Select address</label>
                                  <select
                                    className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary bg-white h-11"
                                    style={{ minHeight: "2.75rem" }}
                                    value=""
                                    onChange={(e) => {
                                      const idx = e.target.value ? parseInt(e.target.value, 10) : -1;
                                      if (idx >= 0 && ownerAddressLookupResults[idx]) {
                                        const a = ownerAddressLookupResults[idx];
                                        setPscs((prev) => prev.map((p) => (p.id === psc.id ? { ...p, residentialLine1: a.addressLine1, residentialLine2: a.addressLine2 || "", residentialTown: a.town } : p)));
                                        setOwnerAddressLookupResults([]);
                                        setOwnerAddressLookupError(null);
                                        setOwnerAddressLookupTarget(null);
                                      }
                                    }}
                                  >
                                    <option value="">Select your address</option>
                                    {ownerAddressLookupResults.map((a, i) => (
                                      <option key={i} value={i}>
                                        {[a.addressLine1, a.town, a.postcode].filter(Boolean).join(", ")}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              <input
                                type="text"
                                value={psc.residentialLine1}
                                onChange={(e) => setPscs((prev) => prev.map((p) => (p.id === psc.id ? { ...p, residentialLine1: e.target.value } : p)))}
                                placeholder="Address Line 1"
                                className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                              />
                              <input
                                type="text"
                                value={psc.residentialLine2}
                                onChange={(e) => setPscs((prev) => prev.map((p) => (p.id === psc.id ? { ...p, residentialLine2: e.target.value } : p)))}
                                placeholder="Address Line 2"
                                className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                              />
                              <input
                                type="text"
                                value={psc.residentialTown}
                                onChange={(e) => setPscs((prev) => prev.map((p) => (p.id === psc.id ? { ...p, residentialTown: e.target.value } : p)))}
                                placeholder="Town"
                                className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-path-p2 text-path-grey-600 mb-1">Nationality</label>
                            <select
                              value={psc.nationality}
                              onChange={(e) => setPscs((prev) => prev.map((p) => (p.id === psc.id ? { ...p, nationality: e.target.value } : p)))}
                              className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary bg-white h-11"
                              style={{ minHeight: "2.75rem" }}
                            >
                              <option value="">Select nationality</option>
                              {EUROPEAN_COUNTRIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-path-p2 text-path-grey-600 mb-1">Ownership percentage</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={psc.ownership}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  if (!isNaN(v) && v >= 0 && v <= 100) {
                                    setPscs((prev) => prev.map((p) => (p.id === psc.id ? { ...p, ownership: v } : p)));
                                  }
                                }}
                                className="w-20 px-2 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 text-right focus:ring-2 focus:ring-path-primary focus:border-path-primary h-11"
                                style={{ minHeight: "2.75rem" }}
                              />
                              <span className="text-path-p2 text-path-grey-600">%</span>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {directorsEditable && (
                  <button
                    type="button"
                    onClick={() =>
                      setPscs((prev) => [
                        ...prev,
                        { id: crypto.randomUUID(), fullLegalName: "", dateOfBirth: "", residentialPostcode: "", residentialLine1: "", residentialLine2: "", residentialTown: "", nationality: "", ownership: 0 },
                      ])
                    }
                    className="mb-6 flex items-center gap-2 px-4 py-2 border border-dashed border-path-grey-300 text-path-grey-600 rounded-lg hover:border-path-primary hover:text-path-primary transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add director
                  </button>
                )}

                {/* Directors confirmation: Yes/No – comes after listed directors, before additional ownership */}
                <p className="text-path-p1 text-path-grey-700 mb-4">Are these director details correct?</p>
                <div className="space-y-4 mb-6">
                  <label className="flex items-center gap-3 cursor-pointer p-4 border border-path-grey-200 rounded-lg hover:border-path-primary hover:bg-path-grey-50 transition-colors has-[:checked]:border-path-primary has-[:checked]:bg-path-primary/5">
                    <input
                      type="radio"
                      name="pscConfirmed"
                      checked={pscConfirmed === true}
                      onChange={() => setPscConfirmed(true)}
                      className="w-5 h-5 text-path-primary border-path-grey-300 focus:ring-path-primary"
                    />
                    <span className="text-path-p1 text-path-grey-900 font-medium">Yes, this is correct</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-4 border border-path-grey-200 rounded-lg hover:border-path-primary hover:bg-path-grey-50 transition-colors has-[:checked]:border-path-primary has-[:checked]:bg-path-primary/5">
                    <input
                      type="radio"
                      name="pscConfirmed"
                      checked={pscConfirmed === false}
                      onChange={() => setPscConfirmed(false)}
                      className="w-5 h-5 text-path-primary border-path-grey-300 focus:ring-path-primary"
                    />
                    <span className="text-path-p1 text-path-grey-900 font-medium">No, I need to update</span>
                  </label>
                </div>

                {/* Additional ownership details – corporate shareholders (only for complex flow) */}
                {corporateShareholders.length > 0 && (
                  <div className="mb-6 pt-6 border-t border-path-grey-200">
                    <h3 className="text-path-p1 font-semibold text-path-grey-900 mb-2">Additional ownership details required</h3>
                    <p className="text-path-p2 text-path-grey-600 mb-6">
                      We detected corporate shareholder(s) with 25% or more. To support your application we need to understand the ownership structure.
                    </p>
                    {corporateShareholders.map((corp) => (
                      <div key={corp.id} className="mb-6 p-4 border border-path-grey-200 rounded-lg bg-path-grey-50/50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-path-p1 font-medium text-path-grey-900">{corp.name}</span>
                          <span className="text-path-p2 text-path-grey-600">(Company {corp.companyNumber})</span>
                          <span className="text-path-p2 text-path-grey-600">– {corp.ownership}%</span>
                        </div>
                        <p className="text-path-p2 text-path-grey-600 mb-4">
                          Please confirm who ultimately owns 25% or more of this company.
                        </p>
                        <div className="space-y-6 mb-4">
                          {corp.beneficialOwners.map((ubo) => (
                            <div key={ubo.id} className="p-4 border border-path-grey-200 rounded-lg bg-white">
                              <div className="flex items-center justify-between mb-4">
                                <span className="text-path-p1 font-medium text-path-grey-900">
                                  {(ubo.fullLegalName || "Unnamed") + ` – ${ubo.ownership}%`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCorporateShareholders((prev) =>
                                      prev.map((c) =>
                                        c.id === corp.id
                                          ? { ...c, beneficialOwners: c.beneficialOwners.filter((b) => b.id !== ubo.id) }
                                          : c
                                      )
                                    )
                                  }
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove owner"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                              <div className="space-y-4">
                                  <div>
                                    <label className="block text-path-p2 text-path-grey-600 mb-1">Full legal name</label>
                                    <input
                                      type="text"
                                      value={ubo.fullLegalName}
                                      onChange={(e) =>
                                        setCorporateShareholders((prev) =>
                                          prev.map((c) =>
                                            c.id === corp.id
                                              ? { ...c, beneficialOwners: c.beneficialOwners.map((b) => (b.id === ubo.id ? { ...b, fullLegalName: e.target.value } : b)) }
                                              : c
                                          )
                                        )
                                      }
                                      placeholder="Full legal name"
                                      className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-path-p2 text-path-grey-600 mb-1">Date of birth</label>
                                    <input
                                      type="text"
                                      value={ubo.dateOfBirth}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const raw = val.replace(/\D/g, "").slice(0, 8);
                                        let formatted = "";
                                        if (raw.length > 0) formatted = raw.slice(0, 2);
                                        if (raw.length > 2) formatted += "/" + raw.slice(2, 4);
                                        if (raw.length > 4) formatted += "/" + raw.slice(4, 8);
                                        if (val.trim().endsWith("/") && (raw.length === 2 || raw.length === 4)) formatted += "/";
                                        setCorporateShareholders((prev) =>
                                          prev.map((c) =>
                                            c.id === corp.id
                                              ? { ...c, beneficialOwners: c.beneficialOwners.map((b) => (b.id === ubo.id ? { ...b, dateOfBirth: formatted } : b)) }
                                              : c
                                          )
                                        );
                                      }}
                                      placeholder="DD / MM / YYYY"
                                      className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-path-p2 text-path-grey-600 mb-1">Residential address</label>
                                    <div className="space-y-3">
                                      <input
                                        type="text"
                                        value={ubo.residentialPostcode}
                                        onChange={(e) => {
                                          setCorporateShareholders((prev) =>
                                            prev.map((c) =>
                                              c.id === corp.id
                                                ? { ...c, beneficialOwners: c.beneficialOwners.map((b) => (b.id === ubo.id ? { ...b, residentialPostcode: e.target.value } : b)) }
                                                : c
                                            )
                                          );
                                          if (ownerAddressLookupTarget?.type === "ubo" && ownerAddressLookupTarget.corpId === corp.id && ownerAddressLookupTarget.uboId === ubo.id) {
                                            setOwnerAddressLookupResults([]);
                                            setOwnerAddressLookupError(null);
                                          }
                                        }}
                                        onBlur={() => {
                                          const pc = ubo.residentialPostcode.trim();
                                          if (pc && isValidUkPostcode(pc)) {
                                            fetchAddressLookupForOwner(pc, { type: "ubo", corpId: corp.id, uboId: ubo.id });
                                          }
                                        }}
                                        placeholder="Postcode"
                                        className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                                      />
                                      {ownerAddressLookupTarget?.type === "ubo" && ownerAddressLookupTarget.corpId === corp.id && ownerAddressLookupTarget.uboId === ubo.id && ownerAddressLookupLoading && (
                                        <p className="text-path-p2 text-path-grey-600">Loading addresses...</p>
                                      )}
                                      {ownerAddressLookupTarget?.type === "ubo" && ownerAddressLookupTarget.corpId === corp.id && ownerAddressLookupTarget.uboId === ubo.id && ownerAddressLookupError && !ownerAddressLookupLoading && (
                                        <p className="text-path-p2 text-path-secondary">{ownerAddressLookupError}</p>
                                      )}
                                      {ownerAddressLookupTarget?.type === "ubo" && ownerAddressLookupTarget.corpId === corp.id && ownerAddressLookupTarget.uboId === ubo.id && ownerAddressLookupResults.length > 0 && !ownerAddressLookupLoading && (
                                        <div>
                                          <label className="block text-path-p2 text-path-grey-600 mb-1">Select address</label>
                                          <select
                                            className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary bg-white h-11"
                                            style={{ minHeight: "2.75rem" }}
                                            value=""
                                            onChange={(e) => {
                                              const idx = e.target.value ? parseInt(e.target.value, 10) : -1;
                                              if (idx >= 0 && ownerAddressLookupResults[idx]) {
                                                const a = ownerAddressLookupResults[idx];
                                                setCorporateShareholders((prev) =>
                                                  prev.map((c) =>
                                                    c.id === corp.id
                                                      ? { ...c, beneficialOwners: c.beneficialOwners.map((b) => (b.id === ubo.id ? { ...b, residentialLine1: a.addressLine1, residentialLine2: a.addressLine2 || "", residentialTown: a.town } : b)) }
                                                      : c
                                                  )
                                                );
                                                setOwnerAddressLookupResults([]);
                                                setOwnerAddressLookupError(null);
                                                setOwnerAddressLookupTarget(null);
                                              }
                                            }}
                                          >
                                            <option value="">Select your address</option>
                                            {ownerAddressLookupResults.map((a, i) => (
                                              <option key={i} value={i}>
                                                {[a.addressLine1, a.town, a.postcode].filter(Boolean).join(", ")}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                      <input
                                        type="text"
                                        value={ubo.residentialLine1}
                                        onChange={(e) =>
                                          setCorporateShareholders((prev) =>
                                            prev.map((c) =>
                                              c.id === corp.id
                                                ? { ...c, beneficialOwners: c.beneficialOwners.map((b) => (b.id === ubo.id ? { ...b, residentialLine1: e.target.value } : b)) }
                                                : c
                                            )
                                          )
                                        }
                                        placeholder="Address Line 1"
                                        className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                                      />
                                      <input
                                        type="text"
                                        value={ubo.residentialLine2}
                                        onChange={(e) =>
                                          setCorporateShareholders((prev) =>
                                            prev.map((c) =>
                                              c.id === corp.id
                                                ? { ...c, beneficialOwners: c.beneficialOwners.map((b) => (b.id === ubo.id ? { ...b, residentialLine2: e.target.value } : b)) }
                                                : c
                                            )
                                          )
                                        }
                                        placeholder="Address Line 2"
                                        className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                                      />
                                      <input
                                        type="text"
                                        value={ubo.residentialTown}
                                        onChange={(e) =>
                                          setCorporateShareholders((prev) =>
                                            prev.map((c) =>
                                              c.id === corp.id
                                                ? { ...c, beneficialOwners: c.beneficialOwners.map((b) => (b.id === ubo.id ? { ...b, residentialTown: e.target.value } : b)) }
                                                : c
                                            )
                                          )
                                        }
                                        placeholder="Town"
                                        className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-path-p2 text-path-grey-600 mb-1">Nationality</label>
                                    <select
                                      value={ubo.nationality}
                                      onChange={(e) =>
                                        setCorporateShareholders((prev) =>
                                          prev.map((c) =>
                                            c.id === corp.id
                                              ? { ...c, beneficialOwners: c.beneficialOwners.map((b) => (b.id === ubo.id ? { ...b, nationality: e.target.value } : b)) }
                                              : c
                                          )
                                        )
                                      }
                                      className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary bg-white h-11"
                                      style={{ minHeight: "2.75rem" }}
                                    >
                                      <option value="">Select nationality</option>
                                      {EUROPEAN_COUNTRIES.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-path-p2 text-path-grey-600 mb-1">Ownership percentage</label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={ubo.ownership}
                                        onChange={(e) => {
                                          const v = parseInt(e.target.value, 10);
                                          if (!isNaN(v) && v >= 0 && v <= 100) {
                                            setCorporateShareholders((prev) =>
                                              prev.map((c) =>
                                                c.id === corp.id
                                                  ? { ...c, beneficialOwners: c.beneficialOwners.map((b) => (b.id === ubo.id ? { ...b, ownership: v } : b)) }
                                                  : c
                                              )
                                            );
                                          }
                                        }}
                                        className="w-20 px-2 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 text-right focus:ring-2 focus:ring-path-primary focus:border-path-primary h-11"
                                        style={{ minHeight: "2.75rem" }}
                                      />
                                      <span className="text-path-p2 text-path-grey-600">%</span>
                                    </div>
                                  </div>
                                </div>
                            </div>
                          ))}
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                              setCorporateShareholders((prev) =>
                                prev.map((c) =>
                                  c.id === corp.id
                                    ? { ...c, beneficialOwners: [...c.beneficialOwners, { id: crypto.randomUUID(), fullLegalName: "", dateOfBirth: "", residentialPostcode: "", residentialLine1: "", residentialLine2: "", residentialTown: "", nationality: "", ownership: 0 }] }
                                    : c
                                )
                              )
                            }
                            className="flex items-center gap-2 px-4 py-2 border border-dashed border-path-grey-300 text-path-grey-600 rounded-lg hover:border-path-primary hover:text-path-primary transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add individual owner
                          </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Continue – enabled when directors confirmed (and beneficial owners complete for complex flow) */}
                <div className="mt-8 pt-8 border-t border-path-grey-200">
                  <button
                    type="button"
                    onClick={() => canContinue && setStep("step5")}
                    disabled={!canContinue}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      canContinue
                        ? "bg-path-primary text-white hover:bg-path-primary-light-1"
                        : "bg-path-grey-200 text-path-grey-500 cursor-not-allowed"
                    }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            );
            })()}

            {/* Sole Trader placeholder */}
            {businessType === "sole_trader" && (
              <p className="text-path-p1 text-path-grey-600 mb-8">
                Sole trader registration will be available in a future update.
              </p>
            )}
          </div>
          <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500 text-center">
            © 2026 Path2ai.tech
          </footer>
        </main>
        {inviteInfo && (
          <BoardingRightPanel 
            partner={inviteInfo.partner}
            onBack={{
              label: "Verify Identity",
              onClick: () => setStep("step3")
            }}
            onSaveForLater={() => setShowSaveForLaterModal(true)}
          />
        )}

        {/* Save for Later Modal */}
        {showSaveForLaterModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              {!saveForLaterSuccess ? (
                <>
                  <h2 className="text-path-h3 font-poppins text-path-primary mb-4">Save for later</h2>
                  <p className="text-path-p1 text-path-grey-700 mb-4">
                    Your progress has been saved and is available for the next 14 days for you to return and complete.
                  </p>
                  <p className="text-path-p1 text-path-grey-700 mb-6">
                    We&apos;ll send an email to your email address with a link that will take you to the merchant boarding login screen.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSaveForLaterModal(false)}
                      className="flex-1 px-4 py-2 border border-path-grey-300 rounded-lg text-path-grey-700 hover:bg-path-grey-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveForLater}
                      disabled={saveForLaterLoading}
                      className="flex-1 px-4 py-2 bg-path-primary text-white rounded-lg hover:bg-path-primary-light-1 transition-colors disabled:opacity-50"
                    >
                      {saveForLaterLoading ? "Sending..." : "Continue"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-path-h3 font-poppins text-path-primary mb-4">Email sent!</h2>
                  <p className="text-path-p1 text-path-grey-700 mb-6">
                    We&apos;ve sent a link to your email address. You can use it to return and complete your boarding anytime within the next 14 days.
                  </p>
                  <button
                    onClick={() => {
                      setShowSaveForLaterModal(false);
                      setSaveForLaterSuccess(false);
                      router.push("/");
                    }}
                    className="w-full px-4 py-2 bg-path-primary text-white rounded-lg hover:bg-path-primary-light-1 transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === "step5") {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900">
          <header className="flex items-center gap-4 mb-8">
            <Image src="/logo-path.png" alt="Path" width={140} height={40} />
          </header>
          <div className="flex-1 max-w-md mx-auto w-full">
            <nav className="flex items-center flex-wrap gap-1 text-path-p2 text-path-grey-600 mb-6" aria-label="Breadcrumb">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                  <Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" />
                </span>
                Account
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button
                type="button"
                onClick={() => setStep("step2")}
                className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                  <Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" />
                </span>
                Personal Details
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button
                type="button"
                onClick={() => setStep("step3")}
                className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                  <Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" />
                </span>
                Verify
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button
                type="button"
                onClick={() => setStep("step4")}
                className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                  <Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" />
                </span>
                Business
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <span className="flex items-center gap-1.5 font-medium text-path-primary">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
                  <Image src="/icons/form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" />
                </span>
                Business Details
              </span>
            </nav>
            <h1 className="text-path-h2 font-poppins text-path-primary mb-2">Business Details</h1>
            {inviteInfo && (
              <p className="text-path-p1 text-path-grey-700 mb-6">
                Please provide some additional details about how your business will trade with {inviteInfo.partner.name}&apos;s platform.
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep("step6");
              }}
              className="space-y-6 mb-8"
            >
              <div>
                <label htmlFor="vatNumber" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                  VAT Number (if registered)
                </label>
                <input
                  id="vatNumber"
                  type="text"
                  value={vatNumber}
                  onChange={(e) => {
                    setVatNumber(e.target.value);
                    setVatNumberError(null);
                  }}
                  onBlur={() => setVatNumberError(validateVatNumber(vatNumber))}
                  placeholder="e.g. GB123456789"
                  className={`w-full px-3 py-2 border rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary ${vatNumberError ? "border-path-secondary" : "border-path-grey-300"}`}
                />
                {vatNumberError && (
                  <p className="mt-1 text-path-p2 text-path-secondary">{vatNumberError}</p>
                )}
              </div>

              <div>
                <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                  Your Business Industry
                </label>
                <div className="space-y-3">
                  {!mccTaxonomy ? (
                    <p className="text-path-p2 text-path-grey-600 py-2">Loading industry options...</p>
                  ) : (
                    <>
                  <div>
                    <label htmlFor="tier1" className="sr-only">Category</label>
                    <select
                      id="tier1"
                      value={customerIndustryTier1}
                      onChange={(e) => {
                        setCustomerIndustryTier1(e.target.value);
                        setCustomerIndustryTier2("");
                        setCustomerIndustry("");
                      }}
                      className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary bg-white h-11"
                      style={{ minHeight: "2.75rem" }}
                    >
                      <option value="">Select Category</option>
                      {uxTaxonomy.map((tier) => (
                        <option key={tier.id} value={tier.id}>
                          {tier.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedTier1 && (
                    <div>
                      <label htmlFor="tier2" className="sr-only">Sub category</label>
                      <select
                        id="tier2"
                        value={customerIndustryTier2}
                        onChange={(e) => {
                          setCustomerIndustryTier2(e.target.value);
                          setCustomerIndustry("");
                        }}
                        className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary bg-white h-11"
                        style={{ minHeight: "2.75rem" }}
                      >
                        <option value="">Select sub category</option>
                        {selectedTier1.children.map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {selectedTier2 && (
                    <div>
                      <label htmlFor="customerIndustry" className="sr-only">Business</label>
                      <select
                        id="customerIndustry"
                        value={customerIndustry}
                        onChange={(e) => setCustomerIndustry(e.target.value)}
                        className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary bg-white h-11"
                        style={{ minHeight: "2.75rem" }}
                      >
                        <option value="">Select business</option>
                        {selectedTier2.items.map((item) => (
                          <option key={item.mcc} value={item.mcc}>
                            {item.mcc} – {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                    </>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="estimatedMonthlyCardVolume" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                  Estimated monthly card volume
                </label>
                <select
                  id="estimatedMonthlyCardVolume"
                  value={estimatedMonthlyCardVolume}
                  onChange={(e) => setEstimatedMonthlyCardVolume(e.target.value)}
                  className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary bg-white h-11"
                  style={{ minHeight: "2.75rem" }}
                >
                  <option value="">Select volume</option>
                  <option value="<£1000">&lt;£1,000</option>
                  <option value="£1000-£2000">£1,000 – £2,000</option>
                  <option value="£2000-£4000">£2,000 – £4,000</option>
                  <option value="£4000-£6000">£4,000 – £6,000</option>
                  <option value="£6000-£10000">£6,000 – £10,000</option>
                  <option value="£10000-£15000">£10,000 – £15,000</option>
                  <option value="£15000-£25000">£15,000 – £25,000</option>
                  <option value="£25000-£50000">£25,000 – £50,000</option>
                  <option value=">£50000">&gt;£50,000</option>
                </select>
              </div>

              <div>
                <label htmlFor="averageTransactionValue" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                  Average transaction value
                </label>
                <select
                  id="averageTransactionValue"
                  value={averageTransactionValue}
                  onChange={(e) => setAverageTransactionValue(e.target.value)}
                  className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary bg-white h-11"
                  style={{ minHeight: "2.75rem" }}
                >
                  <option value="">Select value</option>
                  <option value="£0-£5">£0 – £5</option>
                  <option value="£5-£10">£5 – £10</option>
                  <option value="£10-£15">£10 – £15</option>
                  <option value="£15-£20">£15 – £20</option>
                  <option value="£20-£30">£20 – £30</option>
                  <option value="£30-£40">£30 – £40</option>
                  <option value="£40-£50">£40 – £50</option>
                  <option value="£50-£75">£50 – £75</option>
                  <option value="£75-£100">£75 – £100</option>
                  <option value="£100-£150">£100 – £150</option>
                  <option value=">£150">&gt;£150</option>
                </select>
              </div>

              <div>
                <label htmlFor="deliveryTimeframe" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                  When do your customers typically receive their goods?
                </label>
                <select
                  id="deliveryTimeframe"
                  value={deliveryTimeframe}
                  onChange={(e) => setDeliveryTimeframe(e.target.value)}
                  className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary bg-white h-11"
                  style={{ minHeight: "2.75rem" }}
                >
                  <option value="">Select timeframe</option>
                  <option value="immediately">Immediately</option>
                  <option value="within_7_days">Within 7 days</option>
                  <option value="within_30_days">Within 30 days</option>
                  <option value="over_30_days">Over 30 days</option>
                </select>
              </div>

              <div>
                <label htmlFor="customerSupportEmail" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                  Customer support email
                </label>
                <input
                  id="customerSupportEmail"
                  type="email"
                  value={customerSupportEmail}
                  onChange={(e) => {
                    setCustomerSupportEmail(e.target.value);
                    setCustomerSupportEmailError(null);
                  }}
                  onBlur={() => {
                    const t = customerSupportEmail.trim();
                    setCustomerSupportEmailError(t && !isValidEmail(t) ? "Enter a valid email (e.g. support@company.com)" : null);
                  }}
                  placeholder="support@yourcompany.com"
                  className={`w-full px-3 py-2 border rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary ${customerSupportEmailError ? "border-path-secondary" : "border-path-grey-300"}`}
                />
                {customerSupportEmailError && (
                  <p className="mt-1 text-path-p2 text-path-secondary">{customerSupportEmailError}</p>
                )}
              </div>

              <div>
                <label htmlFor="customerWebsites" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                  Customer websites
                </label>
                <input
                  id="customerWebsites"
                  type="text"
                  value={customerWebsites}
                  onChange={(e) => {
                    setCustomerWebsites(e.target.value);
                    setCustomerWebsitesError(null);
                  }}
                  onBlur={() => setCustomerWebsitesError(validateWebsite(customerWebsites))}
                  placeholder="e.g. www.example.com or https://www.example.com (comma-separated for multiple)"
                  className={`w-full px-3 py-2 border rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary ${customerWebsitesError ? "border-path-secondary" : "border-path-grey-300"}`}
                />
                {customerWebsitesError && (
                  <p className="mt-1 text-path-p2 text-path-secondary">{customerWebsitesError}</p>
                )}
              </div>

              <div>
                <label htmlFor="productDescription" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                  Product description
                </label>
                <textarea
                  id="productDescription"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Describe your products or services..."
                  rows={5}
                  className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors"
              >
                Continue
              </button>
            </form>
          </div>
          <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500 text-center">
            © 2026 Path2ai.tech
          </footer>
        </main>
        {inviteInfo && (
          <BoardingRightPanel
            partner={inviteInfo.partner}
            onBack={{
              label: "Business",
              onClick: () => setStep("step4")
            }}
            onSaveForLater={() => setShowSaveForLaterModal(true)}
          />
        )}

        {/* Save for Later Modal */}
        {showSaveForLaterModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              {!saveForLaterSuccess ? (
                <>
                  <h2 className="text-path-h3 font-poppins text-path-primary mb-4">Save for later</h2>
                  <p className="text-path-p1 text-path-grey-700 mb-4">
                    Your progress has been saved and is available for the next 14 days for you to return and complete.
                  </p>
                  <p className="text-path-p1 text-path-grey-700 mb-6">
                    We&apos;ll send an email to your email address with a link that will take you to the merchant boarding login screen.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSaveForLaterModal(false)}
                      className="flex-1 px-4 py-2 border border-path-grey-300 rounded-lg text-path-grey-700 hover:bg-path-grey-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveForLater}
                      disabled={saveForLaterLoading}
                      className="flex-1 px-4 py-2 bg-path-primary text-white rounded-lg hover:bg-path-primary-light-1 transition-colors disabled:opacity-50"
                    >
                      {saveForLaterLoading ? "Sending..." : "Continue"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-path-h3 font-poppins text-path-primary mb-4">Email sent!</h2>
                  <p className="text-path-p1 text-path-grey-700 mb-6">
                    We&apos;ve sent a link to your email address. You can use it to return and complete your boarding anytime within the next 14 days.
                  </p>
                  <button
                    onClick={() => {
                      setShowSaveForLaterModal(false);
                      setSaveForLaterSuccess(false);
                      router.push("/");
                    }}
                    className="w-full px-4 py-2 bg-path-primary text-white rounded-lg hover:bg-path-primary-light-1 transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const isUkBank = bankCurrency === "GBP" && bankCountry === "United Kingdom";
  const sortCodeDigits = sortCode.replace(/\D/g, "");
  const accountNumberDigits = accountNumber.replace(/\D/g, "");
  const ibanNormalised = iban.replace(/\s/g, "").toUpperCase();
  const step6Valid =
    accountName.trim() &&
    bankCurrency &&
    bankCountry &&
    (isUkBank
      ? (sortCodeDigits.length === 6 && accountNumberDigits.length === 8 && !validateSortCode(sortCode) && !validateAccountNumber(accountNumber))
      : (ibanNormalised.length > 0 && !validateIban(iban))) &&
    bankConfirmationChecked;

  async function handleVerifyWithBank() {
    if (!isUkBank || !step6Valid) return;
    if (validateSortCode(sortCode) || validateAccountNumber(accountNumber)) return;
    setBankVerifying(true);
    try {
      // Save first so backend has bank details
      const companyName = selectedCompany?.name ?? (businessType === "sole_trader" ? "Sole Trader" : "");
      const payload: Record<string, unknown> = {
        bank_account_name: accountName.trim(),
        bank_currency: bankCurrency,
        bank_country: bankCountry,
        bank_sort_code: sortCode.replace(/\D/g, ""),
        bank_account_number: accountNumber.replace(/\D/g, ""),
        vat_number: vatNumber.trim() || undefined,
        customer_industry: customerIndustry || undefined,
        company_name: companyName || undefined,
        company_number: selectedCompany?.number || undefined,
      };
      const saveRes = await apiPost<{ saved?: boolean }>(
        `/boarding/step/6?token=${encodeURIComponent(token)}`,
        payload
      );
      if (saveRes.error) {
        alert(saveRes.error);
        setBankVerifying(false);
        return;
      }
      // Fetch auth URL with timeout (TrueLayer sandbox can be slow)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const authRes = await apiGet<{ auth_url: string }>(
        `/boarding/truelayer-auth-url?token=${encodeURIComponent(token)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (authRes.error || !authRes.data?.auth_url) {
        alert(authRes.error ?? "Could not start bank verification.");
        setBankVerifying(false);
        return;
      }
      // Use replace so back button doesn't return to loading state
      window.location.replace(authRes.data.auth_url);
    } catch (e) {
      const msg = e instanceof Error && e.name === "AbortError"
        ? "Request timed out. TrueLayer sandbox may be slow – try again or open in incognito."
        : "Failed to start bank verification. Please try again.";
      alert(msg);
      setBankVerifying(false);
    }
  }

  async function handleStep6Continue() {
    if (!step6Valid) return;
    setSortCodeError(validateSortCode(sortCode));
    setAccountNumberError(validateAccountNumber(accountNumber));
    setIbanError(validateIban(iban));
    if (isUkBank && (validateSortCode(sortCode) || validateAccountNumber(accountNumber))) return;
    if (!isUkBank && validateIban(iban)) return;
    setStep6Submitting(true);
    try {
      const companyName = selectedCompany?.name ?? (businessType === "sole_trader" ? "Sole Trader" : "");
      const payload: Record<string, unknown> = {
        bank_account_name: accountName.trim(),
        bank_currency: bankCurrency,
        bank_country: bankCountry,
        bank_sort_code: isUkBank ? sortCodeDigits : undefined,
        bank_account_number: isUkBank ? accountNumberDigits : undefined,
        bank_iban: !isUkBank ? ibanNormalised : undefined,
        vat_number: vatNumber.trim() || undefined,
        customer_industry: customerIndustry || undefined,
        estimated_monthly_card_volume: estimatedMonthlyCardVolume.trim() || undefined,
        average_transaction_value: averageTransactionValue.trim() || undefined,
        delivery_timeframe: deliveryTimeframe || undefined,
        customer_support_email: customerSupportEmail.trim() || undefined,
        customer_websites: customerWebsites.trim() || undefined,
        product_description: productDescription.trim() || undefined,
        company_name: companyName || undefined,
        company_number: selectedCompany?.number || undefined,
        company_registered_office: selectedCompany?.fullAddress || undefined,
        company_incorporated_in: selectedCompany ? "United Kingdom" : undefined,
        company_incorporation_date: selectedCompany?.incorporated || undefined,
        company_industry_sic: selectedCompany?.industry || undefined,
      };
      const res = await apiPost<{ saved: boolean }>(
        `/boarding/step/6?token=${encodeURIComponent(token)}`,
        payload
      );
      if (res.error) {
        alert(res.error);
        setStep6Submitting(false);
        return;
      }
      setStep("review");
      setStep6Submitting(false);
    } catch {
      alert("Failed to save. Please try again.");
      setStep6Submitting(false);
    }
  }

  if (step === "step6") {
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900">
          <header className="flex items-center gap-4 mb-8">
            <Image src="/logo-path.png" alt="Path" width={140} height={40} />
          </header>
          <div className="flex-1 max-w-md mx-auto w-full">
            <nav className="flex items-center flex-wrap gap-1 text-path-p2 text-path-grey-600 mb-6" aria-label="Breadcrumb">
              <button type="button" onClick={() => setStep("form")} className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" /></span>
                Account
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button type="button" onClick={() => setStep("step2")} className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" /></span>
                Personal Details
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button type="button" onClick={() => setStep("step3")} className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" /></span>
                Verify
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button type="button" onClick={() => setStep("step4")} className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" /></span>
                Business
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button type="button" onClick={() => setStep("step5")} className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" /></span>
                Business Details
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <span className="flex items-center gap-1.5 font-medium text-path-primary">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" /></span>
                Bank Details
              </span>
            </nav>
            <h1 className="text-path-h2 font-poppins text-path-primary mb-2">Add a bank account for payouts</h1>
            <p className="text-path-p1 text-path-grey-700 mb-6">Your earnings will be deposited into this account.</p>

            <div className="space-y-6 mb-8">
              <div>
                <label htmlFor="accountName" className="block text-path-p2 font-medium text-path-grey-700 mb-1">Account name</label>
                <input
                  id="accountName"
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Name the account is in"
                  className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary"
                />
              </div>

              <div>
                <label htmlFor="bankCurrency" className="block text-path-p2 font-medium text-path-grey-700 mb-1">Currency</label>
                <select
                  id="bankCurrency"
                  value={bankCurrency}
                  onChange={(e) => setBankCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary bg-white h-11"
                  style={{ minHeight: "2.75rem" }}
                >
                  {EUROPEAN_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} – {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="bankCountry" className="block text-path-p2 font-medium text-path-grey-700 mb-1">Country of bank account</label>
                <select
                  id="bankCountry"
                  value={bankCountry}
                  onChange={(e) => setBankCountry(e.target.value)}
                  className="w-full px-3 py-2 border border-path-grey-300 rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary bg-white h-11"
                  style={{ minHeight: "2.75rem" }}
                >
                  {EUROPEAN_COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {isUkBank ? (
                <>
                  <div>
                    <label htmlFor="sortCode" className="block text-path-p2 font-medium text-path-grey-700 mb-1">Sort code</label>
                    <input
                      id="sortCode"
                      type="text"
                      inputMode="numeric"
                      value={sortCode}
                      onChange={(e) => {
                        const formatted = formatSortCode(e.target.value);
                        setSortCode(formatted);
                        setSortCodeError(null);
                      }}
                      onBlur={() => setSortCodeError(validateSortCode(sortCode))}
                      placeholder="e.g. 33-44-55"
                      maxLength={8}
                      className={`w-full px-3 py-2 border rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary ${sortCodeError ? "border-path-secondary" : "border-path-grey-300"}`}
                    />
                    {sortCodeError && <p className="mt-1 text-path-p2 text-path-secondary">{sortCodeError}</p>}
                  </div>

                  <div>
                    <label htmlFor="accountNumber" className="block text-path-p2 font-medium text-path-grey-700 mb-1">Account number</label>
                    <input
                      id="accountNumber"
                      type="text"
                      inputMode="numeric"
                      value={accountNumber}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                        setAccountNumber(digits);
                        setAccountNumberError(null);
                      }}
                      onBlur={() => setAccountNumberError(validateAccountNumber(accountNumber))}
                      placeholder="8 digits"
                      maxLength={8}
                      className={`w-full px-3 py-2 border rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary ${accountNumberError ? "border-path-secondary" : "border-path-grey-300"}`}
                    />
                    {accountNumberError && <p className="mt-1 text-path-p2 text-path-secondary">{accountNumberError}</p>}
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="iban" className="block text-path-p2 font-medium text-path-grey-700 mb-1">IBAN</label>
                  <input
                    id="iban"
                    type="text"
                    value={iban}
                    onChange={(e) => {
                      setIban(e.target.value.toUpperCase());
                      setIbanError(null);
                    }}
                    onBlur={() => setIbanError(validateIban(iban))}
                    placeholder="e.g. DE89370400440532013000"
                    className={`w-full px-3 py-2 border rounded-lg text-path-p1 text-path-grey-900 focus:ring-2 focus:ring-path-primary focus:border-path-primary ${ibanError ? "border-path-secondary" : "border-path-grey-300"}`}
                  />
                  {ibanError && <p className="mt-1 text-path-p2 text-path-secondary">{ibanError}</p>}
                </div>
              )}

              <div className="pt-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bankConfirmationChecked}
                    onChange={(e) => setBankConfirmationChecked(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-path-grey-300 text-path-primary focus:ring-path-primary"
                  />
                  <span className="text-path-p2 text-path-grey-700">
                    I confirm that I am the account holder and the only person required to authorise debits from this bank account. By submitting these details, I authorise Path to make transfers to and from this account via the Bankers&apos; Automated Clearing Services (Bacs), in accordance with the Bacs Direct Debit Guarantee. I confirm that I have read and agree to the{" "}
                    <Link href="/legal/services-agreement" className="text-path-primary font-medium underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                      Services Agreement
                    </Link>
                    , including the Bacs Direct Debit Instruction.
                  </span>
                </label>
              </div>

              {bankVerificationMessage && (
                <div className={`p-3 rounded-lg text-path-p2 ${bankVerified ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
                  {bankVerificationMessage}
                </div>
              )}

              {isUkBank && (
                <>
                  <p className="text-path-p2 text-path-grey-700 mb-2">
                    Bank verification is required before continuing. Please verify your account with your bank.
                  </p>
                  <button
                    type="button"
                    onClick={handleVerifyWithBank}
                    disabled={!step6Valid || bankVerifying || bankVerified === true}
                    className="w-full py-3 px-4 rounded-lg font-medium border-2 border-path-primary text-path-primary bg-white hover:bg-path-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bankVerifying ? "Redirecting to your bank..." : "Verify with my bank"}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleStep6Continue}
                disabled={
                  !step6Valid ||
                  step6Submitting ||
                  (isUkBank && bankVerified === null)
                }
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  step6Valid && !step6Submitting && (!isUkBank || bankVerified !== null)
                    ? "bg-path-primary text-white hover:bg-path-primary-light-1"
                    : "bg-path-grey-200 text-path-grey-500 cursor-not-allowed"
                }`}
              >
                {step6Submitting ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
          <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500 text-center">
            © 2026 Path2ai.tech
          </footer>
        </main>
        {inviteInfo && (
          <BoardingRightPanel
            partner={inviteInfo.partner}
            onBack={{ label: "Business Details", onClick: () => setStep("step5") }}
            onSaveForLater={() => setShowSaveForLaterModal(true)}
          />
        )}
        {showSaveForLaterModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              {!saveForLaterSuccess ? (
                <>
                  <h2 className="text-path-h3 font-poppins text-path-primary mb-4">Save for later</h2>
                  <p className="text-path-p1 text-path-grey-700 mb-4">Your progress has been saved and is available for the next 14 days for you to return and complete.</p>
                  <p className="text-path-p1 text-path-grey-700 mb-6">We&apos;ll send an email to your email address with a link that will take you to the merchant boarding login screen.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowSaveForLaterModal(false)} className="flex-1 px-4 py-2 border border-path-grey-300 rounded-lg text-path-grey-700 hover:bg-path-grey-100 transition-colors">Cancel</button>
                    <button onClick={handleSaveForLater} disabled={saveForLaterLoading} className="flex-1 px-4 py-2 bg-path-primary text-white rounded-lg hover:bg-path-primary-light-1 transition-colors disabled:opacity-50">{saveForLaterLoading ? "Sending..." : "Continue"}</button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-path-h3 font-poppins text-path-primary mb-4">Email sent!</h2>
                  <p className="text-path-p1 text-path-grey-700 mb-6">We&apos;ve sent a link to your email address. You can use it to return and complete your boarding anytime within the next 14 days.</p>
                  <button onClick={() => { setShowSaveForLaterModal(false); setSaveForLaterSuccess(false); router.push("/"); }} className="w-full px-4 py-2 bg-path-primary text-white rounded-lg hover:bg-path-primary-light-1 transition-colors">Close</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Helper: get industry label from MCC taxonomy
  function getIndustryLabel(): string {
    if (!customerIndustry || !mccTaxonomy) return "";
    const ux = mccTaxonomy.ux_taxonomy ?? [];
    for (const tier of ux) {
      for (const child of tier.children ?? []) {
        const item = child.items?.find((i) => i.mcc === customerIndustry);
        if (item) return `${item.mcc}, ${item.label}`;
      }
    }
    return customerIndustry;
  }

  if (step === "review") {
    const businessSetupCompanyName = selectedCompany?.name ?? (businessType === "sole_trader" ? "Sole Trader" : "");
    const businessSetupType = businessType === "ltd" ? "Limited Company" : businessType === "llp" ? "Limited Liability Partnership" : "Sole Trader";
    const businessSetupIndustry = getIndustryLabel();
    const hasBusinessSetup = !!(selectedCompany || businessType === "sole_trader");

    const firstWebsite = customerWebsites?.trim().split(",")[0]?.trim() ?? "";
    const isValidUrl = (s: string) => /^https?:\/\/[^\s]+$/i.test(s);
    const websiteUrl = firstWebsite && isValidUrl(firstWebsite) ? firstWebsite : firstWebsite.startsWith("www.") ? `https://${firstWebsite}` : firstWebsite;
    const websiteIsClickable = websiteUrl && isValidUrl(websiteUrl);

    const hasBusinessDetails = !!(customerWebsites?.trim() || customerSupportEmail?.trim() || productDescription?.trim());
    const directorName = `${legalFirstName} ${legalLastName}`.trim();
    const hasPersonalDetails = !!(directorName || addressLine1 || dateOfBirth || phoneNumber);
    const hasPayoutAccount = !!(accountName?.trim() || bankCurrency || bankCountry);

    return (
      <div className="flex min-h-screen">
        <main className="flex-1 flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900">
          <header className="flex items-center gap-4 mb-8">
            <Image src="/logo-path.png" alt="Path" width={140} height={40} />
          </header>
          <div className="flex-1 max-w-2xl mx-auto w-full">
            <nav className="flex items-center flex-wrap gap-1 text-path-p2 text-path-grey-600 mb-6" aria-label="Breadcrumb">
              <button type="button" onClick={() => setStep("form")} className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" /></span>
                Account
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button type="button" onClick={() => setStep("step2")} className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" /></span>
                Personal Details
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button type="button" onClick={() => setStep("step3")} className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" /></span>
                Verify
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button type="button" onClick={() => setStep("step4")} className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" /></span>
                Business
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button type="button" onClick={() => setStep("step5")} className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" /></span>
                Business Details
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <button type="button" onClick={() => setStep("step6")} className="flex items-center gap-1.5 text-path-grey-400 hover:text-path-primary transition-colors cursor-pointer">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/completed-form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain scale-125 opacity-70" /></span>
                Bank Details
              </button>
              <span className="mx-1 text-path-grey-400">/</span>
              <span className="flex items-center gap-1.5 font-medium text-path-primary">
                <span className="inline-flex items-center justify-center w-5 h-5 shrink-0"><Image src="/icons/form.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" /></span>
                Review and Submit
              </span>
            </nav>
            <h1 className="text-path-h2 font-poppins text-path-primary mb-2">Review and Submit</h1>
            <p className="text-path-p1 text-path-grey-700 mb-8">Take a moment to check your information and product selection.</p>

            <div className="space-y-6 mb-8">
              <div>
                <h3 className="font-semibold text-path-grey-900 mb-2 text-left">Business Setup</h3>
                <div className="p-4 border border-path-grey-200 rounded-lg bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {hasBusinessSetup ? (
                        <>
                          <p className="text-xs font-medium text-path-grey-600 mb-1">Company Name</p>
                          <p className="text-xs text-path-grey-700 mb-1">{businessSetupCompanyName}</p>
                          <p className="text-xs text-path-grey-700 mb-1">{businessSetupType}</p>
                          <p className="text-xs text-path-grey-700 mb-1">Registered in the UK</p>
                          {businessSetupIndustry && (
                            <p className="text-xs text-path-grey-700">{businessSetupIndustry.length > 50 ? businessSetupIndustry.slice(0, 47) + "..." : businessSetupIndustry}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-path-grey-500">Add summary info</p>
                      )}
                    </div>
                    <button type="button" onClick={() => setStep("step4")} className="shrink-0 text-xs text-path-secondary font-medium hover:underline">
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-path-grey-900 mb-2 text-left">Business Details</h3>
                <div className="p-4 border border-path-grey-200 rounded-lg bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {hasBusinessDetails ? (
                        <>
                          {firstWebsite && (
                            <>
                              <p className="text-xs font-medium text-path-grey-600 mb-1">Company Web Site</p>
                              <p className="text-xs text-path-grey-700 mb-2">
                                {websiteIsClickable ? (
                                  <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-path-primary hover:underline">{firstWebsite}</a>
                                ) : (
                                  firstWebsite
                                )}
                              </p>
                            </>
                          )}
                          {customerSupportEmail?.trim() && (
                            <p className="text-xs text-path-grey-700 mb-1">Support Email Address: <span className="font-medium text-path-grey-600">{customerSupportEmail.trim()}</span></p>
                          )}
                          {productDescription?.trim() && (
                            <p className="text-xs text-path-grey-700">Product and Service Description: {productDescription.trim().length > 60 ? productDescription.trim().slice(0, 57) + "..." : productDescription.trim()}</p>
                          )}
                          {!firstWebsite && !customerSupportEmail?.trim() && !productDescription?.trim() && (
                            <p className="text-xs text-path-grey-500">Add summary info</p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-path-grey-500">Add summary info</p>
                      )}
                    </div>
                    <button type="button" onClick={() => setStep("step5")} className="shrink-0 text-xs text-path-secondary font-medium hover:underline">
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-path-grey-900 mb-2 text-left">Personal Details</h3>
                <div className="p-4 border border-path-grey-200 rounded-lg bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {hasPersonalDetails ? (
                        <>
                          <p className="text-xs font-medium text-path-grey-600 mb-1">Director</p>
                          <p className="text-xs text-path-grey-700 mb-1">{directorName || "—"}</p>
                          {addressLine1 && <p className="text-xs text-path-grey-700 mb-1">{[addressLine1, addressLine2].filter(Boolean).join(", ")}</p>}
                          {addressTown && <p className="text-xs text-path-grey-700 mb-1">{[addressTown, addressPostcode].filter(Boolean).join(" ")}</p>}
                          {addressCountry && <p className="text-xs text-path-grey-700 mb-1">{addressCountry}</p>}
                          {dateOfBirth && <p className="text-xs text-path-grey-700 mb-1">DOB: {dateOfBirth}</p>}
                          {phoneNumber && <p className="text-xs text-path-grey-700">Phone: {`${phoneCountryCode} ${phoneNumber}`.trim()}</p>}
                        </>
                      ) : (
                        <p className="text-xs text-path-grey-500">Add summary info</p>
                      )}
                    </div>
                    <button type="button" onClick={() => setStep("step2")} className="shrink-0 text-xs text-path-secondary font-medium hover:underline">
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-path-grey-900 mb-2 text-left">Payout Account</h3>
                <div className="p-4 border border-path-grey-200 rounded-lg bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {hasPayoutAccount ? (
                        <>
                          <p className="text-xs font-medium text-path-grey-600 mb-1">Account Name</p>
                          <p className="text-xs text-path-grey-700 mb-1">{accountName?.trim() || "—"}</p>
                          {bankCurrency && bankCountry && <p className="text-xs text-path-grey-700 mb-1">{bankCurrency} – {bankCountry}</p>}
                          {isUkBank && sortCode && accountNumber && (
                            <>
                              <p className="text-xs text-path-grey-700 mb-1">Sort code: {sortCode}</p>
                              <p className="text-xs text-path-grey-700 mb-1">Account: ****{accountNumber.slice(-4)}</p>
                            </>
                          )}
                          {!isUkBank && iban && (
                            <p className="text-xs text-path-grey-700 mb-1">IBAN: {iban.replace(/\s/g, "").slice(0, 4)}****{iban.replace(/\s/g, "").slice(-4)}</p>
                          )}
                          {isUkBank && (
                            <p className={`text-xs font-medium ${bankVerified ? "text-green-600" : "text-amber-600"}`}>
                              Bank verification: {bankVerified ? "Verified" : "Further checks required"}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-path-grey-500">Add summary info</p>
                      )}
                    </div>
                    <button type="button" onClick={() => setStep("step6")} className="shrink-0 text-xs text-path-secondary font-medium hover:underline">
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reviewAgreeChecked}
                  onChange={(e) => setReviewAgreeChecked(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-path-grey-300 text-path-primary focus:ring-path-primary"
                />
                <span className="text-path-p2 text-path-grey-700">
                  By selecting Agree and submit, you accept the{" "}
                  <Link href="/legal/linked-account-agreement" className="text-path-primary font-medium underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                    Path Linked Account Agreement
                  </Link>
                  , consent to receive automated text messages, and certify that the information provided is complete and accurate.
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={async () => {
                if (!reviewAgreeChecked) return;
                setReviewSubmitting(true);
                try {
                  const res = await apiPost<{
                    success: boolean;
                    agreement_pdf_path?: string;
                    redirect_to_signing?: boolean;
                    signing_url?: string;
                  }>(
                    `/boarding/submit-review?token=${encodeURIComponent(token ?? "")}`,
                    {}
                  );
                  if (res.error) {
                    alert(res.error);
                    setReviewSubmitting(false);
                    return;
                  }
                  if (res.data?.redirect_to_signing && res.data?.signing_url) {
                    window.location.href = res.data.signing_url;
                    return;
                  }
                  setStep("done");
                } catch {
                  alert("Failed to submit. Please try again.");
                }
                setReviewSubmitting(false);
              }}
              disabled={!reviewAgreeChecked || reviewSubmitting}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                reviewAgreeChecked && !reviewSubmitting ? "bg-path-primary text-white hover:bg-path-primary-light-1" : "bg-path-grey-200 text-path-grey-500 cursor-not-allowed"
              }`}
            >
              {reviewSubmitting ? "Submitting..." : "Review and Submit"}
            </button>
          </div>
          <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500 text-center">
            © 2026 Path2ai.tech
          </footer>
        </main>
        {inviteInfo && (
          <BoardingRightPanel
            partner={inviteInfo.partner}
            productPackage={inviteInfo.product_package ?? null}
            productSummaryTitle="Your product selection"
            onSaveForLater={() => setShowSaveForLaterModal(true)}
          />
        )}
        {showSaveForLaterModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              {!saveForLaterSuccess ? (
                <>
                  <h2 className="text-path-h3 font-poppins text-path-primary mb-4">Save for later</h2>
                  <p className="text-path-p1 text-path-grey-700 mb-4">Your progress has been saved and is available for the next 14 days for you to return and complete.</p>
                  <p className="text-path-p1 text-path-grey-700 mb-6">We&apos;ll send an email to your email address with a link that will take you to the merchant boarding login screen.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowSaveForLaterModal(false)} className="flex-1 px-4 py-2 border border-path-grey-300 rounded-lg text-path-grey-700 hover:bg-path-grey-100 transition-colors">Cancel</button>
                    <button onClick={handleSaveForLater} disabled={saveForLaterLoading} className="flex-1 px-4 py-2 bg-path-primary text-white rounded-lg hover:bg-path-primary-light-1 transition-colors disabled:opacity-50">{saveForLaterLoading ? "Sending..." : "Continue"}</button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-path-h3 font-poppins text-path-primary mb-4">Email sent!</h2>
                  <p className="text-path-p1 text-path-grey-700 mb-6">We&apos;ve sent a link to your email address. You can use it to return and complete your boarding anytime within the next 14 days.</p>
                  <button onClick={() => { setShowSaveForLaterModal(false); setSaveForLaterSuccess(false); router.push("/"); }} className="w-full px-4 py-2 bg-path-primary text-white rounded-lg hover:bg-path-primary-light-1 transition-colors">Close</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === "done") {
    const pdfUrl = `${API_BASE || ""}/boarding/agreement-pdf?token=${encodeURIComponent(token ?? "")}`;
    const servicesUrl = `${API_BASE || ""}/boarding/services-agreement`;
    return (
      <div className="flex min-h-screen">
        <main className="flex-1 flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900">
          <header className="flex items-center gap-4 mb-8">
            <Image src="/logo-path.png" alt="Path" width={140} height={40} />
          </header>
          <div className="flex-1 max-w-md mx-auto w-full flex flex-col">
            <h1 className="text-path-h2 font-poppins text-path-primary mb-2">Your Merchant Agreement Documents</h1>
            <p className="text-path-p1 text-path-grey-700 mb-8">
              Below is a set of documents relating to your merchant agreement with Path. You can download each agreement as a PDF by clicking the relevant button.
            </p>
            <div className="space-y-4 mb-8">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-lg border border-path-grey-200 hover:border-path-primary hover:bg-path-primary/5 transition-colors group"
              >
                <div className="w-12 h-12 rounded-lg bg-path-primary/10 flex items-center justify-center shrink-0 group-hover:bg-path-primary/20">
                  <svg className="w-6 h-6 text-path-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-path-grey-900">Path Merchant Agreement</p>
                  <p className="text-path-p2 text-path-grey-600">Summary of your application and agreement terms</p>
                </div>
                <span className="text-path-primary font-medium shrink-0">Download PDF</span>
              </a>
              <a
                href={servicesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-lg border border-path-grey-200 hover:border-path-primary hover:bg-path-primary/5 transition-colors group"
              >
                <div className="w-12 h-12 rounded-lg bg-path-primary/10 flex items-center justify-center shrink-0 group-hover:bg-path-primary/20">
                  <svg className="w-6 h-6 text-path-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-path-grey-900">Services Agreement</p>
                  <p className="text-path-p2 text-path-grey-600">Path terms and conditions</p>
                </div>
                <span className="text-path-primary font-medium shrink-0">Download PDF</span>
              </a>
            </div>
            {inviteInfo?.partner && (
              <p className="text-path-p1 text-path-grey-700 mb-8">
                If you require any additional services or assistance, please contact your software partner, {inviteInfo.partner.name}, using the support email address or telephone number provided.
              </p>
            )}
            <button
              type="button"
              onClick={() => { localStorage.removeItem("boarding_token"); localStorage.removeItem("boarding_event_id"); router.push("/"); }}
              className="text-path-primary hover:underline font-medium"
            >
              Log out
            </button>
          </div>
        </main>
        {inviteInfo && (
          <BoardingRightPanel partner={inviteInfo.partner} showSupportInfo />
        )}
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
        {inviteInfo?.merchant_name ? (
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
      {inviteInfo && (
        <BoardingRightPanel
          partner={inviteInfo.partner}
          productPackage={inviteInfo.product_package ?? null}
        />
      )}
    </div>
  );
}
