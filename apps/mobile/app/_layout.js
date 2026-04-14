import { useFonts } from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { MatchingProvider } from "../context/MatchingContext";
import GlobalMenu from "../components/GlobalMenu";

// Prevent splash screen from auto-hiding until fonts are loaded
SplashScreen.preventAutoHideAsync();

// Set Inter as the default font for all Text components
const originalRender = Text.render;
Text.render = function (props, ref) {
  const style = props.style || {};
  // Merge Inter as default fontFamily unless explicitly overridden
  return originalRender.call(this, {
    ...props,
    style: [{ fontFamily: "Inter_400Regular" }, style],
  }, ref);
};

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular: require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
    Inter_500Medium: require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf"),
    Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"),
    Inter_700Bold: require("@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"),
    Inter_800ExtraBold: require("@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf"),
    Inter_900Black: require("@expo-google-fonts/inter/900Black/Inter_900Black.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <MatchingProvider>
      {/* Inject Inter as default web font */}
      {Platform.OS === "web" && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * { font-family: 'Inter_400Regular', 'Inter', system-ui, -apple-system, sans-serif !important; }
            `,
          }}
        />
      )}
      <Stack screenOptions={{ headerShown: false }} />
      <GlobalMenu />
    </MatchingProvider>
  );
}