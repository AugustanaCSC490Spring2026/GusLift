// Augustana College campus building coordinates (Rock Island, IL).
// Verified via OpenStreetMap; estimated entries marked with ~.
const CAMPUS_COORDS = {
  "Andreen Hall":              { latitude: 41.5063,    longitude: -90.5486  }, // ~
  "Arbaugh TLA":               { latitude: 41.4993451, longitude: -90.5522353 },
  "Brodahl":                   { latitude: 41.5029225, longitude: -90.5523592 },
  "Carlsson Evald Hall":       { latitude: 41.5051629, longitude: -90.5500737 },
  "College Center":            { latitude: 41.5028,    longitude: -90.5498  }, // ~
  "Denkmann Memorial":         { latitude: 41.5044548, longitude: -90.5506091 },
  "Erickson Hall":             { latitude: 41.4993827, longitude: -90.5548683 },
  "Gerber DiningCenter":       { latitude: 41.5022949, longitude: -90.5504689 },
  "Hanson Hall of Science":    { latitude: 41.5036,    longitude: -90.5463  }, // ~
  "Library":                   { latitude: 41.5022830, longitude: -90.5502395 },
  "Naeseth":                   { latitude: 41.4995214, longitude: -90.5536910 },
  "New Hall":                  { latitude: 41.5010,    longitude: -90.5510  }, // ~
  "Old Main":                  { latitude: 41.5043672, longitude: -90.5496036 },
  "Olin Center":               { latitude: 41.5031066, longitude: -90.5506731 },
  "Seminary Hall":             { latitude: 41.5031407, longitude: -90.5483660 },
  "Sorensen Hall":             { latitude: 41.5051918, longitude: -90.5472462 },
  "Swanson Commons":           { latitude: 41.5008132, longitude: -90.5484669 },
  "Swanson Hall of Geosciences": { latitude: 41.5030227, longitude: -90.5490387 },
  "Wallenberg Hall":           { latitude: 41.5044853, longitude: -90.5505971 },
  "Westerlin":                 { latitude: 41.5003608, longitude: -90.5546330 },
  // Default campus center — used when dropoff is "Augustana College"
  "Augustana College":         { latitude: 41.5033,    longitude: -90.5490  },
};

export function getCoords(locationName) {
  if (!locationName) return null;
  const trimmed = locationName.trim();
  return CAMPUS_COORDS[trimmed] ?? null;
}

export default CAMPUS_COORDS;
