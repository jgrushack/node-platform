import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="relative">
        <div className="absolute inset-0 blur-2xl">
          <div className="h-full w-full animate-pulse rounded-full bg-pink-500/20" />
        </div>
        <Image
          src="/node-mark.svg"
          alt="Loading..."
          width={60}
          height={60}
          className="relative z-10 animate-pulse"
        />
      </div>
    </div>
  );
}
