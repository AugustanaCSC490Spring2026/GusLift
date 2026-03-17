import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useRef, useState } from "react";

const MatchingContext = createContext(null);

export function MatchingProvider({ children }) {
  const wsRef = useRef(null);
  const listenersRef = useRef(new Set());
  const userIdRef = useRef(null);
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

  async function connect(options = {}) {
    if (wsRef.current) return userIdRef.current; // already connected

    const stored = await AsyncStorage.getItem("@user");
    if (!stored) return null;
    const user = JSON.parse(stored);
    console.log("stored user:", JSON.stringify(user));
    setUserId(user.id);
    userIdRef.current = user.id;

    return new Promise((resolve) => {
      const baseUrl = normalizeWsUrl(process.env.EXPO_PUBLIC_MATCHING_WORKER_URL);
      if (!baseUrl) {
        resolve(null);
        return;
      }

      const url = new URL(baseUrl);
      url.searchParams.set("token", user.id);
      if (options?.location) url.searchParams.set("location", options.location);
      if (options?.time) url.searchParams.set("time", options.time);
      if (options?.day) url.searchParams.set("day", options.day);

      const wsUrl = url.toString();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        resolve(user.id);
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        listenersRef.current.forEach((handler) => handler(msg));
      };

      ws.onerror = () => {
        wsRef.current = null;
        resolve(null);
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
  }

  return (
    <MatchingContext.Provider value={{ connect, send, disconnect, onMessage, userId }}>
      {children}
    </MatchingContext.Provider>
  );
}

export function useMatching() {
  return useContext(MatchingContext);
}
