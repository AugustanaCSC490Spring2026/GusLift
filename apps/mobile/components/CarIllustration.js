import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
} from "react-native-svg";

/* ─── Color tokens ─── */
const C = {
  brand: "#3B82F6",
  brandDark: "#2563EB",
  brandDeep: "#1D4ED8",
  brandLight: "#93C5FD",
  brandPale: "#BFDBFE",
  bg: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  dark: "#1E293B",
  darkMid: "#334155",
};

const AnimatedG = Animated.createAnimatedComponent(G);

export default function CarIllustration({ isHovered }) {
  const wheelAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const bounceRef = useRef(null);

  useEffect(() => {
    if (isHovered) {
      // Spin wheels
      animRef.current = Animated.loop(
        Animated.timing(wheelAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      animRef.current.start();

      // Bounce car
      bounceRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 1,
            duration: 180,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(bounceAnim, {
            toValue: -1,
            duration: 180,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 180,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ])
      );
      bounceRef.current.start();
    } else {
      animRef.current?.stop();
      bounceRef.current?.stop();
      wheelAnim.setValue(0);
      bounceAnim.setValue(0);
    }

    return () => {
      animRef.current?.stop();
      bounceRef.current?.stop();
    };
  }, [isHovered, wheelAnim, bounceAnim]);

  const wheelRotation = wheelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const carTranslateY = bounceAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [2, 0, -2],
  });

  return (
    <View style={styles.canvas}>
      <Animated.View style={{ transform: [{ translateY: carTranslateY }] }}>
        <Svg width={180} height={96} viewBox="0 0 120 64" fill="none">
          {/* Shadow */}
          <Ellipse cx="60" cy="62" rx="44" ry="3.5" fill={C.dark} opacity={0.1} />
          {/* Body */}
          <Rect x="4" y="30" width="112" height="24" rx="8" fill={C.brand} />
          {/* Roof */}
          <Path d="M32 30 C34 18 44 12 56 12 L72 12 C82 12 88 18 90 30 Z" fill={C.brandDark} />
          {/* Windows */}
          <Path d="M36 30 C37 22 44 16 55 16 L58 16 L58 30 Z" fill={C.brandLight} opacity={0.85} />
          <Path d="M84 30 C83 22 76 16 65 16 L62 16 L62 30 Z" fill={C.brandPale} opacity={0.9} />
          {/* Window divider */}
          <Rect x="59" y="14" width="4" height="16" fill="#60A5FA" opacity={0.5} />
          {/* Headlights */}
          <Rect x="100" y="34" width="14" height="9" rx="4" fill="#FEF9C3" />
          <Rect x="102" y="35.5" width="10" height="6" rx="3" fill="#FDE68A" />
          {/* Taillights */}
          <Rect x="6" y="34" width="10" height="9" rx="4" fill="#FECACA" />
          <Rect x="7" y="35.5" width="8" height="6" rx="3" fill="#EF4444" />
          {/* Center line */}
          <Line x1="60" y1="30" x2="60" y2="54" stroke={C.brandDeep} strokeWidth="1.5" opacity={0.25} />
          {/* Door handles */}
          <Rect x="63" y="40" width="11" height="3" rx="1.5" fill={C.brandDeep} opacity={0.35} />
          <Rect x="46" y="40" width="11" height="3" rx="1.5" fill={C.brandDeep} opacity={0.35} />
          {/* Back wheel */}
          <AnimatedG
            style={Platform.OS === "web" ? { transform: [{ rotate: wheelRotation }] } : undefined}
            origin="30, 54"
          >
            <Circle cx="30" cy="54" r="10" fill={C.text} />
            <Circle cx="30" cy="54" r="5.5" fill={C.darkMid} />
            <Circle cx="30" cy="54" r="2" fill={C.muted} />
            <Line x1="30" y1="45" x2="30" y2="63" stroke={C.muted} strokeWidth="1" />
            <Line x1="21" y1="54" x2="39" y2="54" stroke={C.muted} strokeWidth="1" />
          </AnimatedG>
          {/* Front wheel */}
          <AnimatedG
            style={Platform.OS === "web" ? { transform: [{ rotate: wheelRotation }] } : undefined}
            origin="90, 54"
          >
            <Circle cx="90" cy="54" r="10" fill={C.text} />
            <Circle cx="90" cy="54" r="5.5" fill={C.darkMid} />
            <Circle cx="90" cy="54" r="2" fill={C.muted} />
            <Line x1="90" y1="45" x2="90" y2="63" stroke={C.muted} strokeWidth="1" />
            <Line x1="81" y1="54" x2="99" y2="54" stroke={C.muted} strokeWidth="1" />
          </AnimatedG>
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: "100%",
    height: 160,
    backgroundColor: C.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
});
