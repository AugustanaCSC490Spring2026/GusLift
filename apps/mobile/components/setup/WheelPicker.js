import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { B } from './SetupIcons';

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const isWeb = Platform.OS === 'web';

export default function WheelPicker({ data, initialIndex = 0, onChange }) {
  const scrollRef = useRef(null);
  const scrollTimer = useRef(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  // Two empty strings at each end let the first/last real item center in the viewport
  const paddedData = ['', '', ...data, '', ''];

  const scrollToIndex = (index) => {
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
  };

  // Native: fires after momentum/drag ends — position is already snapped
  const handleNativeScrollEnd = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(data.length - 1, index));
    setActiveIndex(clamped);
    onChange(clamped);
  };

  // Web: CSS scroll-snap handles physical snapping; we debounce to read the settled position
  const handleWebScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(data.length - 1, index));

    // Update highlight in real time
    setActiveIndex(clamped);

    // Notify parent only once scrolling settles
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => onChange(clamped), 120);
  };

  return (
    <View style={styles.outer}>
      <View style={styles.highlight} />

      <ScrollView
        ref={scrollRef}
        onLayout={() => scrollToIndex(initialIndex)}
        // Native scroll handling
        onMomentumScrollEnd={!isWeb ? handleNativeScrollEnd : undefined}
        onScrollEndDrag={!isWeb ? handleNativeScrollEnd : undefined}
        snapToInterval={!isWeb ? ITEM_HEIGHT : undefined}
        decelerationRate={!isWeb ? 'fast' : undefined}
        // Web scroll handling — CSS snap via style, debounced onScroll
        onScroll={isWeb ? handleWebScroll : undefined}
        scrollEventThrottle={isWeb ? 16 : undefined}
        showsVerticalScrollIndicator={false}
        style={[styles.scroll, isWeb && styles.scrollWeb]}
      >
        {paddedData.map((item, i) => {
          const realIndex = i - 2;
          const isActive = realIndex === activeIndex;
          const isNear = Math.abs(realIndex - activeIndex) === 1;
          return (
            <View
              key={i}
              style={[styles.item, isWeb && styles.itemWeb]}
            >
              <Text
                style={[
                  styles.text,
                  isActive ? styles.textActive : isNear ? styles.textNear : styles.textFar,
                ]}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.fadeTop} pointerEvents="none" />
      <View style={styles.fadeBottom} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 8,
    zIndex: 0,
  },
  scroll: {
    zIndex: 1,
  },
  // CSS scroll-snap for web — RN Web passes these through to the DOM element
  scrollWeb: {
    scrollSnapType: 'y mandatory',
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemWeb: {
    scrollSnapAlign: 'center',
  },
  text: {
    fontSize: 14,
    color: B.text,
  },
  textActive: {
    fontSize: 18,
    fontWeight: '700',
    color: B.blue,
  },
  textNear: {
    fontSize: 15,
    fontWeight: '600',
    color: B.text,
    opacity: 0.6,
  },
  textFar: {
    color: B.text,
    opacity: 0.25,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 2,
    backgroundColor: 'rgba(255,255,255,0.88)',
    zIndex: 2,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 2,
    backgroundColor: 'rgba(255,255,255,0.88)',
    zIndex: 2,
  },
});
