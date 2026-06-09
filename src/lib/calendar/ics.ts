// Minimal RFC 5545 helper. Event times are stored as Eastern wall-clock and
// emitted as absolute UTC (DST-aware) so every recipient's calendar shows the
// correct local time. All-day events stay as floating DATE values.

const PRODID = "-//NODE//Calendar 1.0//EN";

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string | null;
  date: string; // YYYY-MM-DD
  startTime?: string | null; // HH:MM
  endTime?: string | null;   // HH:MM
  location?: string | null;
  url?: string | null;
  createdAt?: string | null; // ISO
  updatedAt?: string | null; // ISO
}

export interface IcsAttendee {
  email: string;
  name?: string | null;
}

export interface IcsOrganizer {
  email: string;
  name?: string | null;
}

/** Escape a text value per RFC 5545 §3.3.11. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    // Normalize all line breaks (CRLF, CR, LF) to an escaped \n. A bare CR left
    // unescaped can break line folding / inject lines in some parsers.
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    // Strip remaining control chars that are not valid in iCal text values.
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
}

/**
 * Sanitize a URI for emission as a URL/property value. Only http(s) is allowed,
 * and any control chars (incl. CR/LF) reject the value to prevent line injection.
 * Returns null if the URI is unsafe to emit.
 */
function sanitizeUri(value: string): string | null {
  if (!/^https?:\/\//i.test(value)) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(value)) return null;
  return value;
}

/** Fold lines longer than 75 octets per RFC 5545 §3.1 (CRLF + space). */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  // Fold on UTF-8 byte boundaries, never splitting a multi-byte code point.
  // First line holds 75 octets; continuation lines hold 74 (+ the leading space = 75).
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;
  for (const ch of Array.from(line)) {
    const chBytes = encoder.encode(ch).length;
    if (currentBytes + chBytes > limit) {
      chunks.push(current);
      current = ch;
      currentBytes = chBytes;
      limit = 74;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }
  if (current) chunks.push(current);
  return chunks.map((c, i) => (i === 0 ? c : " " + c)).join("\r\n");
}

function compactDate(date: string): string {
  // "2026-06-15" -> "20260615"
  return date.replace(/-/g, "");
}

const EVENT_TZ = "America/New_York";

/** Minutes `timeZone` is offset from UTC at the given UTC instant
 *  (e.g. -240 for America/New_York during EDT). */
function tzOffsetMinutes(timeZone: string, atUtcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(atUtcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return (asUtc - atUtcMs) / 60000;
}

/** Eastern wall-clock (YYYY-MM-DD, HH:MM[:SS]) -> compact UTC "YYYYMMDDTHHMMSSZ". */
function etToUtcCompact(date: string, time: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.slice(0, 5).split(":").map(Number);
  // Treat the wall-clock as UTC, then correct by Eastern's offset at that instant.
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi, 0);
  const offsetMin = tzOffsetMinutes(EVENT_TZ, naiveUtc);
  const real = new Date(naiveUtc - offsetMin * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${real.getUTCFullYear()}${pad(real.getUTCMonth() + 1)}${pad(real.getUTCDate())}` +
    `T${pad(real.getUTCHours())}${pad(real.getUTCMinutes())}${pad(real.getUTCSeconds())}Z`
  );
}

/** "2026-08-15" -> "2026-08-16" (keeps dashes, for etToUtcCompact). */
function addOneDayDashed(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Minutes-since-midnight for an "HH:MM[:SS]" string (for end<=start rollover). */
function timeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function utcStamp(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function addOneDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}

function buildEventBlock(
  event: IcsEvent,
  organizer?: IcsOrganizer,
  attendee?: IcsAttendee
): string[] {
  const lines: string[] = [];
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${event.uid}`);
  lines.push(`DTSTAMP:${utcStamp(event.updatedAt ?? event.createdAt)}`);
  lines.push(`SUMMARY:${escapeText(event.title)}`);

  if (event.startTime) {
    lines.push(`DTSTART:${etToUtcCompact(event.date, event.startTime)}`);
    let endDate = event.date; // dashed YYYY-MM-DD
    let endTime: string;
    if (event.endTime) {
      // If the end time is at/before the start (overnight event entered on a
      // single date), roll DTEND to the next day so it's never before DTSTART.
      if (timeToMinutes(event.endTime) <= timeToMinutes(event.startTime)) {
        endDate = addOneDayDashed(event.date);
      }
      endTime = event.endTime.slice(0, 5);
    } else {
      // Default 1-hour duration when end time is missing.
      const [h, m] = event.startTime.split(":").map(Number);
      const nextHour = h + 1;
      // Roll the date forward if the +1h end crosses midnight (e.g. a 23:30
      // start ends 00:30 the next day) so DTEND is never before DTSTART.
      if (nextHour >= 24) endDate = addOneDayDashed(event.date);
      endTime = `${String(nextHour % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    lines.push(`DTEND:${etToUtcCompact(endDate, endTime)}`);
  } else {
    // All-day event. DTEND is exclusive, so push to next day.
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${addOneDay(event.date)}`);
  }

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }
  if (event.url) {
    const safeUrl = sanitizeUri(event.url);
    if (safeUrl) lines.push(`URL:${safeUrl}`);
  }
  if (organizer) {
    const cn = organizer.name ? `;CN=${escapeText(organizer.name)}` : "";
    lines.push(`ORGANIZER${cn}:mailto:${organizer.email}`);
  }
  if (attendee) {
    const cn = attendee.name ? `;CN=${escapeText(attendee.name)}` : "";
    lines.push(
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE${cn}:mailto:${attendee.email}`
    );
  }

  lines.push("STATUS:CONFIRMED");
  lines.push("SEQUENCE:0");
  lines.push("END:VEVENT");
  return lines;
}

/** Build a single-event invite (METHOD:REQUEST) for one recipient. */
export function buildInviteIcs(
  event: IcsEvent,
  organizer: IcsOrganizer,
  attendee: IcsAttendee
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    ...buildEventBlock(event, organizer, attendee),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Build a published feed (METHOD:PUBLISH) suitable for webcal subscription. */
export function buildFeedIcs(
  events: IcsEvent[],
  calendarName: string,
  organizer?: IcsOrganizer
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-WR-TIMEZONE:America/New_York",
  ];
  for (const event of events) {
    lines.push(...buildEventBlock(event, organizer));
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
