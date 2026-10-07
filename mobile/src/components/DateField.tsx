import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";
import Button from "./Button";

type Props = {
  label: string;
  // "YYYY-MM-DD" (local calendar day) or null when unset.
  value: string | null;
  onChange: (day: string | null) => void;
  minDay?: string | null;
};

function toDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromDay(day: string): Date {
  return new Date(`${day}T12:00:00`);
}
function show(day: string): string {
  return fromDay(day).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Date-only field (no time) used by the Home filters. Android opens the
// native date dialog; iOS shows an inline calendar in a small modal with an
// explicit "Done" — same pattern as DateTimeField. Web has its own file.
export default function DateField({ label, value, onChange, minDay }: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());
  const { styles, colors } = useThemedStyles((colors) => ({
    box: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background,
      gap: spacing.sm,
    },
    textCol: { flex: 1 },
    label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.textFaint },
    value: { fontSize: fontSize.base, fontWeight: "600", color: colors.text, marginTop: 2 },
    placeholder: { color: colors.textFaint, fontWeight: "500" },
    backdrop: { flex: 1, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    sheet: { width: "100%", maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
    doneRow: { marginTop: spacing.md },
  }));

  const minDate = minDay ? fromDay(minDay) : undefined;

  function open() {
    const start = value ? fromDay(value) : minDate ?? new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: start,
        mode: "date",
        minimumDate: minDate,
        onValueChange: (_event, picked) => onChange(toDay(picked)),
      });
    } else {
      setDraft(start);
      setIosOpen(true);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Pressable style={styles.box} onPress={open}>
        <View style={styles.textCol}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.value, !value && styles.placeholder]}>{value ? show(value) : "Any date"}</Text>
        </View>
        {value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : (
          <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
        )}
      </Pressable>

      {Platform.OS === "ios" && (
        <Modal visible={iosOpen} transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setIosOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                minimumDate={minDate}
                onValueChange={(_event, selected) => setDraft(selected)}
              />
              <View style={styles.doneRow}>
                <Button
                  label="Done"
                  onPress={() => {
                    onChange(toDay(draft));
                    setIosOpen(false);
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
