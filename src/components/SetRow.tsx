import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../constants/theme';
import type { DraftSetInput } from '../stores/workoutStore';
import type { EffortLabel } from '../types';

const effortOptions: EffortLabel[] = ['easy', 'productive', 'hard', 'failure'];

const effortColorByLabel: Record<EffortLabel, string> = {
  easy: theme.colors.effortEasy,
  productive: theme.colors.effortProductive,
  hard: theme.colors.effortHard,
  failure: theme.colors.effortFailure,
};

interface SetRowProps {
  setNumber: number;
  value: DraftSetInput;
  inputMode?: 'reps' | 'timed';
  intervalHintSeconds?: number | null;
  onChange: (nextValue: DraftSetInput) => void;
  onConfirm: () => void;
}

export function SetRow({
  setNumber,
  value,
  inputMode = 'reps',
  intervalHintSeconds,
  onChange,
  onConfirm,
}: SetRowProps) {
  const [isTiming, setIsTiming] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isTiming) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isTiming]);

  useEffect(() => {
    if (inputMode !== 'timed' || isTiming) {
      return;
    }

    const parsed = Number(value.reps);
    if (Number.isFinite(parsed) && parsed > 0) {
      setElapsedSeconds(parsed);
    }
  }, [inputMode, isTiming, value.reps]);

  const parsedReps = Number(value.reps);
  const parsedLoad = Number(value.loadKg);
  const canConfirm =
    inputMode === 'timed'
      ? Number.isFinite(parsedReps) && parsedReps > 0 && value.effortLabel !== null
      : Number.isFinite(parsedReps) &&
        parsedReps > 0 &&
        Number.isFinite(parsedLoad) &&
        parsedLoad >= 0 &&
        value.effortLabel !== null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>SET {setNumber}</Text>
        <View style={styles.modePillRow}>
          <View style={styles.modePill}>
            <Text style={styles.modePillText}>{value.isWarmup ? 'WARMUP' : 'WORKING'}</Text>
          </View>
          {inputMode === 'timed' ? (
            <View style={styles.timedPill}>
              <Text style={styles.timedPillText}>TIMED</Text>
            </View>
          ) : null}
        </View>
      </View>

      {inputMode === 'timed' ? (
        <View style={styles.inputGroupStack}>
          <Text style={styles.metricLabel}>Duration</Text>
          <View style={styles.metricInputWrap}>
            <TextInput
              keyboardType="number-pad"
              value={value.reps}
              onChangeText={(reps) => onChange({ ...value, reps, loadKg: '0' })}
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.metricInput}
            />
            <Text style={styles.metricSuffix}>sec</Text>
          </View>

          <View style={styles.timerRow}>
            <Text style={styles.timerReadout}>Elapsed {elapsedSeconds}s</Text>
            <View style={styles.timerActions}>
              <Pressable
                onPress={() => {
                  setElapsedSeconds(0);
                  setIsTiming(true);
                }}
                style={({ pressed }) => [styles.timerButton, pressed && styles.pressed]}
              >
                <Text style={styles.timerButtonText}>Start Timer</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsTiming(false);
                  onChange({
                    ...value,
                    reps: String(elapsedSeconds),
                    loadKg: '0',
                  });
                }}
                disabled={elapsedSeconds <= 0}
                style={({ pressed }) => [
                  styles.timerButton,
                  elapsedSeconds <= 0 && styles.timerButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.timerButtonText}>Done</Text>
              </Pressable>
            </View>
          </View>

          {typeof intervalHintSeconds === 'number' ? (
            <Text style={styles.timerHint}>Target interval: {intervalHintSeconds}s</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.inputRow}>
          <View style={styles.inputColumn}>
            <Text style={styles.metricLabel}>Load</Text>
            <View style={styles.metricInputWrap}>
              <TextInput
                keyboardType="decimal-pad"
                value={value.loadKg}
                onChangeText={(loadKg) => onChange({ ...value, loadKg })}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.metricInput}
              />
              <Text style={styles.metricSuffix}>kg</Text>
            </View>
          </View>

          <View style={styles.inputColumn}>
            <Text style={styles.metricLabel}>Reps</Text>
            <View style={styles.metricInputWrap}>
              <TextInput
                keyboardType="number-pad"
                value={value.reps}
                onChangeText={(reps) => onChange({ ...value, reps })}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.metricInput}
              />
              <Text style={styles.metricSuffix}>reps</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.effortRow}>
        {effortOptions.map((option) => {
          const selected = value.effortLabel === option;
          const color = effortColorByLabel[option];
          return (
            <Pressable
              key={option}
              onPress={() => onChange({ ...value, effortLabel: option })}
              style={({ pressed }) => [
                styles.effortButton,
                { borderColor: color },
                selected && { backgroundColor: `${color}33` },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.effortButtonText,
                  { color },
                  selected && styles.effortButtonTextSelected,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        <Pressable
          onPress={() => onChange({ ...value, isWarmup: !value.isWarmup })}
          style={({ pressed }) => [styles.warmupToggle, pressed && styles.pressed]}
        >
          <View style={[styles.checkbox, value.isWarmup && styles.checkboxChecked]}>
            {value.isWarmup ? <View style={styles.checkboxInner} /> : null}
          </View>
          <Text style={styles.warmupText}>Exclude from volume</Text>
        </Pressable>

        <Pressable
          onPress={onConfirm}
          disabled={!canConfirm}
          style={({ pressed }) => [
            styles.confirmButton,
            !canConfirm && styles.confirmButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.confirmButtonText}>Confirm Set</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  heading: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: theme.fontSize.lg,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  modePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  modePill: {
    minHeight: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  modePillText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  timedPill: {
    minHeight: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: '#37280f',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  timedPillText: {
    color: theme.colors.warning,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  inputColumn: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  inputGroupStack: {
    gap: theme.spacing.xs,
  },
  metricLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  metricInputWrap: {
    minHeight: 56,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  metricInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  metricSuffix: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    marginLeft: theme.spacing.sm,
  },
  timerRow: {
    gap: theme.spacing.xs,
  },
  timerReadout: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timerActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  timerButton: {
    minHeight: 38,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  timerButtonDisabled: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
  },
  timerButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
  },
  timerHint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
  },
  effortRow: {
    flexDirection: 'row',
    gap: 6,
  },
  effortButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg1,
    paddingHorizontal: 6,
  },
  effortButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.sm,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  effortButtonTextSelected: {
    color: theme.colors.textPrimary,
  },
  footerRow: {
    gap: theme.spacing.sm,
  },
  warmupToggle: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg1,
  },
  checkboxChecked: {
    borderColor: theme.colors.warning,
    backgroundColor: '#3d2911',
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: theme.colors.warning,
  },
  warmupText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
  confirmButton: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  confirmButtonDisabled: {
    backgroundColor: theme.colors.bg3,
  },
  confirmButtonText: {
    color: '#03241d',
    fontWeight: '900',
    fontSize: theme.fontSize.md,
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.7,
  },
});
