/**
 * Parse clock hour/minute from ride `start_time` (Postgres time / Supabase REST):
 * "14:30", "14:30:00", fractional seconds, or ISO strings like "1970-01-01T14:30:00".
 */
export function parseClockFromTimeValue(v) {
  if (v == null) return null;
  const raw = String(v).trim();
  if (!raw) return null;

  const isoT = raw.indexOf("T");
  if (isoT !== -1) {
    const afterT = raw.slice(isoT + 1);
    const m = /^(\d{1,2}):(\d{2})/.exec(afterT);
    if (m) {
      const h = Number(m[1]);
      const mi = Number(m[2]);
      if (Number.isFinite(h) && Number.isFinite(mi)) return { h, m: mi };
    }
  }

  const m2 = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (m2) {
    const h = Number(m2[1]);
    const mi = Number(m2[2]);
    if (Number.isFinite(h) && Number.isFinite(mi)) return { h, m: mi };
  }

  return null;
}

export function formatTime12h(timeStr) {
  const clock = parseClockFromTimeValue(timeStr);
  if (!clock) return "—";
  const { h, m } = clock;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Calendar label from `ride_date`; uses first 10 chars so full ISO strings still work. */
export function formatRideDateLong(rideDateStr) {
  if (!rideDateStr) return null;
  const dateOnly = String(rideDateStr).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!m) return String(rideDateStr);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  try {
    return new Date(y, mo, d).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateOnly;
  }
}

export function formatRideDateShort(rideDateStr) {
  if (!rideDateStr) return null;
  const dateOnly = String(rideDateStr).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!m) return String(rideDateStr);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  try {
    return new Date(y, mo, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateOnly;
  }
}
