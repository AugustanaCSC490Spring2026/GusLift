import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to GusLift!</Text>
      <Text style={styles.subtitle}>You're signed in.</Text>
      <Link href="/driver/OfferRide" style={styles.link}>Test: Offer a Ride</Link>
      <Link href="/driver/AvailableRiders" style={styles.link}>Test: Available Riders</Link>
      <Link href="/rider/RequestRide" style={styles.link}>Test: Request a Ride</Link>
      <Link href="/rider/AvailableDrivers" style={styles.link}>Test: Available Drivers</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f6f1",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#4b5563",
    textAlign: "center",
  },
  link: {
    marginTop: 20,
    backgroundColor: "#1a3a6b",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    overflow: "hidden",
  },
});