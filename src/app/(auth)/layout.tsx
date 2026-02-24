import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-8">
        <Image
          src="/node-wordmark.svg"
          alt="NODE"
          width={140}
          height={40}
          priority
        />
      </div>
      <div className="glass-card w-full max-w-md rounded-2xl p-8">
        {children}
      </div>
    </div>
  );
}
