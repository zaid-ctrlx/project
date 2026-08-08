import React from "react";
import { StyleSheet, Text, View } from "react-native";

import ProfileForm from "../components/ProfileForm";
import { useAuth } from "../context/AuthContext";

export default function OnboardingScreen() {
  const { setUser } = useAuth();

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.subtitle}>This helps us recommend relevant events near you.</Text>
      </View>
      <ProfileForm submitLabel="Continue" onSaved={setUser} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#fff" },
  header: { paddingTop: 60, paddingHorizontal: 24 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#666" },
});
