import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const FIELD_CONFIG = {
  residenceLocation: {
    label: "Residence Hall / Default Pickup",
    placeholder: "Tap to enter residence hall or pickup location",
    keyboardType: "default",
  },
  dropoffLocation: {
    label: "Default Dropoff Location",
    placeholder: "Tap to enter default dropoff (e.g. Academic Bldg)",
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

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, idx) => {
  const totalMinutes = idx * 15;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return hh + ":" + mm;
});

const EMPTY_WEEKLY_SCHEDULE = Object.fromEntries(
  WEEKDAY_FIELDS.map(({ key }) => [
    key,
    { enabled: false, start_time: "", end_time: "" },
  ]),
);

function isStartBeforeEnd(startTime, endTime) {
  if (!startTime || !endTime) return false;
  return String(startTime) < String(endTime);
}

function cloneWeeklySchedule(schedule) {
  return Object.fromEntries(
    WEEKDAY_FIELDS.map(({ key }) => [key, { ...(schedule[key] || {}) }]),
  );
}

export default function RiderSetup() {
  const router = useRouter();

  const [residenceLocation, setResidenceLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [sameAsPickup, setSameAsPickup] = useState(false);

  const [activeField, setActiveField] = useState(null);
  const [draftValue, setDraftValue] = useState("");

  const [weeklySchedule, setWeeklySchedule] = useState(() =>
    cloneWeeklySchedule(EMPTY_WEEKLY_SCHEDULE),
  );
  const [scheduleDraft, setScheduleDraft] = useState(() =>
    cloneWeeklySchedule(EMPTY_WEEKLY_SCHEDULE),
  );
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState(null);

  const [selectedImage, setSelectedImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);

  const fieldValues = {
    residenceLocation,
    dropoffLocation,
  };

  const scheduleEntryCount = Object.values(weeklySchedule).filter(
    (entry) => entry?.enabled && entry?.start_time && entry?.end_time,
  ).length;
  const selectedImageLabel = selectedImage?.name || selectedImage?.uri || "";

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

    if (activeField === "residenceLocation") {
      setResidenceLocation(value);
    } else if (activeField === "dropoffLocation") {
      setDropoffLocation(value);
    }

    closeFieldInput();
  }

  function openScheduleInput() {
    setScheduleDraft(cloneWeeklySchedule(weeklySchedule));
    setScheduleError("");
    setScheduleModalVisible(true);
  }

  function closeScheduleInput() {
    setScheduleModalVisible(false);
    setScheduleError("");
    setScheduleDraft(cloneWeeklySchedule(weeklySchedule));
  }

  function saveScheduleInput() {
    for (const day of WEEKDAY_FIELDS) {
      const entry = scheduleDraft[day.key];
      if (!entry?.enabled) continue;
      const startTime = (entry.start_time || "").trim();
      const endTime = (entry.end_time || "").trim();
      if (!startTime || !endTime) {
        setScheduleError(`${day.label}: please select both start and end times.`);
        return;
      }
      if (!isStartBeforeEnd(startTime, endTime)) {
        setScheduleError(`${day.label}: start time must be earlier than end time.`);
        return;
      }
    }

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
    setScheduleError("");
    setWeeklySchedule(cleanedSchedule);
    setScheduleModalVisible(false);
  }

  async function pickRiderImage() {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to upload a rider photo.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const normalizedMime = String(asset.mimeType || "").toLowerCase();
    if (normalizedMime && !ALLOWED_MIME_TYPES.has(normalizedMime)) {
      Alert.alert("Invalid image", "Please choose a JPG, PNG, GIF, or WEBP image.");
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
      Alert.alert("Image too large", "Please choose an image smaller than 5 MB.");
      return;
    }
    const ext = asset?.fileName?.split(".").pop()?.toLowerCase() || "jpg";
    const normalizedExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? ext : "jpg";
    setSelectedImage({
      uri: asset.uri,
      name: asset.fileName || `rider-photo.${normalizedExt}`,
      type: asset.mimeType || `image/${normalizedExt === "jpg" ? "jpeg" : normalizedExt}`,
      file: asset.file || null,
    });
  }

  async function handleContinue() {
    const finalDropoff = sameAsPickup ? residenceLocation.trim() : dropoffLocation.trim();

    if (!residenceLocation.trim() || !finalDropoff) {
      Alert.alert("Missing info", "Please enter both your default pickup and dropoff locations.");
      return;
    }

    if (!BACKEND_URL) {
      Alert.alert(
        "Backend URL missing",
        "Set BACKEND_URL in apps/mobile/.env and restart Expo.",
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
          "Each enabled day must have both start and end times selected.",
        );
        return;
      }
      if (!isStartBeforeEnd(entry.start_time, entry.end_time)) {
        const dayLabel = WEEKDAY_FIELDS.find((d) => d.key === key)?.label || key;
        Alert.alert(
          "Invalid schedule time",
          `${dayLabel}: start time must be earlier than end time.`,
        );
        return;
      }
      daysPayload[key] = {
        start_time: entry.start_time,
        end_time: entry.end_time,
      };
    }

    if (submitInFlightRef.current) return;
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
      formData.append("pickup_loc", residenceLocation.trim());
      formData.append("dropoff_loc", finalDropoff);
      formData.append("days", JSON.stringify(daysPayload));

      if (selectedImage?.uri) {
        if (selectedImage.type && !ALLOWED_MIME_TYPES.has(String(selectedImage.type).toLowerCase())) {
          Alert.alert("Invalid image", "Please choose a JPG, PNG, GIF, or WEBP image.");
          return;
        }
        if (Platform.OS === "web") {
          const webFile = selectedImage.file;
          if (webFile) {
            formData.append("picture", webFile);
          } else {
            Alert.alert("Upload error", "Could not read the selected image file.");
            return;
          }
        } else {
          formData.append("picture", {
            uri: selectedImage.uri,
            name: selectedImage.name || "rider-photo.jpg",
            type: selectedImage.type || "image/jpeg",
          });
        }
      }

      const response = await fetch(`${normalizedBackendUrl}/api/rider`, {
        method: "POST",
        body: formData,
      });

      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage = responseBody?.error || responseBody?.details || "Failed to register rider profile.";
        Alert.alert("Registration failed", String(errorMessage));
        return;
      }

      const updated = {
        ...parsed,
        riderSetupComplete: true,
      };

      await AsyncStorage.setItem("@user", JSON.stringify(updated));
      finishedOk = true;
      router.replace("/rider/RiderHome");
    } catch {
      Alert.alert("Error", "Could not save rider info. Try again.");
    } finally {
      submitInFlightRef.current = false;
      if (!finishedOk) {
        setSubmitting(false);
      }
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="car" size={32} color="#1a3a6b" />
        </View>
        <Text style={styles.title}>Rider Setup</Text>
        <Text style={styles.subtitle}>
          {"Let's set your default locations and schedule to get you riding faster."}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.fieldButton}
        onPress={() => openFieldInput("residenceLocation")}
        activeOpacity={0.7}
      >
        <Ionicons name="home" size={24} color="#1a3a6b" style={styles.fieldIcon} />
        <View style={styles.fieldTextContainer}>
          <Text style={styles.fieldLabel}>{FIELD_CONFIG.residenceLocation.label}</Text>
          <Text
            style={[styles.fieldValue, !residenceLocation && styles.fieldPlaceholder]}
          >
            {residenceLocation || FIELD_CONFIG.residenceLocation.placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </TouchableOpacity>

      <View style={styles.switchRowContainer}>
        <View style={styles.switchRowText}>
          <Ionicons name="git-compare" size={20} color="#4b5563" style={styles.switchIcon} />
          <Text style={styles.switchRowLabel}>Default dropoff is same as pickup</Text>
        </View>
        <Switch
          value={sameAsPickup}
          onValueChange={(val) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setSameAsPickup(val);
          }}
          trackColor={{ false: "#d1d5db", true: "#bfdbfe" }}
          thumbColor={sameAsPickup ? "#1a3a6b" : "#f3f4f6"}
        />
      </View>

      {!sameAsPickup && (
        <TouchableOpacity
          style={styles.fieldButton}
          onPress={() => openFieldInput("dropoffLocation")}
          activeOpacity={0.7}
        >
          <Ionicons name="business" size={24} color="#1a3a6b" style={styles.fieldIcon} />
          <View style={styles.fieldTextContainer}>
            <Text style={styles.fieldLabel}>{FIELD_CONFIG.dropoffLocation.label}</Text>
            <Text
              style={[styles.fieldValue, !dropoffLocation && styles.fieldPlaceholder]}
            >
              {dropoffLocation || FIELD_CONFIG.dropoffLocation.placeholder}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.fieldButton}
        onPress={openScheduleInput}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={24} color="#1a3a6b" style={styles.fieldIcon} />
        <View style={styles.fieldTextContainer}>
          <Text style={styles.fieldLabel}>Weekly Class Schedule (Optional)</Text>
          <Text
            style={[
              styles.fieldValue,
              scheduleEntryCount === 0 && styles.fieldPlaceholder,
            ]}
          >
            {scheduleEntryCount > 0
              ? `${scheduleEntryCount} weekday entries added`
              : "Tap to add your semester schedule"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fieldButton}
        onPress={pickRiderImage}
        activeOpacity={0.7}
      >
        <Ionicons name="person-circle-outline" size={24} color="#1a3a6b" style={styles.fieldIcon} />
        <View style={styles.fieldTextContainer}>
          <Text style={styles.fieldLabel}>Profile Photo (Optional)</Text>
          <Text
            style={[
              styles.fieldValue,
              !selectedImageLabel && styles.fieldPlaceholder,
            ]}
          >
            {selectedImageLabel || "Tap to choose a photo"}
          </Text>
          {selectedImage?.uri ? (
            <View style={styles.photoPreviewRow}>
              <Image source={{ uri: selectedImage.uri }} style={styles.photoPreview} />
              <TouchableOpacity
                onPress={() => setSelectedImage(null)}
                activeOpacity={0.8}
                style={styles.removePhotoButton}
              >
                <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                <Text style={styles.removePhotoText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        {!selectedImage?.uri && <Ionicons name="chevron-forward" size={20} color="#9ca3af" />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Finish Setup</Text>
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
            <TextInput
              style={styles.modalInput}
              value={draftValue}
              onChangeText={setDraftValue}
              autoFocus
              placeholder={activeField ? FIELD_CONFIG[activeField].placeholder : ""}
              keyboardType={activeField ? FIELD_CONFIG[activeField].keyboardType : "default"}
              returnKeyType="done"
              onSubmitEditing={saveFieldInput}
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
              Select start/end class times for each day you need rides.
            </Text>
            {scheduleError ? (
              <Text style={styles.scheduleErrorText}>{scheduleError}</Text>
            ) : null}
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

      {/* Time Picker Modal inside the Schedule Modal */}
      <Modal
        visible={timePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <View style={styles.timePickerOverlay}>
          <View style={styles.timePickerCard}>
            <Text style={styles.timePickerTitle}>Select Time</Text>
            <ScrollView style={styles.timePickerList}>
              {["", ...TIME_OPTIONS].map((opt) => (
                <TouchableOpacity
                  key={opt || "clear"}
                  style={styles.timeOptionButton}
                  onPress={() => selectTimeValue(opt)}
                >
                  <Text style={styles.timeOptionText}>
                    {opt ? formatTime12h(opt) : "Clear"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.timePickerClose}
              onPress={() => setTimePickerVisible(false)}
            >
              <Text style={styles.timePickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// Trigger Metro bundler hot reload
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  contentContainer: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  header: { marginBottom: 32 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#e0e7ff", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 32, fontWeight: "800", color: "#111827", marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: "#6b7280", lineHeight: 22 },
  fieldButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    paddingVertical: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  fieldIcon: { marginRight: 16, backgroundColor: "#f3f4f6", padding: 10, borderRadius: 12, overflow: "hidden" },
  fieldTextContainer: { flex: 1 },
  fieldLabel: { fontSize: 12, color: "#9ca3af", fontWeight: "700", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  fieldValue: { fontSize: 16, color: "#1f2937", fontWeight: "600" },
  fieldPlaceholder: { color: "#9ca3af", fontWeight: "400" },
  switchRowContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  switchRowText: { flexDirection: "row", alignItems: "center" },
  switchIcon: { marginRight: 10 },
  switchRowLabel: { fontSize: 15, fontWeight: "600", color: "#374151" },
  photoPreviewRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  photoPreview: { width: 48, height: 48, borderRadius: 24, marginRight: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  removePhotoButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#fee2e2", borderRadius: 8 },
  removePhotoText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
  button: {
    backgroundColor: "#1a3a6b",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#1a3a6b",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#ffffff", fontSize: 18, fontWeight: "700", letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { width: "100%", backgroundColor: "#ffffff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  scheduleModalCard: { width: "100%", maxHeight: "85%", backgroundColor: "#ffffff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#1f2937", marginBottom: 16 },
  scheduleSubtitle: { fontSize: 14, color: "#4b5563", marginBottom: 16 },
  scheduleErrorText: { color: "#b45309", fontSize: 14, marginBottom: 12, fontWeight: "500", backgroundColor: "#fef3c7", padding: 10, borderRadius: 8 },
  modalInput: { backgroundColor: "#f3f4f6", borderRadius: 10, padding: 16, fontSize: 18, color: "#1f2937", marginBottom: 24 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  cancelButton: { backgroundColor: "#f3f4f6" },
  cancelButtonText: { color: "#4b5563", fontSize: 16, fontWeight: "600" },
  saveButton: { backgroundColor: "#1a3a6b" },
  saveButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  scheduleList: { flexGrow: 0, marginBottom: 20 },
  scheduleListContent: { gap: 16 },
  scheduleRow: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  dayHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  scheduleDay: { fontSize: 16, fontWeight: "600", color: "#1f2937" },
  timeRow: { flexDirection: "row", gap: 12 },
  timeButton: { flex: 1, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 12 },
  timeButtonDisabled: { backgroundColor: "#f3f4f6", borderColor: "#e5e7eb" },
  timeButtonLabel: { fontSize: 12, color: "#6b7280", fontWeight: "600", textTransform: "uppercase", marginBottom: 4 },
  timeButtonValue: { fontSize: 15, color: "#1f2937", fontWeight: "500" },
  timePickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  timePickerCard: { backgroundColor: "#ffffff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "50%", padding: 20 },
  timePickerTitle: { fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 16, color: "#1f2937" },
  timePickerList: { flex: 1 },
  timeOptionButton: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", alignItems: "center" },
  timeOptionText: { fontSize: 18, color: "#1a3a6b", fontWeight: "500" },
  timePickerClose: { marginTop: 16, paddingVertical: 16, alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 12 },
  timePickerCloseText: { fontSize: 16, fontWeight: "600", color: "#4b5563" },
});
