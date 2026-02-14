"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE, apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { ProductPackageWizard, type CatalogProduct, type WizardItem } from "@/components/ProductPackageWizard";
import { StoreAddressInput } from "@/components/StoreAddressInput";

const PARTNER_TOKEN_KEY = "path_partner_token";

type InviteResponse = { invite_url: string; expires_at: string; boarding_event_id: string; token: string };

type PackageItem = {
  id: string;
  catalog_product_id: string;
  product_code?: string;
  product_name?: string;
  product_type?: string;
  config?: Record<string, unknown>;
  sort_order: number;
  requires_store_epos: boolean;
};

type ProductPackage = {
  id: string;
  partner_id: string;
  uid: string;
  name: string;
  description?: string;
  items: PackageItem[];
  created_at?: string;
};

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

  // Product packages
  const [activeTab, setActiveTab] = useState<"invite" | "packages">("invite");
  const [packages, setPackages] = useState<ProductPackage[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [feeScheduleRates, setFeeScheduleRates] = useState<Record<string, Record<string, number>>>({});
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardItems, setWizardItems] = useState<WizardItem[]>([]);
  const [wizardName, setWizardName] = useState("");
  const [wizardDesc, setWizardDesc] = useState("");
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [packageCreateSuccess, setPackageCreateSuccess] = useState<string | null>(null);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);

  // Invite form: package + device details (per POS type: qty + store/address/epos per instance)
  const [selectedPackageUid, setSelectedPackageUid] = useState<string>("");
  const [posDeviceConfig, setPosDeviceConfig] = useState<
    Array<{
      package_item_id: string;
      product_name: string;
      qty: number;
      instances: Array<{
        store_name: string;
        postcode: string;
        addressLine1: string;
        addressLine2: string;
        town: string;
        epos_terminal: string;
      }>;
    }>
  >([]);

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

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setPackagesLoading(true);
    (async () => {
      const [catRes, pkgRes, feeRes] = await Promise.all([
        apiGet<CatalogProduct[]>("/partners/product-catalog", { headers: authHeaders(token) }),
        apiGet<ProductPackage[]>("/partners/product-packages", { headers: authHeaders(token) }),
        apiGet<{ rates: Record<string, Record<string, number>> }>("/partners/fee-schedule", { headers: authHeaders(token) }),
      ]);
      if (cancelled) return;
      if (catRes.error && (catRes as { statusCode?: number }).statusCode === 401) {
        clearPartnerAndRedirect(router, setToken);
        return;
      }
      if (pkgRes.error && (pkgRes as { statusCode?: number }).statusCode === 401) {
        clearPartnerAndRedirect(router, setToken);
        return;
      }
      if (feeRes.error && (feeRes as { statusCode?: number }).statusCode === 401) {
        clearPartnerAndRedirect(router, setToken);
        return;
      }
      if (catRes.data) setCatalog(catRes.data);
      if (pkgRes.data) setPackages(pkgRes.data);
      if (feeRes.data?.rates) setFeeScheduleRates(feeRes.data.rates);
      setPackagesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token, router]);

  useEffect(() => {
    if (!selectedPackageUid || !packages.length) {
      setPosDeviceConfig([]);
      return;
    }
    const pkg = packages.find((p) => p.uid === selectedPackageUid);
    if (!pkg) {
      setPosDeviceConfig([]);
      return;
    }
    const posItems = pkg.items.filter((i) => i.requires_store_epos);
    setPosDeviceConfig(
      posItems.map((i) => ({
        package_item_id: i.id,
        product_name: i.product_name ?? "POS device",
        qty: 1,
        instances: [{ store_name: "", postcode: "", addressLine1: "", addressLine2: "", town: "", epos_terminal: "" }],
      }))
    );
  }, [selectedPackageUid, packages]);

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
    const body: Record<string, unknown> = {
      merchant_name: merchantName || undefined,
      email: merchantEmail || undefined,
      product_package_uid: selectedPackageUid || undefined,
    };
    if (selectedPackageUid && posDeviceConfig.length > 0) {
      body.device_details = posDeviceConfig.flatMap((cfg) =>
        cfg.instances.map((inst) => {
          const addrParts = [inst.addressLine1, inst.addressLine2, inst.town, inst.postcode].filter(Boolean);
          return {
            package_item_id: cfg.package_item_id,
            store_name: inst.store_name || undefined,
            store_address: addrParts.length > 0 ? addrParts.join(", ") : undefined,
            epos_terminal: inst.epos_terminal || undefined,
          };
        })
      );
    }
    const res = await apiPost<InviteResponse>(
      "/partners/boarding/invite",
      body,
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
    const body: Record<string, unknown> = {
      merchant_name: merchantName || undefined,
      email: merchantEmail || undefined,
      product_package_uid: selectedPackageUid || undefined,
    };
    if (selectedPackageUid && posDeviceConfig.length > 0) {
      body.device_details = posDeviceConfig.flatMap((cfg) =>
        cfg.instances.map((inst) => {
          const addrParts = [inst.addressLine1, inst.addressLine2, inst.town, inst.postcode].filter(Boolean);
          return {
            package_item_id: cfg.package_item_id,
            store_name: inst.store_name || undefined,
            store_address: addrParts.length > 0 ? addrParts.join(", ") : undefined,
            epos_terminal: inst.epos_terminal || undefined,
          };
        })
      );
    }
    const res = await apiPost<InviteResponse>(
      "/partners/boarding/invite",
      body,
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

        <div className="flex gap-2 border-b border-path-grey-200">
          <button
            type="button"
            onClick={() => setActiveTab("invite")}
            className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === "invite" ? "bg-path-primary text-white" : "bg-path-grey-100 text-path-grey-700 hover:bg-path-grey-200"
            }`}
          >
            Generate Link
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("packages")}
            className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === "packages" ? "bg-path-primary text-white" : "bg-path-grey-100 text-path-grey-700 hover:bg-path-grey-200"
            }`}
          >
            Product Packages
          </button>
        </div>

        {activeTab === "invite" && (
          <>
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
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Product package</label>
              <div className="relative h-11">
                <select
                  value={selectedPackageUid}
                  onChange={(e) => setSelectedPackageUid(e.target.value)}
                  className="w-full h-full border border-path-grey-300 rounded-lg pl-3 pr-10 py-2 text-path-p1 appearance-none bg-white"
                >
                  <option value="">None</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.uid}>{p.name} ({p.uid})</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-path-grey-500" aria-hidden>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            {posDeviceConfig.length > 0 && (
              <div className="space-y-4 border border-path-grey-200 rounded-lg p-3 bg-path-grey-50">
                <h3 className="text-path-p2 font-medium text-path-grey-700">Device details (required for POS devices)</h3>
                {posDeviceConfig.map((cfg, cfgIdx) => (
                  <div key={cfg.package_item_id} className="space-y-3 p-3 bg-white rounded border border-path-grey-200">
                    <div className="flex items-center gap-3">
                      <label className="text-path-p2 font-medium text-path-grey-700">
                        How many {cfg.product_name}?
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={cfg.qty}
                        onChange={(e) => {
                          const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setPosDeviceConfig((prev) => {
                            const next = [...prev];
                            const c = { ...next[cfgIdx] };
                            const diff = v - c.instances.length;
                            if (diff > 0) {
                              c.instances = [...c.instances, ...Array(diff).fill(null).map(() => ({ store_name: "", postcode: "", addressLine1: "", addressLine2: "", town: "", epos_terminal: "" }))];
                            } else if (diff < 0) {
                              c.instances = c.instances.slice(0, v);
                            }
                            c.qty = v;
                            next[cfgIdx] = c;
                            return next;
                          });
                        }}
                        className="w-20 border border-path-grey-300 rounded px-2 py-1 text-path-p2"
                      />
                    </div>
                    {cfg.instances.map((inst, instIdx) => (
                      <div key={instIdx} className="pl-4 border-l-2 border-path-grey-200 space-y-2">
                        <p className="text-path-p2 text-path-grey-600 font-medium">{cfg.product_name} #{instIdx + 1}</p>
                        <input
                          type="text"
                          placeholder="Store name"
                          value={inst.store_name}
                          onChange={(e) => {
                            setPosDeviceConfig((prev) => {
                              const next = prev.map((c, i) =>
                                i === cfgIdx
                                  ? { ...c, instances: c.instances.map((x, j) => (j === instIdx ? { ...x, store_name: e.target.value } : x)) }
                                  : c
                              );
                              return next;
                            });
                          }}
                          className="w-full border border-path-grey-300 rounded px-2 py-1 text-path-p2"
                        />
                        <StoreAddressInput
                          label="Store address (postcode first for UK)"
                          postcode={inst.postcode}
                          addressLine1={inst.addressLine1}
                          addressLine2={inst.addressLine2}
                          town={inst.town}
                          onPostcodeChange={(v) => {
                            setPosDeviceConfig((prev) =>
                              prev.map((c, i) =>
                                i === cfgIdx
                                  ? { ...c, instances: c.instances.map((x, j) => (j === instIdx ? { ...x, postcode: v } : x)) }
                                  : c
                              )
                            );
                          }}
                          onAddressChange={(a) => {
                            setPosDeviceConfig((prev) =>
                              prev.map((c, i) =>
                                i === cfgIdx
                                  ? {
                                      ...c,
                                      instances: c.instances.map((x, j) =>
                                        j === instIdx ? { ...x, addressLine1: a.addressLine1, addressLine2: a.addressLine2, town: a.town } : x
                                      ),
                                    }
                                  : c
                              )
                            );
                          }}
                        />
                        <input
                          type="text"
                          placeholder="EPOS terminal"
                          value={inst.epos_terminal}
                          onChange={(e) => {
                            setPosDeviceConfig((prev) => {
                              const next = prev.map((c, i) =>
                                i === cfgIdx
                                  ? { ...c, instances: c.instances.map((x, j) => (j === instIdx ? { ...x, epos_terminal: e.target.value } : x)) }
                                  : c
                              );
                              return next;
                            });
                          }}
                          className="w-full border border-path-grey-300 rounded px-2 py-1 text-path-p2"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Merchant name</label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="e.g. Acme Ltd"
                className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 h-11"
              />
            </div>
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Merchant email</label>
              <input
                type="email"
                value={merchantEmail}
                onChange={(e) => setMerchantEmail(e.target.value)}
                placeholder="merchant@example.com"
                className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 h-11"
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
          </>
        )}

        {activeTab === "packages" && (
          <section className="border border-path-grey-300 rounded-lg p-4">
            <h2 className="text-path-h4 font-poppins text-path-primary mb-2">Product Packages</h2>
            <p className="text-path-p2 text-path-grey-600 mb-4">
              Create and manage product packages. Assign a package when generating boarding links to pre-configure products for merchants.
            </p>
            {packageCreateSuccess && (
              <p className="text-path-p2 text-path-primary font-medium mb-2">{packageCreateSuccess}</p>
            )}
            {!showCreateWizard ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPackageId(null);
                    setShowCreateWizard(true);
                    setWizardStep(1);
                    setWizardItems([]);
                    setWizardName("");
                    setWizardDesc("");
                    setWizardError(null);
                    setPackageCreateSuccess(null);
                  }}
                  className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 mb-4"
                >
                  Create package
                </button>
                {packagesLoading ? (
                  <p className="text-path-p2 text-path-grey-600">Loading packages…</p>
                ) : (
                  <ul className="space-y-2">
                    {packages.map((p) => (
                      <li key={p.id} className="flex items-center justify-between border border-path-grey-200 rounded-lg p-3">
                        <div>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-path-grey-500 ml-2">({p.uid})</span>
                          {p.description && <p className="text-path-p2 text-path-grey-600 mt-1">{p.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-path-p2 text-path-grey-500">{p.items.length} items</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPackageId(p.id);
                              setWizardName(p.name);
                              setWizardDesc(p.description ?? "");
                              setWizardItems(
                                p.items.map((it, i) => ({
                                  catalog_product_id: it.catalog_product_id,
                                  config: it.config ?? {},
                                  sort_order: it.sort_order ?? i,
                                }))
                              );
                              setWizardStep(1);
                              setWizardError(null);
                              setPackageCreateSuccess(null);
                              setShowCreateWizard(true);
                            }}
                            className="px-3 py-1 text-path-p2 border border-path-grey-300 rounded hover:bg-path-grey-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Delete package "${p.name}"? This cannot be undone.`)) return;
                              if (!token) return;
                              const res = await apiDelete(`/partners/product-packages/${p.id}`, { headers: authHeaders(token) });
                              if (res.error) {
                                setPackageCreateSuccess(null);
                                alert(res.error);
                                return;
                              }
                              setPackages((prev) => prev.filter((x) => x.id !== p.id));
                              setPackageCreateSuccess("Package deleted.");
                            }}
                            className="px-3 py-1 text-path-p2 border border-path-secondary text-path-secondary rounded hover:bg-path-grey-100"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                    {packages.length === 0 && <li className="text-path-p2 text-path-grey-500">No packages yet. Create one to get started.</li>}
                  </ul>
                )}
              </>
            ) : (
              <ProductPackageWizard
                catalog={catalog}
                feeScheduleRates={feeScheduleRates}
                wizardStep={wizardStep}
                setWizardStep={setWizardStep}
                wizardItems={wizardItems}
                setWizardItems={setWizardItems}
                wizardName={wizardName}
                setWizardName={setWizardName}
                wizardDesc={wizardDesc}
                setWizardDesc={setWizardDesc}
                wizardError={wizardError}
                setWizardError={setWizardError}
                onCancel={() => {
                  setShowCreateWizard(false);
                  setEditingPackageId(null);
                }}
                onSuccess={(uid) => {
                  setShowCreateWizard(false);
                  setEditingPackageId(null);
                  setPackageCreateSuccess(editingPackageId ? "Package updated." : `Package created. UID: ${uid}`);
                  if (token) {
                    apiGet<ProductPackage[]>("/partners/product-packages", { headers: authHeaders(token) }).then((r) => {
                      if (r.data) setPackages(r.data);
                    });
                  }
                }}
                createPackage={async (payload) => {
                  if (!token) return { error: "Not authenticated" };
                  const doRequest = async () => {
                    if (editingPackageId) {
                      return apiPatch<{ uid: string }>(`/partners/product-packages/${editingPackageId}`, payload, { headers: authHeaders(token) });
                    }
                    return apiPost<{ uid: string }>("/partners/product-packages", payload, { headers: authHeaders(token) });
                  };
                  const res = await doRequest();
                  if (res.error) {
                    if ((res as { statusCode?: number }).statusCode === 401) {
                      clearPartnerAndRedirect(router, setToken);
                      return { error: "Session expired. Please log in again." };
                    }
                    return { error: res.error };
                  }
                  return { uid: res.data?.uid ?? "" };
                }}
              />
            )}
          </section>
        )}
      </div>

      <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500">
        © 2026 Path2ai.tech
      </footer>
    </main>
  );
}
