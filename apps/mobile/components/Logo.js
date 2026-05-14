import React from 'react';
import { Text } from 'react-native';

const SIZES = {
  lg: { fontSize: 64, letterSpacing: -2 },
  md: { fontSize: 40, letterSpacing: -1.2 },
  sm: { fontSize: 24, letterSpacing: -0.7 },
  xs: { fontSize: 16, letterSpacing: -0.4 },
};

const BRAND = '#3B82F6';
const TEXT = '#0F172A';

export default function Logo({ size = 'md' }) {
  const { fontSize, letterSpacing } = SIZES[size] || SIZES.md;
  return (
    <Text style={{ fontSize, letterSpacing, fontWeight: '800', color: TEXT, lineHeight: fontSize * 1.15 }}>
      <Text style={{ color: BRAND }}>Gus</Text>Lift
    </Text>
  );
}
