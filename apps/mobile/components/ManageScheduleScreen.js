import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { B, ArrowLeftIcon, TrashIcon } from './setup/SetupIcons';
import { s } from './setup/SetupStyles';
import AutocompleteInput from './setup/AutocompleteInput';
import TimePickerField from './setup/TimePickerField';
import { CircleIcon, SquareIcon, ClockIcon } from './LocationTimeline';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://172.20.10.4:5000';

const DAY_SHORT = ['m', 't', 'w', 't', 'f', 's', 's'];
const DAY_LONG = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEY_MAP = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };
const DAY_NAME_MAP = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

function toMinutes(t) {
  const [h, m] = (t || '').split(':').map(Number);
  return h * 60 + m;
}

// ─── Add / Edit bottom sheet ─────────────────────────────────────────────────

function ScheduleFormModal({ visible, editingBlock, defaultFrom, defaultTo, onClose, onSave }) {
  const [tempFrom, setTempFrom] = useState('');
  const [tempTo, setTempTo] = useState('');
  const [tempDays, setTempDays] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (editingBlock) {
      setTempFrom(editingBlock.from);
      setTempTo(editingBlock.to);
      setTempDays([...editingBlock.days]);
      setStartTime(editingBlock.start || '');
      setEndTime(editingBlock.end || '');
    } else {
      setTempFrom(defaultFrom || '');
      setTempTo(defaultTo || '');
      setTempDays([]);
      setStartTime('');
      setEndTime('');
    }
    setTimeError('');
  }, [visible, editingBlock]);

  const handleStartChange = (val) => {
    setStartTime(val);
    if (val && endTime && toMinutes(val) >= toMinutes(endTime)) {
      setTimeError('Start time must be before end time.');
    } else {
      setTimeError('');
    }
  };

  const handleEndChange = (val) => {
    setEndTime(val);
    if (startTime && val && toMinutes(startTime) >= toMinutes(val)) {
      setTimeError('End time must be after start time.');
    } else {
      setTimeError('');
    }
  };

  const canSubmit = tempFrom && tempTo && tempDays.length > 0 && startTime && endTime && !timeError;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSave({
      id: editingBlock?.id || Math.random().toString(36).substr(2, 9),
      from: tempFrom,
      to: tempTo,
      days: [...tempDays],
      start: startTime,
      end: endTime,
      recurrence: 'Weekly',
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ms.modalOverlay}>
        <View style={ms.modalSheet}>
          <View style={ms.modalHeader}>
            <TouchableOpacity onPress={onClose} style={ms.modalCloseBtn}>
              <Text style={ms.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={ms.modalTitle}>
              {editingBlock ? 'Edit Schedule' : 'Add Schedule'}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.card}>
              {/* From / To */}
              <View style={s.row}>
                <View style={s.halfField}>
                  <View style={s.inlineLabelRow}>
                    <CircleIcon size={12} color="#0F172A" />
                    <Text style={s.fieldLabel}>From</Text>
                  </View>
                  <AutocompleteInput
                    style={[s.fieldInput, s.fieldInputText]}
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
                  <AutocompleteInput
                    style={[s.fieldInput, s.fieldInputText]}
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
                      style={[s.dayBtn, tempDays.includes(d) && s.dayBtnSelected]}
                      onPress={() =>
                        setTempDays((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                        )
                      }
                    >
                      <Text style={[s.dayBtnText, tempDays.includes(d) && s.dayBtnTextSelected]}>
                        {DAY_SHORT[i]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Time */}
              <View style={s.row}>
                <View style={s.halfField}>
                  <View style={s.inlineLabelRow}>
                    <ClockIcon size={12} color="#0F172A" />
                    <Text style={s.fieldLabel}>Start (24H)</Text>
                  </View>
                  <TimePickerField
                    value={startTime}
                    onChange={handleStartChange}
                    placeholder="e.g. 08:00"
                  />
                </View>
                <View style={s.halfField}>
                  <View style={s.inlineLabelRow}>
                    <ClockIcon size={12} color="#0F172A" />
                    <Text style={s.fieldLabel}>End (24H)</Text>
                  </View>
                  <TimePickerField
                    value={endTime}
                    onChange={handleEndChange}
                    placeholder="e.g. 09:00"
                  />
                </View>
              </View>

              {timeError ? (
                <Text style={ms.timeError}>{timeError}</Text>
              ) : null}

              <TouchableOpacity
                style={[s.addBtn, !canSubmit && s.addBtnDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                <Text style={s.addBtnText}>
                  {editingBlock ? 'Update Block' : 'Add to Week'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ManageScheduleScreen({ role }) {
  const router = useRouter();

  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scheduleData, setScheduleData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);

  useEffect(() => { loadSchedule(); }, []);

  const loadSchedule = async () => {
    try {
      const stored = await AsyncStorage.getItem('@user');
      if (!stored) return;
      const { id } = JSON.parse(stored);
      const userId = String(id || '');

      const base = BACKEND_URL.replace(/\/$/, '');
      const res = await fetch(`${base}/api/${role}/schedule?userID=${userId}`);
      if (!res.ok) throw new Error('Failed to load schedule');

      const data = await res.json();
      setScheduleData(data);

      if (data.days && typeof data.days === 'object') {
        // Group days that share the same start/end time into one block
        const groups = {};
        Object.entries(data.days).forEach(([dayKey, val]) => {
          const start_time = val?.start_time || '';
          const end_time = val?.end_time || '';
          const key = `${start_time}|${end_time}`;
          if (!groups[key]) groups[key] = { start_time, end_time, dayKeys: [] };
          groups[key].dayKeys.push(dayKey);
        });

        const loaded = Object.values(groups).map(({ start_time, end_time, dayKeys }) => ({
          id: Math.random().toString(36).substr(2, 9),
          from: data.pickup_loc || data.from || '',
          to: data.dropoff_loc || '',
          days: dayKeys.map((k) => DAY_NAME_MAP[k]).filter(Boolean),
          start: start_time,
          end: end_time,
          recurrence: 'Weekly',
        }));
        setBlocks(loaded);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBlock = (block) => {
    setBlocks((prev) => {
      const exists = prev.some((b) => b.id === block.id);
      return exists ? prev.map((b) => (b.id === block.id ? block : b)) : [...prev, block];
    });
    setShowModal(false);
  };

  const openAdd = () => {
    setEditingBlock(null);
    setShowModal(true);
  };

  const openEdit = (block) => {
    setEditingBlock(block);
    setShowModal(true);
  };

  const deleteBlock = (id) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const stored = await AsyncStorage.getItem('@user');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const userId = String(parsed?.id || '');

      const base = BACKEND_URL.replace(/\/$/, '');
      const formData = new FormData();
      formData.append('userID', userId);

      const daysPayload = {};
      blocks.forEach((block) => {
        block.days.forEach((day) => {
          const key = DAY_KEY_MAP[day] || day.toLowerCase();
          daysPayload[key] = { start_time: block.start, end_time: block.end };
        });
      });
      formData.append('days', JSON.stringify(daysPayload));

      if (role === 'rider') {
        const pickup = scheduleData?.pickup_loc || scheduleData?.from || '';
        const dropoff = scheduleData?.dropoff_loc || pickup; // fallback to pickup if no separate dropoff
        formData.append('name', String(parsed?.name || ''));
        formData.append('residence', scheduleData?.residence || pickup);
        formData.append('pickup_loc', pickup);
        formData.append('dropoff_loc', dropoff);
        formData.append('is_rider', 'true');
      } else {
        formData.append('is_driver', 'true');
      }

      const res = await fetch(`${base}/api/${role}`, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save schedule');
      }

      router.back();
    } catch (err) {
      Alert.alert('Error saving schedule', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={ms.safeArea}>
        <ActivityIndicator color={B.blue} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ms.safeArea}>
      {/* Header — no right-side button to avoid GlobalMenu overlap */}
      <View style={ms.header}>
        <TouchableOpacity onPress={() => router.back()} style={ms.headerBtn}>
          <ArrowLeftIcon size={20} color={B.text} />
        </TouchableOpacity>
        <Text style={ms.headerTitle}>My Schedule</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={ms.content}>
        {/* Section row: label + inline Add button */}
        <View style={ms.sectionRow}>
          <View style={ms.sectionLeft}>
            <Text style={s.sectionLabel}>Active Week</Text>
            <View style={ms.dividerLine} />
          </View>
          <TouchableOpacity style={ms.inlineAddBtn} onPress={openAdd}>
            <Text style={ms.inlineAddText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {blocks.length === 0 ? (
          <View style={ms.emptyState}>
            <Text style={ms.emptyTitle}>No schedules yet</Text>
            <Text style={ms.emptyHint}>
              Tap + Add to set up your recurring commute times.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 16 }}>
            {blocks.map((block) => (
              <TouchableOpacity
                key={block.id}
                style={ms.blockCard}
                onPress={() => openEdit(block)}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={ms.blockDays}>{block.days.join(', ')}</Text>
                  <Text style={ms.blockTime}>
                    {block.start}{block.end ? ` – ${block.end}` : ''}
                  </Text>
                  <View style={s.blockRoute}>
                    <View style={s.routeLine} />
                    <View style={s.routeStops}>
                      <View style={s.routeStop}>
                        <View style={s.customDotHolder}>
                          <CircleIcon size={14} color="#0F172A" />
                        </View>
                        <Text style={s.routeLabel}>{block.from || '—'}</Text>
                      </View>
                      <View style={s.routeStop}>
                        <View style={s.customDotHolder}>
                          <SquareIcon size={14} color="#0F172A" />
                        </View>
                        <Text style={s.routeLabel}>{block.to || '—'}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={ms.blockActions}>
                  <View style={ms.editChip}>
                    <Text style={ms.editChipText}>Edit</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteBlock(block.id)}
                    style={s.deleteBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <TrashIcon size={18} color={B.slate300} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={ms.footer}>
        <TouchableOpacity
          style={[ms.saveBtn, saving && { opacity: 0.6 }]}
          onPress={saveSchedule}
          disabled={saving}
        >
          <Text style={ms.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </View>

      <ScheduleFormModal
        visible={showModal}
        editingBlock={editingBlock}
        defaultFrom={scheduleData?.pickup_loc || scheduleData?.from || ''}
        defaultTo={scheduleData?.dropoff_loc || ''}
        onClose={() => setShowModal(false)}
        onSave={handleSaveBlock}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: B.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: B.white,
    borderBottomWidth: 1,
    borderBottomColor: B.slate100,
  },
  headerBtn: { padding: 4, width: 36 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: B.text },

  content: { padding: 24, paddingBottom: 32 },

  // Section row with inline Add button
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: B.slate200 },
  inlineAddBtn: {
    backgroundColor: B.blue,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  inlineAddText: { fontSize: 12, fontWeight: '700', color: B.white },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: B.slate400 },
  emptyHint: {
    fontSize: 13,
    color: B.slate300,
    textAlign: 'center',
    maxWidth: 240,
  },

  blockCard: {
    backgroundColor: B.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: B.slate200,
    flexDirection: 'row',
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
  blockActions: { alignItems: 'flex-end', gap: 10 },
  editChip: {
    backgroundColor: B.blueLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  editChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: B.blue,
  },

  footer: {
    padding: 24,
    backgroundColor: B.white,
    borderTopWidth: 1,
    borderTopColor: B.slate100,
  },
  saveBtn: {
    backgroundColor: B.blue,
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: B.white },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: B.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: B.slate100,
    backgroundColor: B.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  modalCloseBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  modalCloseText: { fontSize: 14, fontWeight: '600', color: B.slate400 },
  modalTitle: { fontSize: 15, fontWeight: '700', color: B.text },

  timeError: { fontSize: 13, fontWeight: '600', color: '#EF4444', marginTop: -8 },
});
