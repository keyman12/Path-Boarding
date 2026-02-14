"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE, apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api";
import { ProductPackageWizard, type CatalogProduct, type WizardItem } from "@/components/ProductPackageWizard";

const ADMIN_TOKEN_KEY = "path_admin_token";

type AdminUser = { id: string; username: string; created_at: string };
type Partner = { id: string; name: string; email: string; external_id?: string | null; logo_url?: string | null; is_active: boolean; fee_schedule_id: string; created_at: string };
type FeeSchedule = { id: string; name: string; rates: Record<string, Record<string, number>> };

type PackageItem = { id: string; catalog_product_id: string; product_code?: string; product_name?: string; product_type?: string; config?: Record<string, unknown>; sort_order: number; requires_store_epos: boolean };
type ProductPackage = { id: string; partner_id: string; uid: string; name: string; description?: string; items: PackageItem[]; created_at?: string };

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

const inputClass = "w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 min-h-[2.75rem]";
const selectClass = "w-full h-full border border-path-grey-300 rounded-lg pl-3 pr-10 py-2 text-path-p1 appearance-none bg-white";

function isUnauthorized(res: { error?: string; statusCode?: number }): boolean {
  return res.error != null && (res as { statusCode?: number }).statusCode === 401;
}

export default function AdminPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState("Admin");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [feeSchedules, setFeeSchedules] = useState<FeeSchedule[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminPasswordConfirm, setNewAdminPasswordConfirm] = useState("");
  const [adminPasswordNew, setAdminPasswordNew] = useState("");
  const [adminPasswordNewConfirm, setAdminPasswordNewConfirm] = useState("");
  const [isvName, setIsvName] = useState("");
  const [isvEmail, setIsvEmail] = useState("");
  const [isvPassword, setIsvPassword] = useState("");
  const [isvPasswordConfirm, setIsvPasswordConfirm] = useState("");
  const [isvExternalId, setIsvExternalId] = useState("");
  const [isvFeeScheduleId, setIsvFeeScheduleId] = useState("");
  const [isvLogoFile, setIsvLogoFile] = useState<File | null>(null);
  const [partnerPasswordNew, setPartnerPasswordNew] = useState("");
  const [partnerPasswordNewConfirm, setPartnerPasswordNewConfirm] = useState("");
  const [partnerNameEdit, setPartnerNameEdit] = useState("");
  const [partnerEmailEdit, setPartnerEmailEdit] = useState("");
  const [partnerFeeScheduleIdEdit, setPartnerFeeScheduleIdEdit] = useState("");
  const [partnerLogoFile, setPartnerLogoFile] = useState<File | null>(null);
  const [createAdminMessage, setCreateAdminMessage] = useState<string | null>(null);
  const [createAdminError, setCreateAdminError] = useState<string | null>(null);
  const [changePasswordMessage, setChangePasswordMessage] = useState<string | null>(null);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [setupPartnerMessage, setSetupPartnerMessage] = useState<string | null>(null);
  const [setupPartnerError, setSetupPartnerError] = useState<string | null>(null);
  const [updatePartnerMessage, setUpdatePartnerMessage] = useState<string | null>(null);
  const [updatePartnerError, setUpdatePartnerError] = useState<string | null>(null);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
    setToken(t);
  }, []);

  const clearAdminAndRedirect = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
    router.replace("/");
  }, [router]);

  const loadAdmins = useCallback(async () => {
    if (!token) return;
    const res = await apiGet<AdminUser[]>("/admin/users", { headers: authHeaders(token) });
    if (isUnauthorized(res)) {
      clearAdminAndRedirect();
      return;
    }
    if (res.data) setAdmins(res.data);
  }, [token, clearAdminAndRedirect]);

  const loadPartners = useCallback(async () => {
    if (!token) return;
    const res = await apiGet<Partner[]>("/admin/partners", { headers: authHeaders(token) });
    if (isUnauthorized(res)) {
      clearAdminAndRedirect();
      return;
    }
    if (res.data) setPartners(res.data);
  }, [token, clearAdminAndRedirect]);

  const loadFeeSchedules = useCallback(async () => {
    if (!token) return;
    const res = await apiGet<FeeSchedule[]>("/admin/fee-schedules", { headers: authHeaders(token) });
    if (isUnauthorized(res)) {
      clearAdminAndRedirect();
      return;
    }
    if (res.data) setFeeSchedules(res.data);
  }, [token, clearAdminAndRedirect]);

  useEffect(() => {
    if (token) {
      loadAdmins();
      loadPartners();
      loadFeeSchedules();
    }
  }, [token, loadAdmins, loadPartners, loadFeeSchedules]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await apiPost<{ access_token: string }>("/admin/login", { username: loginUsername, password: loginPassword });
    if (res.error) {
      setLoginError(res.error);
      return;
    }
    if (res.data?.access_token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, res.data.access_token);
      setToken(res.data.access_token);
    }
  }

  function handleLogout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setCreateAdminError(null);
    setCreateAdminMessage(null);
    if (!token) return;
    if (newAdminPassword !== newAdminPasswordConfirm) {
      setCreateAdminError("Passwords do not match.");
      return;
    }
    const res = await apiPost<AdminUser>("/admin/users", { username: newAdminUsername, password: newAdminPassword }, { headers: authHeaders(token) });
    if (res.error) {
      if (isUnauthorized(res)) { clearAdminAndRedirect(); return; }
      setCreateAdminError(res.error);
      return;
    }
    setCreateAdminMessage("Admin user created.");
    setNewAdminUsername("");
    setNewAdminPassword("");
    setNewAdminPasswordConfirm("");
    loadAdmins();
  }

  async function handleChangeAdminPassword(e: React.FormEvent) {
    e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordMessage(null);
    if (!token || !selectedAdminId || !adminPasswordNew) return;
    if (adminPasswordNew !== adminPasswordNewConfirm) {
      setChangePasswordError("Passwords do not match.");
      return;
    }
    const res = await apiPatch(`/admin/users/${selectedAdminId}/password`, { new_password: adminPasswordNew }, { headers: authHeaders(token) });
    if (res.error) {
      if (isUnauthorized(res)) { clearAdminAndRedirect(); return; }
      setChangePasswordError(res.error);
      return;
    }
    setChangePasswordMessage("Admin password updated.");
    setAdminPasswordNew("");
    setAdminPasswordNewConfirm("");
    setSelectedAdminId("");
  }

  async function handleSetupIsv(e: React.FormEvent) {
    e.preventDefault();
    setSetupPartnerError(null);
    setSetupPartnerMessage(null);
    if (!token) return;
    if (isvPassword !== isvPasswordConfirm) {
      setSetupPartnerError("Passwords do not match.");
      return;
    }
    const formData = new FormData();
    formData.append("name", isvName);
    formData.append("email", isvEmail);
    formData.append("password", isvPassword);
    formData.append("fee_schedule_id", isvFeeScheduleId);
    if (isvExternalId) formData.append("external_id", isvExternalId);
    if (isvLogoFile) formData.append("logo", isvLogoFile);
    const res = await fetch(`${API_BASE}/admin/partners`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) { clearAdminAndRedirect(); return; }
      setSetupPartnerError(json.detail ?? json.message ?? "Request failed");
      return;
    }
    setSetupPartnerMessage("Partner created.");
    setIsvName("");
    setIsvEmail("");
    setIsvPassword("");
    setIsvPasswordConfirm("");
    setIsvExternalId("");
    setIsvFeeScheduleId("");
    setIsvLogoFile(null);
    loadPartners();
  }

  async function handleUpdatePartner(e: React.FormEvent) {
    e.preventDefault();
    setUpdatePartnerError(null);
    setUpdatePartnerMessage(null);
    if (!token || !selectedPartnerId) return;
    if (partnerPasswordNew || partnerPasswordNewConfirm) {
      if (partnerPasswordNew !== partnerPasswordNewConfirm) {
        setUpdatePartnerError("Passwords do not match.");
        return;
      }
    }
    const body: { name?: string; email?: string; password?: string; fee_schedule_id?: string } = {};
    if (partnerNameEdit) body.name = partnerNameEdit;
    if (partnerEmailEdit) body.email = partnerEmailEdit;
    if (partnerPasswordNew) body.password = partnerPasswordNew;
    if (partnerFeeScheduleIdEdit) body.fee_schedule_id = partnerFeeScheduleIdEdit;
    if (Object.keys(body).length === 0) {
      setUpdatePartnerError("Enter at least one field to update.");
      return;
    }
    const res = await apiPatch<Partner>(`/admin/partners/${selectedPartnerId}`, body, { headers: authHeaders(token) });
    if (res.error) {
      if (isUnauthorized(res)) { clearAdminAndRedirect(); return; }
      setUpdatePartnerError(res.error);
      return;
    }
    setUpdatePartnerMessage("Partner updated.");
    setPartnerPasswordNew("");
    setPartnerPasswordNewConfirm("");
    setPartnerNameEdit("");
    setPartnerEmailEdit("");
    setSelectedPartnerId("");
    loadPartners();
  }

  async function handleUploadPartnerLogo() {
    if (!token || !selectedPartnerId || !partnerLogoFile) return;
    setUpdatePartnerError(null);
    setUpdatePartnerMessage(null);
    const formData = new FormData();
    formData.append("logo", partnerLogoFile);
    const res = await fetch(`${API_BASE}/admin/partners/${selectedPartnerId}/logo`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) { clearAdminAndRedirect(); return; }
      setUpdatePartnerError(json.detail ?? json.message ?? "Upload failed");
      return;
    }
    setUpdatePartnerMessage("Logo updated.");
    setPartnerLogoFile(null);
    loadPartners();
  }

  async function handleRemovePartnerLogo() {
    if (!token || !selectedPartnerId) return;
    setUpdatePartnerError(null);
    setUpdatePartnerMessage(null);
    const res = await fetch(`${API_BASE}/admin/partners/${selectedPartnerId}/logo`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) { clearAdminAndRedirect(); return; }
      setUpdatePartnerError(json.detail ?? json.message ?? "Remove failed");
      return;
    }
    setUpdatePartnerMessage("Logo removed.");
    setPartnerLogoFile(null);
    loadPartners();
  }

  async function handleDeletePartner() {
    if (!token || !selectedPartnerId) return;
    if (!confirm("Delete this partner and all associated data (invites, boarding events, merchants)? This cannot be undone.")) return;
    setUpdatePartnerError(null);
    setUpdatePartnerMessage(null);
    const res = await fetch(`${API_BASE}/admin/partners/${selectedPartnerId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) { clearAdminAndRedirect(); return; }
      setUpdatePartnerError(json.detail ?? json.message ?? "Delete failed");
      return;
    }
    setUpdatePartnerMessage("Partner deleted.");
    setSelectedPartnerId("");
    setPartnerNameEdit("");
    setPartnerEmailEdit("");
    setPartnerPasswordNew("");
    setPartnerPasswordNewConfirm("");
    setPartnerLogoFile(null);
    loadPartners();
  }

  const selectedPartner = partners.find((p) => p.id === selectedPartnerId);

  useEffect(() => {
    const p = partners.find((x) => x.id === selectedPartnerId);
    if (p) {
      setPartnerNameEdit(p.name);
      setPartnerEmailEdit(p.email);
      setPartnerFeeScheduleIdEdit(p.fee_schedule_id);
    } else {
      setPartnerNameEdit("");
      setPartnerEmailEdit("");
      setPartnerFeeScheduleIdEdit("");
    }
  }, [selectedPartnerId, partners]);

  if (token === null) {
    return (
      <main className="min-h-screen flex flex-col p-8 font-roboto bg-white">
        <header className="flex items-center gap-4 mb-8">
          <Image src="/logo-path.png" alt="Path" width={140} height={40} />
        </header>
        <div className="max-w-md mx-auto w-full">
          <h1 className="text-path-h2 font-poppins text-path-primary mb-6">Path Admin login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1"
              />
            </div>
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1"
              />
            </div>
            {loginError && <p className="text-path-p2 text-path-secondary">{loginError}</p>}
            <button type="submit" className="w-full px-4 py-3 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors">
              Log in
            </button>
          </form>
          <p className="mt-4 text-path-p2 text-path-grey-500">
            <Link href="/" className="text-path-primary hover:underline">Back to boarding</Link>
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
        <div className="flex items-center gap-4">
          <Link href="/" className="text-path-p2 text-path-grey-600 hover:underline">Boarding</Link>
          <button type="button" onClick={handleLogout} className="px-4 py-2 border border-path-grey-300 rounded-lg text-path-p2 hover:bg-path-grey-100">
            Log out
          </button>
        </div>
      </header>

      <div className="max-w-3xl space-y-8">
        <h1 className="text-path-h2 font-poppins text-path-primary">Path Boarding Admin Dashboard</h1>

        {/* 1. Create Path Administrator Account */}
        <section className="border border-path-grey-300 rounded-lg p-4">
          <h2 className="text-path-h4 font-poppins text-path-primary mb-3">Create a New Path Administrator Account</h2>
          <p className="text-path-p2 text-path-grey-600 mb-3">Add a new admin user with username and password.</p>
          {createAdminMessage && <p className="text-path-p2 text-path-primary font-medium mb-2">{createAdminMessage}</p>}
          {createAdminError && <p className="text-path-p2 text-path-secondary mb-2">{createAdminError}</p>}
          <form onSubmit={handleCreateAdmin} className="space-y-3 max-w-md">
            <input type="text" value={newAdminUsername} onChange={(e) => setNewAdminUsername(e.target.value)} placeholder="Username" required className={inputClass} />
            <input type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} placeholder="Password" required minLength={8} className={inputClass} />
            <input type="password" value={newAdminPasswordConfirm} onChange={(e) => setNewAdminPasswordConfirm(e.target.value)} placeholder="Confirm password" required minLength={8} className={inputClass} />
            <button type="submit" className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1">Create admin</button>
          </form>
        </section>

        {/* 2. Update Administrator Password */}
        <section className="border border-path-grey-300 rounded-lg p-4">
          <h2 className="text-path-h4 font-poppins text-path-primary mb-3">Update Administrator Password</h2>
          <p className="text-path-p2 text-path-grey-600 mb-3">Select an administrator account and set a new password.</p>
          {changePasswordMessage && <p className="text-path-p2 text-path-primary font-medium mb-2">{changePasswordMessage}</p>}
          {changePasswordError && <p className="text-path-p2 text-path-secondary mb-2">{changePasswordError}</p>}
          <form onSubmit={handleChangeAdminPassword} className="space-y-3 max-w-md">
            <div className="relative h-11">
              <select value={selectedAdminId} onChange={(e) => setSelectedAdminId(e.target.value)} required className={selectClass}>
                <option value="">Select administrator</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>{a.username}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-path-grey-500" aria-hidden>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <input type="password" value={adminPasswordNew} onChange={(e) => setAdminPasswordNew(e.target.value)} placeholder="New password" required minLength={8} className={inputClass} />
            <input type="password" value={adminPasswordNewConfirm} onChange={(e) => setAdminPasswordNewConfirm(e.target.value)} placeholder="Confirm new password" required minLength={8} className={inputClass} />
            <button type="submit" className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1">Update password</button>
          </form>
        </section>

        {/* 2b. Fee Schedules */}
        <FeeSchedulesSection token={token} feeSchedules={feeSchedules} loadFeeSchedules={loadFeeSchedules} authHeaders={authHeaders} clearAdminAndRedirect={clearAdminAndRedirect} />

        {/* 3. Setup New Partnership Account */}
        <section className="border border-path-grey-300 rounded-lg p-4">
          <h2 className="text-path-h4 font-poppins text-path-primary mb-3">Setup a New Partnership Account</h2>
          <p className="text-path-p2 text-path-grey-600 mb-3">Create a new partner with name, email, password. Requires a fee schedule. Optional logo (max 512KB for welcome screen).</p>
          {setupPartnerMessage && <p className="text-path-p2 text-path-primary font-medium mb-2">{setupPartnerMessage}</p>}
          {setupPartnerError && <p className="text-path-p2 text-path-secondary mb-2">{setupPartnerError}</p>}
          <form onSubmit={handleSetupIsv} className="space-y-3 max-w-md">
            <input type="text" value={isvName} onChange={(e) => setIsvName(e.target.value)} placeholder="Name (e.g. Order Champ)" required className={inputClass} />
            <input type="email" value={isvEmail} onChange={(e) => setIsvEmail(e.target.value)} placeholder="Email" required className={inputClass} />
            <input type="password" value={isvPassword} onChange={(e) => setIsvPassword(e.target.value)} placeholder="Password" required minLength={8} className={inputClass} />
            <input type="password" value={isvPasswordConfirm} onChange={(e) => setIsvPasswordConfirm(e.target.value)} placeholder="Confirm password" required minLength={8} className={inputClass} />
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Fee schedule (required)</label>
              <div className="relative h-11">
                <select value={isvFeeScheduleId} onChange={(e) => setIsvFeeScheduleId(e.target.value)} required className={selectClass}>
                  <option value="">Select fee schedule</option>
                  {feeSchedules.map((fs) => (
                    <option key={fs.id} value={fs.id}>{fs.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-path-grey-500" aria-hidden>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {feeSchedules.length === 0 && <p className="text-path-p2 text-path-grey-500 mt-1">Create a fee schedule first.</p>}
            </div>
            <input type="text" value={isvExternalId} onChange={(e) => setIsvExternalId(e.target.value)} placeholder="External ID (optional)" className={inputClass} />
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Logo (optional, max 512KB)</label>
              <input type="file" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={(e) => setIsvLogoFile(e.target.files?.[0] ?? null)} className="w-full text-path-p2" />
            </div>
            <button type="submit" className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1">Create Partner</button>
          </form>
        </section>

        {/* 4. Update Partner Details */}
        <section className="border border-path-grey-300 rounded-lg p-4">
          <h2 className="text-path-h4 font-poppins text-path-primary mb-3">Update Partner Details</h2>
          <p className="text-path-p2 text-path-grey-600 mb-3">Select a partner, update details or delete.</p>
          {updatePartnerMessage && <p className="text-path-p2 text-path-primary font-medium mb-2">{updatePartnerMessage}</p>}
          {updatePartnerError && <p className="text-path-p2 text-path-secondary mb-2">{updatePartnerError}</p>}
          <form onSubmit={handleUpdatePartner} className="space-y-3 max-w-md">
            <div className="relative h-11">
              <select value={selectedPartnerId} onChange={(e) => { setSelectedPartnerId(e.target.value); const p = partners.find(x => x.id === e.target.value); if (p) { setPartnerNameEdit(p.name); setPartnerEmailEdit(p.email); setPartnerFeeScheduleIdEdit(p.fee_schedule_id); } setPartnerLogoFile(null); }} className={selectClass}>
                <option value="">Select partner</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-path-grey-500" aria-hidden>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {selectedPartner && (
              <>
                {selectedPartner.logo_url && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <img src={`${API_BASE}${selectedPartner.logo_url}`} alt={`${selectedPartner.name} logo`} className="h-12 object-contain border border-path-grey-300 rounded" />
                    <span className="text-path-p2 text-path-grey-600">Current logo</span>
                  </div>
                )}
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Logo (upload or replace, max 512KB)</label>
                    <input type="file" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={(e) => setPartnerLogoFile(e.target.files?.[0] ?? null)} className="w-full text-path-p2" />
                  </div>
                  <button type="button" onClick={handleUploadPartnerLogo} disabled={!partnerLogoFile} className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 disabled:opacity-50">Upload logo</button>
                  {selectedPartner.logo_url && (
                    <button type="button" onClick={handleRemovePartnerLogo} className="px-4 py-2 border border-path-grey-300 rounded-lg text-path-p2 hover:bg-path-grey-100">Remove logo</button>
                  )}
                </div>
                <input type="text" value={partnerNameEdit} onChange={(e) => setPartnerNameEdit(e.target.value)} placeholder="Name" className={inputClass} />
                <input type="email" value={partnerEmailEdit} onChange={(e) => setPartnerEmailEdit(e.target.value)} placeholder="Email" className={inputClass} />
                <div>
                  <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Fee schedule</label>
                  <div className="relative h-11">
                    <select value={partnerFeeScheduleIdEdit} onChange={(e) => setPartnerFeeScheduleIdEdit(e.target.value)} className={selectClass}>
                      {feeSchedules.map((fs) => (
                        <option key={fs.id} value={fs.id}>{fs.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-path-grey-500" aria-hidden>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                <input type="password" value={partnerPasswordNew} onChange={(e) => setPartnerPasswordNew(e.target.value)} placeholder="New password (leave blank to keep)" minLength={8} className={inputClass} />
                <input type="password" value={partnerPasswordNewConfirm} onChange={(e) => setPartnerPasswordNewConfirm(e.target.value)} placeholder="Confirm new password" minLength={8} className={inputClass} />
              </>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={!selectedPartnerId} className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 disabled:opacity-50">Update partner</button>
              <button type="button" onClick={handleDeletePartner} disabled={!selectedPartnerId} className="px-4 py-2 border border-path-secondary text-path-secondary rounded-lg font-medium hover:bg-path-grey-100 disabled:opacity-50">Delete partner</button>
            </div>
          </form>
        </section>

        {/* 5. Product Packages (Admin) */}
        <AdminProductPackagesSection
          token={token}
          partners={partners}
          authHeaders={authHeaders}
          clearAdminAndRedirect={clearAdminAndRedirect}
        />
      </div>

      <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500">
        © 2026 Path2ai.tech
      </footer>
    </main>
  );
}

function FeeSchedulesSection({
  token,
  feeSchedules,
  loadFeeSchedules,
  authHeaders,
  clearAdminAndRedirect,
}: {
  token: string | null;
  feeSchedules: FeeSchedule[];
  loadFeeSchedules: () => Promise<void>;
  authHeaders: (t: string) => { Authorization: string };
  clearAdminAndRedirect: () => void;
}) {
  const [newScheduleName, setNewScheduleName] = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRates, setEditRates] = useState<Record<string, Record<string, number>>>({});
  const [productSchema, setProductSchema] = useState<Record<string, { label: string; [k: string]: unknown }>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const res = await apiGet<{ products: Record<string, { label: string; [k: string]: unknown }> }>("/admin/fee-schedule-schema", { headers: authHeaders(token) });
      if (res.data?.products) setProductSchema(res.data.products);
    })();
  }, [token, authHeaders]);

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!token || !newScheduleName.trim()) return;
    const res = await apiPost<FeeSchedule>("/admin/fee-schedules", { name: newScheduleName.trim() }, { headers: authHeaders(token) });
    if (res.error) {
      if (isUnauthorized(res)) { clearAdminAndRedirect(); return; }
      setError(res.error);
      return;
    }
    setMessage("Fee schedule created.");
    setNewScheduleName("");
    loadFeeSchedules();
  }

  const RATE_KEYS = ["min_pct", "min_amount", "min_per_month", "min_per_device", "min_service"];

  function startEdit(s: FeeSchedule) {
    setEditingScheduleId(s.id);
    setEditName(s.name);
    const merged: Record<string, Record<string, number>> = {};
    const codes = Object.keys(productSchema).length > 0 ? Object.keys(productSchema) : Object.keys(s.rates || {});
    for (const code of codes) {
      const schema = productSchema[code];
      const fromSchema: Record<string, number> = {};
      if (schema) {
        for (const k of RATE_KEYS) {
          const v = schema[k];
          if (typeof v === "number") fromSchema[k] = v;
        }
      }
      merged[code] = { ...fromSchema, ...(s.rates?.[code] || {}) };
    }
    setEditRates(merged);
    setError(null);
    setMessage(null);
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!token || !editingScheduleId) return;
    const res = await apiPatch<FeeSchedule>(`/admin/fee-schedules/${editingScheduleId}`, { name: editName, rates: editRates }, { headers: authHeaders(token) });
    if (res.error) {
      if (isUnauthorized(res)) { clearAdminAndRedirect(); return; }
      setError(res.error);
      return;
    }
    setMessage("Fee schedule updated.");
    setEditingScheduleId(null);
    loadFeeSchedules();
  }

  async function handleDeleteSchedule(id: string) {
    if (!token || !confirm("Delete this fee schedule? Partners using it must be reassigned first.")) return;
    setError(null);
    setMessage(null);
    const res = await apiDelete(`/admin/fee-schedules/${id}`, { headers: authHeaders(token) });
    if (res.error) {
      if (isUnauthorized(res)) { clearAdminAndRedirect(); return; }
      setError(res.error);
      return;
    }
    setMessage("Fee schedule deleted.");
    setEditingScheduleId(null);
    loadFeeSchedules();
  }

  return (
    <section className="border border-path-grey-300 rounded-lg p-4">
      <h2 className="text-path-h4 font-poppins text-path-primary mb-3">Fee Schedules</h2>
      <p className="text-path-p2 text-path-grey-600 mb-3">Define minimum fees per product. Create schedules and assign them to partners. One schedule can serve many partners.</p>
      {message && <p className="text-path-p2 text-path-primary font-medium mb-2">{message}</p>}
      {error && <p className="text-path-p2 text-path-secondary mb-2">{error}</p>}

      <div className="space-y-4">
        <form onSubmit={handleCreateSchedule} className="flex gap-2 flex-wrap items-end">
          <div className="min-w-[200px]">
            <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Create new (from defaults)</label>
            <input type="text" value={newScheduleName} onChange={(e) => setNewScheduleName(e.target.value)} placeholder="e.g. Standard Retail" required className={inputClass} />
          </div>
          <button type="submit" className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1">Create</button>
        </form>

        <div className="space-y-2">
          {feeSchedules.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-2 border border-path-grey-200 rounded">
              <span className="font-medium flex-1">{s.name}</span>
              <button type="button" onClick={() => startEdit(s)} className="px-3 py-1 border border-path-grey-300 rounded text-path-p2 hover:bg-path-grey-100">Edit</button>
              <button type="button" onClick={() => handleDeleteSchedule(s.id)} className="px-3 py-1 border border-path-secondary text-path-secondary rounded text-path-p2 hover:bg-path-grey-100">Delete</button>
            </div>
          ))}
        </div>

        {editingScheduleId && (
          <form onSubmit={handleSaveSchedule} className="p-4 border border-path-grey-300 rounded-lg space-y-4 bg-path-grey-50">
            <h3 className="font-medium">Edit fee schedule</h3>
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Name</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required className={inputClass} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(editRates).map(([code, rates]) => (
                <div key={code} className="p-3 bg-white border border-path-grey-200 rounded space-y-2">
                  <span className="font-medium text-path-p2">{productSchema[code]?.label ?? code}</span>
                  <div className="space-y-1">
                    {"min_pct" in rates && (
                      <div className="flex items-center gap-2">
                        <label className="text-path-p2 w-24">Min %</label>
                        <input type="number" step="0.1" value={rates.min_pct ?? ""} onChange={(e) => setEditRates((prev) => ({ ...prev, [code]: { ...prev[code], min_pct: parseFloat(e.target.value) || 0 } }))} className="w-20 border border-path-grey-300 rounded px-2 py-1 text-path-p1" />
                      </div>
                    )}
                    {"min_amount" in rates && (
                      <div className="flex items-center gap-2">
                        <label className="text-path-p2 w-24">Min £</label>
                        <input type="number" step="0.01" value={rates.min_amount ?? ""} onChange={(e) => setEditRates((prev) => ({ ...prev, [code]: { ...prev[code], min_amount: parseFloat(e.target.value) || 0 } }))} className="w-20 border border-path-grey-300 rounded px-2 py-1 text-path-p1" />
                      </div>
                    )}
                    {"min_per_month" in rates && (
                      <div className="flex items-center gap-2">
                        <label className="text-path-p2 w-24">Per month £</label>
                        <input type="number" step="1" value={rates.min_per_month ?? ""} onChange={(e) => setEditRates((prev) => ({ ...prev, [code]: { ...prev[code], min_per_month: parseFloat(e.target.value) || 0 } }))} className="w-20 border border-path-grey-300 rounded px-2 py-1 text-path-p1" />
                      </div>
                    )}
                    {"min_per_device" in rates && (
                      <div className="flex items-center gap-2">
                        <label className="text-path-p2 w-24">Per device £</label>
                        <input type="number" step="1" value={rates.min_per_device ?? ""} onChange={(e) => setEditRates((prev) => ({ ...prev, [code]: { ...prev[code], min_per_device: parseFloat(e.target.value) || 0 } }))} className="w-20 border border-path-grey-300 rounded px-2 py-1 text-path-p1" />
                      </div>
                    )}
                    {"min_service" in rates && (
                      <div className="flex items-center gap-2">
                        <label className="text-path-p2 w-24">Service £</label>
                        <input type="number" step="0.01" value={rates.min_service ?? ""} onChange={(e) => setEditRates((prev) => ({ ...prev, [code]: { ...prev[code], min_service: parseFloat(e.target.value) || 0 } }))} className="w-20 border border-path-grey-300 rounded px-2 py-1 text-path-p1" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1">Save</button>
              <button type="button" onClick={() => setEditingScheduleId(null)} className="px-4 py-2 border border-path-grey-300 rounded-lg text-path-p2 hover:bg-path-grey-100">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function AdminProductPackagesSection({
  token,
  partners,
  authHeaders,
  clearAdminAndRedirect,
}: {
  token: string | null;
  partners: Partner[];
  authHeaders: (t: string) => { Authorization: string };
  clearAdminAndRedirect: () => void;
}) {
  const [pkgPartnerId, setPkgPartnerId] = useState("");
  const [packages, setPackages] = useState<ProductPackage[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [feeScheduleRates, setFeeScheduleRates] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardItems, setWizardItems] = useState<WizardItem[]>([]);
  const [wizardName, setWizardName] = useState("");
  const [wizardDesc, setWizardDesc] = useState("");
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const res = await apiGet<CatalogProduct[]>("/admin/product-catalog", { headers: authHeaders(token) });
      if (cancelled) return;
      if (res.error && (res as { statusCode?: number }).statusCode === 401) {
        clearAdminAndRedirect();
        return;
      }
      if (res.data) setCatalog(res.data);
    })();
    return () => { cancelled = true; };
  }, [token, authHeaders, clearAdminAndRedirect]);

  useEffect(() => {
    if (!token || !pkgPartnerId) {
      setPackages([]);
      setFeeScheduleRates({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    const partner = partners.find((p) => p.id === pkgPartnerId);
    (async () => {
      const [pkgRes, feeRes] = await Promise.all([
        apiGet<ProductPackage[]>(`/admin/partners/${pkgPartnerId}/product-packages`, { headers: authHeaders(token) }),
        partner?.fee_schedule_id
          ? apiGet<FeeSchedule>(`/admin/fee-schedules/${partner.fee_schedule_id}`, { headers: authHeaders(token) })
          : Promise.resolve({ data: null as FeeSchedule | null }),
      ]);
      if (cancelled) return;
      if (pkgRes.error && (pkgRes as { statusCode?: number }).statusCode === 401) {
        clearAdminAndRedirect();
        return;
      }
      if (pkgRes.data) setPackages(pkgRes.data);
      if (feeRes.data?.rates) setFeeScheduleRates(feeRes.data.rates);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token, pkgPartnerId, partners, authHeaders, clearAdminAndRedirect]);

  return (
    <section className="border border-path-grey-300 rounded-lg p-4">
      <h2 className="text-path-h4 font-poppins text-path-primary mb-3">Product Packages</h2>
      <p className="text-path-p2 text-path-grey-600 mb-3">Manage product packages for a partner. Select a partner to view and create packages.</p>
      {successMsg && <p className="text-path-p2 text-path-primary font-medium mb-2">{successMsg}</p>}
      <div className="space-y-4">
        <div>
          <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Partner</label>
          <div className="relative h-11">
            <select
              value={pkgPartnerId}
              onChange={(e) => { setPkgPartnerId(e.target.value); setShowCreateWizard(false); }}
              className={selectClass}
            >
              <option value="">Select partner</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-path-grey-500" aria-hidden>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        {!showCreateWizard ? (
          <>
            {pkgPartnerId && (
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
                  setSuccessMsg(null);
                }}
                className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1"
              >
                Create package
              </button>
            )}
            {loading ? (
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
                          setSuccessMsg(null);
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
                          if (!token || !pkgPartnerId) return;
                          const res = await apiDelete(`/admin/partners/${pkgPartnerId}/product-packages/${p.id}`, { headers: authHeaders(token) });
                          if (res.error) {
                            setSuccessMsg(null);
                            alert(res.error);
                            return;
                          }
                          setPackages((prev) => prev.filter((x) => x.id !== p.id));
                          setSuccessMsg("Package deleted.");
                        }}
                        className="px-3 py-1 text-path-p2 border border-path-secondary text-path-secondary rounded hover:bg-path-grey-100"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
                {pkgPartnerId && packages.length === 0 && !loading && (
                  <li className="text-path-p2 text-path-grey-500">No packages yet. Create one to get started.</li>
                )}
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
            onCancel={() => { setShowCreateWizard(false); setEditingPackageId(null); }}
            onSuccess={(uid) => {
              setShowCreateWizard(false);
              setEditingPackageId(null);
              setSuccessMsg(editingPackageId ? "Package updated." : `Package created. UID: ${uid}`);
              if (token && pkgPartnerId) {
                apiGet<ProductPackage[]>(`/admin/partners/${pkgPartnerId}/product-packages`, { headers: authHeaders(token) }).then((r) => {
                  if (r.data) setPackages(r.data);
                });
              }
            }}
            createPackage={async (payload) => {
              if (!token || !pkgPartnerId) return { error: "Select a partner" };
              if (editingPackageId) {
                const res = await apiPatch<{ uid: string }>(`/admin/partners/${pkgPartnerId}/product-packages/${editingPackageId}`, payload, { headers: authHeaders(token) });
                if (res.error) return { error: res.error };
                return { uid: res.data?.uid ?? "" };
              }
              const res = await apiPost<{ uid: string }>(`/admin/partners/${pkgPartnerId}/product-packages`, payload, { headers: authHeaders(token) });
              if (res.error) return { error: res.error };
              return { uid: res.data?.uid ?? "" };
            }}
          />
        )}
      </div>
    </section>
  );
}
