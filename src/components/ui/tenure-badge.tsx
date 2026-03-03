import { Award, Crown } from "lucide-react";

interface TenureBadgeProps {
  yearsCount: number;
}

export function TenureBadge({ yearsCount }: TenureBadgeProps) {
  if (yearsCount < 5) return null;

  const isOG = yearsCount >= 7;

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
        isOG
          ? "border-purple-500/40 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]"
          : "border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
      }`}
    >
      {isOG ? (
        <Crown className="h-3 w-3" />
      ) : (
        <Award className="h-3 w-3" />
      )}
      {isOG ? "OG NODE Member" : "5-Year Veteran"}
      <span
        className="pointer-events-none absolute inset-0 animate-[shimmer_3s_ease-in-out_infinite]"
        style={{
          background:
            "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)",
          backgroundSize: "200% 100%",
        }}
      />
    </span>
  );
}
