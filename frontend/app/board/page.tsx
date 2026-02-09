"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

export default function BoardingLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiPost<{ 
        access_token: string; 
        current_step?: string; 
        boarding_event_id: string;
        invite_token?: string;
      }>(
        "/boarding/login",
        { email, password }
      );

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      if (res.data) {
        // Store token in localStorage
        localStorage.setItem("boarding_token", res.data.access_token);
        localStorage.setItem("boarding_event_id", res.data.boarding_event_id);
        
        // Navigate back to their boarding page with the stored invite token
        if (res.data.invite_token) {
          router.push(`/board/${res.data.invite_token}`);
        } else {
          setError("Unable to resume boarding. Please contact support.");
        }
      }
    } catch (err) {
      console.error("Login error:", err);
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-roboto bg-white p-6 md:p-8">
      <header className="mb-8">
        <Image
          src="/logo-path.png"
          alt="Path"
          width={140}
          height={40}
          priority
        />
      </header>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
            <h1 className="text-path-h2 font-poppins text-path-primary mb-2">
              Continue your boarding
            </h1>
            <p className="text-path-p1 text-path-grey-700 mb-6">
              Sign in to resume where you left off.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
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
                <label htmlFor="password" className="block text-path-p2 font-medium text-path-grey-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="p-3 bg-path-secondary/10 border border-path-secondary rounded-lg">
                  <p className="text-path-p2 text-path-secondary">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-path-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Continue"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-path-grey-200">
              <p className="text-path-p2 text-path-grey-600 text-center">
                Don't have an account yet?
              </p>
              <p className="text-path-p2 text-path-grey-600 text-center mt-2">
                Ask your partner for an invite link to get started.
              </p>
            </div>

            <div className="mt-6 text-center">
              <Link href="/" className="text-path-p2 text-path-primary hover:underline">
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>

      <footer className="mt-8 text-path-p2 text-path-grey-500 text-center">
        © 2026 Path2ai.tech
      </footer>
    </div>
  );
}
