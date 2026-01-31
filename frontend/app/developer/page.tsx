"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const DEFAULT_API_BASE = "http://localhost:8000";

export default function DeveloperPage() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE);
  const [token, setToken] = useState("");
  const [registerReq, setRegisterReq] = useState({ name: "Order Champ", email: "partner@example.com", password: "secret123" });
  const [registerRes, setRegisterRes] = useState<string | null>(null);
  const [loginReq, setLoginReq] = useState({ email: "partner@example.com", password: "secret123" });
  const [loginRes, setLoginRes] = useState<string | null>(null);
  const [inviteReq, setInviteReq] = useState({ merchant_name: "Acme Ltd", email: "merchant@example.com" });
  const [inviteRes, setInviteRes] = useState<string | null>(null);

  const base = apiBaseUrl.replace(/\/$/, "");

  async function handleRegister() {
    setRegisterRes(null);
    try {
      const res = await fetch(`${base}/auth/partner/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerReq),
      });
      const json = await res.json().catch(() => ({}));
      setRegisterRes(JSON.stringify({ status: res.status, body: json }, null, 2));
    } catch (e) {
      setRegisterRes(JSON.stringify({ error: String(e) }, null, 2));
    }
  }

  async function handleLogin() {
    setLoginRes(null);
    try {
      const res = await fetch(`${base}/auth/partner/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginReq),
      });
      const json = await res.json().catch(() => ({}));
      setLoginRes(JSON.stringify({ status: res.status, body: json }, null, 2));
      if (res.ok && json.access_token) setToken(json.access_token);
    } catch (e) {
      setLoginRes(JSON.stringify({ error: String(e) }, null, 2));
    }
  }

  async function handleInvite() {
    setInviteRes(null);
    if (!token) {
      setInviteRes(JSON.stringify({ error: "Login first to get an access token." }, null, 2));
      return;
    }
    try {
      const res = await fetch(`${base}/partners/boarding/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(inviteReq),
      });
      const json = await res.json().catch(() => ({}));
      setInviteRes(JSON.stringify({ status: res.status, body: json }, null, 2));
    } catch (e) {
      setInviteRes(JSON.stringify({ error: String(e) }, null, 2));
    }
  }

  return (
    <main className="min-h-screen flex flex-col p-6 md:p-8 font-roboto bg-white text-path-grey-900">
      <header className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-4">
          <Image src="/logo-path.png" alt="Path" width={140} height={40} />
          <span className="text-path-p2 text-path-grey-500 hidden sm:inline">Boarding API</span>
        </div>
        <nav className="flex items-center gap-4 text-path-p2">
          <a
            href={`${base}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-path-primary hover:underline"
          >
            Swagger
          </a>
          <a
            href={`${base}/redoc`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-path-primary hover:underline"
          >
            ReDoc
          </a>
          <Link href="/" className="text-path-grey-500 hover:underline">
            Boarding
          </Link>
        </nav>
      </header>

      <div className="max-w-3xl">
        <h1 className="text-path-h2 font-poppins text-path-primary mb-2">
          Boarding API Tester
        </h1>
        <p className="text-path-p1 text-path-grey-700 mb-6">
          Register as a partner, login, and generate a merchant boarding link. All the APIs you need in one place.
        </p>

        <div className="mb-6">
          <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">
            API base URL
          </label>
          <input
            type="text"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            className="w-full max-w-md border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1"
            placeholder="http://localhost:8000"
          />
        </div>

        {/* Register */}
        <section className="border border-path-grey-300 rounded-lg p-4 mb-6">
          <h2 className="text-path-h4 font-poppins text-path-primary mb-3">1. Register partner</h2>
          <p className="text-path-p2 text-path-grey-600 mb-3">
            POST /auth/partner/register — Create your partner account (one-time).
          </p>
          <div className="grid gap-2 mb-3 max-w-md">
            <input
              type="text"
              value={registerReq.name}
              onChange={(e) => setRegisterReq((r) => ({ ...r, name: e.target.value }))}
              placeholder="Name"
              className="border border-path-grey-300 rounded px-3 py-2 text-path-p1"
            />
            <input
              type="email"
              value={registerReq.email}
              onChange={(e) => setRegisterReq((r) => ({ ...r, email: e.target.value }))}
              placeholder="Email"
              className="border border-path-grey-300 rounded px-3 py-2 text-path-p1"
            />
            <input
              type="password"
              value={registerReq.password}
              onChange={(e) => setRegisterReq((r) => ({ ...r, password: e.target.value }))}
              placeholder="Password"
              className="border border-path-grey-300 rounded px-3 py-2 text-path-p1"
            />
          </div>
          <button
            type="button"
            onClick={handleRegister}
            className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors"
          >
            Send request
          </button>
          {registerRes && (
            <pre className="mt-3 p-3 bg-path-grey-100 rounded text-path-p2 overflow-auto max-h-40">
              {registerRes}
            </pre>
          )}
        </section>

        {/* Login */}
        <section className="border border-path-grey-300 rounded-lg p-4 mb-6">
          <h2 className="text-path-h4 font-poppins text-path-primary mb-3">2. Login</h2>
          <p className="text-path-p2 text-path-grey-600 mb-3">
            POST /auth/partner/login — Get an access token for the invite API.
          </p>
          <div className="grid gap-2 mb-3 max-w-md">
            <input
              type="email"
              value={loginReq.email}
              onChange={(e) => setLoginReq((r) => ({ ...r, email: e.target.value }))}
              placeholder="Email"
              className="border border-path-grey-300 rounded px-3 py-2 text-path-p1"
            />
            <input
              type="password"
              value={loginReq.password}
              onChange={(e) => setLoginReq((r) => ({ ...r, password: e.target.value }))}
              placeholder="Password"
              className="border border-path-grey-300 rounded px-3 py-2 text-path-p1"
            />
          </div>
          <button
            type="button"
            onClick={handleLogin}
            className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors"
          >
            Send request
          </button>
          {token && (
            <p className="mt-2 text-path-p2 text-path-grey-600">
              Token saved. Use &quot;Create invite&quot; below.
            </p>
          )}
          {loginRes && (
            <pre className="mt-3 p-3 bg-path-grey-100 rounded text-path-p2 overflow-auto max-h-40">
              {loginRes}
            </pre>
          )}
        </section>

        {/* Create invite */}
        <section className="border border-path-grey-300 rounded-lg p-4 mb-6">
          <h2 className="text-path-h4 font-poppins text-path-primary mb-3">3. Generate boarding link</h2>
          <p className="text-path-p2 text-path-grey-600 mb-3">
            POST /partners/boarding/invite — Create a merchant boarding link (requires Bearer token).
          </p>
          <div className="grid gap-2 mb-3 max-w-2xl">
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Access token (required)</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your token here, or click Send request in Login above to fill automatically"
                className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1 font-mono text-path-p2"
              />
              <p className="text-path-p2 text-path-grey-500 mt-1">Use the token from step 2 (Login). Do not put it in Merchant name.</p>
            </div>
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Merchant name (optional)</label>
              <input
                type="text"
                value={inviteReq.merchant_name}
                onChange={(e) => setInviteReq((r) => ({ ...r, merchant_name: e.target.value }))}
                placeholder="e.g. Acme Ltd"
                className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1"
              />
            </div>
            <div>
              <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Merchant email (optional)</label>
              <input
                type="email"
                value={inviteReq.email}
                onChange={(e) => setInviteReq((r) => ({ ...r, email: e.target.value }))}
                placeholder="merchant@example.com"
                className="w-full border border-path-grey-300 rounded px-3 py-2 text-path-p1"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleInvite}
            className="px-4 py-2 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors"
          >
            Send request
          </button>
          {inviteRes && (
            <pre className="mt-3 p-3 bg-path-grey-100 rounded text-path-p2 overflow-auto max-h-48">
              {inviteRes}
            </pre>
          )}
        </section>

        <p className="text-path-p2 text-path-grey-500">
          <a href={`${base}/docs`} target="_blank" rel="noopener noreferrer" className="text-path-primary hover:underline">
            Interactive API docs (Swagger)
          </a>
          {" · "}
          <a href={`${base}/redoc`} target="_blank" rel="noopener noreferrer" className="text-path-primary hover:underline">
            ReDoc
          </a>
        </p>
      </div>

      <footer className="mt-12 pt-6 border-t border-path-grey-200 text-path-p2 text-path-grey-500">
        © {new Date().getFullYear()} Path. All rights reserved. | path2ai.tech
      </footer>
    </main>
  );
}
