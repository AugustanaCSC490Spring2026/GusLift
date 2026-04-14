import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CircleIcon, SquareIcon, ClockIcon } from '../../components/LocationTimeline';
import Svg, { Path, Circle, Rect, Polyline, Line } from 'react-native-svg';

const ArrowLeftIcon = ({ size = 24, color = "#000" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="19" y1="12" x2="5" y2="12" />
    <Polyline points="12 19 5 12 12 5" />
  </Svg>
);

const UserIcon = ({ size = 24, color = "#000" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
  </Svg>
);

const CameraIcon = ({ size = 24, color = "#000" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <Circle cx="12" cy="13" r="4" />
  </Svg>
);

const TrashIcon = ({ size = 24, color = "#000" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="3 6 5 6 21 6" />
    <Path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </Svg>
);

const CheckIcon = ({ size = 24, color = "#000", strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://172.20.10.4:5000';

const B = {
  blue: '#3B82F6',
  blueDark: '#1E40AF',
  blueLight: '#EFF6FF',
  bg: '#F8FAFC',
  text: '#0F172A',
  muted: '#94A3B8',
  border: '#E2E8F0',
  white: '#FFFFFF',
  green: '#10B981',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  red400: '#F87171',
  emerald500: '#10B981',
};

const STEPS = [
  { eyebrow: 'Step 1 • Vehicle Info', question: 'What do you drive?', hint: 'Enter your car details to help riders find you.' },
  { eyebrow: 'Step 2 • Origin', question: 'Where are you driving from?', hint: 'This usually is your residence hall or off-campus home.' },
  { eyebrow: 'Step 3 • Destination', question: 'Where are you heading to?', hint: 'This usually is your destination default on campus.' },
  { eyebrow: 'Step 4 • Schedule', question: 'When do you usually drive?', hint: 'Add some typical times you head to campus.' },
  { eyebrow: 'Step 5 • Profile', question: 'Put a face to the name.', hint: 'Riders feel safer when they can see their driver.' },
];

const CTA_LABELS = ['Next Step', 'Next Step', 'Next Step', 'Next Step', 'Finish Setup'];
const DAY_SHORT = ['m', 't', 'w', 't', 'f', 's', 's'];
const DAY_LONG = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
  
  // Photo State
  const [photo, setPhoto] = useState(null);
  const [selectedImageData, setSelectedImageData] = useState(null);
  
  // Form Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Scheduling State
  const [classBlocks, setClassBlocks] = useState([]);
  const [tempFrom, setTempFrom] = useState('');
  const [tempTo, setTempTo] = useState('');
  const [tempDays, setTempDays] = useState([]);
  const [startTime24, setStartTime24] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);

  const progressAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (step + 1) * 20,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [step]);

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

  const addBlock = () => {
    if (!tempFrom || !tempTo || tempDays.length === 0 || (!isAllDay && !startTime24) || (!isAllDay && !endTime)) return;
    const block = {
      id: Math.random().toString(36).substr(2, 9),
      from: tempFrom,
      to: tempTo,
      days: [...tempDays],
      start: isAllDay ? 'All Day' : startTime24,
      end: isAllDay ? '' : endTime,
      recurrence: 'Weekly',
    };
    setClassBlocks((prev) => [...prev, block]);
    setTempFrom('');
    setTempTo('');
    setTempDays([]);
    setStartTime24('');
    setEndTime('');
  };

  const pickPhotoWrapper = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const ext = result.assets[0].fileName?.split('.').pop()?.toLowerCase() || 'jpg';
      setPhoto(result.assets[0].uri);
      setSelectedImageData({
        uri: result.assets[0].uri,
        name: result.assets[0].fileName || `driver.${ext}`,
        type: result.assets[0].mimeType || `image/${ext}`,
        file: result.assets[0].file || null
      });
    }
  };

  const currentStep = STEPS[step];
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={s.safeArea}>
      <KeyboardAvoidingView
        style={s.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          {step > 0 ? (
            <TouchableOpacity style={s.backBtn} onPress={() => setStep(step - 1)}>
              <ArrowLeftIcon size={18} color={B.muted} />
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          {step > 0 && (
            <TouchableOpacity onPress={submitDriverProfile}>
              <Text style={s.skipSetup}>Skip setup</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Progress ── */}
        <View style={s.progressContainer}>
          <View style={s.progressLabelRow}>
            <Text style={s.progressLabel}>Step {step + 1} of 5</Text>
            <Text style={s.progressPercent}>{(step + 1) * 20}%</Text>
          </View>
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth }]} />
          </View>
        </View>

        {/* ── Scrollable content ── */}
        <ScrollView
          style={s.flex1}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step header */}
          <View style={s.stepHeader}>
            <Text style={s.eyebrow}>{currentStep.eyebrow}</Text>
            <Text style={s.question}>{currentStep.question}</Text>
            <Text style={s.hint}>{currentStep.hint}</Text>
          </View>

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
            <View style={{ gap: 24 }}>
              <View style={s.card}>
                {/* From / To */}
                <View style={s.row}>
                  <View style={s.halfField}>
                    <View style={s.inlineLabelRow}>
                      <CircleIcon size={12} color="#0F172A" />
                      <Text style={s.fieldLabel}>From</Text>
                    </View>
                    <TextInput
                      style={s.fieldInput}
                      value={tempFrom}
                      onChangeText={setTempFrom}
                      placeholder="Origin"
                      placeholderTextColor={B.muted}
                    />
                  </View>
                  <View style={s.halfField}>
                    <View style={s.inlineLabelRow}>
                      <SquareIcon size={12} color="#0F172A" />
                      <Text style={s.fieldLabel}>To</Text>
                    </View>
                    <TextInput
                      style={s.fieldInput}
                      value={tempTo}
                      onChangeText={setTempTo}
                      placeholder="Destination"
                      placeholderTextColor={B.muted}
                    />
                  </View>
                </View>

                {/* Days */}
                <View style={{ gap: 8 }}>
                  <Text style={s.fieldLabel}>Days active</Text>
                  <View style={s.daysRow}>
                    {DAY_LONG.map((d, i) => (
                      <TouchableOpacity
                        key={d}
                        style={[
                          s.dayBtn,
                          tempDays.includes(d) && s.dayBtnSelected,
                        ]}
                        onPress={() =>
                          setTempDays((prev) =>
                            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                          )
                        }
                      >
                        <Text
                          style={[
                            s.dayBtnText,
                            tempDays.includes(d) && s.dayBtnTextSelected,
                          ]}
                        >
                          {DAY_SHORT[i]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Duration / Time */}
                <View style={{ gap: 12 }}>
                  <View style={s.row}>
                    <View style={[s.halfField, isAllDay && s.dimmed]}>
                      <View style={s.inlineLabelRow}>
                        <ClockIcon size={12} color="#0F172A" />
                        <Text style={s.fieldLabel}>Start (24H)</Text>
                      </View>
                      <TextInput
                        style={[s.fieldInput, { textAlign: 'center' }]}
                        value={startTime24}
                        onChangeText={setStartTime24}
                        placeholder="e.g. 14:00"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                        editable={!isAllDay}
                      />
                    </View>
                    <View style={[s.halfField, isAllDay && s.dimmed]}>
                      <View style={s.inlineLabelRow}>
                        <ClockIcon size={12} color="#0F172A" />
                        <Text style={s.fieldLabel}>End (24H)</Text>
                      </View>
                      <TextInput
                        style={[s.fieldInput, { textAlign: 'center' }]}
                        value={endTime}
                        onChangeText={setEndTime}
                        placeholder="e.g. 15:15"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                        editable={!isAllDay}
                      />
                    </View>
                  </View>
                </View>

                {/* All day toggle */}
                <TouchableOpacity
                  style={s.checkRow}
                  onPress={() => setIsAllDay(!isAllDay)}
                >
                  <View style={[s.checkbox, isAllDay && s.checkboxChecked]}>
                    {isAllDay ? <CheckIcon size={12} color={B.white} strokeWidth={3} /> : null}
                  </View>
                  <Text style={s.checkLabelUpper}>All day event</Text>
                </TouchableOpacity>

                {/* Add button */}
                <TouchableOpacity
                  style={[
                    s.addBtn,
                    (!tempFrom || !tempTo || tempDays.length === 0 || !startTime24 || !endTime) && s.addBtnDisabled,
                  ]}
                  onPress={addBlock}
                  disabled={!tempFrom || !tempTo || tempDays.length === 0 || !startTime24 || !endTime}
                >
                  <Text style={s.addBtnText}>Add to Week</Text>
                </TouchableOpacity>
              </View>

              {/* Active blocks */}
              <View style={{ gap: 16 }}>
                <View style={s.sectionDivider}>
                  <Text style={s.sectionLabel}>Active Week</Text>
                  <View style={s.dividerLine} />
                </View>
                {classBlocks.length === 0 ? (
                  <Text style={s.emptyText}>No periods scheduled yet.</Text>
                ) : (
                  classBlocks.map((block) => (
                    <View key={block.id} style={s.blockItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.blockDays}>{block.days.join(', ')}</Text>
                        <Text style={s.blockTime}>
                          {block.start} {block.end && `– ${block.end}`}
                        </Text>
                        <View style={s.blockRoute}>
                          <View style={s.routeLine} />
                          <View style={s.routeStops}>
                            <View style={s.routeStop}>
                              <View style={s.customDotHolder}>
                                <CircleIcon size={14} color="#0F172A" />
                              </View>
                              <Text style={s.routeLabel}>{block.from}</Text>
                            </View>
                            <View style={s.routeStop}>
                              <View style={s.customDotHolder}>
                                <SquareIcon size={14} color="#0F172A" />
                              </View>
                              <Text style={s.routeLabel}>{block.to}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          setClassBlocks((prev) => prev.filter((b) => b.id !== block.id))
                        }
                        style={s.deleteBtn}
                      >
                        <TrashIcon size={18} color={B.slate300} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* ── Step 4: Photo ── */}
          {step === 4 && (
            <View style={s.photoSection}>
              <TouchableOpacity style={s.photoCircleWrapper} onPress={pickPhotoWrapper}>
                <View style={[s.photoCircle, photo && { borderStyle: 'solid', borderColor: B.blue }]}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={s.photoImage} />
                  ) : (
                    <UserIcon size={56} color={B.slate200} />
                  )}
                </View>
                <View style={s.cameraBtn}>
                  <CameraIcon size={20} color={B.white} />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[
              s.ctaBtn,
              !canAdvance() && s.ctaBtnDisabled,
              isSuccess && s.ctaBtnSuccess,
            ]}
            onPress={handleNext}
            disabled={!canAdvance() || isSubmitting || isSuccess}
          >
            {isSubmitting ? (
              <ActivityIndicator color={B.white} size="small" />
            ) : isSuccess ? (
              <CheckIcon size={24} color={B.white} strokeWidth={4} />
            ) : (
              <View style={s.ctaBtnInner}>
                <Text style={[s.ctaBtnText, !canAdvance() && s.ctaBtnTextDisabled]}>
                  {CTA_LABELS[step]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {step > 0 && (
            <TouchableOpacity
              style={s.skipBtn}
              onPress={() => (step < 4 ? setStep(step + 1) : submitDriverProfile())}
            >
              <Text style={s.skipBtnText}>Skip this step</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: B.bg },
  flex1: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: 13, fontWeight: '700', color: B.muted },
  skipSetup: { fontSize: 13, fontWeight: '700', color: B.muted },

  // Progress
  progressContainer: { paddingHorizontal: 24, marginTop: 12 },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: { fontSize: 10, fontWeight: '800', color: B.slate300, letterSpacing: 2, textTransform: 'uppercase' },
  progressPercent: { fontSize: 11, fontWeight: '700', color: B.blue },
  progressTrack: {
    height: 4,
    backgroundColor: B.slate100,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: B.blue,
    borderRadius: 2,
  },

  // Content Elements
  stepHeader: { marginBottom: 16, paddingTop: 16 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: B.blue,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  question: {
    fontSize: 24,
    fontWeight: '800',
    color: B.text,
    lineHeight: 32,
  },
  hint: {
    fontSize: 15,
    color: B.slate400,
    marginTop: 12,
    fontWeight: '500',
    lineHeight: 22,
  },

  // Text input
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: B.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: B.slate200,
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'ios' ? 18 : 14,
  },
  inputIcon: { marginRight: 12 },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: B.text,
    outlineStyle: 'none',
  },
  textInputDisabled: { color: B.muted, fontStyle: 'italic' },

  // Checkbox row
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 4 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: B.slate300,
    backgroundColor: B.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: B.blue, borderColor: B.blue },
  checkLabel: { fontSize: 13, fontWeight: '700', color: B.slate400 },
  checkLabelUpper: {
    fontSize: 11,
    fontWeight: '800',
    color: B.slate500,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // Schedule card
  card: {
    backgroundColor: B.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: B.slate200,
    padding: 24,
    gap: 24,
  },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: B.slate400,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 4,
  },
  inlineLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  fieldInput: {
    backgroundColor: B.slate50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: B.slate100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    height: 48,
    outlineStyle: 'none',
    marginTop: 8,
  },
  smallInput: {
    backgroundColor: B.slate50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: B.slate100,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    height: 40,
    outlineStyle: 'none',
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: B.text,
  },
  fieldInputText: { fontSize: 14, fontWeight: '700', color: B.text, outlineStyle: 'none' },

  // Days
  daysRow: { flexDirection: 'row', gap: 4 },
  dayBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: B.slate50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: B.slate100,
  },
  dayBtnSelected: { backgroundColor: B.blue, borderColor: B.blue },
  dayBtnText: { fontSize: 13, fontWeight: '700', color: B.slate400, textTransform: 'uppercase' },
  dayBtnTextSelected: { color: B.white },
  dimmed: { opacity: 0.4 },

  addBtn: {
    backgroundColor: B.slate100,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { fontSize: 14, fontWeight: '700', color: B.text },

  // Active blocks
  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: B.slate400, textTransform: 'uppercase', letterSpacing: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: B.slate200 },
  emptyText: { fontSize: 14, color: B.slate400, fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },
  blockItem: {
    backgroundColor: B.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: B.slate200,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  blockDays: {
    fontSize: 12,
    fontWeight: '800',
    color: B.blue,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  blockTime: { fontSize: 15, fontWeight: '800', color: B.text, marginBottom: 20 },
  blockRoute: { flexDirection: 'row', paddingLeft: 28 },
  routeLine: {
    position: 'absolute',
    left: 1,
    top: 6,
    bottom: 6,
    width: 1,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderColor: B.slate200,
  },
  routeStops: { gap: 16 },
  routeStop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customDotHolder: {
    position: 'absolute',
    left: -33,
    backgroundColor: B.white,
    paddingVertical: 2,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: B.slate600,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  deleteBtn: { padding: 8 },

  // Photo
  photoSection: { alignItems: 'center', paddingVertical: 40 },
  photoCircleWrapper: { position: 'relative' },
  photoCircle: {
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: B.slate200,
    backgroundColor: B.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: { width: '100%', height: '100%', borderRadius: 72 },
  cameraBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: B.blue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: B.bg,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: B.white,
    borderTopWidth: 1,
    borderTopColor: B.slate100,
    alignItems: 'center',
    gap: 4,
  },
  ctaBtn: {
    width: '100%',
    height: 48,
    borderRadius: 22,
    backgroundColor: B.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnDisabled: { backgroundColor: B.slate100 },
  ctaBtnSuccess: { backgroundColor: B.emerald500 },
  ctaBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaBtnText: { fontSize: 15, fontWeight: '700', color: B.white },
  ctaBtnTextDisabled: { color: B.muted },
  skipBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  skipBtnText: { fontSize: 13, fontWeight: '700', color: B.slate400 },
});
