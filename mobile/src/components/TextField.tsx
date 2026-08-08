import React from "react";
import { StyleSheet, TextInput, TextInputProps, View } from "react-native";

import { colors, fontSize, radius, spacing } from "../theme";

type Props = TextInputProps & {
  containerStyle?: object;
};

export default function TextField({ style, containerStyle, ...rest }: Props) {
  return (
    <View style={containerStyle}>
      <TextInput style={[styles.input, style]} placeholderTextColor={colors.textFaint} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
});
