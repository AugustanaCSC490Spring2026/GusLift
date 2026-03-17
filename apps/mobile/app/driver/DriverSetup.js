import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
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
  carModel: {
    label: "Car Model",
    placeholder: "Tap to enter make, model, year, and color",
    keyboardType: "default",
  },
  licensePlate: {
    label: "License Plate",
    placeholder: "Tap to enter license plate",
    keyboardType: "default",
  },
  seatsAvailable: {
    label: "Seats Available",
    placeholder: "Tap to enter seats available",
    keyboardType: "numeric",
  },
  residenceLocation: {
    label: "Residence Hall / Off Campus",
    placeholder: "Tap to enter residence hall or off-campus location",
    keyboardType: "default",
  },
};

const EMPTY_CAR_DETAILS = {
  make: "",
  model: "",
  year: "",
  color: "",
};

const CAR_DETAIL_FIELDS = [
  {
    key: "make",
    label: "Make",
    placeholder: "e.g. Toyota",
    keyboardType: "default",
  },
  {
    key: "model",
    label: "Model",
    placeholder: "e.g. Camry",
    keyboardType: "default",
  },
  {
    key: "year",
    label: "Year",
    placeholder: "e.g. 2021",
    keyboardType: "numeric",
  },
  {
    key: "color",
    label: "Color",
    placeholder: "e.g. Silver",
    keyboardType: "default",
  },
];

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

function buildCarSummary(details) {
  const parts = [details?.year, details?.color, details?.make, details?.model]
    .map((part) => (part || "").trim())
    .filter(Boolean);
  return parts.join(" ");
}

