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
  Path,
  Rect,
} from "react-native-svg";

/* ─── Color tokens ─── */
const C = {
  brand: "#3B82F6",
  bg: "#F8FAFC",
  text: "#0F172A",
  border: "#E2E8F0",
  skin: "#FBBF72",
  hair: "#92400E",
  dark: "#1E293B",
};

const AnimatedG = Animated.createAnimatedComponent(G);

export default function RiderIllustration({ isHovered }) {
  const armAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  useEffect(() => {
    if (isHovered) {
      animRef.current = Animated.loop(
        Animated.sequence([
          // Raise arm
          Animated.timing(armAnim, {
            toValue: -130,
            duration: 350,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          // Wave 1
          Animated.timing(armAnim, {
            toValue: -95,
            duration: 180,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(armAnim, {
            toValue: -130,
            duration: 180,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          // Wave 2
          Animated.timing(armAnim, {
            toValue: -95,
            duration: 180,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(armAnim, {
            toValue: -130,
            duration: 180,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          // Wave 3
          Animated.timing(armAnim, {
            toValue: -95,
            duration: 180,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(armAnim, {
            toValue: -130,
            duration: 180,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          // Lower arm
          Animated.timing(armAnim, {
            toValue: 0,
            duration: 350,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          // Pause
          Animated.delay(500),
        ])
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
      armAnim.setValue(0);
    }

    return () => {
      animRef.current?.stop();
    };
  }, [isHovered, armAnim]);

  const armRotation = armAnim.interpolate({
    inputRange: [-180, 0],
    outputRange: ["-180deg", "0deg"],
  });

  return (
    <View style={styles.canvas}>
      <Svg width={120} height={180} viewBox="-20 -50 120 174" fill="none" overflow="visible">
        {/* Body */}
        <Rect x="20" y="46" width="40" height="36" rx="8" fill={C.brand} />
        {/* Left arm */}
        <Rect x="5" y="50" width="16" height="26" rx="8" fill={C.brand} />
        <Circle cx="13" cy="76" r="8" fill={C.skin} />
        {/* Right arm (animated) */}
        <AnimatedG
          style={Platform.OS === "web" ? { transform: [{ rotate: armRotation }] } : undefined}
          origin="64, 50"
        >
          <Rect x="56" y="50" width="16" height="26" rx="8" fill={C.brand} />
          <Circle cx="64" cy="76" r="8" fill={C.skin} />
        </AnimatedG>
        {/* Neck */}
        <Rect x="33" y="38" width="14" height="10" rx="4" fill={C.skin} />
        {/* Head */}
        <Circle cx="40" cy="22" r="18" fill={C.skin} />
        {/* Hair */}
        <Path d="M22 18 C22 5 58 5 58 18 C54 9 26 9 22 18Z" fill={C.hair} />
        {/* Eyes */}
        <Ellipse cx="33" cy="21" rx="3" ry="3.5" fill={C.dark} />
        <Ellipse cx="47" cy="21" rx="3" ry="3.5" fill={C.dark} />
        {/* Eye highlights */}
        <Circle cx="34.2" cy="19.5" r="1.1" fill="white" />
        <Circle cx="48.2" cy="19.5" r="1.1" fill="white" />
        {/* Smile */}
        <Path d="M 34 30 Q 40 33 46 30" stroke={C.hair} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        {/* Legs */}
        <Rect x="23" y="80" width="14" height="28" rx="6" fill={C.dark} />
        <Rect x="43" y="80" width="14" height="28" rx="6" fill={C.dark} />
        {/* Shoes */}
        <Ellipse cx="30" cy="109" rx="10" ry="6" fill={C.text} />
        <Ellipse cx="50" cy="109" rx="10" ry="6" fill={C.text} />
      </Svg>
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
    overflow: "visible",
  },
});
