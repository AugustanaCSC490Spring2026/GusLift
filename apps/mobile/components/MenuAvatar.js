import React from "react";
import { View, StyleSheet, Platform, Image } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

export default function MenuAvatar({ size = 44, color = "#3B82F6", uri }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%", borderRadius: size / 2 }} />
      ) : (
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2.5" />
          <Path 
            d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" 
            stroke={color} 
            strokeWidth="2.5" 
            strokeLinecap="round" 
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#EFF6FF", // light blue brand tint
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        cursor: "pointer",
      },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      },
    }),
  },
});
