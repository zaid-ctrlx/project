import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";
import Button from "./Button";

type Props = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
};

function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Android has no combined date+time mode (AndroidMode is 'date' | 'time'
// only) so we chain the native date dialog into the native time dialog,
// merging both into one Date. iOS supports mode="datetime" directly but the
// picker doesn't auto-dismiss, so it's shown inline inside a Modal with an
// explicit "Done" (same backdrop/sheet pattern as Select.tsx and
// ProfileForm's avatar-source sheet).
export default function DateTimeField({ label, value, onChange, minimumDate }: Props) {
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? minimumDate ?? new Date());
  const { styles, colors } = useThemedStyles((colors) => ({
    // box/textCol/label/value/placeholder mirror Select.tsx exactly for
    // visual consistency with the rest of the form.
    box: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      backgroundColor: colors.background,
    },
    textCol: { flex: 1 },
    label: { fontSize: fontSize.sm, color: colors.textMuted },
    value: { fontSize: fontSize.md, color: colors.text, paddingTop: spacing.xs, paddingBottom: spacing.sm },
    placeholder: { color: colors.textFaint },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },
    sheet: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.background,
      borderRadius: radius.md,
      padding: spacing.lg,
    },
    doneRow: { marginTop: spacing.md },
  }));

  function openPicker() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: value ?? minimumDate ?? new Date(),
        mode: "date",
        minimumDate,
        onValueChange: (_event, pickedDate) => {
          DateTimePickerAndroid.open({
            value: pickedDate,
            mode: "time",
            onValueChange: (_e, pickedTime) => {
              const merged = new Date(pickedDate);
              merged.setHours(pickedTime.getHours(), pickedTime.getMinutes());
              onChange(merged);
            },
          });
        },
      });
    } else {
      setDraft(value ?? minimumDate ?? new Date());
      setIosPickerOpen(true);
    }
  }

  return (
    <View>
      <Pressable style={styles.box} onPress={openPicker}>
        <View style={styles.textCol}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.value, !value && styles.placeholder]}>
            {value ? formatDateTime(value) : "Select date & time"}
          </Text>
        </View>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </Pressable>

      {Platform.OS === "ios" && (
        <Modal
          visible={iosPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIosPickerOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setIosPickerOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <DateTimePicker
                value={draft}
                mode="datetime"
                display="inline"
                minimumDate={minimumDate}
                onValueChange={(_event, selected) => setDraft(selected)}
              />
              <View style={styles.doneRow}>
                <Button
                  label="Done"
                  onPress={() => {
                    onChange(draft);
                    setIosPickerOpen(false);
                  }}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
