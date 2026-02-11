import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../../constants/theme';
import { listExerciseLibrary, setExerciseActive } from '../../db/queries';
import type { Exercise } from '../../types';

export default function ExerciseSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);
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
        <Text style={styles.subtitle}>
          Active exercises are available across workout logging, progression, and trends.
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>{items.length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Active</Text>
          <Text style={styles.summaryValue}>{activeCount}</Text>
        </View>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search exercise, category, equipment"
        placeholderTextColor={theme.colors.textSecondary}
        style={styles.searchInput}
      />

      <View style={styles.listCard}>
        {filteredItems.length === 0 ? (
          <Text style={styles.emptyText}>No exercises match your search.</Text>
        ) : (
          filteredItems.map((exercise) => {
            const isSaving = savingExerciseId === exercise.id;
            return (
              <View key={exercise.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.metaText}>
                    {exercise.category} | {exercise.equipment ?? 'unspecified'}
                  </Text>
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
                    style={styles.toggleButton}
                  >
                    <Text style={styles.toggleButtonText}>
                      {isSaving ? 'Saving...' : exercise.isActive ? 'Disable' : 'Enable'}
                    </Text>
                  </Pressable>
                </View>
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
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#304868',
    backgroundColor: '#0f192a',
    padding: 10,
    gap: 4,
  },
  summaryLabel: {
    color: '#9fb8d8',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: '#eef5ff',
    fontWeight: '900',
    fontSize: 22,
  },
  searchInput: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38567a',
    backgroundColor: '#122139',
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
  },
  listCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#304868',
    backgroundColor: '#0f192a',
    padding: 12,
    gap: 8,
  },
  row: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#304868',
    backgroundColor: '#122036',
    padding: 10,
    gap: 8,
  },
  rowMain: {
    gap: 2,
  },
  exerciseName: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  rowControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  statusPillActive: {
    borderColor: '#2f6b56',
    backgroundColor: '#16362b',
  },
  statusPillInactive: {
    borderColor: '#70535d',
    backgroundColor: '#3b2127',
  },
  statusText: {
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.2,
  },
  statusTextActive: {
    color: '#b4efcf',
  },
  statusTextInactive: {
    color: '#ffc7d0',
  },
  toggleButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#39557a',
    backgroundColor: '#122138',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  toggleButtonText: {
    color: '#cce0fa',
    fontWeight: '800',
    fontSize: 12,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
});
