import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../../constants/theme';
import {
  listProgramDayTemplates,
  updateDayTemplateName,
  updateTemplateExerciseSlot,
} from '../../db/queries';
import type { DayTemplateSlotWithOptions, DayTemplateWithSlots } from '../../types';

interface SlotDraft {
  targetSets: string;
  targetRepLow: string;
  targetRepHigh: string;
  restSeconds: string;
  notes: string;
}

function makeSlotDraft(slot: DayTemplateSlotWithOptions): SlotDraft {
  return {
    targetSets: String(slot.targetSets),
    targetRepLow: String(slot.targetRepLow),
    targetRepHigh: String(slot.targetRepHigh),
    restSeconds: String(slot.restSeconds),
    notes: slot.notes ?? '',
  };
}

export default function ProgramSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [savingDayId, setSavingDayId] = useState<number | null>(null);
  const [savingSlotId, setSavingSlotId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<DayTemplateWithSlots[]>([]);
  const [dayNameDrafts, setDayNameDrafts] = useState<Record<number, string>>({});
  const [slotDrafts, setSlotDrafts] = useState<Record<number, SlotDraft>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const days = await listProgramDayTemplates();
      setTemplates(days);

      const nextDayDrafts: Record<number, string> = {};
      const nextSlotDrafts: Record<number, SlotDraft> = {};

      for (const day of days) {
        nextDayDrafts[day.id] = day.dayName;
        for (const slot of day.slots) {
          nextSlotDrafts[slot.id] = makeSlotDraft(slot);
        }
      }

      setDayNameDrafts(nextDayDrafts);
      setSlotDrafts(nextSlotDrafts);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const saveDayName = async (dayTemplateId: number) => {
    const nextName = dayNameDrafts[dayTemplateId]?.trim();
    if (!nextName) {
      Alert.alert('Invalid day name', 'Day name cannot be blank.');
      return;
    }

    setSavingDayId(dayTemplateId);
    try {
      await updateDayTemplateName({
        dayTemplateId,
        dayName: nextName,
      });

      setTemplates((current) =>
        current.map((day) =>
          day.id === dayTemplateId
            ? { ...day, dayName: nextName }
            : day
        )
      );
    } catch (error) {
      Alert.alert(
        'Day save failed',
        error instanceof Error ? error.message : 'Could not save day name.'
      );
    } finally {
      setSavingDayId(null);
    }
  };

  const saveSlot = async (slotId: number) => {
    const draft = slotDrafts[slotId];
    if (!draft) {
      return;
    }

    const targetSets = Number(draft.targetSets);
    const targetRepLow = Number(draft.targetRepLow);
    const targetRepHigh = Number(draft.targetRepHigh);
    const restSeconds = Number(draft.restSeconds);

    if (
      !Number.isFinite(targetSets) ||
      !Number.isFinite(targetRepLow) ||
      !Number.isFinite(targetRepHigh) ||
      !Number.isFinite(restSeconds)
    ) {
      Alert.alert('Invalid slot values', 'All slot fields must be valid numbers.');
      return;
    }

    if (targetSets <= 0 || targetRepLow <= 0 || targetRepHigh <= 0 || restSeconds <= 0) {
      Alert.alert('Invalid slot values', 'Sets, rep range, and rest must be greater than 0.');
      return;
    }

    if (targetRepLow > targetRepHigh) {
      Alert.alert('Invalid rep range', 'Rep low cannot be greater than rep high.');
      return;
    }

    setSavingSlotId(slotId);
    try {
      await updateTemplateExerciseSlot({
        slotId,
        targetSets,
        targetRepLow,
        targetRepHigh,
        restSeconds,
        notes: draft.notes.trim().length > 0 ? draft.notes.trim() : null,
      });

      setTemplates((current) =>
        current.map((day) => ({
          ...day,
          slots: day.slots.map((slot) =>
            slot.id === slotId
              ? {
                  ...slot,
                  targetSets,
                  targetRepLow,
                  targetRepHigh,
                  restSeconds,
                  notes: draft.notes.trim().length > 0 ? draft.notes.trim() : null,
                }
              : slot
          ),
        }))
      );
    } catch (error) {
      Alert.alert(
        'Slot save failed',
        error instanceof Error ? error.message : 'Could not save slot targets.'
      );
    } finally {
      setSavingSlotId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.tag}>Settings</Text>
        <Text style={styles.title}>Program Templates</Text>
        <Text style={styles.subtitle}>Edit day names and slot targets for the active phase.</Text>
      </View>

      {templates.map((day) => (
        <View key={day.id} style={styles.dayCard}>
          <View style={styles.dayHeaderRow}>
            <View style={styles.dayNumberChip}>
              <Text style={styles.dayNumberText}>Day {day.dayNumber}</Text>
            </View>
            <Text style={styles.slotCountText}>{day.slots.length} slots</Text>
          </View>

          <View style={styles.dayNameRow}>
            <TextInput
              value={dayNameDrafts[day.id] ?? day.dayName}
              onChangeText={(value) =>
                setDayNameDrafts((current) => ({ ...current, [day.id]: value }))
              }
              style={styles.dayNameInput}
            />
            <Pressable
              disabled={savingDayId === day.id}
              onPress={() => {
                void saveDayName(day.id);
              }}
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
            >
              <Text style={styles.saveButtonText}>
                {savingDayId === day.id ? 'Saving...' : 'Save Day'}
              </Text>
            </Pressable>
          </View>

          {day.slots.map((slot) => {
            const draft = slotDrafts[slot.id] ?? makeSlotDraft(slot);
            const isSaving = savingSlotId === slot.id;

            return (
              <View key={slot.id} style={styles.slotCard}>
                <Text style={styles.slotTitle}>
                  {slot.slotOrder}. {slot.defaultExerciseName}
                </Text>

                <View style={styles.slotFieldRow}>
                  <View style={styles.slotField}>
                    <Text style={styles.slotLabel}>Sets</Text>
                    <TextInput
                      keyboardType="number-pad"
                      value={draft.targetSets}
                      onChangeText={(value) =>
                        setSlotDrafts((current) => ({
                          ...current,
                          [slot.id]: { ...draft, targetSets: value },
                        }))
                      }
                      style={styles.slotInput}
                    />
                  </View>
                  <View style={styles.slotField}>
                    <Text style={styles.slotLabel}>Rep Low</Text>
                    <TextInput
                      keyboardType="number-pad"
                      value={draft.targetRepLow}
                      onChangeText={(value) =>
                        setSlotDrafts((current) => ({
                          ...current,
                          [slot.id]: { ...draft, targetRepLow: value },
                        }))
                      }
                      style={styles.slotInput}
                    />
                  </View>
                  <View style={styles.slotField}>
                    <Text style={styles.slotLabel}>Rep High</Text>
                    <TextInput
                      keyboardType="number-pad"
                      value={draft.targetRepHigh}
                      onChangeText={(value) =>
                        setSlotDrafts((current) => ({
                          ...current,
                          [slot.id]: { ...draft, targetRepHigh: value },
                        }))
                      }
                      style={styles.slotInput}
                    />
                  </View>
                  <View style={styles.slotField}>
                    <Text style={styles.slotLabel}>Rest (s)</Text>
                    <TextInput
                      keyboardType="number-pad"
                      value={draft.restSeconds}
                      onChangeText={(value) =>
                        setSlotDrafts((current) => ({
                          ...current,
                          [slot.id]: { ...draft, restSeconds: value },
                        }))
                      }
                      style={styles.slotInput}
                    />
                  </View>
                </View>

                <TextInput
                  value={draft.notes}
                  onChangeText={(value) =>
                    setSlotDrafts((current) => ({
                      ...current,
                      [slot.id]: { ...draft, notes: value },
                    }))
                  }
                  placeholder="Slot notes (optional)"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.notesInput}
                />

                <Pressable
                  disabled={isSaving}
                  onPress={() => {
                    void saveSlot(slot.id);
                  }}
                  style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
                >
                  <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Slot'}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg1,
  },
  container: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bg1,
  },
  heroCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.lg,
    gap: 3,
  },
  tag: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xl,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  dayCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayNumberChip: {
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  dayNumberText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xs,
    fontWeight: '900',
  },
  slotCountText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  dayNameRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  dayNameInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    fontWeight: '700',
  },
  saveButton: {
    minHeight: 38,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  saveButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
  },
  slotCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  slotTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
  },
  slotFieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  slotField: {
    width: '48.7%',
    gap: 4,
  },
  slotLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  slotInput: {
    minHeight: 38,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    color: theme.colors.textPrimary,
    paddingHorizontal: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  notesInput: {
    minHeight: 38,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    color: theme.colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.7,
  },
});