export default function DriverSetup() {
  const router = useRouter();

  const [carDetails, setCarDetails] = useState({ ...EMPTY_CAR_DETAILS });
  const [carDetailsDraft, setCarDetailsDraft] = useState({
    ...EMPTY_CAR_DETAILS,
  });
  const [licensePlate, setLicensePlate] = useState("");
  const [seatsAvailable, setSeatsAvailable] = useState("");
  const [residenceLocation, setResidenceLocation] = useState("");
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
  const submitInFlightRef = useRef(false);

  const fieldValues = {
    licensePlate,
    seatsAvailable,
    residenceLocation,
  };
  const carModel = buildCarSummary(carDetails);
  const isCarDetailsComplete = Object.values(carDetails).every((value) =>
    value.trim(),
  );

  const scheduleEntryCount = Object.values(weeklySchedule).filter(
    (entry) => entry?.enabled && entry?.start_time && entry?.end_time,
  ).length;

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

  function openFieldInput(fieldKey) {
    if (fieldKey === "carModel") {
      setCarDetailsDraft({ ...carDetails });
      setActiveField(fieldKey);
      return;
    }

    setDraftValue(fieldValues[fieldKey] ?? "");
    setActiveField(fieldKey);
  }

  function closeFieldInput() {
    setActiveField(null);
    setDraftValue("");
    setCarDetailsDraft({ ...carDetails });
  }

  function saveFieldInput() {
    if (!activeField) {
      return;
    }

    if (activeField === "carModel") {
      const cleanedDetails = Object.fromEntries(
        Object.entries(carDetailsDraft).map(([key, value]) => [
          key,
          value.trim(),
        ]),
      );
      setCarDetails(cleanedDetails);
      closeFieldInput();
      return;
    }

    let value = draftValue.trim();
    if (activeField === "seatsAvailable") {
      // Keep seats as digits only so values like "4abc" never persist in UI state.
      value = value.replace(/\D+/g, "");
    }

    if (activeField === "licensePlate") {
      setLicensePlate(value);
    } else if (activeField === "seatsAvailable") {
      setSeatsAvailable(value);
    } else if (activeField === "residenceLocation") {
      setResidenceLocation(value);
    }

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

  async function handleContinue() {
    if (
      !isCarDetailsComplete ||
      !licensePlate.trim() ||
      !seatsAvailable.trim() ||
      !residenceLocation.trim()
    ) {
      Alert.alert("Missing info", "Please fill out all driver setup fields.");
      return;
    }

    if (!BACKEND_URL) {
      Alert.alert(
        "Backend URL missing",
        "Set BACKEND_URL in apps/mobile/.env and restart Expo.",
      );
      return;
    }

    const seatsRaw = seatsAvailable.trim();
    if (!/^\d+$/.test(seatsRaw)) {
      Alert.alert("Invalid seats", "Seats available must be a whole number from 1 to 8.");
      return;
    }

    const parsedSeats = Number(seatsRaw);
    if (
      Number.isNaN(parsedSeats) ||
      parsedSeats < 1 ||
      parsedSeats > 8
    ) {
      Alert.alert("Invalid seats", "Seats available must be a number from 1 to 8.");
      return;
    }

    const daysPayload = {};
    for (const { key } of WEEKDAY_FIELDS) {
      const entry = weeklySchedule[key];
      if (!entry?.enabled) continue;
      if (!entry.start_time || !entry.end_time) {
        Alert.alert(
          "Missing schedule time",
          "Each enabled day must have both start and end times selected.",
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
        "Please enable at least one weekday and select its start/end times.",
      );
      return;
    }

    if (submitInFlightRef.current) {
      return;
    }
    submitInFlightRef.current = true;

    let finishedOk = false;
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
        Alert.alert("Session error", "Google user id is missing. Please sign in again.");
        router.replace("/signup");
        return;
      }

      const normalizedBackendUrl = BACKEND_URL.replace(/\/$/, "");
      const formData = new FormData();
      formData.append("userID", userId);
      formData.append("name", String(parsed?.name || "").trim());
      formData.append("residence", residenceLocation.trim());
      formData.append("make", carDetails.make.trim());
      formData.append("model", carDetails.model.trim());
      formData.append("color", carDetails.color.trim());
      formData.append("license_plate", licensePlate.trim());
      formData.append("capacity", String(parsedSeats));
      formData.append("is_driver", "true");
      formData.append("days", JSON.stringify(daysPayload));

      const response = await fetch(`${normalizedBackendUrl}/api/driver`, {
        method: "POST",
        body: formData,
      });

      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage =
          responseBody?.error ||
          responseBody?.details ||
          "Failed to register driver profile.";
        Alert.alert("Registration failed", String(errorMessage));
        return;
      }

      const updated = {
        ...parsed,
        driverSetupComplete: true,
      };

      await AsyncStorage.setItem("@user", JSON.stringify(updated));
      finishedOk = true;
      router.replace("/driver/OfferRide");
    } catch {
      Alert.alert("Error", "Could not save driver info. Try again.");
    } finally {
      submitInFlightRef.current = false;
      if (!finishedOk) {
        setSubmitting(false);
      }
    }
  }

  const FIELD_ICONS = {
    carModel: "car-outline",
    licensePlate: "card-outline",
    seatsAvailable: "people-outline",
    residenceLocation: "home-outline",
  };

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace("/home")}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={20} color="#1a3a6b" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.headerSection}>
        <View style={styles.headerIcon}>
          <Ionicons name="car-sport" size={24} color="#ffffff" />
        </View>
        <Text style={styles.title}>Driver Setup</Text>
        <Text style={styles.subtitle}>Tell us about your vehicle and availability.</Text>
      </View>

      {/* Fields */}
      <View style={styles.fieldsGroup}>
        {[
          { key: "carModel", value: carModel },
          { key: "licensePlate", value: licensePlate },
          { key: "seatsAvailable", value: seatsAvailable },
          { key: "residenceLocation", value: residenceLocation },
        ].map(({ key, value }) => (
          <TouchableOpacity
            key={key}
            style={[styles.fieldButton, value && styles.fieldButtonFilled]}
            onPress={() => openFieldInput(key)}
            activeOpacity={0.85}
          >
            <View style={[styles.fieldIconWrap, value && styles.fieldIconWrapFilled]}>
              <Ionicons
                name={FIELD_ICONS[key]}
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
                : "Tap to add your semester schedule"}
            </Text>
          </View>
          {scheduleEntryCount > 0 && (
            <View style={styles.scheduleCount}>
              <Text style={styles.scheduleCountText}>{scheduleEntryCount}</Text>
            </View>
          )}
          {scheduleEntryCount === 0 && (
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          )}
        </TouchableOpacity>
      </View>

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
            <Text style={styles.buttonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
          </>
        )}
      </TouchableOpacity>

      <Modal
        visible={Boolean(activeField)}
        transparent
        animationType="fade"
        onRequestClose={closeFieldInput}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {activeField ? FIELD_CONFIG[activeField].label : ""}
            </Text>
            {activeField === "carModel" ? (
              <View style={styles.carDetailsGroup}>
                {CAR_DETAIL_FIELDS.map((field, index) => (
                  <View key={field.key} style={styles.carDetailRow}>
                    <Text style={styles.scheduleInputLabel}>{field.label}</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={carDetailsDraft[field.key]}
                      onChangeText={(value) =>
                        setCarDetailsDraft((prev) => ({
                          ...prev,
                          [field.key]: value,
                        }))
                      }
                      autoFocus={index === 0}
                      placeholder={field.placeholder}
                      keyboardType={field.keyboardType}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <TextInput
                style={styles.modalInput}
                value={draftValue}
                onChangeText={setDraftValue}
                autoFocus
                placeholder={
                  activeField ? FIELD_CONFIG[activeField].placeholder : ""
                }
                keyboardType={
                  activeField
                    ? FIELD_CONFIG[activeField].keyboardType
                    : "default"
                }
              />
            )}
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
              Select start/end times for each day you are driving.
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
                            start_time: value
                              ? prev[day.key]?.start_time || ""
                              : "",
                            end_time: value
                              ? prev[day.key]?.end_time || ""
                              : "",
                          },
                        }))
                      }
                    />
                  </View>
                  <View style={styles.timeRow}>
                    <TouchableOpacity
                      style={[
                        styles.timeButton,
                        !scheduleDraft[day.key]?.enabled && styles.timeButtonDisabled,
                      ]}
                      disabled={!scheduleDraft[day.key]?.enabled}
                      onPress={() => openTimePicker(day.key, "start_time")}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.timeButtonLabel}>Start</Text>
                      <Text style={styles.timeButtonValue}>
                        {formatTime12h(scheduleDraft[day.key]?.start_time || "")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.timeButton,
                        !scheduleDraft[day.key]?.enabled && styles.timeButtonDisabled,
                      ]}
                      disabled={!scheduleDraft[day.key]?.enabled}
                      onPress={() => openTimePicker(day.key, "end_time")}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.timeButtonLabel}>End</Text>
                      <Text style={styles.timeButtonValue}>
                        {formatTime12h(scheduleDraft[day.key]?.end_time || "")}
                      </Text>
                    </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f6f1",
    justifyContent: "center",
    padding: 24,
    gap: 20,
  },

  backButton: {
    position: "absolute",
    top: 52,
    left: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a3a6b",
  },

  // Header
  headerSection: {
    alignItems: "center",
    gap: 8,
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

  // Fields group
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

  // Button
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
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  carDetailsGroup: {
    gap: 10,
  },
  carDetailRow: {
    gap: 6,
  },
  scheduleModalCard: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  scheduleSubtitle: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
  scheduleList: {
    maxHeight: 320,
  },
  scheduleListContent: {
    gap: 10,
  },
  scheduleRow: {
    gap: 6,
  },
  dayHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scheduleDay: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  scheduleInputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
  },
  timeRow: {
    flexDirection: "row",
    gap: 10,
  },
  timeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    gap: 2,
  },
  timeButtonDisabled: {
    opacity: 0.45,
  },
  timeButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  timeButtonValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#111827",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#e5e7eb",
  },
  saveButton: {
    backgroundColor: "#1a3a6b",
  },
  cancelButtonText: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "700",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  timePickerCard: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  timePickerList: {
    maxHeight: 340,
  },
  timePickerListContent: {
    gap: 8,
  },
  timeOption: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  timeOptionRaw: {
    fontSize: 12,
    color: "#6b7280",
  },
});
