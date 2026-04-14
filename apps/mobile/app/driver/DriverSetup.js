import React, { useState, useEffect } from 'react';
import { View, TextInput, Alert, Platform, Text } from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";

import SetupLayout from '../../components/setup/SetupLayout';
import ScheduleManager from '../../components/setup/ScheduleManager';
import PhotoPicker from '../../components/setup/PhotoPicker';
import { s } from '../../components/setup/SetupStyles';
import { B, CheckIcon } from '../../components/setup/SetupIcons';
import { CircleIcon, SquareIcon } from '../../components/LocationTimeline';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://172.20.10.4:5000';

const STEPS = [
  { eyebrow: 'Step 1 • Vehicle Info', question: 'What do you drive?', hint: 'Enter your car details to help riders find you.' },
  { eyebrow: 'Step 2 • Origin', question: 'Where are you driving from?', hint: 'This usually is your residence hall or off-campus home.' },
  { eyebrow: 'Step 3 • Destination', question: 'Where are you heading to?', hint: 'This usually is your destination default on campus.' },
  { eyebrow: 'Step 4 • Schedule', question: 'When do you usually drive?', hint: 'Add some typical times you head to campus.' },
  { eyebrow: 'Step 5 • Profile', question: 'Put a face to the name.', hint: 'Riders feel safer when they can see their driver.' },
];
const CTA_LABELS = ['Next Step', 'Next Step', 'Next Step', 'Next Step', 'Finish Setup'];

