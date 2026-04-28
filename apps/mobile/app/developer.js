import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function DeveloperMenu() {
  const router = useRouter();

  return (
    <View style={styles.outer}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.closeButton}
      >
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Developer Options</Text>
        <Text style={styles.subtitle}>Test individual screens and flows</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rider Flows</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/rider/RiderSetup")}>
            <Text style={styles.buttonText}>Rider Setup</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/rider/RiderHome")}>
            <Text style={styles.buttonText}>Rider Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/rider/RiderWaitingRoom")}>
            <Text style={styles.buttonText}>Rider Waiting Room</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/rider/AvailableDrivers")}>
            <Text style={styles.buttonText}>Available Drivers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/rider/ScheduledRidesRider")}>
            <Text style={styles.buttonText}>Scheduled Rides (Rider)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Flows</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/driver/DriverSetup")}>
            <Text style={styles.buttonText}>Driver Setup</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/driver/DriverHome")}>
            <Text style={styles.buttonText}>Driver Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/driver/DriverWaitingRoom")}>
            <Text style={styles.buttonText}>Driver Waiting Room</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/driver/AvailableRiders")}>
            <Text style={styles.buttonText}>Available Riders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/driver/ScheduledRidesDriver")}>
            <Text style={styles.buttonText}>Scheduled Rides (Driver)</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Auth Flows</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/?preview=true")}>
            <Text style={styles.buttonText}>Landing Page (Home)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/About")}>
            <Text style={styles.buttonText}>About Page</Text>
          </TouchableOpacity>
           <TouchableOpacity style={styles.button} onPress={() => router.push("/role")}>
            <Text style={styles.buttonText}>Role Selection Page</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payments</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/payments/demo")}>
            <Text style={styles.buttonText}>Stripe Demo Checkout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingTop: 56,
    paddingHorizontal: 24,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  closeText: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "600",
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    marginBottom: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#3B82F6",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonText: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
  },
});
