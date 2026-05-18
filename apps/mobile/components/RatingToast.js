import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import StarRatingRow from "./StarRatingRow";
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const DISMISS_MS = 7000;

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function RatingToast({
  visible,
  driverName,
  rideId,
  fromUserId,
  toUserId,
  onDismiss,
  onNavigateDetail,
  onRatedSuccess,
}) {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const [submitted, setSubmitted] = useState(false);
  const [selectedScore, setSelectedScore] = useState(0);
  const hasAppeared = useRef(false);

  useEffect(() => {
    hasAppeared.current = false;
  }, [rideId]);

  useEffect(() => {
    if (visible && !hasAppeared.current) {
      hasAppeared.current = true;
      setSubmitted(false);
      setSelectedScore(0);
      progressAnim.setValue(1);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 9,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.timing(progressAnim, {
        toValue: 0,
        duration: DISMISS_MS,
        useNativeDriver: false,
      }).start();

      timerRef.current = setTimeout(() => {
        dismiss();
      }, DISMISS_MS);
    }

    if (!visible) {
      hasAppeared.current = false;
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, rideId]);

  function dismiss() {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  }

  async function submitRating(score) {
    setSelectedScore(score);
    setSubmitted(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (BACKEND_URL && rideId && fromUserId && toUserId) {
      try {
        const normalizedUrl = BACKEND_URL.replace(/\/$/, "");
        const res = await fetch(`${normalizedUrl}/api/ratings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ride_id: String(rideId),
            from_user_id: String(fromUserId),
            to_user_id: String(toUserId),
            score,
          }),
        });
        if (res.ok) {
          onRatedSuccess?.(score);
        }
      } catch {
        // best-effort
      }
    }

    setTimeout(() => dismiss(), 1400);
  }

  if (!visible) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: slideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.toast}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { width: progressWidth }]}
          />
        </View>

        {submitted ? (
          <View style={styles.thankYou}>
            <View style={styles.thankYouIcon}>
              <Ionicons name="checkmark-circle" size={28} color="#16a34a" />
            </View>
            <Text style={styles.thankYouText}>Thanks for rating!</Text>
            <View style={styles.starsConfirm}>
              <StarRatingRow
                value={selectedScore}
                size={22}
                filledColor="#d4af37"
                emptyColor="#e5e7eb"
              />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.topSection}>
              <View style={styles.driverInfo}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {String(driverName || "D")[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.textCol}>
                  <Text style={styles.promptText}>How was your ride?</Text>
                  <Text style={styles.driverNameText} numberOfLines={1}>
                    with {driverName || "your driver"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.starsSection}>
              <StarRatingRow
                value={selectedScore}
                size={36}
                filledColor="#d4af37"
                emptyColor="#cbd5e1"
                onSelect={(n) => submitRating(n)}
              />
            </View>

            <View style={styles.bottomRow}>
              <TouchableOpacity
                onPress={() => onNavigateDetail?.()}
                style={styles.detailsLink}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text-outline" size={14} color="#1a3a6b" />
                <Text style={styles.detailsLinkText}>View ride details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={dismiss}
                style={styles.skipButton}
                activeOpacity={0.7}
              >
                <Text style={styles.skipText}>Skip</Text>
                <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: Platform.OS === "web" ? "fixed" : "absolute",
    bottom: 36,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 24,
    ...(Platform.OS === "web"
      ? { maxWidth: 480, alignSelf: "center", marginHorizontal: "auto" }
      : {}),
  },
  toast: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#f1f5f9",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#1a3a6b",
    borderRadius: 2,
  },
  topSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  driverAvatarText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1a3a6b",
  },
  textCol: {
    flex: 1,
    gap: 1,
  },
  promptText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
  },
  driverNameText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  starsSection: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 2,
  },
  detailsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
  },
  detailsLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a3a6b",
  },
  skipButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  skipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9ca3af",
  },
  thankYou: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 22,
  },
  thankYouIcon: {
    marginBottom: 2,
  },
  thankYouText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#16a34a",
  },
  starsConfirm: {
    flexDirection: "row",
    gap: 4,
  },
});
