import React, { useRef, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import { B } from "./SetupIcons";

const CAMPUS_LOCATIONS = [
  "Andreen Hall",
  "Arbaugh TLA",
  "Brodahl",
  "Carlsson Evald Hall",
  "College Center",
  "Denkmann Memorial",
  "Erickson Hall",
  "Gerber DiningCenter",
  "Hanson Hall of Science",
  "Library",
  "Naeseth",
  "New Hall",
  "Old Main",
  "Olin Center",
  "Seminary Hall",
  "Sorensen Hall",
  "Swanson Commons",
  "Swanson Hall of Geosciences",
  "Wallenberg Hall",
  "Westerlin",
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
  const [isFocused, setIsFocused] = useState(false);
  const suppressBlurRef = useRef(false);

  const filtered =
    value && value.length > 0
      ? CAMPUS_LOCATIONS.filter((loc) =>
          loc.toLowerCase().includes(value.toLowerCase()),
        ).slice(0, 6)
      : [];

  const hasSuggestions = showSuggestions && filtered.length > 0 && editable;

  function selectSuggestion(item) {
    suppressBlurRef.current = true;
    onChangeText(item);
    setShowSuggestions(false);
    setIsFocused(false);
    requestAnimationFrame(() => {
      suppressBlurRef.current = false;
    });
  }

  function handleBlur() {
    setIsFocused(false);
    setTimeout(() => {
      if (!suppressBlurRef.current) {
        setShowSuggestions(false);
      }
    }, 150);
  }

  return (
    <View
      style={[
        styles.wrapper,
        (isFocused || hasSuggestions) && styles.wrapperActive,
      ]}
    >
      <TextInput
        style={style}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setShowSuggestions(true);
        }}
        onFocus={() => {
          setIsFocused(true);
          setShowSuggestions(true);
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        editable={editable}
        autoFocus={autoFocus}
        {...rest}
      />
      {hasSuggestions && (
        <View style={styles.dropdown}>
          {filtered.map((item, idx) => (
            <Pressable
              key={item}
              style={({ pressed }) => [
                styles.suggestion,
                idx === filtered.length - 1 && styles.suggestionLast,
                pressed && styles.suggestionPressed,
              ]}
              onPressIn={
                Platform.OS === "web"
                  ? undefined
                  : () => selectSuggestion(item)
              }
              {...(Platform.OS === "web"
                ? {
                    onMouseDown: (e) => {
                      e.preventDefault();
                      selectSuggestion(item);
                    },
                  }
                : {})}
            >
              <Text style={styles.suggestionText}>{item}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    zIndex: 0,
  },
  wrapperActive: {
    zIndex: 20,
    ...Platform.select({
      android: { elevation: 12 },
    }),
  },
  dropdown: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 4,
    zIndex: 30,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      web: {
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      },
    }),
  },
  suggestion: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  suggestionLast: {
    borderBottomWidth: 0,
  },
  suggestionPressed: {
    backgroundColor: "#F1F5F9",
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: "600",
    color: B.text,
  },
});
