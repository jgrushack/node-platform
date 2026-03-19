import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6">
      <div className="mb-8">
        <Image
          src="/node-wordmark.svg"
          alt="NODE"
          width={140}
          height={40}
          priority
        />
      </div>
      <div className="glass-card relative w-full max-w-md rounded-2xl p-6 glow-pink sm:p-8">
        <Link
          href="/"
          className="absolute right-4 top-4 rounded-full p-1.5 text-sand-400 transition-colors hover:bg-sand-400/10 hover:text-sand-200"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Link>
        {children}
      </div>
    </div>
  );
}
