import { Redirect } from "expo-router";

function buildWaitingRoomReturnPath(params) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    searchParams.set(key, normalized);
  });
  const query = searchParams.toString();
  return `/rider/RiderWaitingRoom${query ? `?${query}` : ""}`;
}

export default function RequestRide() {
  return <Redirect href="/rider/RiderHome" />;
}
