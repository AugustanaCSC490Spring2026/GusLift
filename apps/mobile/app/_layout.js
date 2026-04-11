import { Stack } from "expo-router";
import { MatchingProvider } from "../context/MatchingContext";
import GlobalMenu from "../components/GlobalMenu";

export default function Layout() {
  return (
    <MatchingProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <GlobalMenu />
    </MatchingProvider>
  );
}