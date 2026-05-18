import React from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { getCoords } from "../lib/campusCoords";

function midpoint(a, b) {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
  };
}

function delta(a, b, padding = 1.6) {
  return {
    latitudeDelta: Math.max(Math.abs(a.latitude - b.latitude) * padding, 0.005),
    longitudeDelta: Math.max(Math.abs(a.longitude - b.longitude) * padding, 0.005),
  };
}

/**
 * Props:
 *   pickup  {string}  — campus location name for green "From" pin
 *   dropoff {string}  — campus location name for red "To" pin
 *   extraMarkers {Array<{label: string, location: string, color?: string}>}
 *   height  {number}  — card height (default 220)
 */
export default function RouteMap({ pickup, dropoff, extraMarkers = [], height = 220 }) {
  const pickupCoords = getCoords(pickup);
  const dropoffCoords = getCoords(dropoff);

  if (!pickupCoords && !dropoffCoords) return null;

  const anchor = pickupCoords ?? dropoffCoords;
  const other = dropoffCoords ?? pickupCoords;
  const center = midpoint(anchor, other);
  const region = { ...center, ...delta(anchor, other) };

  return (
    <View style={[styles.card, { height }]}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        scrollEnabled
        zoomEnabled
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {pickupCoords && (
          <Marker
            coordinate={pickupCoords}
            pinColor="#22C55E"
            title="Pickup"
            description={pickup}
          />
        )}
        {dropoffCoords && (
          <Marker
            coordinate={dropoffCoords}
            pinColor="#EF4444"
            title="Drop-off"
            description={dropoff}
          />
        )}
        {extraMarkers.map((m, i) => {
          const coords = getCoords(m.location);
          if (!coords) return null;
          return (
            <Marker
              key={i}
              coordinate={coords}
              pinColor={m.color ?? "#3B82F6"}
              title={m.label}
              description={m.location}
            />
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "#E2E8F0",
  },
});
