"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Flame,
  Plane,
  Tent,
  Briefcase,
  Users,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import type { HypeData } from "@/lib/actions/hype";

export interface HypeShift {
  title: string;
  label?: string | null;
  shiftDate: string;
  startTime: string;
}

// ── Rotating "dust drop" content — one per visit, cycles by day ─────
const DUST_DROPS: { kind: string; title: string; body: string }[] = [
  { kind: "Pack tip", title: "Two pairs of goggles.", body: "One clear, one tinted. The whiteout has ended marriages and twenty-burn egos alike. Your single pair of gas station sunglasses is not a plan, it's a sacrifice." },
  { kind: "Pack tip", title: "Cup on a carabiner, or stay thirsty forever.", body: "No cup, no booze — that's city law. Walk up to a bar cupless and watch a bartender look through you like you're a mirage with bad planning skills." },
  { kind: "Camp lore", title: "Martini Therapy. Monday, 1pm.", body: "We prescribe gin to strangers until the city loves us. It's called Therapy because 'Recreational Alcoholism' didn't clear legal. Co-pay is a compliment." },
  { kind: "Pack tip", title: "Electrolytes or headache — pick one by 3pm.", body: "Chugging plain water out here just means you'll be the best-hydrated person crying in a shade structure. Eat. Salt. Now." },
  { kind: "Camp lore", title: "Wednesday is Hip Hop BBQ.", body: "Eight hours, three bar shifts, a grill running hotter than your ex's takes. The entire city shows up like they were invited. They weren't. They are now. Act like you knew." },
  { kind: "Pack tip", title: "Light your bike like a bad decision.", body: "Darkwads don't get right of way, they get discovered. At speed. Be a rolling Vegas sign or be a story someone tells at brunch." },
  { kind: "Camp lore", title: "You don't need an alarm. You have Gunny.", body: "Every morning: CHOW TIME, screamed at a volume OSHA would flag, whether you went to bed at 10pm or 10 minutes ago. Brunch lands by 10. Resistance is futile and also you're hungry." },
  { kind: "Pack tip", title: "Wet wipes are the playa's reserve currency.", body: "A shower out here is a bedtime story for tourists. Three wipes gifted to the right stranger and you're in somebody's wedding party." },
  { kind: "Camp lore", title: "Strike is everyone's job.", body: "The desert was empty when we got here and it'll be emptier when we leave. Skip your strike shift and enjoy your new playa name: 'That Guy.' It's non-refundable." },
  { kind: "Pack tip", title: "Headlamp with a red mode.", body: "White-beam your tentmate at 4am exactly once and find out how fast a friendship converts to a custody battle over the good sleeping pad." },
  { kind: "Camp lore", title: "The Temple burns Sunday night.", body: "Dinner's early so nobody's mid-burger during the most emotional fire in Nevada. Go together. Cry in front of strangers. That's not a warning, it's the itinerary." },
  { kind: "Pack tip", title: "Earplugs. Then backup earplugs.", body: "The camp next door did not haul forty speakers across state lines to honor your sleep schedule. They will win. Foam in, world off, see you at CHOW TIME." },
];

