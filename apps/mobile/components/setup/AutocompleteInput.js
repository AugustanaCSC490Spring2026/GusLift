import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { B } from './SetupIcons';

const CAMPUS_LOCATIONS = [
  'Andreen Hall',
  'Arbaugh TLA',
  'Brodahl',
  'Carlsson Evald Hall',
  'College Center',
  'Denkmann Memorial',
  'Erickson Hall',
  'Gerber DiningCenter',
  'Hanson Hall of Science',
  'Library',
  'Naeseth',
  'New Hall',
  'Old Main',
  'Olin Center',
  'Seminary Hall',
  'Sorensen Hall',
  'Swanson Commons',
  'Swanson Hall of Geosciences',
  'Wallenberg Hall',
  'Westerlin',
];

export default function AutocompleteInput({
  value,
  onChangeText,
  placeholder,
  style,
  editable = true,
  autoFocus,
  placeholderTextColor,
  ...rest
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = value && value.length > 0
    ? CAMPUS_LOCATIONS.filter(loc =>
        loc.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 6)
    : [];

  const hasSuggestions = showSuggestions && filtered.length > 0 && editable;

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={style}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        editable={editable}
        autoFocus={autoFocus}
        {...rest}
      />
      {hasSuggestions && (
        <View style={styles.dropdown}>
          {filtered.map((item, idx) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.suggestion,
                idx === filtered.length - 1 && styles.suggestionLast,
              ]}
              onPress={() => {
                onChangeText(item);
                setShowSuggestions(false);
              }}
            >
              <Text style={styles.suggestionText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      },
    }),
  },
  suggestion: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '600',
    color: B.text,
  },
});
