"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE, apiGet, apiPatch, apiPost } from "@/lib/api";

const ADMIN_TOKEN_KEY = "path_admin_token";

type AdminUser = { id: string; username: string; created_at: string };
type Partner = { id: string; name: string; email: string; external_id?: string | null; logo_url?: string | null; is_active: boolean; created_at: string };

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

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
  const [isvLogoFile, setIsvLogoFile] = useState<File | null>(null);
  const [partnerPasswordNew, setPartnerPasswordNew] = useState("");
  const [partnerPasswordNewConfirm, setPartnerPasswordNewConfirm] = useState("");
  const [partnerNameEdit, setPartnerNameEdit] = useState("");
  const [partnerEmailEdit, setPartnerEmailEdit] = useState("");
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

  useEffect(() => {
    if (token) {
      loadAdmins();
      loadPartners();
    }
  }, [token, loadAdmins, loadPartners]);

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
    const body: { name?: string; email?: string; password?: string } = {};
    if (partnerNameEdit) body.name = partnerNameEdit;
    if (partnerEmailEdit) body.email = partnerEmailEdit;
    if (partnerPasswordNew) body.password = partnerPasswordNew;
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
    } else {
      setPartnerNameEdit("");
      setPartnerEmailEdit("");
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
            <input type="text" value={newAdminUsername} onChange={(e) => setNewAdminUsername(e.target.value)} placeholder="Username" required className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
            <input type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} placeholder="Password" required minLength={8} className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
            <input type="password" value={newAdminPasswordConfirm} onChange={(e) => setNewAdminPasswordConfirm(e.target.value)} placeholder="Confirm password" required minLength={8} className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
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
            <select value={selectedAdminId} onChange={(e) => setSelectedAdminId(e.target.value)} required className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1">
              <option value="">Select administrator</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>{a.username}</option>
              ))}
            </select>
            <input type="password" value={adminPasswordNew} onChange={(e) => setAdminPasswordNew(e.target.value)} placeholder="New password" required minLength={8} className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
            <input type="password" value={adminPasswordNewConfirm} onChange={(e) => setAdminPasswordNewConfirm(e.target.value)} placeholder="Confirm new password" required minLength={8} className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
            <button type="submit" className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1">Update password</button>
          </form>
        </section>

        {/* 3. Setup New Partnership Account */}
        <section className="border border-path-grey-300 rounded-lg p-4">
          <h2 className="text-path-h4 font-poppins text-path-primary mb-3">Setup a New Partnership Account</h2>
          <p className="text-path-p2 text-path-grey-600 mb-3">Create a new partner with name, email, password. Optional logo (max 512KB for welcome screen).</p>
          {setupPartnerMessage && <p className="text-path-p2 text-path-primary font-medium mb-2">{setupPartnerMessage}</p>}
          {setupPartnerError && <p className="text-path-p2 text-path-secondary mb-2">{setupPartnerError}</p>}
          <form onSubmit={handleSetupIsv} className="space-y-3 max-w-md">
            <input type="text" value={isvName} onChange={(e) => setIsvName(e.target.value)} placeholder="Name (e.g. Order Champ)" required className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
            <input type="email" value={isvEmail} onChange={(e) => setIsvEmail(e.target.value)} placeholder="Email" required className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
            <input type="password" value={isvPassword} onChange={(e) => setIsvPassword(e.target.value)} placeholder="Password" required minLength={8} className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
            <input type="password" value={isvPasswordConfirm} onChange={(e) => setIsvPasswordConfirm(e.target.value)} placeholder="Confirm password" required minLength={8} className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
            <input type="text" value={isvExternalId} onChange={(e) => setIsvExternalId(e.target.value)} placeholder="External ID (optional)" className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
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
            <select value={selectedPartnerId} onChange={(e) => { setSelectedPartnerId(e.target.value); const p = partners.find(x => x.id === e.target.value); if (p) { setPartnerNameEdit(p.name); setPartnerEmailEdit(p.email); } setPartnerLogoFile(null); }} className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1">
              <option value="">Select partner</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
              ))}
            </select>
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
                <input type="text" value={partnerNameEdit} onChange={(e) => setPartnerNameEdit(e.target.value)} placeholder="Name" className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
                <input type="email" value={partnerEmailEdit} onChange={(e) => setPartnerEmailEdit(e.target.value)} placeholder="Email" className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
                <input type="password" value={partnerPasswordNew} onChange={(e) => setPartnerPasswordNew(e.target.value)} placeholder="New password (leave blank to keep)" minLength={8} className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
                <input type="password" value={partnerPasswordNewConfirm} onChange={(e) => setPartnerPasswordNewConfirm(e.target.value)} placeholder="Confirm new password" minLength={8} className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1" />
              </>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={!selectedPartnerId} className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 disabled:opacity-50">Update partner</button>
              <button type="button" onClick={handleDeletePartner} disabled={!selectedPartnerId} className="px-4 py-2 border border-path-secondary text-path-secondary rounded-lg font-medium hover:bg-path-grey-100 disabled:opacity-50">Delete partner</button>
            </div>
          </form>
        </section>
      </div>

      <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500">
        © 2026 Path2ai.tech
      </footer>
    </main>
  );
}
