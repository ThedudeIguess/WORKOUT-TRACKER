import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.tag}>Settings</Text>
        <Text style={styles.title}>Program Templates</Text>
        <Text style={styles.subtitle}>
          Edit day names and slot targets for the active phase.
        </Text>
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
              style={styles.saveButton}
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
                  placeholderTextColor={theme.colors.textSecondary}
                  style={styles.notesInput}
                />

                <Pressable
                  disabled={isSaving}
                  onPress={() => {
                    void saveSlot(slot.id);
                  }}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveButtonText}>
                    {isSaving ? 'Saving...' : 'Save Slot'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: 12,
    gap: 10,
    backgroundColor: theme.colors.background,
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#345378',
    backgroundColor: '#122238',
    padding: 12,
    gap: 3,
  },
  tag: {
    color: '#a7c6ec',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    lineHeight: 18,
    fontSize: 12,
  },
  dayCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#304868',
    backgroundColor: '#0f192a',
    padding: 12,
    gap: 10,
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
    borderColor: '#466a99',
    backgroundColor: '#193152',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  dayNumberText: {
    color: '#d3e7ff',
    fontSize: 11,
    fontWeight: '900',
  },
  slotCountText: {
    color: '#9fb8d8',
    fontSize: 12,
    fontWeight: '700',
  },
  dayNameRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dayNameInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38567a',
    backgroundColor: '#122139',
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    fontWeight: '700',
  },
  saveButton: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#39557a',
    backgroundColor: '#122138',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  saveButtonText: {
    color: '#cce0fa',
    fontWeight: '800',
    fontSize: 12,
  },
  slotCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#304868',
    backgroundColor: '#122036',
    padding: 10,
    gap: 8,
  },
  slotTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  slotFieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotField: {
    width: '48.7%',
    gap: 4,
  },
  slotLabel: {
    color: '#9fb8d8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  slotInput: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#39557a',
    backgroundColor: '#122138',
    color: theme.colors.textPrimary,
    paddingHorizontal: 10,
    fontWeight: '700',
  },
  notesInput: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#39557a',
    backgroundColor: '#122138',
    color: theme.colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
});
