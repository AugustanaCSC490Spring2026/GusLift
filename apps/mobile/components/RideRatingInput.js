import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import StarRatingRow from "./StarRatingRow";

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

/**
 * Submit a rating for a completed ride (POST /api/ratings).
 */
export default function RideRatingInput({
  rideId,
  fromUserId,
  toUserId,
  initialScore = 0,
  promptLabel = "Rate",
  ratedLabel = "Your rating",
  onRated,
  onError,
}) {
  const [score, setScore] = useState(() =>
    typeof initialScore === "number" && initialScore >= 1 && initialScore <= 5
      ? initialScore
      : 0,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const n =
      typeof initialScore === "number" && initialScore >= 1 && initialScore <= 5
        ? initialScore
        : 0;
    setScore(n);
  }, [initialScore, rideId]);

  async function submit(value) {
    setSaving(true);
    try {
      const normalizedUrl = BACKEND_URL?.replace(/\/$/, "");
      if (!normalizedUrl) {
        onError?.("Backend URL is not configured (EXPO_PUBLIC_BACKEND_URL).");
        return;
      }
      const res = await fetch(`${normalizedUrl}/api/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ride_id: String(rideId),
          from_user_id: String(fromUserId),
          to_user_id: String(toUserId),
          score: value,
        }),
      });
      if (res.ok) {
        setScore(value);
        onRated?.(value);
        return;
      }
      let message = `Server returned ${res.status}`;
      try {
        const body = await res.json();
        if (body?.details) message = String(body.details);
        else if (body?.error) message = String(body.error);
      } catch {
        // ignore
      }
      onError?.(message);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {score > 0 ? ratedLabel : promptLabel}
      </Text>
      <StarRatingRow
        value={score}
        size={30}
        filledColor="#d4af37"
        emptyColor="#d1d5db"
        onSelect={(n) => submit(n)}
        gap={10}
      />
      {saving ? <Text style={styles.hint}>Saving…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  hint: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
  },
});
