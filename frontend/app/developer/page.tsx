"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy route: Boarding API was formerly "API Tester" at /developer.
 * Redirect to the new Boarding API page.
 */
export default function DeveloperPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/boarding-api");
  }, [router]);
  return (
    <main className="min-h-screen flex items-center justify-center font-roboto bg-white">
      <p className="text-path-p2 text-path-grey-500">Redirecting to Boarding API…</p>
    </main>
  );
}
