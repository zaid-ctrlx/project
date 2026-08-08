import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RootStackParamList } from "../../App";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome{user?.full_name ? `, ${user.full_name}` : ""}</Text>
      <Text style={styles.subtitle}>{user?.email}</Text>

      {user?.location_label && <Text style={styles.meta}>📍 {user.location_label}</Text>}
      {user && user.tags.length > 0 && (
        <Text style={styles.meta}>🏷️ {user.tags.map((t) => t.name).join(", ")}</Text>
      )}

      <Pressable style={styles.button} onPress={() => navigation.navigate("Profile")}>
        <Text style={styles.buttonText}>Edit profile</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={logout}>
        <Text style={styles.secondaryButtonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666", marginBottom: 8 },
  meta: { fontSize: 14, color: "#666", marginBottom: 4 },
  button: { backgroundColor: "#111", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, marginTop: 24 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 24, marginTop: 12 },
  secondaryButtonText: { color: "#c00", fontSize: 15, fontWeight: "600" },
});
