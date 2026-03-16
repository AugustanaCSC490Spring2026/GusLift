import { Stack } from "expo-router";
import { MatchingProvider } from "../context/MatchingContext";

export default function Layout() {
  return (
    <MatchingProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </MatchingProvider>
  );
}