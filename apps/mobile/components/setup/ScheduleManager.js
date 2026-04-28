import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { s } from './SetupStyles';
import { B, CheckIcon, TrashIcon } from './SetupIcons';
import { CircleIcon, SquareIcon, ClockIcon } from '../LocationTimeline';

const DAY_SHORT = ['m', 't', 'w', 't', 'f', 's', 's'];
const DAY_LONG = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ScheduleManager({ blocks, setBlocks }) {
  const [tempFrom, setTempFrom] = useState('');
  const [tempTo, setTempTo] = useState('');
  const [tempDays, setTempDays] = useState([]);
  const [startTime24, setStartTime24] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);

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
    setBlocks((prev) => [...prev, block]);
    
    // Reset form inputs after adding
    setTempFrom('');
    setTempTo('');
    setTempDays([]);
    setStartTime24('');
    setEndTime('');
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
            (!tempFrom || !tempTo || tempDays.length === 0 || (!isAllDay && !startTime24) || (!isAllDay && !endTime)) && s.addBtnDisabled,
          ]}
          onPress={addBlock}
          disabled={!tempFrom || !tempTo || tempDays.length === 0 || (!isAllDay && !startTime24) || (!isAllDay && !endTime)}
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
