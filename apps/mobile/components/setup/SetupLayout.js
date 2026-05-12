import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Animated
} from 'react-native';
import { ArrowLeftIcon, CheckIcon, B } from './SetupIcons';
import { s } from './SetupStyles';

export default function SetupLayout({
  step,
  totalSteps,
  currentStepData,
  canAdvance,
  isSubmitting,
  isSuccess,
  ctaLabel,
  onBack,
  onSkipSetup,
  onSkipStep,
  onNext,
  children
}) {
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Animate progress bar native value
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: ((step + 1) / totalSteps) * 100,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [step, totalSteps]);

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
            <TouchableOpacity style={s.backBtn} onPress={onBack}>
              <ArrowLeftIcon size={18} color={B.muted} />
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          {onSkipSetup && (
            <TouchableOpacity onPress={onSkipSetup}>
              <Text style={s.skipSetup}>Skip setup</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Progress ── */}
        <View style={s.progressContainer}>
          <View style={s.progressLabelRow}>
            <Text style={s.progressLabel}>Step {step + 1} of {totalSteps}</Text>
            <Text style={s.progressPercent}>{Math.round(((step + 1) / totalSteps) * 100)}%</Text>
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
            <Text style={s.eyebrow}>{currentStepData.eyebrow}</Text>
            <Text style={s.question}>{currentStepData.question}</Text>
            <Text style={s.hint}>{currentStepData.hint}</Text>
          </View>

          {children}
        </ScrollView>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[
              s.ctaBtn,
              !canAdvance() && s.ctaBtnDisabled,
              isSuccess && s.ctaBtnSuccess,
            ]}
            onPress={onNext}
            disabled={!canAdvance() || isSubmitting || isSuccess}
          >
            {isSubmitting ? (
              <ActivityIndicator color={B.white} size="small" />
            ) : isSuccess ? (
              <CheckIcon size={24} color={B.white} strokeWidth={4} />
            ) : (
              <View style={s.ctaBtnInner}>
                <Text style={[s.ctaBtnText, !canAdvance() && s.ctaBtnTextDisabled]}>
                  {ctaLabel}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {onSkipStep && (
            <TouchableOpacity
              style={s.skipBtn}
              onPress={onSkipStep}
            >
              <Text style={s.skipBtnText}>Skip this step</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
