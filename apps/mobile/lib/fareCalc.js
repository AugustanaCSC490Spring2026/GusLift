import { getCoords } from "./campusCoords";

const BASE_CENTS = 100;
const RATE_CENTS_PER_KM = 46.6; // ~$0.75/mile

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateFare(pickupLocation, dropoffLocation) {
  const p = getCoords(pickupLocation);
  const d = getCoords(dropoffLocation);
  if (!p || !d) return null;
  const km = haversineKm(p.latitude, p.longitude, d.latitude, d.longitude);
  const fareCents = Math.round(BASE_CENTS + km * RATE_CENTS_PER_KM);
  return {
    km: Math.round(km * 10) / 10,
    fareCents,
    fareLabel: `$${(fareCents / 100).toFixed(2)}`,
  };
}
