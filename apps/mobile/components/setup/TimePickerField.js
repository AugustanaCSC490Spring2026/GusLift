import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { B } from "./SetupIcons";

const HOURS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

const ROW_HEIGHT = 40;

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

function to24h(hourIdx, minIdx, periodIdx) {
  let h = hourIdx + 1;
  if (periodIdx === 0 && h === 12) h = 0;
  else if (periodIdx === 1 && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${String(minIdx).padStart(2, "0")}`;
}

function format12h(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hh, mm] = value.split(":").map(Number);
  const period = hh >= 12 ? "PM" : "AM";
  const h = hh % 12 || 12;
  return `${h}:${String(mm).padStart(2, "0")} ${period}`;
}

function ColumnList({ data, selectedIndex, onSelect }) {
  return (
    <ScrollView
      style={styles.colScroll}
      contentContainerStyle={styles.colContent}
      showsVerticalScrollIndicator
    >
      {data.map((item, i) => {
        const isSelected = i === selectedIndex;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.row, isSelected && styles.rowSelected]}
            onPress={() => onSelect(i)}
            activeOpacity={0.6}
          >
            <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>
              {item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
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

              <View style={styles.columnsRow}>
                <View style={styles.column}>
                  <Text style={styles.columnLabel}>HR</Text>
                  <ColumnList
                    data={HOURS}
                    selectedIndex={hourIdx}
                    onSelect={setHourIdx}
                  />
                </View>

                <View style={styles.column}>
                  <Text style={styles.columnLabel}>MIN</Text>
                  <ColumnList
                    data={MINUTES}
                    selectedIndex={minIdx}
                    onSelect={setMinIdx}
                  />
                </View>

                <View style={styles.periodColumn}>
                  <Text style={styles.columnLabel}> </Text>
                  <View style={styles.periodGroup}>
                    <TouchableOpacity
                      style={[
                        styles.periodBtn,
                        periodIdx === 0 && styles.periodBtnActive,
                      ]}
                      onPress={() => setPeriodIdx(0)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.periodText,
                          periodIdx === 0 && styles.periodTextActive,
                        ]}
                      >
                        AM
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.periodBtn,
                        periodIdx === 1 && styles.periodBtnActive,
                      ]}
                      onPress={() => setPeriodIdx(1)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.periodText,
                          periodIdx === 1 && styles.periodTextActive,
                        ]}
                      >
                        PM
                      </Text>
                    </TouchableOpacity>
                  </View>
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
  columnsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  column: {
    flex: 1,
    alignItems: "center",
  },
  periodColumn: {
    width: 80,
    alignItems: "center",
  },
  columnLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: B.slate400,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  colScroll: {
    height: ROW_HEIGHT * 5,
    width: "100%",
    borderWidth: 1,
    borderColor: B.border,
    borderRadius: 8,
    backgroundColor: B.slate50,
  },
  colContent: {
    paddingVertical: 4,
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  rowSelected: {
    backgroundColor: "rgba(59,130,246,0.12)",
  },
  rowText: {
    fontSize: 15,
    color: B.text,
  },
  rowTextSelected: {
    fontSize: 16,
    fontWeight: "700",
    color: B.blue,
  },
  periodGroup: {
    width: "100%",
    gap: 8,
  },
  periodBtn: {
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: B.border,
    borderRadius: 8,
    backgroundColor: B.slate50,
  },
  periodBtnActive: {
    backgroundColor: B.blue,
    borderColor: B.blue,
  },
  periodText: {
    fontSize: 15,
    fontWeight: "700",
    color: B.text,
  },
  periodTextActive: {
    color: B.white,
  },
});
