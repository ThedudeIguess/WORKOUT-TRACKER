import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
  deleteCustomExercise,
  listExerciseLibrary,
  setExerciseActive,
  updateCustomExerciseDefinition,
} from '../../db/queries';
import type { Exercise } from '../../types';

export default function ExerciseSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);
  const [editingCustomExerciseId, setEditingCustomExerciseId] = useState<string | null>(null);
  const [editCustomName, setEditCustomName] = useState('');
  const [editCustomCategory, setEditCustomCategory] = useState<Exercise['category']>('isolation');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Exercise[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const exercises = await listExerciseLibrary();
      setItems(exercises);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return items;
    }

    return items.filter((exercise) => {
      return (
        exercise.name.toLowerCase().includes(needle) ||
        exercise.category.toLowerCase().includes(needle) ||
        (exercise.equipment ?? '').toLowerCase().includes(needle)
      );
    });
  }, [items, search]);

  const activeCount = useMemo(
    () => items.filter((exercise) => exercise.isActive).length,
    [items]
  );

  const toggleExercise = async (exercise: Exercise) => {
    setSavingExerciseId(exercise.id);
    try {
      await setExerciseActive({
        exerciseId: exercise.id,
        isActive: !exercise.isActive,
      });

      setItems((current) =>
        current.map((candidate) =>
          candidate.id === exercise.id
            ? { ...candidate, isActive: !exercise.isActive }
            : candidate
        )
      );
    } finally {
      setSavingExerciseId(null);
    }
  };

  const startEditCustomExercise = (exercise: Exercise) => {
    setEditingCustomExerciseId(exercise.id);
    setEditCustomName(exercise.name);
    setEditCustomCategory(exercise.category);
  };

  const saveCustomExercise = async (exerciseId: string) => {
    const name = editCustomName.trim();
    if (!name) {
      Alert.alert('Invalid name', 'Custom exercise name cannot be blank.');
      return;
    }

    setSavingExerciseId(exerciseId);
    try {
      await updateCustomExerciseDefinition({
        exerciseId,
        name,
        category: editCustomCategory,
      });

      setItems((current) =>
        current.map((exercise) =>
          exercise.id === exerciseId
            ? { ...exercise, name, category: editCustomCategory }
            : exercise
        )
      );
      setEditingCustomExerciseId(null);
    } catch (error) {
      Alert.alert(
        'Custom exercise save failed',
        error instanceof Error ? error.message : 'Could not save custom exercise.'
      );
    } finally {
      setSavingExerciseId(null);
    }
  };

  const removeCustomExercise = async (exerciseId: string) => {
    Alert.alert(
      'Delete custom exercise?',
      'This removes the custom exercise from your library and swap options.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSavingExerciseId(exerciseId);
              try {
                await deleteCustomExercise(exerciseId);
                setItems((current) =>
                  current.filter((exercise) => exercise.id !== exerciseId)
                );
                if (editingCustomExerciseId === exerciseId) {
                  setEditingCustomExerciseId(null);
                }
              } catch (error) {
                Alert.alert(
                  'Delete blocked',
                  error instanceof Error
                    ? error.message
                    : 'Could not delete custom exercise.'
                );
              } finally {
                setSavingExerciseId(null);
              }
            })();
          },
        },
      ]
    );
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
        <Text style={styles.title}>Exercise Library</Text>
        <Text style={styles.subtitle}>Toggle active status and manage custom movements.</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL</Text>
          <Text style={styles.summaryValue}>{items.length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>ACTIVE</Text>
          <Text style={styles.summaryValue}>{activeCount}</Text>
        </View>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search exercise, category, equipment"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.searchInput}
      />

      <View style={styles.listCard}>
        {filteredItems.length === 0 ? (
          <Text style={styles.emptyText}>No exercises match your search.</Text>
        ) : (
          filteredItems.map((exercise) => {
            const isSaving = savingExerciseId === exercise.id;
            const isCustom = exercise.id.startsWith('custom-');
            const isEditingCustom = editingCustomExerciseId === exercise.id;
            return (
              <View key={exercise.id} style={styles.row}>
                <View style={styles.rowMain}>
                  {isEditingCustom ? (
                    <View style={styles.customEditCard}>
                      <TextInput
                        value={editCustomName}
                        onChangeText={setEditCustomName}
                        placeholder="Custom exercise name"
                        placeholderTextColor={theme.colors.textMuted}
                        style={styles.customEditInput}
                      />
                      <View style={styles.customCategoryRow}>
                        {(['compound', 'isolation', 'metcon', 'mobility'] as Exercise['category'][]).map((category) => {
                          const selected = editCustomCategory === category;
                          return (
                            <Pressable
                              key={`${exercise.id}-${category}`}
                              onPress={() => setEditCustomCategory(category)}
                              style={({ pressed }) => [
                                styles.customCategoryButton,
                                selected && styles.customCategoryButtonSelected,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.customCategoryButtonText,
                                  selected && styles.customCategoryButtonTextSelected,
                                ]}
                              >
                                {category}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View style={styles.customEditActions}>
                        <Pressable
                          disabled={isSaving}
                          onPress={() => {
                            void saveCustomExercise(exercise.id);
                          }}
                          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.actionButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setEditingCustomExerciseId(null)}
                          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.actionButtonText}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.metaText}>
                        {exercise.category} • {exercise.equipment ?? 'unspecified'}
                      </Text>
                    </>
                  )}
                </View>

                <View style={styles.rowControls}>
                  <View
                    style={[
                      styles.statusPill,
                      exercise.isActive ? styles.statusPillActive : styles.statusPillInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        exercise.isActive ? styles.statusTextActive : styles.statusTextInactive,
                      ]}
                    >
                      {exercise.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </View>

                  <Pressable
                    disabled={isSaving}
                    onPress={() => {
                      void toggleExercise(exercise);
                    }}
                    style={({ pressed }) => [styles.toggleButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.toggleButtonText}>
                      {isSaving ? 'Saving...' : exercise.isActive ? 'Disable' : 'Enable'}
                    </Text>
                  </Pressable>
                </View>

                {isCustom && !isEditingCustom ? (
                  <View style={styles.customActionsRow}>
                    <Pressable
                      onPress={() => startEditCustomExercise(exercise)}
                      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      disabled={isSaving}
                      onPress={() => removeCustomExercise(exercise.id)}
                      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.actionButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
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
  summaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: 4,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: theme.fontSize.xl,
    fontVariant: ['tabular-nums'],
  },
  searchInput: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
  },
  listCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  row: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  rowMain: {
    gap: 2,
  },
  customEditCard: {
    gap: theme.spacing.sm,
  },
  customEditInput: {
    minHeight: 40,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    color: theme.colors.textPrimary,
    paddingHorizontal: 10,
  },
  customCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  customCategoryButton: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  customCategoryButtonSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  customCategoryButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: '800',
    fontSize: theme.fontSize.xs,
  },
  customCategoryButtonTextSelected: {
    color: theme.colors.accent,
  },
  customEditActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  exerciseName: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.md,
  },
  metaText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    textTransform: 'capitalize',
  },
  rowControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statusPill: {
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  statusPillActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  statusPillInactive: {
    borderColor: theme.colors.zoneRed,
    backgroundColor: '#3a1b22',
  },
  statusText: {
    fontWeight: '900',
    fontSize: theme.fontSize.xs,
    letterSpacing: 0.3,
  },
  statusTextActive: {
    color: theme.colors.accent,
  },
  statusTextInactive: {
    color: theme.colors.zoneRed,
  },
  toggleButton: {
    minHeight: 38,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  toggleButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
  },
  customActionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    minHeight: 34,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  actionButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.xs,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
