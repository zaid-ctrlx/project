import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { RootStackParamList } from "../../App";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { colors, fontSize, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome{user?.full_name ? `, ${user.full_name}` : ""}</Text>
      <Text style={styles.subtitle}>{user?.email}</Text>

      {(user?.location_label || (user && user.tags.length > 0)) && (
        <View style={styles.metaBlock}>
          {user?.location_label && <Text style={styles.meta}>📍 {user.location_label}</Text>}
          {user && user.tags.length > 0 && (
            <Text style={styles.meta}>🏷️ {user.tags.map((t) => t.name).join(", ")}</Text>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <Button label="Edit profile" onPress={() => navigation.navigate("Profile")} />
        <View style={styles.buttonGap} />
        <Button label="Log out" onPress={logout} variant="text" danger />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: { fontSize: fontSize.xl, fontWeight: "700", marginBottom: spacing.xs, color: colors.text },
  subtitle: { fontSize: fontSize.md, color: colors.textMuted },
  metaBlock: { marginTop: spacing.lg, alignItems: "center" },
  meta: { fontSize: fontSize.base, color: colors.textMuted, marginBottom: spacing.xs },
  actions: { marginTop: spacing.xxl, alignItems: "center", width: "100%" },
  buttonGap: { height: spacing.md },
});
