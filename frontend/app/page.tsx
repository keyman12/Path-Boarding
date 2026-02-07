import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 font-roboto">
      <Image
        src="/logo-path.png"
        alt="Path – Commerce for platforms"
        width={180}
        height={48}
        className="mb-8"
        priority
      />
      <h1 className="text-path-h2 font-poppins text-path-primary mb-2">
        Merchant Boarding
      </h1>
      <p className="text-path-p1 text-path-grey-700 mb-6 max-w-md text-center">
        Complete your onboarding to accept payments.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/board"
          className="px-6 py-3 bg-path-primary text-white rounded-lg font-medium hover:bg-path-primary-light-1 transition-colors"
        >
          Merchant Boarding
        </Link>
        <Link
          href="/boarding-api"
          className="px-6 py-3 border border-path-primary text-path-primary rounded-lg font-medium hover:bg-path-grey-100 transition-colors"
        >
          Partner Boarding
        </Link>
        <Link
          href="/admin"
          className="px-6 py-3 border border-path-grey-400 text-path-grey-600 rounded-lg font-medium hover:bg-path-grey-100 transition-colors text-path-p2"
        >
          Path Admin
        </Link>
      </div>
    </main>
  );
}
