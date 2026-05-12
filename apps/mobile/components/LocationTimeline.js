import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

const C = {
  brand: "#3B82F6",
  text: "#0F172A",
  subtle: "#94A3B8",
  border: "#E2E8F0",
};

/** Pickup icon: outer ring + filled inner circle (matches home page) */
export function CircleIcon({ size = 20, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2.5} />
      <Circle cx={12} cy={12} r={4} fill={color} />
    </Svg>
  );
}

/** Drop-off icon: filled square + white inner square (matches home page) */
export function SquareIcon({ size = 20, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={16} height={16} rx={3} fill={color} />
      <Rect x={9} y={9} width={6} height={6} rx={1.5} fill="#fff" />
    </Svg>
  );
}

export function ClockIcon({ size = 20, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function CalendarIcon({ size = 22, color = "#0F172A" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} />
      <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function LocationTimeline({
  timeLabel = "Pickup time",
  timeValue = "First class · Today",
  dateValue = null,
  pickupLabel = "Pickup location",
  pickupValue = "Not set",
  dropoffLabel = "Destination",
  dropoffValue = "",
  noTimeLine = false,
}) {
  return (
    <View style={styles.container}>
      {/* Date Row (Optional) */}
      {dateValue && (
        <View style={styles.row}>
          <View style={styles.iconCol}>
            <CalendarIcon size={22} color={C.text} />
            {!noTimeLine && <View style={styles.line} />}
          </View>
          <View style={styles.textCol}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{dateValue}</Text>
          </View>
        </View>
      )}

      {/* Time Row */}
      <View style={styles.row}>
        <View style={styles.iconCol}>
          <ClockIcon size={22} color={C.text} />
          {!noTimeLine && <View style={styles.line} />}
        </View>
        <View style={styles.textCol}>
          <Text style={styles.label}>{timeLabel}</Text>
          {typeof timeValue === "string" ? (
            <Text style={styles.value}>{timeValue}</Text>
          ) : (
            timeValue
          )}
        </View>
      </View>

      {/* Pickup Row */}
      <View style={styles.row}>
        <View style={styles.iconCol}>
          <CircleIcon size={22} color={C.text} />
          <View style={styles.line} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.label}>{pickupLabel}</Text>
          {typeof pickupValue === "string" ? (
            <Text style={styles.value}>{pickupValue}</Text>
          ) : (
            pickupValue
          )}
        </View>
      </View>

      {/* Dropoff Row */}
      <View style={[styles.row, { minHeight: 48 }]}>
        <View style={styles.iconCol}>
          <SquareIcon size={22} color={C.text} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.label}>{dropoffLabel}</Text>
          {typeof dropoffValue === "string" ? (
            dropoffValue ? (
              <Text style={styles.value}>{dropoffValue}</Text>
            ) : (
              <Text style={styles.valueEmpty}>Not selected</Text>
            )
          ) : (
            dropoffValue
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    minHeight: 64,
  },
  iconCol: {
    width: 28,
    alignItems: "center",
    marginRight: 16,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: C.border,
    marginTop: 2,
    marginBottom: 2,
  },
  textCol: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: C.subtle,
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
    color: C.text,
  },
  valueEmpty: {
    fontSize: 16,
    fontWeight: "500",
    color: C.subtle,
    fontStyle: "italic",
  },
});
