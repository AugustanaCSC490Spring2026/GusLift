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
 * Pickup is always 15 minutes before class start.
 *
 * The DB stores `Rides.start_time` differently depending on how the ride was
 * matched, because the matching slot key carries different semantics:
 *  - Scheduled ride: slot time = `schedule.days[day].start_time` (class start),
 *    so `Rides.start_time === scheduleClassStart`. Pickup = start − 15.
 *  - Manual ride: slot time = the time the rider/driver typed in, treated as
 *    the desired pickup window. Pickup = start, class = start + 15.
 *
 * We disambiguate by comparing the saved ride time to the user's saved class
 * start for that weekday. If they match → scheduled. Otherwise → manual.
 */
export function deriveRideDisplayTimes(rideStartTime, scheduleClassStart) {
  const slot = normalizeTime24(rideStartTime);
  const sched = normalizeTime24(scheduleClassStart);

  if (!slot && !sched) {
    return { pickupTime: "—", classTime: "—" };
  }
  if (!slot) {
    return { pickupTime: "—", classTime: "—" };
  }

  const isScheduledRide = sched != null && slot === sched;
  if (isScheduledRide) {
    return {
      pickupTime: formatTime12h(subtractMinutes(sched, 15)),
      classTime: formatTime12h(sched),
    };
  }

  // Manual ride (or scheduled day exists but this ride was a one-off):
  // saved start_time is the pickup window; class start is +15.
  return {
    pickupTime: formatTime12h(slot),
    classTime: formatTime12h(addMinutes(slot, 15)),
  };
}
