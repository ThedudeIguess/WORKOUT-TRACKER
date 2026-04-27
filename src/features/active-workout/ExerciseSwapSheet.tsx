import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { muscleGroups } from '../../constants/mevThresholds';
import { theme } from '../../constants/theme';
import type { DayTemplateSlotWithOptions, ExerciseCategory } from '../../types';

interface SwapOption {
  id: string;
  name: string;
}

export interface CustomExerciseInput {
  name: string;
  category: ExerciseCategory;
  primaryMuscleGroupIds: string[];
  secondaryMuscleGroupIds: string[];
}

interface ExerciseSwapSheetProps {
  slot: DayTemplateSlotWithOptions;
  options: SwapOption[];
  selectedExerciseId: string | null;
  onSelect: (option: SwapOption) => void;
  onCreateCustom: (input: CustomExerciseInput) => Promise<void>;
  onClose: () => void;
}

const customExerciseCategories: ExerciseCategory[] = [
  'compound',
  'isolation',
  'metcon',
  'mobility',
];

export function ExerciseSwapSheet({
  slot,
  options,
  selectedExerciseId,
  onSelect,
  onCreateCustom,
  onClose,
}: ExerciseSwapSheetProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<ExerciseCategory>('isolation');
  const [primaryMuscles, setPrimaryMuscles] = useState<string[]>([]);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);

  const toggleMuscle = (
    muscleId: string,
    setter: (updater: (current: string[]) => string[]) => void
  ) => {
    setter((current) => {
      if (current.includes(muscleId)) {
        return current.filter((entry) => entry !== muscleId);
      }
      return [...current, muscleId];
    });
  };

  const handleCreate = async () => {
    const trimmedName = customName.trim();
    if (!trimmedName) {
      Alert.alert('Custom exercise', 'Exercise name is required.');
      return;
    }
    if (primaryMuscles.length === 0) {
      Alert.alert('Custom exercise', 'Select at least one primary muscle group.');
      return;
    }

    setCreating(true);
    try {
      await onCreateCustom({
        name: trimmedName,
        category: customCategory,
        primaryMuscleGroupIds: primaryMuscles,
        secondaryMuscleGroupIds: secondaryMuscles.filter(
          (muscleGroup) => !primaryMuscles.includes(muscleGroup)
        ),
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={styles.dismissArea} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Swap Exercise</Text>
        <Text style={styles.subtitle}>
          Choose an option for slot {slot.slotOrder}.
        </Text>

        {options.map((option) => {
          const selected = selectedExerciseId === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => onSelect(option)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {option.name}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => setShowCustomForm((current) => !current)}
          style={({ pressed }) => [styles.customToggle, pressed && styles.pressed]}
        >
          <Text style={styles.customToggleText}>+ Add Custom Exercise</Text>
        </Pressable>

        {showCustomForm ? (
          <View style={styles.customCard}>
            <Text style={styles.customLabel}>Exercise Name</Text>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder="e.g. Hyperextension (Glute Focus)"
              placeholderTextColor={theme.colors.textSecondary}
              style={styles.customInput}
            />

            <Text style={styles.customLabel}>Category</Text>
            <View style={styles.categoryRow}>
              {customExerciseCategories.map((category) => {
                const selected = customCategory === category;
                return (
                  <Pressable
                    key={category}
                    onPress={() => setCustomCategory(category)}
                    style={({ pressed }) => [
                      styles.categoryButton,
                      selected && styles.categoryButtonSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        selected && styles.categoryTextSelected,
                      ]}
                    >
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.customLabel}>Primary Muscles (Direct)</Text>
            <View style={styles.muscleGrid}>
              {muscleGroups.map((muscleGroup) => {
                const selected = primaryMuscles.includes(muscleGroup.id);
                return (
                  <Pressable
                    key={`primary-${muscleGroup.id}`}
                    onPress={() => toggleMuscle(muscleGroup.id, setPrimaryMuscles)}
                    style={({ pressed }) => [
                      styles.muscleButton,
                      selected && styles.muscleButtonSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.muscleText,
                        selected && styles.muscleTextSelected,
                      ]}
                    >
                      {muscleGroup.displayName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.customLabel}>Secondary Muscles (Indirect)</Text>
            <View style={styles.muscleGrid}>
              {muscleGroups.map((muscleGroup) => {
                const selected = secondaryMuscles.includes(muscleGroup.id);
                return (
                  <Pressable
                    key={`secondary-${muscleGroup.id}`}
                    onPress={() => toggleMuscle(muscleGroup.id, setSecondaryMuscles)}
                    style={({ pressed }) => [
                      styles.muscleButton,
                      selected && styles.muscleButtonSecondarySelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.muscleText,
                        selected && styles.muscleTextSelected,
                      ]}
                    >
                      {muscleGroup.displayName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => {
                void handleCreate();
              }}
              disabled={creating}
              style={({ pressed }) => [
                styles.createButton,
                creating && styles.createButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.createButtonText}>
                {creating ? 'Creating...' : 'Create & Select'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  sheet: {
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomWidth: 0,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xl,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
  option: {
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: theme.colors.bg3,
  },
  optionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  optionText: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: theme.colors.accent,
  },
  customToggle: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  customToggleText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
  },
  customCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    padding: 10,
    gap: 8,
  },
  customLabel: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  customInput: {
    minHeight: 42,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    color: theme.colors.textPrimary,
    paddingHorizontal: 10,
    fontWeight: '700',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  categoryButtonSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  categoryText: {
    color: theme.colors.textSecondary,
    fontWeight: '800',
    fontSize: theme.fontSize.xs,
  },
  categoryTextSelected: {
    color: theme.colors.accent,
  },
  muscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  muscleButton: {
    minHeight: 34,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  muscleButtonSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  muscleButtonSecondarySelected: {
    borderColor: theme.colors.warning,
    backgroundColor: '#3d2a10',
  },
  muscleText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  muscleTextSelected: {
    color: theme.colors.textPrimary,
  },
  createButton: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    backgroundColor: theme.colors.bg3,
  },
  createButtonText: {
    color: '#03241d',
    fontWeight: '900',
    fontSize: theme.fontSize.sm,
  },
  pressed: {
    opacity: 0.7,
  },
});
