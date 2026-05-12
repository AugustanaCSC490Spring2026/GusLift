import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { B } from './SetupIcons';

function parseTimeToDate(timeStr) {
  const d = new Date();
  if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(12, 0, 0, 0);
  }
  return d;
}

function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function TimePickerField({ value, onChange, placeholder, disabled }) {
  const [show, setShow] = useState(false);
  const dateValue = useMemo(() => parseTimeToDate(value), [value]);

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate) onChange(formatTime(selectedDate));
  };

  if (Platform.OS === 'web') {
    return (
      <input
        type="time"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          backgroundColor: B.slate50,
          border: `1px solid ${B.slate100}`,
          borderRadius: 12,
          padding: '12px 16px',
          height: 48,
          fontSize: 14,
          fontWeight: 700,
          color: value ? B.text : B.muted,
          outline: 'none',
          marginTop: 8,
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      />
    );
  }

  return (
    <View>
      <TouchableOpacity
        style={[styles.field, disabled && styles.disabled]}
        onPress={() => !disabled && setShow(true)}
        activeOpacity={0.6}
        disabled={disabled}
      >
        <Text style={[styles.text, !value && styles.placeholder]}>
          {value || placeholder || 'Select time'}
        </Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && show && (
        <Modal transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.cancelBtn}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.doneBtn}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateValue}
                mode="time"
                is24Hour={true}
                display="spinner"
                onChange={handleChange}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={dateValue}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleChange}
        />
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
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    marginTop: 8,
  },
  disabled: { opacity: 0.4 },
  text: {
    fontSize: 14,
    fontWeight: '700',
    color: B.text,
    textAlign: 'center',
  },
  placeholder: {
    color: B.muted,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cancelBtn: {
    fontSize: 16,
    fontWeight: '600',
    color: B.slate400,
  },
  doneBtn: {
    fontSize: 16,
    fontWeight: '700',
    color: B.blue,
  },
});
