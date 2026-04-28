import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useRef, useState } from "react";

const MatchingContext = createContext(null);

/**
 * Matching worker (apps/matching-worker/src/index.ts) exposes:
 * - GET (JSON): resolves the slot key from the user’s schedule and optional `location` / `time` / `day` query overrides.
 * - WebSocket: same query string; worker sets `X-Slot-Key` and routes to the Durable Object for that slot.
 *
 * We always GET first so we can return `needsManualTime` when there is no class block for today without opening a socket,
 * and so validation errors surface before the upgrade.
 *
 * Return shape from `connect()`:
 * - `{ ok: true, userId }` — socket is open and ready for `send()`
 * - `{ ok: false, needsManualTime: true, message }` — show one-off location/time UI, then call `connect({ location, time })` again
 * - `{ ok: false, error }` — show `error` (auth, bad time format, network, etc.)
 */
export function MatchingProvider({ children }) {
  const wsRef = useRef(null);
  const listenersRef = useRef(new Set());
  const userIdRef = useRef(null);
  const ridersSnapshotRef = useRef([]);
  const [userId, setUserId] = useState(null);

  function onMessage(handler) {
    listenersRef.current.add(handler);
    return () => listenersRef.current.delete(handler);
  }

  function normalizeWsUrl(rawUrl) {
    if (!rawUrl) return null;
    if (rawUrl.startsWith("ws://") || rawUrl.startsWith("wss://")) return rawUrl;
    if (rawUrl.startsWith("http://")) return `ws://${rawUrl.slice("http://".length)}`;
    if (rawUrl.startsWith("https://")) return `wss://${rawUrl.slice("https://".length)}`;
    return null;
  }

  /** Same host as the WebSocket URL, but `http(s)://` for the JSON preflight request. */
  function normalizeHttpUrl(rawUrl) {
    if (!rawUrl) return null;
    if (rawUrl.startsWith("https://") || rawUrl.startsWith("http://")) return rawUrl;
    if (rawUrl.startsWith("wss://")) return `https://${rawUrl.slice(6)}`;
    if (rawUrl.startsWith("ws://")) return `http://${rawUrl.slice(5)}`;
    return null;
  }

  function applySlotQueryParams(url, userIdValue, options) {
    url.searchParams.set("token", userIdValue);
    if (options?.location) url.searchParams.set("location", options.location);
    if (options?.time) url.searchParams.set("time", options.time);
    if (options?.day) url.searchParams.set("day", options.day);
  }

  async function connect(options = {}) {
    if (wsRef.current) {
      return { ok: true, userId: userIdRef.current };
    }

    const stored = await AsyncStorage.getItem("@user");
    if (!stored) {
      return { ok: false, error: "Not signed in" };
    }

    const user = JSON.parse(stored);
    setUserId(user.id);
    userIdRef.current = user.id;

    const httpBase = normalizeHttpUrl(process.env.EXPO_PUBLIC_MATCHING_WORKER_URL);
    if (!httpBase) {
      return { ok: false, error: "EXPO_PUBLIC_MATCHING_WORKER_URL is not set" };
    }

    const preflightUrl = new URL(httpBase);
    applySlotQueryParams(preflightUrl, user.id, options);

    let data;
    try {
      const res = await fetch(preflightUrl.toString(), { method: "GET" });
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        return { ok: false, error: "Invalid response from matching service" };
      }

      if (data.needsManualTime) {
        return {
          ok: false,
          needsManualTime: true,
          message: data.message || "Enter pickup location and time to match.",
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          error:
            typeof data.error === "string"
              ? data.error
              : `Matching service error (${res.status})`,
        };
      }

      if (data.ok === true && data.slot) {
        // Fall through to WebSocket with the same query string so the worker computes the same slot.
      } else if (data.ok === false && data.error) {
        return { ok: false, error: data.error };
      } else {
        return { ok: false, error: "Could not resolve matching slot" };
      }
    } catch (e) {
      return {
        ok: false,
        error: e?.message || "Network error while contacting matching service",
      };
    }

    return new Promise((resolve) => {
      const wsBase = normalizeWsUrl(process.env.EXPO_PUBLIC_MATCHING_WORKER_URL);
      if (!wsBase) {
        resolve({ ok: false, error: "EXPO_PUBLIC_MATCHING_WORKER_URL is not set" });
        return;
      }

      const wsUrl = new URL(wsBase);
      applySlotQueryParams(wsUrl, user.id, options);

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        resolve({ ok: true, userId: user.id });
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "initial_state" && Array.isArray(msg.riders)) {
          ridersSnapshotRef.current = msg.riders;
        }
        if (msg.type === "rider_joined" && msg.rider) {
          const already = ridersSnapshotRef.current.some(
            (r) => r.rider_id === msg.rider.rider_id
          );
          if (!already) ridersSnapshotRef.current = [...ridersSnapshotRef.current, msg.rider];
        }
        if (msg.type === "rider_removed") {
          ridersSnapshotRef.current = ridersSnapshotRef.current.filter(
            (r) => r.rider_id !== msg.rider_id
          );
        }
        listenersRef.current.forEach((handler) => handler(msg));
      };

      ws.onerror = () => {
        wsRef.current = null;
        resolve({ ok: false, error: "WebSocket connection failed" });
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
    });
  }

  function send(payload) {
    wsRef.current?.send(JSON.stringify(payload));
  }

  function disconnect() {
    wsRef.current?.close();
    wsRef.current = null;
    ridersSnapshotRef.current = [];
  }

  function getRidersSnapshot() {
    return ridersSnapshotRef.current;
  }

  return (
    <MatchingContext.Provider
      value={{ connect, send, disconnect, onMessage, userId, getRidersSnapshot }}
    >
      {children}
    </MatchingContext.Provider>
  );
}

export function useMatching() {
  return useContext(MatchingContext);
}
