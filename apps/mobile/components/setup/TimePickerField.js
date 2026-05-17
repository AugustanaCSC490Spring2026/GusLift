import { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { B } from "./SetupIcons";
import WheelPicker from "./WheelPicker";

const HOURS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);
const PERIODS = ["AM", "PM"];

// HH:MM (24h) → wheel indices. Falls back to current time when value is absent.
function parse24h(value) {
  if (value && /^\d{2}:\d{2}$/.test(value)) {
    const [hh, mm] = value.split(":").map(Number);
    return {
      hourIdx: (hh % 12 || 12) - 1,
      minIdx: mm,
      periodIdx: hh >= 12 ? 1 : 0,
    };
  }
  const now = new Date();
  const hh = now.getHours();
  return {
    hourIdx: (hh % 12 || 12) - 1,
    minIdx: now.getMinutes(),
    periodIdx: hh >= 12 ? 1 : 0,
  };
}

// Wheel indices → HH:MM (24h) string
function to24h(hourIdx, minIdx, periodIdx) {
  let h = hourIdx + 1; // 1–12
  if (periodIdx === 0 && h === 12) h = 0; // 12 AM → 00
  else if (periodIdx === 1 && h !== 12) h += 12; // PM → +12
  return `${String(h).padStart(2, "0")}:${String(minIdx).padStart(2, "0")}`;
}

// HH:MM (24h) → "H:MM AM/PM" for display
function format12h(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hh, mm] = value.split(":").map(Number);
  const period = hh >= 12 ? "PM" : "AM";
  const h = hh % 12 || 12;
  return `${h}:${String(mm).padStart(2, "0")} ${period}`;
}

export default function TimePickerField({
  value,
  onChange,
  placeholder,
  disabled,
}) {
  const [show, setShow] = useState(false);
  const [hourIdx, setHourIdx] = useState(0);
  const [minIdx, setMinIdx] = useState(0);
  const [periodIdx, setPeriodIdx] = useState(0);

  const openPicker = () => {
    if (disabled) return;
    const parsed = parse24h(value);
    setHourIdx(parsed.hourIdx);
    setMinIdx(parsed.minIdx);
    setPeriodIdx(parsed.periodIdx);
    setShow(true);
  };

  const handleDone = () => {
    onChange(to24h(hourIdx, minIdx, periodIdx));
    setShow(false);
  };

  const displayValue = format12h(value);

  return (
    <View>
      <TouchableOpacity
        style={[styles.field, disabled && styles.disabled]}
        onPress={openPicker}
        activeOpacity={0.6}
        disabled={disabled}
      >
        <Text style={[styles.text, !displayValue && styles.placeholder]}>
          {displayValue || placeholder || "Select time"}
        </Text>
      </TouchableOpacity>

      {show && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.cancelBtn}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDone}>
                  <Text style={styles.doneBtn}>Done</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.wheelsRow}>
                <View style={styles.wheelCol}>
                  <Text style={styles.wheelLabel}>HR</Text>
                  <WheelPicker
                    key={`h-${hourIdx}`}
                    data={HOURS}
                    initialIndex={hourIdx}
                    onChange={setHourIdx}
                  />
                </View>

                <Text style={styles.colon}>:</Text>

                <View style={styles.wheelCol}>
                  <Text style={styles.wheelLabel}>MIN</Text>
                  <WheelPicker
                    key={`m-${minIdx}`}
                    data={MINUTES}
                    initialIndex={minIdx}
                    onChange={setMinIdx}
                  />
                </View>

                <View style={[styles.wheelCol, styles.periodCol]}>
                  <Text style={styles.wheelLabel}> </Text>
                  <WheelPicker
                    key={`p-${periodIdx}`}
                    data={PERIODS}
                    initialIndex={periodIdx}
                    onChange={setPeriodIdx}
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: B.slate50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: B.slate100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    height: 48,
    marginTop: 8,
  },
  disabled: { opacity: 0.4 },
  text: {
    fontSize: 14,
    fontWeight: "700",
    color: B.text,
    textAlign: "center",
  },
  placeholder: {
    color: B.muted,
    fontWeight: "500",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    backgroundColor: B.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: B.border,
  },
  cancelBtn: {
    fontSize: 16,
    fontWeight: "600",
    color: B.slate400,
  },
  doneBtn: {
    fontSize: 16,
    fontWeight: "700",
    color: B.blue,
  },
  wheelsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  wheelCol: {
    alignItems: "center",
  },
  periodCol: {
    marginLeft: 12,
    minWidth: 64,
  },
  wheelLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: B.slate400,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  colon: {
    fontSize: 22,
    fontWeight: "700",
    color: B.slate400,
    marginHorizontal: 4,
    marginTop: 20,
  },
});
