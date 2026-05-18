const base = require("./app.json").expo;

module.exports = {
  expo: {
    ...base,
    android: {
      ...base.android,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
        },
      },
    },
  },
};