function dayIndex(seedDate: string): number {
  const [y, m, d] = seedDate.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function formatDay(d: string, opts?: Intl.DateTimeFormatOptions): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...opts,
  });
}
function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${suffix}` : `${hh}${suffix}`;
}
function joinNames(names: string[], max = 4): string {
  if (names.length <= max) {
    if (names.length <= 1) return names[0] ?? "";
    return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  }
  return `${names.slice(0, max).join(", ")} +${names.length - max} more`;
}

/** Live-ticking countdown to a playa-local midnight. */
function useCountdown(targetDate: string | null) {
  const target = useMemo(() => {
    if (!targetDate) return null;
    // Gate opens Sunday morning; count to 00:00 playa (PDT = UTC-7) that day.
    const [y, m, d] = targetDate.split("-").map(Number);
    return Date.UTC(y, m - 1, d, 7, 0, 0);
  }, [targetDate]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!target) return null;
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);
  return { diff, days, hours, mins, secs };
}

export function HypeCard({
  data,
  nextShift,
  onOpenJobs,
  onOpenArrival,
}: {
  data: HypeData;
  nextShift?: HypeShift | null;
  onOpenJobs: () => void;
  onOpenArrival: () => void;
}) {
  const cd = useCountdown(data.startDate);
  const drop = DUST_DROPS[dayIndex(data.todayPlaya) % DUST_DROPS.length];
  const shift = nextShift ?? data.me.firstShift;
  const pct =
    data.pulse.slotsTotal > 0
      ? Math.round((data.pulse.slotsFilled / data.pulse.slotsTotal) * 100)
      : 0;
  const readyPct =
    data.pulse.confirmed > 0
      ? Math.round((data.pulse.ready / data.pulse.confirmed) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="space-y-4"
    >
      {/* Countdown hero */}
      <Card className="glass-card relative overflow-hidden border-0">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 90% at 0% 0%, rgba(249,0,119,0.22) 0%, transparent 55%), radial-gradient(90% 90% at 100% 100%, rgba(255,184,0,0.18) 0%, transparent 55%)",
          }}
        />
        <CardContent className="relative p-5 sm:p-7">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-pink-300">
            <Flame className="h-3.5 w-3.5" />
            {data.phase === "before"
              ? "You're locked in"
              : data.phase === "during"
                ? "We're here"
                : "Until next year"}
          </div>
          {data.phase === "before" && cd ? (
            <div className="mt-4">
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                <TimeCell value={cd.days} label={cd.days === 1 ? "day" : "days"} />
                <TimeCell value={cd.hours} label="hours" pad />
                <TimeCell value={cd.mins} label="minutes" pad />
                <TimeCell value={cd.secs} label="seconds" pad />
              </div>
              <p className="mt-4 text-center text-sm text-sand-300">
                until gate opens
                {data.startDate && (
                  <>
                    {" "}
                    · <span className="font-medium text-sand-100">{formatDay(data.startDate)}</span>
                  </>
                )}
              </p>
            </div>
          ) : data.phase === "during" ? (
            <div className="mt-3">
              <p className="font-heading text-3xl font-bold text-sand-100 sm:text-4xl">
                Welcome home.
              </p>
              <p className="mt-1 text-sm text-sand-400">
                Today is {formatDay(data.todayPlaya, { weekday: "long" })} on playa.
              </p>
            </div>
          ) : (
            <p className="mt-3 font-heading text-3xl font-bold text-sand-100">
              Thanks for a great burn.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Your week + camp pulse */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="glass-card border-0">
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-sand-200">Your week</h3>
            <ul className="space-y-3">
              {data.me.renoArrivalDate && (
                <Row
                  icon={Plane}
                  label="Reno"
                  value={formatDay(data.me.renoArrivalDate)}
                  sub={
                    data.renoBuddies.length
                      ? `with ${joinNames(data.renoBuddies)}`
                      : undefined
                  }
                  onClick={onOpenArrival}
                  action="dates"
                />
              )}
              <Row
                icon={Tent}
                label="Playa"
                value={
                  data.me.arrivalDate
                    ? `${formatDay(data.me.arrivalDate)}${data.me.departureDate ? ` – ${formatDay(data.me.departureDate)}` : ""}`
                    : "Set your dates"
                }
                sub={
                  data.arrivalBuddies.length
                    ? `arriving with ${joinNames(data.arrivalBuddies)}`
                    : undefined
                }
                onClick={onOpenArrival}
                action="dates"
              />
              <Row
                icon={Briefcase}
                label={data.phase === "during" ? "Next shift" : "First shift"}
                value={
                  shift
                    ? `${shift.title}${"label" in shift && shift.label ? ` — ${shift.label}` : ""}`
                    : "Grab a shift"
                }
                sub={
                  shift
                    ? `${formatDay(shift.shiftDate)} · ${formatTime(shift.startTime)}`
                    : undefined
                }
                onClick={onOpenJobs}
                action="board"
              />
            </ul>
          </CardContent>
        </Card>

        <Card className="glass-card border-0">
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sand-200">
              <Users className="h-4 w-4 text-pink-400" />
              Camp pulse
            </h3>
            <Meter
              label="Campers fully ready"
              value={`${data.pulse.ready} / ${data.pulse.confirmed}`}
              pct={readyPct}
            />
            <Meter
              label="Shift board filled"
              value={`${pct}%`}
              pct={pct}
              className="mt-4"
            />
            <button
              type="button"
              onClick={onOpenJobs}
              className="mt-4 flex w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-left text-xs text-sand-300 transition-colors hover:bg-white/10"
            >
              <span>
                {data.pulse.slotsTotal - data.pulse.slotsFilled > 0
                  ? `${data.pulse.slotsTotal - data.pulse.slotsFilled} open slots — help fill the board`
                  : "Board's full — legends"}
              </span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Dust drop */}
      <Card className="glass-card border-0">
        <CardContent className="flex items-start gap-3 p-5">
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber/15 ring-1 ring-amber/30">
            <Sparkles className="h-4 w-4 text-amber" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-amber/80">
              {drop.kind} · today&apos;s dust drop
            </p>
            <p className="mt-1 text-sm font-semibold text-sand-100">{drop.title}</p>
            <p className="mt-0.5 text-sm text-sand-400">{drop.body}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TimeCell({ value, label, pad }: { value: number; label: string; pad?: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-white/5 px-1 py-3 ring-1 ring-white/10 sm:py-4">
      <span className="font-sans text-4xl font-extrabold leading-none tabular-nums tracking-tight text-sand-50 sm:text-5xl md:text-6xl">
        {pad ? String(value).padStart(2, "0") : value}
      </span>
      <span className="mt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-sand-400 sm:text-xs">
        {label}
      </span>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  sub,
  onClick,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
  /** Short verb shown at the right edge, e.g. "edit" or "board". */
  action?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group -mx-2 flex w-full items-start gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-white/5"
      >
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-pink-400" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] uppercase tracking-wider text-sand-500">{label}</span>
          <span className="block truncate text-sm font-medium text-sand-100">{value}</span>
          {sub && <span className="block truncate text-xs text-sand-400">{sub}</span>}
        </span>
        {onClick && (
          <span className="mt-1 flex flex-shrink-0 items-center gap-0.5 text-[11px] text-sand-500 group-hover:text-pink-300">
            {action ?? "edit"}
            <ChevronRight className="h-3 w-3" />
          </span>
        )}
      </button>
    </li>
  );
}

function Meter({
  label,
  value,
  pct,
  className,
}: {
  label: string;
  value: string;
  pct: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-sand-400">{label}</span>
        <span className="font-medium text-sand-200">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-sand-700/20">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-pink-500 to-amber"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
