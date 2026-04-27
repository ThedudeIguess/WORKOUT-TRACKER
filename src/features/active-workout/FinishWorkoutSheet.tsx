import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../constants/theme';

interface FinishWorkoutSheetProps {
  elapsedLabel: string;
  loggedSetsCount: number;
  completedSlots: number;
  totalSlots: number;
  missingSlotNames: string[];
  notes: string;
  submitting: boolean;
  bottomInset: number;
  onChangeNotes: (notes: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function FinishWorkoutSheet({
  elapsedLabel,
  loggedSetsCount,
  completedSlots,
  totalSlots,
  missingSlotNames,
  notes,
  submitting,
  bottomInset,
  onChangeNotes,
  onCancel,
  onSubmit,
}: FinishWorkoutSheetProps) {
  return (
    <View style={styles.backdrop}>
      <Pressable style={styles.dismissArea} onPress={onCancel} />
      <View style={[styles.sheet, { paddingBottom: Math.max(14, bottomInset) }]}>
        <Text style={styles.title}>Finish Workout</Text>
        <Text style={styles.summary}>Duration: {elapsedLabel}</Text>
        <Text style={styles.summary}>Total sets: {loggedSetsCount}</Text>
        <Text style={styles.summary}>
          Exercises completed: {completedSlots}/{totalSlots}
        </Text>

        {missingSlotNames.length > 0 ? (
          <Text style={styles.warning}>
            Missing sets: {missingSlotNames.join(', ')}
          </Text>
        ) : null}

        <TextInput
          value={notes}
          onChangeText={onChangeNotes}
          placeholder="Optional workout notes"
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          style={styles.notesInput}
        />

        <Pressable
          disabled={submitting}
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.primaryButton,
            submitting && styles.primaryButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Save Workout</Text>
        </Pressable>
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
  summary: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  warning: {
    color: theme.colors.warning,
    fontWeight: '700',
    lineHeight: 20,
  },
  notesInput: {
    minHeight: 88,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: theme.colors.bg3,
  },
  primaryButtonText: {
    color: '#03241d',
    fontSize: theme.fontSize.md,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.7,
  },
});
