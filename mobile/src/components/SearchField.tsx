import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../context/ThemeContext";
import { spacing } from "../theme";
import TextField from "./TextField";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  // Shows a spinner in the accessory slot instead of the clear button —
  // the two never make sense at once (nothing to clear while empty, and a
  // busy search always has *some* text in it).
  busy?: boolean;
  // false renders this as a display-only tap target instead of a real
  // input — the caller wraps it in a Pressable (with pointerEvents="none"
  // here so the tap reaches that Pressable, not the TextInput) to hand off
  // to a dedicated search screen instead of typing in place. See Home
  // (EventDiscoverView's onRequestSearch) and MessagesScreen.
  editable?: boolean;
  autoFocus?: boolean;
};

// TextField plus a right-edge accessory: a spinner while a search is in
// flight, otherwise a tap-to-clear "✕" once there's text — one click back
// to empty instead of holding backspace. Doesn't touch TextField itself
// (it's used in many non-search places that don't want either of these) —
// this just shares the same absolute-positioned-accessory pattern
// MessagesScreen and UserMultiPicker each had inline for their loading
// spinner, now in one place with the clear button added.
export default function SearchField({ value, onChangeText, placeholder, busy, editable = true, autoFocus }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <TextField
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        autoFocus={autoFocus}
        style={styles.input}
      />
      {busy ? (
        <ActivityIndicator style={styles.accessory} />
      ) : (
        value.length > 0 && (
          <Pressable onPress={() => onChangeText("")} hitSlop={10} style={styles.accessory}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: "center" },
  input: { paddingRight: 40 },
  accessory: { position: "absolute", right: spacing.md },
});
