import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

const FIELD_CONFIG = {
  residence: {
    label: "Residence Hall / Home",
    placeholder: "e.g. Andreen Hall, Off Campus",
    icon: "home-outline",
    keyboardType: "default",
  },
  pickupLoc: {
    label: "Pickup Location",
    placeholder: "e.g. Andreen Hall front entrance",
    icon: "location-outline",
    keyboardType: "default",
  },
  dropoffLoc: {
    label: "Dropoff Location",
    placeholder: "e.g. Olin Center, Main entrance",
    icon: "flag-outline",
    keyboardType: "default",
  },
};

const WEEKDAY_FIELDS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
];

const EMPTY_WEEKLY_SCHEDULE = Object.fromEntries(
  WEEKDAY_FIELDS.map(({ key }) => [
    key,
    { enabled: false, start_time: "", end_time: "" },
  ]),
);

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, idx) => {
  const totalMinutes = idx * 15;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return hh + ":" + mm;
});

function cloneWeeklySchedule(schedule) {
  return Object.fromEntries(
    WEEKDAY_FIELDS.map(({ key }) => [key, { ...(schedule[key] || {}) }]),
  );
}

function formatTime12h(timeValue) {
  if (!timeValue) return "Select";
  const [hoursRaw, minutesRaw] = String(timeValue).split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeValue;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

export default function RiderSetup() {
  const router = useRouter();

  const [residence, setResidence] = useState("");
  const [pickupLoc, setPickupLoc] = useState("");
  const [dropoffLoc, setDropoffLoc] = useState("");

  const [activeField, setActiveField] = useState(null);
  const [draftValue, setDraftValue] = useState("");

  const [weeklySchedule, setWeeklySchedule] = useState(() =>
    cloneWeeklySchedule(EMPTY_WEEKLY_SCHEDULE),
  );
  const [scheduleDraft, setScheduleDraft] = useState(() =>
    cloneWeeklySchedule(EMPTY_WEEKLY_SCHEDULE),
  );
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const scheduleEntryCount = Object.values(weeklySchedule).filter(
    (entry) => entry?.enabled && entry?.start_time && entry?.end_time,
  ).length;

  const fieldValues = { residence, pickupLoc, dropoffLoc };

  function openFieldInput(fieldKey) {
    setDraftValue(fieldValues[fieldKey] ?? "");
    setActiveField(fieldKey);
  }

  function closeFieldInput() {
    setActiveField(null);
    setDraftValue("");
  }

  function saveFieldInput() {
    if (!activeField) return;
    const value = draftValue.trim();
    if (activeField === "residence") setResidence(value);
    else if (activeField === "pickupLoc") setPickupLoc(value);
    else if (activeField === "dropoffLoc") setDropoffLoc(value);
    closeFieldInput();
  }

  function openScheduleInput() {
    setScheduleDraft(cloneWeeklySchedule(weeklySchedule));
    setScheduleModalVisible(true);
  }

  function closeScheduleInput() {
    setScheduleModalVisible(false);
    setScheduleDraft(cloneWeeklySchedule(weeklySchedule));
  }

  function saveScheduleInput() {
    const cleanedSchedule = Object.fromEntries(
      Object.entries(scheduleDraft).map(([day, entry]) => {
        const enabled = Boolean(entry?.enabled);
        return [
          day,
          {
            enabled,
            start_time: enabled ? (entry?.start_time || "").trim() : "",
            end_time: enabled ? (entry?.end_time || "").trim() : "",
          },
        ];
      }),
    );
    setWeeklySchedule(cleanedSchedule);
    setScheduleModalVisible(false);
  }

  function openTimePicker(dayKey, field) {
    setActiveTimeField({ dayKey, field });
    setTimePickerVisible(true);
  }

  function selectTimeValue(value) {
    if (!activeTimeField) return;
    setScheduleDraft((prev) => ({
      ...prev,
      [activeTimeField.dayKey]: {
        ...(prev[activeTimeField.dayKey] || {}),
        [activeTimeField.field]: value,
      },
    }));
    setTimePickerVisible(false);
    setActiveTimeField(null);
  }

  async function handleContinue() {
    if (!residence.trim() || !pickupLoc.trim() || !dropoffLoc.trim()) {
      Alert.alert("Missing info", "Please fill out all fields.");
      return;
    }

    if (!BACKEND_URL) {
      Alert.alert(
        "Backend URL missing",
        "Set EXPO_PUBLIC_BACKEND_URL in apps/mobile/.env and restart Expo.",
      );
      return;
    }

    const daysPayload = {};
    for (const { key } of WEEKDAY_FIELDS) {
      const entry = weeklySchedule[key];
      if (!entry?.enabled) continue;
      if (!entry.start_time || !entry.end_time) {
        Alert.alert(
          "Missing schedule time",
          "Each enabled day needs both start and end times.",
        );
        return;
      }
      daysPayload[key] = {
        start_time: entry.start_time,
        end_time: entry.end_time,
      };
    }

    if (Object.keys(daysPayload).length === 0) {
      Alert.alert(
        "Missing schedule",
        "Please enable at least one weekday and set its times.",
      );
      return;
    }

    try {
      setSubmitting(true);
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) {
        Alert.alert("Session missing", "Please sign in again.");
        router.replace("/signup");
        return;
      }

      const parsed = JSON.parse(stored);
      const userId = String(parsed?.id || "").trim();
      if (!userId) {
        Alert.alert("Session error", "Google user id missing. Please sign in again.");
        router.replace("/signup");
        return;
      }

      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const payload = {
        userID: userId,
        name: String(parsed?.name || "").trim(),
        residence: residence.trim(),
        picture_url: parsed?.picture || null,
        days: daysPayload,
        pickup_loc: pickupLoc.trim(),
        dropoff_loc: dropoffLoc.trim(),
      };

      const response = await fetch(`${normalizedBackendUrl}/api/rider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage =
          responseBody?.error || "Failed to register rider profile.";
        Alert.alert("Registration failed", String(errorMessage));
        return;
      }

      const updated = { ...parsed, riderSetupComplete: true };
      await AsyncStorage.setItem("@user", JSON.stringify(updated));
      router.replace("/home");
    } catch {
      Alert.alert("Error", "Could not save rider info. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={styles.headerIcon}>
          <Ionicons name="walk" size={24} color="#ffffff" />
        </View>
        <Text style={styles.title}>Rider Setup</Text>
        <Text style={styles.subtitle}>
          Tell us where you need rides so we can match you with drivers.
        </Text>
      </View>

      {/* Fields */}
      <View style={styles.fieldsGroup}>
        {[
          { key: "residence", value: residence },
          { key: "pickupLoc", value: pickupLoc },
          { key: "dropoffLoc", value: dropoffLoc },
        ].map(({ key, value }) => (
          <TouchableOpacity
            key={key}
            style={[styles.fieldButton, value && styles.fieldButtonFilled]}
            onPress={() => openFieldInput(key)}
            activeOpacity={0.85}
          >
            <View style={[styles.fieldIconWrap, value && styles.fieldIconWrapFilled]}>
              <Ionicons
                name={FIELD_CONFIG[key].icon}
                size={18}
                color={value ? "#1a3a6b" : "#94a3b8"}
              />
            </View>
            <View style={styles.fieldText}>
              <Text style={styles.fieldLabel}>{FIELD_CONFIG[key].label}</Text>
              <Text style={[styles.fieldValue, !value && styles.fieldPlaceholder]}>
                {value || FIELD_CONFIG[key].placeholder}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>
        ))}

        {/* Schedule field */}
        <TouchableOpacity
          style={[styles.fieldButton, scheduleEntryCount > 0 && styles.fieldButtonFilled]}
          onPress={openScheduleInput}
          activeOpacity={0.85}
        >
          <View style={[styles.fieldIconWrap, scheduleEntryCount > 0 && styles.fieldIconWrapFilled]}>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={scheduleEntryCount > 0 ? "#1a3a6b" : "#94a3b8"}
            />
          </View>
          <View style={styles.fieldText}>
            <Text style={styles.fieldLabel}>Weekly Schedule</Text>
            <Text style={[styles.fieldValue, scheduleEntryCount === 0 && styles.fieldPlaceholder]}>
              {scheduleEntryCount > 0
                ? `${scheduleEntryCount} day${scheduleEntryCount > 1 ? "s" : ""} added`
                : "Tap to set your class schedule"}
            </Text>
          </View>
          {scheduleEntryCount > 0 ? (
            <View style={styles.scheduleCount}>
              <Text style={styles.scheduleCountText}>{scheduleEntryCount}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          )}
        </TouchableOpacity>
      </View>

      {/* Continue button */}
      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Text style={styles.buttonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
          </>
        )}
      </TouchableOpacity>

      {/* Field input modal */}
      <Modal
        visible={Boolean(activeField)}
        transparent
        animationType="fade"
        onRequestClose={closeFieldInput}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {activeField ? FIELD_CONFIG[activeField]?.label : ""}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={draftValue}
              onChangeText={setDraftValue}
              autoFocus
              placeholder={activeField ? FIELD_CONFIG[activeField]?.placeholder : ""}
              placeholderTextColor="#94a3b8"
              keyboardType={activeField ? FIELD_CONFIG[activeField]?.keyboardType : "default"}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeFieldInput}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveFieldInput}
                activeOpacity={0.85}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Schedule modal */}
      <Modal
        visible={scheduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeScheduleInput}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.scheduleModalCard}>
            <Text style={styles.modalTitle}>Weekly Schedule</Text>
            <Text style={styles.scheduleSubtitle}>
              Select the days and times you need rides to campus.
            </Text>
            <ScrollView
              style={styles.scheduleList}
              contentContainerStyle={styles.scheduleListContent}
              showsVerticalScrollIndicator={false}
            >
              {WEEKDAY_FIELDS.map((day) => (
                <View key={day.key} style={styles.scheduleRow}>
                  <View style={styles.dayHeaderRow}>
                    <Text style={styles.scheduleDay}>{day.label}</Text>
                    <Switch
                      value={Boolean(scheduleDraft[day.key]?.enabled)}
                      onValueChange={(value) =>
                        setScheduleDraft((prev) => ({
                          ...prev,
                          [day.key]: {
                            ...(prev[day.key] || {}),
                            enabled: value,
                            start_time: value ? prev[day.key]?.start_time || "" : "",
                            end_time: value ? prev[day.key]?.end_time || "" : "",
                          },
                        }))
                      }
                      trackColor={{ true: "#1a3a6b" }}
                    />
                  </View>
                  <View style={styles.timeRow}>
                    {["start_time", "end_time"].map((field) => (
                      <TouchableOpacity
                        key={field}
                        style={[
                          styles.timeButton,
                          !scheduleDraft[day.key]?.enabled && styles.timeButtonDisabled,
                        ]}
                        disabled={!scheduleDraft[day.key]?.enabled}
                        onPress={() => openTimePicker(day.key, field)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.timeButtonLabel}>
                          {field === "start_time" ? "Start" : "End"}
                        </Text>
                        <Text style={styles.timeButtonValue}>
                          {formatTime12h(scheduleDraft[day.key]?.[field] || "")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeScheduleInput}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveScheduleInput}
                activeOpacity={0.85}
              >
                <Text style={styles.saveButtonText}>Save Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Time picker modal */}
      <Modal
        visible={timePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setTimePickerVisible(false);
          setActiveTimeField(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timePickerCard}>
            <Text style={styles.modalTitle}>Select time</Text>
            <ScrollView
              style={styles.timePickerList}
              contentContainerStyle={styles.timePickerListContent}
              showsVerticalScrollIndicator={false}
            >
              {TIME_OPTIONS.map((timeOption) => (
                <TouchableOpacity
                  key={timeOption}
                  style={styles.timeOption}
                  onPress={() => selectTimeValue(timeOption)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.timeOptionText}>{formatTime12h(timeOption)}</Text>
                  <Text style={styles.timeOptionRaw}>{timeOption}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setTimePickerVisible(false);
                setActiveTimeField(null);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#f8f6f1",
  },
  container: {
    padding: 24,
    paddingTop: 56,
    paddingBottom: 40,
    gap: 20,
  },

  // Header
  headerSection: {
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#1a3a6b",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: "#1a3a6b",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 21,
  },

  // Fields
  fieldsGroup: {
    gap: 10,
  },
  fieldButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  fieldButtonFilled: {
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
  },
  fieldIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldIconWrapFilled: {
    backgroundColor: "#dbeafe",
  },
  fieldText: {
    flex: 1,
    gap: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  fieldValue: {
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "500",
  },
  fieldPlaceholder: {
    color: "#94a3b8",
    fontWeight: "400",
  },
  scheduleCount: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#1a3a6b",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },

  // Continue button
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a3a6b",
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#1a3a6b",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    gap: 14,
  },
  scheduleModalCard: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  timePickerCard: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  scheduleSubtitle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 19,
    marginTop: -4,
  },
  scheduleList: { maxHeight: 320 },
  scheduleListContent: { gap: 12 },
  scheduleRow: { gap: 8 },
  dayHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scheduleDay: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  timeRow: { flexDirection: "row", gap: 10 },
  timeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    gap: 2,
  },
  timeButtonDisabled: { opacity: 0.4 },
  timeButtonLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  timeButtonValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#0f172a",
  },
  modalActions: { flexDirection: "row", gap: 10 },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButton: { backgroundColor: "#f1f5f9" },
  saveButton: { backgroundColor: "#1a3a6b" },
  cancelButtonText: { color: "#475569", fontSize: 15, fontWeight: "600" },
  saveButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  timePickerList: { maxHeight: 340 },
  timePickerListContent: { gap: 6 },
  timeOption: {
    borderWidth: 1,
    borderColor: "#f1f5f9",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeOptionText: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  timeOptionRaw: { fontSize: 12, color: "#94a3b8" },
});
