// Minimal RFC 5545 helper. Floating-time semantics (no TZID) — events are
// interpreted in the viewer's local timezone, which matches our use case
// (camp events posted in PT, members assumed to interpret locally).

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
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Fold lines longer than 75 octets per RFC 5545 §3.1 (CRLF + space). */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  // First chunk: 75 chars; subsequent: 74 chars (the leading space counts).
  chunks.push(line.slice(i, i + 75));
  i += 75;
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join("\r\n");
}

function compactDate(date: string): string {
  // "2026-06-15" -> "20260615"
  return date.replace(/-/g, "");
}

function compactDateTime(date: string, time: string): string {
  // "2026-06-15", "19:00" -> "20260615T190000"
  return `${compactDate(date)}T${time.replace(":", "")}00`;
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
    lines.push(`DTSTART:${compactDateTime(event.date, event.startTime)}`);
    if (event.endTime) {
      lines.push(`DTEND:${compactDateTime(event.date, event.endTime)}`);
    } else {
      // Default 1-hour duration when end time is missing.
      const [h, m] = event.startTime.split(":").map(Number);
      const nextHour = h + 1;
      const endH = String(nextHour % 24).padStart(2, "0");
      const endM = String(m).padStart(2, "0");
      // Roll the date forward if the +1h end crosses midnight, so DTEND is
      // never before DTSTART (e.g. a 23:30 start ends 00:30 the next day).
      const endDate = nextHour >= 24 ? addOneDay(event.date) : compactDate(event.date);
      lines.push(`DTEND:${endDate}T${endH}${endM}00`);
    }
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
    lines.push(`URL:${event.url}`);
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
    "X-WR-TIMEZONE:America/Los_Angeles",
  ];
  for (const event of events) {
    lines.push(...buildEventBlock(event, organizer));
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
