import { Stack } from "expo-router";
import { Platform } from "react-native";
import { MatchingProvider } from "../context/MatchingContext";
import GlobalMenu from "../components/GlobalMenu";

export default function Layout() {
  return (
    <MatchingProvider>
      {/* Keep a consistent sans-serif stack on web without custom font package dependency. */}
      {Platform.OS === "web" && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * { font-family: system-ui, -apple-system, "Segoe UI", sans-serif !important; }
            `,
          }}
        />
      )}
      <Stack screenOptions={{ headerShown: false }} />
      <GlobalMenu />
    </MatchingProvider>
  );
}