export default function DriverSetup() {
  const router = useRouter();
  const { pickup: landingPickup, destination: landingDestination } = useLocalSearchParams();

  const [step, setStep] = useState(0);

  // Car State
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carColor, setCarColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [seats, setSeats] = useState('');

  // Location State
  const [pickup, setPickup] = useState(landingPickup || '');
  const [dropoff, setDropoff] = useState(landingDestination || '');
  const [isSameAsPickup, setIsSameAsPickup] = useState(false);
  
  // Shared State
  const [classBlocks, setClassBlocks] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [selectedImageData, setSelectedImageData] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isSameAsPickup && pickup.trim()) setDropoff(pickup);
  }, [isSameAsPickup, pickup]);

  const canAdvance = () => {
    if (step === 0) return carMake.trim() && carModel.trim() && carColor.trim() && licensePlate.trim() && seats.trim();
    if (step === 1) return pickup.trim().length > 0;
    if (step === 2) return (isSameAsPickup && pickup.trim().length > 0) || dropoff.trim().length > 0;
    if (step === 3) return true; // Class schedule is optional
    if (step === 4) return true; // Photo optional
    return true;
  };

  const submitDriverProfile = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const stored = await AsyncStorage.getItem("@user");
      if (!stored) {
        Alert.alert("Session missing", "Please sign in again.");
        router.replace("/signup");
        return;
      }
      const parsed = JSON.parse(stored);
      const userId = String(parsed?.id || "").trim();

      const normalizedBackendUrl = BACKEND_URL?.replace(/\/$/, "");
      const formData = new FormData();
      formData.append("userID", userId);
      formData.append("name", String(parsed?.name || "").trim());
      formData.append("residence", pickup.trim());
      formData.append("make", carMake.trim());
      formData.append("model", carModel.trim());
      formData.append("color", carColor.trim());
      formData.append("license_plate", licensePlate.trim());
      formData.append("capacity", seats.trim());
      formData.append("is_driver", "true");

      const daysPayload = {};
      classBlocks.forEach(block => {
        block.days.forEach(day => {
          const key = day.toLowerCase();
          daysPayload[key] = {
            start_time: block.start,
            end_time: block.end
          };
        });
      });
      formData.append("days", JSON.stringify(daysPayload));

      if (selectedImageData) {
        if (Platform.OS === 'web') {
          formData.append("picture", selectedImageData.file);
        } else {
          formData.append("picture", {
            uri: selectedImageData.uri,
            name: selectedImageData.name,
            type: selectedImageData.type,
          });
        }
      }

      const response = await fetch(`${normalizedBackendUrl}/api/driver`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || err.details || "Registration failed");
      }

      const updated = { ...parsed, driverSetupComplete: true };
      await AsyncStorage.setItem("@user", JSON.stringify(updated));

      setIsSuccess(true);
      setTimeout(() => {
        router.replace("/driver/OfferRide");
      }, 800);
    } catch (err) {
      Alert.alert("Error saving profile", err.message);
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      submitDriverProfile();
    }
  };

  return (
    <SetupLayout
      step={step}
      totalSteps={STEPS.length}
      currentStepData={STEPS[step]}
      canAdvance={canAdvance}
      isSubmitting={isSubmitting}
      isSuccess={isSuccess}
      ctaLabel={CTA_LABELS[step]}
      onBack={() => setStep(step - 1)}
      onSkipSetup={step > 0 ? submitDriverProfile : null}
      onSkipStep={step > 0 ? () => (step < 4 ? setStep(step + 1) : submitDriverProfile()) : null}
      onNext={handleNext}
    >
      {/* ── Step 0: Vehicle Info ── */}
      {step === 0 && (
        <View style={{ gap: 8 }}>
          <View style={s.row}>
            <View style={s.halfField}>
              <Text style={s.fieldLabel}>Make</Text>
              <TextInput
                style={s.smallInput}
                value={carMake}
                onChangeText={setCarMake}
                placeholder="e.g. Toyota"
                placeholderTextColor={B.muted}
              />
            </View>
            <View style={s.halfField}>
              <Text style={s.fieldLabel}>Model</Text>
              <TextInput
                style={s.smallInput}
                value={carModel}
                onChangeText={setCarModel}
                placeholder="e.g. Camry"
                placeholderTextColor={B.muted}
              />
            </View>
          </View>
          <View style={s.row}>
            <View style={s.halfField}>
              <Text style={s.fieldLabel}>Year</Text>
              <TextInput
                style={s.smallInput}
                value={carYear}
                onChangeText={setCarYear}
                placeholder="e.g. 2018"
                keyboardType="numeric"
                placeholderTextColor={B.muted}
              />
            </View>
            <View style={s.halfField}>
              <Text style={s.fieldLabel}>Color</Text>
              <TextInput
                style={s.smallInput}
                value={carColor}
                onChangeText={setCarColor}
                placeholder="e.g. Blue"
                placeholderTextColor={B.muted}
              />
            </View>
          </View>
          <View style={s.row}>
            <View style={s.halfField}>
              <Text style={s.fieldLabel}>License Plate</Text>
              <TextInput
                style={s.smallInput}
                value={licensePlate}
                onChangeText={setLicensePlate}
                placeholder="e.g. ABC 123"
                placeholderTextColor={B.muted}
              />
            </View>
            <View style={s.halfField}>
              <Text style={s.fieldLabel}>Seats Available</Text>
              <TextInput
                style={s.smallInput}
                value={seats}
                onChangeText={(t) => setSeats(t.replace(/\D+/g, ""))}
                placeholder="e.g. 4"
                keyboardType="numeric"
                placeholderTextColor={B.muted}
              />
            </View>
          </View>
        </View>
      )}

      {/* ── Step 1: Default Pickup ── */}
      {step === 1 && (
        <View style={s.inputWrapper}>
          <View style={s.inputIcon}>
            <CircleIcon size={20} color="#0F172A" />
          </View>
          <TextInput
            autoFocus
            style={s.textInput}
            value={pickup}
            onChangeText={setPickup}
            placeholder="e.g. Westerlin"
            placeholderTextColor={B.muted}
          />
        </View>
      )}

      {/* ── Step 2: Default Dropoff ── */}
      {step === 2 && (
        <View style={{ gap: 12 }}>
          <View style={s.inputWrapper}>
            <View style={s.inputIcon}>
              <SquareIcon size={20} color="#0F172A" />
            </View>
            <TextInput
              autoFocus
              style={[s.textInput, isSameAsPickup && s.textInputDisabled]}
              value={dropoff}
              onChangeText={setDropoff}
              placeholder="e.g. Olin Center"
              placeholderTextColor={B.muted}
              editable={!isSameAsPickup}
            />
          </View>
          <TouchableOpacity
            style={s.checkRow}
            onPress={() => setIsSameAsPickup(!isSameAsPickup)}
          >
            <View style={[s.checkbox, isSameAsPickup && s.checkboxChecked]}>
              {isSameAsPickup ? <CheckIcon size={12} color={B.white} strokeWidth={3} /> : null}
            </View>
            <Text style={s.checkLabel}>Same as origin</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Step 3: Schedule ── */}
      {step === 3 && (
        <ScheduleManager blocks={classBlocks} setBlocks={setClassBlocks} />
      )}

      {/* ── Step 4: Photo ── */}
      {step === 4 && (
        <PhotoPicker photo={photo} setPhoto={setPhoto} setSelectedImageData={setSelectedImageData} />
      )}
    </SetupLayout>
  );
}
