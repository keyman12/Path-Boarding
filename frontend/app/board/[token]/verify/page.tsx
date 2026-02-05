"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Old verification link URL. We now use a 6-digit code entered on the board page.
 * Redirect anyone with an old email link to the board page where they can enter the code.
 */
export default function VerifyEmailRedirectPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  useEffect(() => {
    if (token && typeof window !== "undefined") {
      window.location.replace(`/board/${token}`);
    }
  }, [token]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 font-roboto bg-white">
      <p className="text-path-p1 text-path-grey-600">Taking you to the boarding page…</p>
    </main>
  );
}
