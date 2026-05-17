const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function normalizeTime24(timeStr) {
  if (!timeStr) return null;
  const raw = String(timeStr).trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTime12h(timeStr) {
  const normalized = normalizeTime24(timeStr);
  if (!normalized) return "—";
  const [h, m] = normalized.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export function subtractMinutes(timeStr, minutes) {
  const normalized = normalizeTime24(timeStr);
  if (!normalized) return normalized;
  const [h, m] = normalized.split(":").map(Number);
  const total = Math.max(0, h * 60 + m - minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

export function addMinutes(timeStr, minutes) {
  const normalized = normalizeTime24(timeStr);
  if (!normalized) return normalized;
  const [h, m] = normalized.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(
    wrapped % 60,
  ).padStart(2, "0")}`;
}

export function weekdayKeyFromRideDate(rideDate) {
  if (!rideDate) {
    return WEEKDAYS[new Date().getUTCDay()];
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(rideDate).trim());
  if (!m) {
    return WEEKDAYS[new Date().getUTCDay()];
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return WEEKDAYS[new Date(Date.UTC(y, mo, d)).getUTCDay()];
}

export function getScheduleClassStart(scheduleDays, rideDate) {
  if (!scheduleDays || typeof scheduleDays !== "object") return null;
  const day = weekdayKeyFromRideDate(rideDate);
  return normalizeTime24(scheduleDays[day]?.start_time);
}

/**
 * Pickup is always 15 minutes before class start, for both scheduled and
 * manual rides. `Rides.start_time` is treated as the class start time in both
 * cases, so the rider and driver always see the same numbers for a given ride
 * regardless of their individual saved schedules.
 *
 * The second argument is unused now but kept so existing callers don't need to
 * change.
 */
// eslint-disable-next-line no-unused-vars
export function deriveRideDisplayTimes(rideStartTime, _scheduleClassStart) {
  const slot = normalizeTime24(rideStartTime);
  if (!slot) {
    return { pickupTime: "—", classTime: "—" };
  }
  return {
    pickupTime: formatTime12h(subtractMinutes(slot, 15)),
    classTime: formatTime12h(slot),
  };
}
