/**
 * Member badge system for the members directory.
 *
 * Badge types:
 * - NodeYearsBadge: NODE registration count. ≥5 = gold shimmer with medal. <5 = orange.
 * - BurnsBadge: Total Burning Man attendance count.
 * - BuildBadge: Aggregated build count.
 * - SecretSantaBadge / NodesgivingBadge: placeholders, data TBA.
 */
import { Crown, Medal, Flame, Hammer, Gift, Utensils } from "lucide-react";

/** Tiny inline NODE mark for use inside badges */
function NodeMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 4234 2126"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1337.41 102.319C1427.21 158.828 1451.12 267.169 1397.68 367.225L495.898 1951.92C439.389 2041.72 320.786 2068.7 230.992 2012.19C141.197 1955.68 114.215 1837.08 170.724 1747.28L1072.51 162.587C1129.02 72.7922 1247.62 45.8094 1337.41 102.319Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1781.56 912.65C1871.01 969.702 1897.27 1088.47 1840.22 1177.92L1393.26 1955.92C1336.21 2045.37 1217.45 2071.63 1128 2014.58C1038.55 1957.53 1012.28 1838.76 1069.34 1749.31L1516.29 971.312C1573.35 881.862 1692.11 855.598 1781.56 912.65Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2234.76 1701.65C2318.8 1766.42 2334.42 1887.05 2269.65 1971.08L2267.56 1973.79C2202.8 2057.83 2082.17 2073.45 1998.14 2008.68C1914.1 1943.92 1898.48 1823.29 1963.25 1739.26L1965.34 1736.54C2030.1 1652.51 2150.73 1636.89 2234.76 1701.65Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2895.98 2023.63C2806.18 1967.12 2782.27 1858.78 2835.71 1758.72L3737.49 174.023C3794 84.2285 3912.6 57.2458 4002.4 113.755C4092.19 170.264 4119.18 288.867 4062.67 378.661L3160.88 1963.36C3104.37 2053.15 2985.77 2080.14 2895.98 2023.63Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2451.82 1213.3C2362.37 1156.25 2336.11 1037.48 2393.16 948.033L2840.12 170.031C2897.17 80.581 3015.93 54.3172 3105.38 111.369C3194.84 168.422 3221.1 287.186 3164.05 376.636L2717.09 1154.64C2660.04 1244.09 2541.27 1270.35 2451.82 1213.3Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1998.58 424.295C1914.55 359.53 1898.92 238.904 1963.69 154.87L1965.78 152.157C2030.55 68.1225 2151.17 52.5019 2235.21 117.267C2319.24 182.033 2334.86 302.659 2270.1 386.693L2268.01 389.406C2203.24 473.44 2082.61 489.061 1998.58 424.295Z"
        fill="currentColor"
      />
    </svg>
  );
}

const shimmerOverlay = (
  <span
    className="pointer-events-none absolute inset-0 animate-[shimmer_3s_ease-in-out_infinite]"
    style={{
      background:
        "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)",
      backgroundSize: "200% 100%",
    }}
  />
);

// ── NODE Years Badge ──────────────────────────────────────────────
// ≥5 years: 🏅{count} [node logo] in shimmering gold
// <5 years: {count} [node logo] in orange
// 0 years: hidden

interface NodeYearsBadgeProps {
  count: number;
}

export function NodeYearsBadge({ count }: NodeYearsBadgeProps) {
  if (count <= 0) return null;

  const isOG = count >= 7;
  const isVeteran = count >= 5;

  // OG NODE member (7+ years): 👑 NR1 + 🏅{count} [node logo] in shimmering gold
  if (isOG) {
    return (
      <>
        <span className="relative inline-flex items-center gap-1 overflow-hidden rounded-full border border-purple-500/40 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)] px-2.5 py-1 text-xs font-bold">
          <Crown className="h-3.5 w-3.5" />
          NR1
          {shimmerOverlay}
        </span>
        <span className="relative inline-flex items-center gap-0.5 overflow-hidden rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)] px-2.5 py-1 text-xs font-bold">
          <Medal className="mr-0.5 h-3.5 w-3.5" />
          {count}
          <NodeMark className="h-3.5 w-4" />
          {shimmerOverlay}
        </span>
      </>
    );
  }

  // Veteran (5-6 years): 🏅{count} [node logo] in shimmering gold
  if (isVeteran) {
    return (
      <span className="relative inline-flex items-center gap-0.5 overflow-hidden rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)] px-2.5 py-1 text-xs font-bold">
        <Medal className="mr-0.5 h-3.5 w-3.5" />
        {count}
        <NodeMark className="h-3.5 w-4" />
        {shimmerOverlay}
      </span>
    );
  }

  // Under 5 years: {count} [node logo] in orange
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber/15 border border-amber/20 px-2.5 py-1 text-xs font-bold text-amber">
      {count}
      <NodeMark className="h-3.5 w-4" />
    </span>
  );
}

// ── Burns Badge ───────────────────────────────────────────────────
// 🔥{count} — total Burning Man attendance

interface BurnsBadgeProps {
  count: number;
}

export function BurnsBadge({ count }: BurnsBadgeProps) {
  if (count <= 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 border border-orange-500/20 px-2.5 py-1 text-xs font-bold text-orange-400">
      <Flame className="h-3.5 w-3.5" />
      {count}
    </span>
  );
}

// ── Build Badge ───────────────────────────────────────────────────
// 🔨{count} — aggregated build count

interface BuildBadgeProps {
  count: number;
}

export function BuildBadge({ count }: BuildBadgeProps) {
  if (count <= 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-pink-500/15 border border-pink-500/20 px-2.5 py-1 text-xs font-bold text-pink-400">
      <Hammer className="h-3.5 w-3.5" />
      {count}
    </span>
  );
}

// ── Secret Santa Badge (placeholder — data TBA) ──────────────────

export function SecretSantaBadge({ participated }: { participated: boolean }) {
  if (!participated) return null;

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/15 border border-red-500/20 px-2.5 py-1 text-xs font-bold text-red-400">
      <Gift className="h-3.5 w-3.5" />
      Santa
    </span>
  );
}

// ── Nodesgiving Badge (placeholder — data TBA) ───────────────────

export function NodesgivingBadge({ participated }: { participated: boolean }) {
  if (!participated) return null;

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber/15 border border-amber/20 px-2.5 py-1 text-xs font-bold text-amber">
      <Utensils className="h-3.5 w-3.5" />
      Nodesgiving
    </span>
  );
}

// ── Legacy export for backward compat (used in member detail dialog) ─
// Re-exports NodeYearsBadge under the old name so existing imports work.

export function TenureBadge({ yearsCount }: { yearsCount: number }) {
  return <NodeYearsBadge count={yearsCount} />;
}
