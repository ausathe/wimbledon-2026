/* ============================================================================
   Local-time formatting of the schedule (URS-24: "scheduled date/time in the
   viewer's local time zone"). Ported from the reference's kickoffInstant/
   kickoff, renamed for tennis ("kickoff" -> "scheduled start").
============================================================================ */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse "2026-07-01" + "13:00 UTC+1" (venue-local time with an explicit offset)
 * into a real UTC instant. Returns null if either piece is unparseable, so a
 * malformed placeholder date degrades gracefully rather than throwing (URS-32). */
export function scheduledInstant(dateStr?: string, timeStr?: string): Date | null {
  const dm = (dateStr ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return null;
  const tm = (timeStr ?? "").match(/^(\d{1,2}):(\d{2})(?:\s*UTC([+-])(\d{1,2})(?::(\d{2}))?)?/);
  if (!tm) return null;
  const sign = tm[3] === "-" ? -1 : 1;
  const offMin = tm[3] ? sign * (Number(tm[4]) * 60 + Number(tm[5] || 0)) : 0;
  const asUTC = Date.UTC(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    Number(tm[1]),
    Number(tm[2]),
  );
  const d = new Date(asUTC - offMin * 60000);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Human string for the scheduled start in the VIEWER's own local time zone,
 * e.g. "1 Jul · 2:00 PM GMT+1". Falls back to the raw date string if time
 * parsing fails, so the UI never blanks (URS-32). */
export function formatScheduled(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return "Not yet scheduled";
  const d = scheduledInstant(dateStr, timeStr);
  if (d) {
    const day = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const t = timeStr
      ? d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        })
      : "";
    return t ? `${day} · ${t}` : day;
  }
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const day = m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : dateStr;
  return timeStr ? `${day} · ${timeStr}` : day;
}
