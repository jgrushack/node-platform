import Link from "next/link";
import { ArrowRight, UtensilsCrossed } from "lucide-react";

export function NodesgivingBanner() {
  return (
    <Link
      href="/dashboard/nodesgiving"
      className="group flex flex-col gap-5 rounded-2xl border border-pink-400/30 bg-gradient-to-br from-[#70486d]/40 via-[#a45d72]/25 to-[#e29b67]/15 p-5 transition-colors hover:border-pink-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 text-pink-300">
          <UtensilsCrossed aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-pink-300">
            Saturday, November 21 · 6 PM
          </p>
          <p className="mt-1 text-2xl font-bold text-sand-100">Nodesgiving</p>
          <p className="mt-2 text-sm leading-relaxed text-sand-200">
            A little playa. A lot of gravy. RSVP and choose a dish to share.
          </p>
        </div>
      </div>
      <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-[#f8c7a5] px-5 py-2.5 text-sm font-semibold text-[#321b35] transition-colors group-hover:bg-[#ffe3cb]">
        RSVP &amp; view menu
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </span>
    </Link>
  );
}
