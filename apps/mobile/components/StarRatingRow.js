import { Pressable, StyleSheet, Text, View } from "react-native";

const STAR = "\u2605";
const STAR_EMPTY = "\u2606";

/**
 * Unicode stars — reliable on web and native (Ionicons "star" can render as bars on Expo web).
 */
export default function StarRatingRow({
  value = 0,
  max = 5,
  size = 30,
  filledColor = "#d4af37",
  emptyColor = "#cbd5e1",
  onSelect,
  gap = 8,
}) {
  return (
    <View style={[styles.row, { gap }]}>
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const on = value >= n;
        const glyph = (
          <Text
            style={{
              fontSize: size,
              lineHeight: size * 1.2,
              color: on ? filledColor : emptyColor,
            }}
          >
            {on ? STAR : STAR_EMPTY}
          </Text>
        );

        if (onSelect) {
          return (
            <Pressable
              key={n}
              onPress={() => onSelect(n)}
              style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}
            >
              {glyph}
            </Pressable>
          );
        }

        return <View key={n}>{glyph}</View>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  hit: {
    padding: 4,
  },
  pressed: {
    opacity: 0.75,
  },
});
