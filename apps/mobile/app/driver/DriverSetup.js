import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
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
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

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

function isStartBeforeEnd(startTime, endTime) {
  if (!startTime || !endTime) return false;
  // Times are normalized as HH:mm, so lexicographic compare is reliable.
  return String(startTime) < String(endTime);
}

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
  /** Set true after successful API + storage; navigation runs in useEffect (reliable on Expo web static). */
  const [navigateToOfferRide, setNavigateToOfferRide] = useState(false);

  useEffect(() => {
    if (!navigateToOfferRide) return;
    const path = "/driver/OfferRide";
    // Expo web + static export: imperative router.replace often does not update the document URL.
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.location?.origin
    ) {
      window.location.href = new URL(path, window.location.origin).href;
      return;
    }
    router.replace(path);
  }, [navigateToOfferRide, router]);

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
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
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
        setScheduleError(
          `${day.label}: start time must be earlier than end time.`,
        );
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

  async function pickDriverImage() {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to upload a driver photo.",
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
    const normalizedExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
      ? ext
      : "jpg";
    setSelectedImage({
      uri: asset.uri,
      name: asset.fileName || `driver-photo.${normalizedExt}`,
      type: asset.mimeType || `image/${normalizedExt === "jpg" ? "jpeg" : normalizedExt}`,
      file: asset.file || null,
    });
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
      if (!isStartBeforeEnd(entry.start_time, entry.end_time)) {
        const dayLabel =
          WEEKDAY_FIELDS.find((day) => day.key === key)?.label || key;
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
      // eslint-disable-next-line no-console
      console.log("[GusLift] Signup user id:", userId);

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
      if (selectedImage?.uri) {
        if (
          selectedImage.type &&
          !ALLOWED_MIME_TYPES.has(String(selectedImage.type).toLowerCase())
        ) {
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
            name: selectedImage.name || "driver-photo.jpg",
            type: selectedImage.type || "image/jpeg",
          });
        }
      }

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
      // eslint-disable-next-line no-console
      console.log(
        "[GusLift] Signup completed for user id:",
        responseBody?.user_id || userId,
      );

      const updated = {
        ...parsed,
        driverSetupComplete: true,
      };

      try {
        await AsyncStorage.setItem("@user", JSON.stringify(updated));
      } catch (storageErr) {
        // eslint-disable-next-line no-console
        console.warn("[GusLift] AsyncStorage setItem failed:", storageErr);
      }
      // Same destination as Home → "Go to Driver Matching" (OfferRide).
      setNavigateToOfferRide(true);
    } catch {
      Alert.alert("Error", "Could not save driver info. Try again.");
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Setup</Text>
      <Text style={styles.subtitle}>Tell us a little about your vehicle.</Text>

      <TouchableOpacity
        style={styles.fieldButton}
        onPress={() => openFieldInput("carModel")}
        activeOpacity={0.85}
      >
        <Text style={styles.fieldLabel}>{FIELD_CONFIG.carModel.label}</Text>
        <Text style={[styles.fieldValue, !carModel && styles.fieldPlaceholder]}>
          {carModel || FIELD_CONFIG.carModel.placeholder}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fieldButton}
        onPress={() => openFieldInput("licensePlate")}
        activeOpacity={0.85}
      >
        <Text style={styles.fieldLabel}>{FIELD_CONFIG.licensePlate.label}</Text>
        <Text
          style={[styles.fieldValue, !licensePlate && styles.fieldPlaceholder]}
        >
          {licensePlate || FIELD_CONFIG.licensePlate.placeholder}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fieldButton}
        onPress={() => openFieldInput("seatsAvailable")}
        activeOpacity={0.85}
      >
        <Text style={styles.fieldLabel}>
          {FIELD_CONFIG.seatsAvailable.label}
        </Text>
        <Text
          style={[
            styles.fieldValue,
            !seatsAvailable && styles.fieldPlaceholder,
          ]}
        >
          {seatsAvailable || FIELD_CONFIG.seatsAvailable.placeholder}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fieldButton}
        onPress={() => openFieldInput("residenceLocation")}
        activeOpacity={0.85}
      >
        <Text style={styles.fieldLabel}>
          {FIELD_CONFIG.residenceLocation.label}
        </Text>
        <Text
          style={[
            styles.fieldValue,
            !residenceLocation && styles.fieldPlaceholder,
          ]}
        >
          {residenceLocation || FIELD_CONFIG.residenceLocation.placeholder}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fieldButton}
        onPress={openScheduleInput}
        activeOpacity={0.85}
      >
        <Text style={styles.fieldLabel}>Weekly Schedule</Text>
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
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fieldButton}
        onPress={pickDriverImage}
        activeOpacity={0.85}
      >
        <Text style={styles.fieldLabel}>Driver Photo (Optional)</Text>
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
              <Text style={styles.removePhotoText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
          <Text style={styles.buttonText}>Continue</Text>
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
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 24,
  },
  fieldButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1f2937",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 16,
    color: "#111827",
  },
  fieldPlaceholder: {
    color: "#6b7280",
  },
  button: {
    backgroundColor: "#1a3a6b",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
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
  scheduleErrorText: {
    fontSize: 13,
    color: "#b91c1c",
    fontWeight: "600",
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
  photoPreviewRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  photoPreview: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  removePhotoButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
  removePhotoText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
});
