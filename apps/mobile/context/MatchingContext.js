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

  async function connect() {
    if (wsRef.current) return userIdRef.current; // already connected

    const stored = await AsyncStorage.getItem("@user");
    if (!stored) return null;
    const user = JSON.parse(stored);
    console.log("stored user:", JSON.stringify(user));
    setUserId(user.id);
    userIdRef.current = user.id;

    return new Promise((resolve) => {
      const wsUrl = `${process.env.EXPO_PUBLIC_MATCHING_WORKER_URL}?token=${user.id}`;
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
