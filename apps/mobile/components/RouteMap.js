import React from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { getCoords } from "../lib/campusCoords";

function buildLeafletHTML(markers) {
  // Compute map center and zoom from the bounding box of all markers
  const lats = markers.map((m) => m.lat);
  const lngs = markers.map((m) => m.lng);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  const markerJS = markers
    .map(
      (m) =>
        `L.marker([${m.lat}, ${m.lng}], {icon: makeIcon("${m.color}")})` +
        `.addTo(map).bindPopup(${JSON.stringify(m.label)});`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map("map", { zoomControl: true, attributionControl: false })
    .setView([${centerLat}, ${centerLng}], 16);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);

  function makeIcon(color) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">'
      + '<path d="M14 0C6.27 0 0 6.27 0 14c0 9.63 14 22 14 22S28 23.63 28 14C28 6.27 21.73 0 14 0z" fill="' + color + '"/>'
      + '<circle cx="14" cy="14" r="6" fill="white"/>'
      + '</svg>';
    return L.divIcon({
      html: svg,
      iconSize: [28, 36],
      iconAnchor: [14, 36],
      popupAnchor: [0, -36],
      className: "",
    });
  }

  ${markerJS}

  // Fit map to show all markers with padding
  var group = L.featureGroup(
    [${markers.map((m) => `L.marker([${m.lat}, ${m.lng}])`).join(",")}]
  );
  map.fitBounds(group.getBounds().pad(0.3));
</script>
</body>
</html>`;
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

  const markers = [];
  if (pickupCoords) {
    markers.push({ lat: pickupCoords.latitude, lng: pickupCoords.longitude, color: "#22C55E", label: `Pickup: ${pickup}` });
  }
  if (dropoffCoords) {
    markers.push({ lat: dropoffCoords.latitude, lng: dropoffCoords.longitude, color: "#EF4444", label: `Drop-off: ${dropoff}` });
  }
  extraMarkers.forEach((m) => {
    const coords = getCoords(m.location);
    if (coords) {
      markers.push({ lat: coords.latitude, lng: coords.longitude, color: m.color ?? "#3B82F6", label: m.label });
    }
  });

  const html = buildLeafletHTML(markers);

  return (
    <View style={[styles.card, { height }]}>
      <WebView
        source={{ html }}
        style={StyleSheet.absoluteFillObject}
        scrollEnabled={false}
        originWhitelist={["*"]}
        javaScriptEnabled
      />
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
