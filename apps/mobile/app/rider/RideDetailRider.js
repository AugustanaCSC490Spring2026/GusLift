import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const DAY_LABELS = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

function formatTime12h(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function RideDetailRider() {
  const router = useRouter();
  const { day, start_time, location, driverName, driverPic, carMake, carModel, carColor } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.header}>Ride Details</Text>

      {/* Ride Info */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Day</Text>
          <Text style={styles.value}>{DAY_LABELS[day] ?? day}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>From</Text>
          <Text style={styles.value}>{location || "—"}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>To</Text>
          <Text style={styles.value}>Augustana College</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Pick Up Time</Text>
          <Text style={styles.value}>{formatTime12h(start_time)}</Text>
        </View>
      </View>

      {/* Driver Info */}
      <Text style={styles.sectionHeader}>Your Driver</Text>
      <View style={styles.driverCard}>
        {driverPic ? (
          <Image source={{ uri: driverPic }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {driverName ? driverName[0].toUpperCase() : "?"}
            </Text>
          </View>
        )}

        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{driverName || "—"}</Text>
          {(carMake || carModel) && (
            <Text style={styles.carText}>
              {[carColor, carMake, carModel].filter(Boolean).join(" ")}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f6f1",
    padding: 24,
    paddingTop: 56,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  closeText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
  },
  label: {
    fontSize: 15,
    color: "#6b7280",
    fontWeight: "500",
  },
  value: {
    fontSize: 15,
    color: "#1f2937",
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a3a6b",
  },
  driverInfo: {
    flex: 1,
    gap: 4,
  },
  driverName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2937",
  },
  carText: {
    fontSize: 14,
    color: "#6b7280",
  },
});
