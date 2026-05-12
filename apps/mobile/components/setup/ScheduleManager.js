import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { s } from './SetupStyles';
import { B, CheckIcon, TrashIcon } from './SetupIcons';
import { CircleIcon, SquareIcon, ClockIcon } from '../LocationTimeline';
import AutocompleteInput from './AutocompleteInput';
import TimePickerField from './TimePickerField';

const DAY_SHORT = ['m', 't', 'w', 't', 'f', 's', 's'];
const DAY_LONG = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ScheduleManager({ blocks, setBlocks }) {
  const [tempFrom, setTempFrom] = useState('');
  const [tempTo, setTempTo] = useState('');
  const [tempDays, setTempDays] = useState([]);
  const [startTime24, setStartTime24] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [timeError, setTimeError] = useState('');

  function toMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  const handleStartChange = (val) => {
    setStartTime24(val);
    if (val && endTime && toMinutes(val) >= toMinutes(endTime)) {
      setTimeError('Start time must be before end time.');
    } else {
      setTimeError('');
    }
  };

  const handleEndChange = (val) => {
    setEndTime(val);
    if (startTime24 && val && toMinutes(startTime24) >= toMinutes(val)) {
      setTimeError('End time must be after start time.');
    } else {
      setTimeError('');
    }
  };

  const addBlock = () => {
    if (!tempFrom || !tempTo || tempDays.length === 0 || (!isAllDay && !startTime24) || (!isAllDay && !endTime) || timeError) return;
    const block = {
      id: Math.random().toString(36).substr(2, 9),
      from: tempFrom,
      to: tempTo,
      days: [...tempDays],
      start: isAllDay ? 'All Day' : startTime24,
      end: isAllDay ? '' : endTime,
      recurrence: 'Weekly',
    };
    setBlocks((prev) => [...prev, block]);
    
    // Reset form inputs after adding
    setTempFrom('');
    setTempTo('');
    setTempDays([]);
    setStartTime24('');
    setEndTime('');
    setTimeError('');
  };

  return (
    <View style={{ gap: 24 }}>
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
            <View style={s.halfField}>
              <View style={s.inlineLabelRow}>
                <ClockIcon size={12} color="#0F172A" />
                <Text style={s.fieldLabel}>Start (24H)</Text>
              </View>
              <TimePickerField
                value={startTime24}
                onChange={handleStartChange}
                placeholder="e.g. 14:00"
                disabled={isAllDay}
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
                placeholder="e.g. 15:15"
                disabled={isAllDay}
              />
            </View>
          </View>
        </View>

        {timeError ? (
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#EF4444', marginTop: -8 }}>
            {timeError}
          </Text>
        ) : null}

        {/* All day toggle */}
        <TouchableOpacity
          style={s.checkRow}
          onPress={() => {
            setIsAllDay(!isAllDay);
            setTimeError('');
          }}
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
            (!tempFrom || !tempTo || tempDays.length === 0 || (!isAllDay && !startTime24) || (!isAllDay && !endTime) || !!timeError) && s.addBtnDisabled,
          ]}
          onPress={addBlock}
          disabled={!tempFrom || !tempTo || tempDays.length === 0 || (!isAllDay && !startTime24) || (!isAllDay && !endTime) || !!timeError}
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
        {blocks.length === 0 ? (
          <Text style={s.emptyText}>No periods scheduled yet.</Text>
        ) : (
          blocks.map((block) => (
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
                  setBlocks((prev) => prev.filter((b) => b.id !== block.id))
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
  );
}
