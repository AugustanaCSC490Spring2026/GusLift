import { StyleSheet, Text, View } from "react-native";

/**
 * Shared ★ rating display (unicode star — reliable on Expo web).
 * @param {"compact" | "hero" | "heroMuted" | "muted" | "cta"} variant
 */
export default function RatingPill({
  average,
  count,
  score,
  max = 5,
  label,
  variant = "compact",
}) {
  const textStyle = styles[`${variant}Text`] ?? styles.compactText;

  if (label) {
    return (
      <View style={[styles.base, styles[variant] ?? styles.compact]}>
        {!label.toLowerCase().includes("no rating") ? (
          <Text style={styles.star}>★</Text>
        ) : null}
        <Text style={[styles.text, textStyle]}>{label}</Text>
      </View>
    );
  }

  if (score != null && Number.isFinite(Number(score))) {
    return (
      <View style={[styles.base, styles[variant]]}>
        <Text style={styles.star}>★</Text>
        <Text style={[styles.text, styles[`${variant}Text`]]}>
          {Math.round(Number(score))}/{max}
        </Text>
      </View>
    );
  }

  if (average != null && Number.isFinite(Number(average))) {
    const countSuffix =
      count != null && count > 0 ? ` (${count})` : "";
    return (
      <View style={[styles.base, styles[variant]]}>
        <Text style={styles.star}>★</Text>
        <Text style={[styles.text, styles[`${variant}Text`]]}>
          {Number(average).toFixed(1)}
          {countSuffix}
        </Text>
      </View>
    );
  }

  if (variant === "cta") {
    return (
      <View style={[styles.base, styles.cta]}>
        <Text style={styles.star}>★</Text>
        <Text style={[styles.text, styles.ctaText]}>Rate driver</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  star: {
    fontSize: 14,
    lineHeight: 16,
    color: "#d4af37",
    fontWeight: "700",
  },
  text: {
    fontWeight: "700",
  },
  compact: {
    backgroundColor: "#fef9c3",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  compactText: {
    fontSize: 12,
    color: "#92400e",
  },
  hero: {
    borderRadius: 999,
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroText: {
    fontSize: 12,
    color: "#fff9ef",
  },
  heroMuted: {
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroMutedText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "600",
  },
  cta: {
    backgroundColor: "#eef2ff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ctaText: {
    fontSize: 12,
    color: "#1a3a6b",
  },
  muted: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mutedText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
});
