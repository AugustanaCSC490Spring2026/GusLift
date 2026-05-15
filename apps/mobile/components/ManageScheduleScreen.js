import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { B, ArrowLeftIcon } from './setup/SetupIcons';
import { s } from './setup/SetupStyles';
import { CircleIcon, SquareIcon } from './LocationTimeline';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://172.20.10.4:5000';

const DAY_NAME_MAP = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ManageScheduleScreen({ role }) {
  const router = useRouter();

  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState(null);

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
        }));
        setBlocks(loaded);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSchedule = () => {
    if (role === 'rider') {
      const pickup = encodeURIComponent(scheduleData?.pickup_loc || scheduleData?.from || '');
      const destination = encodeURIComponent(scheduleData?.dropoff_loc || '');
      router.push(`/rider/RiderSetup?editSchedule=true&pickup=${pickup}&destination=${destination}`);
    } else {
      router.push('/driver/DriverSetup?editSchedule=true');
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
      <View style={ms.header}>
        <TouchableOpacity onPress={() => router.back()} style={ms.headerBtn}>
          <ArrowLeftIcon size={20} color={B.text} />
        </TouchableOpacity>
        <Text style={ms.headerTitle}>My Schedule</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={ms.content}>
        <View style={ms.sectionRow}>
          <View style={ms.sectionLeft}>
            <Text style={s.sectionLabel}>Active Week</Text>
            <View style={ms.dividerLine} />
          </View>
          <TouchableOpacity style={ms.editBtn} onPress={handleEditSchedule}>
            <Text style={ms.editBtnText}>Edit Schedule</Text>
          </TouchableOpacity>
        </View>

        {blocks.length === 0 ? (
          <View style={ms.emptyState}>
            <Text style={ms.emptyTitle}>No schedule set up yet</Text>
            <Text style={ms.emptyHint}>Tap Edit Schedule to configure your commute times.</Text>
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 16 }}>
            {blocks.map((block) => (
              <View key={block.id} style={ms.blockCard}>
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
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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

  editBtn: {
    backgroundColor: B.blue,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: B.white },

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
});
