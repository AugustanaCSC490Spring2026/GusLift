import type { DayKey } from "./types/state";

const WEEKDAYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Returns current weekday in doc format: mon, tue, ... sun
 */
export function getCurrentWeekday(): DayKey {
  const d = new Date();
  const idx = d.getUTCDay();
  return WEEKDAYS[idx];
}

/**
 * Normalize User.residence to slot location string (e.g. AUGIE).
 */
export function normalizeLocation(residence: string | null | undefined): string {
  if (!residence || !String(residence).trim()) return "UNKNOWN";
  return String(residence)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "") || "UNKNOWN";
}

export type DaySchedule = { start_time: string; end_time: string };
export type ScheduleDays = Partial<Record<DayKey, DaySchedule>>;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Resolve matching slot key from schedule and location.
 * Returns e.g. "AUGIE:mon:08:00"
 */
export function resolveMatchingSlot(
  schedule: ScheduleDays | null | undefined,
  location: string
): string {
  const day = getCurrentWeekday();
  const daySchedule = schedule?.[day];
  if (!daySchedule?.start_time) {
    throw new ManualSlotRequiredError(
      `No schedule for today (${day}). Pass location and time to match without a saved schedule.`
    );
  }
  const startTime = daySchedule.start_time;
  return `${location}:${day}:${startTime}`;
}

function isDayKey(value: string): value is DayKey {
  return value === "mon" ||
    value === "tue" ||
    value === "wed" ||
    value === "thu" ||
    value === "fri" ||
    value === "sat" ||
    value === "sun";
}

/**
 * Resolve slot from either:
 * 1) user schedule + residence (default), or
 * 2) request override (location + time, optional day).
 */
export function resolveMatchingSlotWithOverride(
  schedule: ScheduleDays | null | undefined,
  residence: string | null | undefined,
  override: { location?: string | null; time?: string | null; day?: string | null }
): string {
  const hasAnyOverride = Boolean(override.location || override.time || override.day);
  if (!hasAnyOverride) {
    return resolveMatchingSlot(schedule, normalizeLocation(residence));
  }

  const locationRaw = override.location?.trim();
  const timeRaw = override.time?.trim();
  const dayRaw = override.day?.trim().toLowerCase();

  if (!locationRaw || !timeRaw) {
    throw new SlotResolveError(
      "Override requires both location and time query params"
    );
  }
  if (!TIME_PATTERN.test(timeRaw)) {
    throw new SlotResolveError(
      "Invalid time format. Expected HH:MM (24h), e.g. 08:00"
    );
  }

  let day: DayKey = getCurrentWeekday();
  if (dayRaw) {
    if (!isDayKey(dayRaw)) {
      throw new SlotResolveError(
        "Invalid day value. Expected one of: mon,tue,wed,thu,fri,sat,sun"
      );
    }
    day = dayRaw;
  }

  return `${normalizeLocation(locationRaw)}:${day}:${timeRaw}`;
}

export class SlotResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlotResolveError";
  }
}

/** No entry for today in schedule — client should collect one-time location + time (Uber-style). */
export class ManualSlotRequiredError extends SlotResolveError {
  constructor(message: string) {
    super(message);
    this.name = "ManualSlotRequiredError";
  }
}
