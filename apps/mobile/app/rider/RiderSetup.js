import React, { useState } from 'react';
import { View, TextInput, Alert, Platform, TouchableOpacity, Text } from 'react-native';
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
  { eyebrow: 'Step 1 • Origin', question: 'Where are you riding from?', hint: 'This usually is your residence hall or off-campus home.' },
  { eyebrow: 'Step 2 • Destination', question: 'Where are you heading to?', hint: 'This is usually your default campus drop-off spot.' },
  { eyebrow: 'Step 3 • Schedule', question: 'When do you usually ride?', hint: 'Add some typical times you head to campus.' },
  { eyebrow: 'Step 4 • Profile', question: 'Put a face to the name.', hint: 'Drivers feel safer when they can see their rider.' },
];
const CTA_LABELS = ['Next Step', 'Next Step', 'Next Step', 'Finish Setup'];

export default function RiderSetup() {
  const router = useRouter();
  const { pickup: landingPickup, destination: landingDestination } = useLocalSearchParams();

  const [step, setStep] = useState(0);

  const [pickup, setPickup] = useState(landingPickup || '');
  const [dropoff, setDropoff] = useState(landingDestination || '');
  const [isSameAsPickup, setIsSameAsPickup] = useState(false);

  const [classBlocks, setClassBlocks] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [selectedImageData, setSelectedImageData] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const canAdvance = () => {
    if (step === 0) return pickup.trim().length > 0;
    if (step === 1) return (isSameAsPickup && pickup.trim().length > 0) || dropoff.trim().length > 0;
    if (step === 2) return true; // Class schedule is optional
    if (step === 3) return true; // Photo optional
    return true;
  };

  const submitRiderProfile = async () => {
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
      formData.append("pickup_loc", pickup.trim());
      formData.append("dropoff_loc", isSameAsPickup ? pickup.trim() : dropoff.trim());
      formData.append("is_rider", "true");

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

      const response = await fetch(`${normalizedBackendUrl}/api/rider`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || err.details || "Registration failed");
      }

      const updated = { ...parsed, riderSetupComplete: true };
      await AsyncStorage.setItem("@user", JSON.stringify(updated));

      setIsSuccess(true);
      setTimeout(() => {
        router.replace("/rider/RiderHome");
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
      submitRiderProfile();
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
      onSkipSetup={() => router.replace("/rider/RiderHome")}
      onSkipStep={step === 0 ? null : () => (step < 3 ? setStep(step + 1) : submitRiderProfile())}
      onNext={handleNext}
    >
      {/* ── Step 0: Pickup ── */}
      {step === 0 && (
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

      {/* ── Step 1: Dropoff ── */}
      {step === 1 && (
        <View style={{ gap: 12 }}>
          <View style={s.inputWrapper}>
            <View style={s.inputIcon}>
              <SquareIcon size={20} color="#0F172A" />
            </View>
            <TextInput
              autoFocus
              style={[s.textInput, isSameAsPickup && s.textInputDisabled]}
              value={isSameAsPickup ? pickup : dropoff}
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

      {/* ── Step 2: Schedule ── */}
      {step === 2 && (
        <ScheduleManager blocks={classBlocks} setBlocks={setClassBlocks} />
      )}

      {/* ── Step 3: Photo ── */}
      {step === 3 && (
        <PhotoPicker photo={photo} setPhoto={setPhoto} setSelectedImageData={setSelectedImageData} />
      )}
    </SetupLayout>
  );
}
