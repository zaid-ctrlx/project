import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

type Variant = "primary" | "secondary" | "text";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
};

// One button component for the whole app: primary (solid), secondary
// (outlined), or text (plain link-style, e.g. "Log out" / "Back"). Handles
// its own disabled/loading/pressed states so every screen looks consistent
// instead of each one styling Pressable+Text by hand.
export default function Button({ label, onPress, variant = "primary", loading, disabled, danger }: Props) {
  const isDisabled = disabled || loading;
  const { styles, colors } = useThemedStyles((colors) => ({
    base: {
      borderRadius: radius.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.primary },
    disabled: { opacity: 0.4 },
    disabledLabel: { opacity: 0.6 },
    pressed: { opacity: 0.85 },
    primaryLabel: { color: colors.primaryText, fontSize: fontSize.md, fontWeight: "600" },
    secondaryLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: "600" },
    textLabel: { color: colors.text, fontSize: fontSize.base, fontWeight: "600" },
    dangerLabel: { color: colors.danger },
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        variant !== "text" && styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        isDisabled && variant !== "text" && styles.disabled,
        pressed && !isDisabled && variant !== "text" && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.primaryText : colors.text} />
      ) : (
        <Text
          style={[
            variant === "primary" && styles.primaryLabel,
            variant === "secondary" && styles.secondaryLabel,
            variant === "text" && styles.textLabel,
            danger && styles.dangerLabel,
            isDisabled && styles.disabledLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
