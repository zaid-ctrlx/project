import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RootStackParamList } from "../../App";
import ProfileForm from "../components/ProfileForm";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export default function ProfileScreen({ navigation }: Props) {
  const { user, setUser } = useAuth();

  // Route is only reachable once logged in (see App.tsx), so user is always
  // set here — this guard is just to satisfy TypeScript's null-checking.
  if (!user) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Edit profile</Text>
      </View>
      <ProfileForm
        initialFullName={user.full_name}
        initialTagIds={user.tags.map((t) => t.id)}
        initialLocationLabel={user.location_label}
        initialLocationCoords={
          user.location_lat != null && user.location_lng != null
            ? { lat: user.location_lat, lng: user.location_lng }
            : null
        }
        submitLabel="Save changes"
        onSaved={(updated) => {
          setUser(updated);
          navigation.goBack();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#fff" },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 4 },
  back: { fontSize: 16, color: "#111", marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "700" },
});
