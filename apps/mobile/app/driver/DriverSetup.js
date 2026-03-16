import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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

const EMPTY_WEEKLY_SCHEDULE = {
  monday: { time: "", building: "" },
  tuesday: { time: "", building: "" },
  wednesday: { time: "", building: "" },
  thursday: { time: "", building: "" },
  friday: { time: "", building: "" },
};

const WEEKDAY_FIELDS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
];

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
    (entry) => entry?.time || entry?.building,
  ).length;

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

    const value = draftValue.trim();

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
      Object.entries(scheduleDraft).map(([day, entry]) => [
        day,
        {
          time: (entry?.time || "").trim(),
          building: (entry?.building || "").trim(),
        },
      ]),
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

    try {
      const stored = await AsyncStorage.getItem("@user");

      if (!stored) {
        Alert.alert("Session missing", "Please sign in again.");
        router.replace("/signup");
        return;
      }

      const parsed = JSON.parse(stored);

      const updated = {
        ...parsed,
        driverProfile: {
          carModel,
          carDetails,
          licensePlate,
          seatsAvailable,
          residenceLocation,
          weeklySchedule,
        },
      };

      await AsyncStorage.setItem("@user", JSON.stringify(updated));
      router.replace("/driver/OfferRide");
    } catch {
      Alert.alert("Error", "Could not save driver info. Try again.");
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
        style={styles.button}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Continue</Text>
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
              Add your semester availability or class conflicts by weekday.
            </Text>
            <ScrollView
              style={styles.scheduleList}
              contentContainerStyle={styles.scheduleListContent}
              showsVerticalScrollIndicator={false}
            >
              {WEEKDAY_FIELDS.map((day) => (
                <View key={day.key} style={styles.scheduleRow}>
                  <Text style={styles.scheduleDay}>{day.label}</Text>
                  <Text style={styles.scheduleInputLabel}>Class Time</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={scheduleDraft[day.key]?.time || ""}
                    onChangeText={(value) =>
                      setScheduleDraft((prev) => ({
                        ...prev,
                        [day.key]: {
                          ...(prev[day.key] || {}),
                          time: value,
                        },
                      }))
                    }
                    placeholder="e.g. 9:00 AM - 2:00 PM"
                  />
                  <Text style={styles.scheduleInputLabel}>Class Building</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={scheduleDraft[day.key]?.building || ""}
                    onChangeText={(value) =>
                      setScheduleDraft((prev) => ({
                        ...prev,
                        [day.key]: {
                          ...(prev[day.key] || {}),
                          building: value,
                        },
                      }))
                    }
                    placeholder="e.g. Olin Hall"
                  />
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
});
