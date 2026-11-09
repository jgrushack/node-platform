import Image from "next/image";
import { ArrowDown, ArrowUpRight, CalendarDays, MapPin, Drumstick, UsersRound, Sparkles } from "lucide-react";
import styles from "./nodesgiving.module.css";

export function NodesgivingHero({ title, date, location }: { title: string; date: string; location?: string | null }) {
  return <>
    <header className={`${styles.hero} relative isolate overflow-hidden rounded-[2rem] border border-[#e7b3ec]/25`}>
      <div aria-hidden="true" className="pointer-events-none absolute -left-12 bottom-8 h-52 w-52 rounded-full border border-[#f3b790]/15" />
      <div className="relative grid items-center gap-8 p-6 sm:p-9 sm:grid-cols-[1.2fr_1fr] lg:gap-10 lg:p-10">
        <div>
          <p className="mb-7 text-xs font-semibold uppercase tracking-[.22em] text-[#f6c5a5]">November 21 · A seat at the NODE table</p>
          <h1 aria-label={title} className={`${styles.title} text-[clamp(4rem,10vw,7.5rem)]`}><span className="block">NODES</span><span className="block">GIVING</span></h1>
          <p className="mt-6 text-xl text-[#ffdec1] sm:text-2xl">A little playa. A lot of gravy.</p>
          <div className="mt-6 space-y-3 text-sm text-[#fff1e4]">
            <p className="flex items-start gap-3"><CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#f5c5ff]" /><span><time dateTime={`${date}T18:00:00-05:00`}>{new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · 6 PM</time></span></p>
            <p className="flex items-start gap-3"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#f5c5ff]" /><span>{location || "See the flyer for the address."}</span></p>
          </div>
          <a href="#rsvp-heading" className="mt-7 inline-flex items-center gap-3 rounded-full bg-[#f8c7a5] px-6 py-3 text-sm font-bold text-[#321b35] transition-colors hover:bg-[#ffe3cb] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f5c5ff]">RSVP &amp; find your dish <ArrowDown aria-hidden="true" className="h-4 w-4" /></a>
        </div>
        <a href="/dashboard/nodesgiving/flyer" target="_blank" rel="noreferrer" className={`${styles.poster} relative mx-auto block w-full max-w-[290px] overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f5c5ff] sm:max-w-[320px] lg:max-w-[360px]`} aria-label="Open the full Nodesgiving flyer in a new tab">
          <Image src="/dashboard/nodesgiving/flyer" alt="Nodesgiving flyer: giant Thanksgiving dishes become a whimsical city on the playa at sunset. Saturday November 21, 6 PM." width={1067} height={1600} unoptimized preload className="h-auto w-full" />
          <span aria-hidden="true" className="absolute right-3 top-3 rounded-full bg-[#26132e]/85 p-2 text-white"><ArrowUpRight className="h-4 w-4" /></span>
        </a>
      </div>
    </header>
    <div className="grid gap-3 md:grid-cols-3">
      {[
        { icon: Drumstick, title: "The mains are on us", text: "NODE is covering turkey, gravy, and a vegetarian main. You bring your favorite side of the feast." },
        { icon: UsersRound, title: "Partners & potential NODEs", text: "Plus-ones are for partners or people interested in joining NODE. This isn’t an open invitation—please keep it to one guest and include them in your RSVP." },
        { icon: Sparkles, title: "All hands, all hearts", text: "In keeping with the 10 Principles, all guests are expected to pitch in with setup and cleanup. Just because we’re off the playa doesn’t mean we leave a trace." },
      ].map(({ icon: Icon, title: heading, text }) => <div key={heading} className="rounded-2xl border border-[#e7b3ec]/15 bg-[#b77c9c]/[.07] p-5">
        <Icon aria-hidden="true" className="mb-3 h-5 w-5 text-[#f6c5a5]" /><h2 className="font-sans text-sm font-semibold text-[#f4d4ed]">{heading}</h2><p className="mt-2 text-sm leading-relaxed text-[#d6bfd1]">{text}</p>
      </div>)}
    </div>
  </>;
}
