import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../constants/theme';
import type { EffortLabel } from '../types';
import type { DraftSetInput } from '../stores/workoutStore';

const effortOptions: EffortLabel[] = ['easy', 'productive', 'hard', 'failure'];

const effortStyleByLabel: Record<EffortLabel, { background: string; text: string }> = {
  easy: { background: '#2f3645', text: '#c7cedf' },
  productive: { background: '#23548d', text: '#e8f4ff' },
  hard: { background: '#8f5c1e', text: '#fff3de' },
  failure: { background: '#8f2430', text: '#ffe6ea' },
};

interface SetRowProps {
  setNumber: number;
  value: DraftSetInput;
  onChange: (nextValue: DraftSetInput) => void;
  onConfirm: () => void;
}

export function SetRow({ setNumber, value, onChange, onConfirm }: SetRowProps) {
  const parsedReps = Number(value.reps);
  const parsedLoad = Number(value.loadKg);
  const canConfirm =
    Number.isFinite(parsedReps) &&
    parsedReps > 0 &&
    Number.isFinite(parsedLoad) &&
    parsedLoad >= 0 &&
    value.effortLabel !== null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Set {setNumber}</Text>
        <View style={styles.modePill}>
          <Text style={styles.modePillText}>{value.isWarmup ? 'Warmup' : 'Working'}</Text>
        </View>
      </View>

      <View style={styles.inputRow}>
        <View style={styles.inputBox}>
          <Text style={styles.label}>Load (kg)</Text>
          <TextInput
            keyboardType="decimal-pad"
            value={value.loadKg}
            onChangeText={(loadKg) => onChange({ ...value, loadKg })}
            placeholder="0"
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.input}
          />
        </View>

        <View style={styles.inputBox}>
          <Text style={styles.label}>Reps</Text>
          <TextInput
            keyboardType="number-pad"
            value={value.reps}
            onChangeText={(reps) => onChange({ ...value, reps })}
            placeholder="0"
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.effortRow}>
        {effortOptions.map((option) => {
          const selected = value.effortLabel === option;
          return (
            <Pressable
              key={option}
              onPress={() => onChange({ ...value, effortLabel: option })}
              style={[
                styles.effortButton,
                { borderColor: effortStyleByLabel[option].background },
                selected && { backgroundColor: effortStyleByLabel[option].background },
              ]}
            >
              <Text
                style={[
                  styles.effortButtonText,
                  selected && { color: effortStyleByLabel[option].text },
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        <Pressable onPress={() => onChange({ ...value, isWarmup: !value.isWarmup })} style={styles.warmupToggle}>
          <View style={[styles.checkbox, value.isWarmup && styles.checkboxChecked]}>
            {value.isWarmup ? <View style={styles.checkboxInner} /> : null}
          </View>
          <Text style={styles.warmupText}>Exclude from volume (warmup)</Text>
        </Pressable>

        <Pressable
          onPress={onConfirm}
          disabled={!canConfirm}
          style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
        >
          <Text style={styles.confirmButtonText}>Confirm</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2f3d58',
    backgroundColor: '#111b2b',
    padding: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heading: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.2,
  },
  modePill: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#35517a',
    backgroundColor: '#13233a',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  modePillText: {
    color: '#b9d7ff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputBox: {
    flex: 1,
    gap: 6,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a4f70',
    backgroundColor: '#0b1322',
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    paddingHorizontal: 12,
  },
  effortRow: {
    flexDirection: 'row',
    gap: 6,
  },
  effortButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d1525',
    paddingHorizontal: 4,
  },
  effortButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  footerRow: {
    gap: 10,
  },
  warmupToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101927',
  },
  checkboxChecked: {
    borderColor: theme.colors.warning,
    backgroundColor: '#4f3c1a',
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#ffd996',
  },
  warmupText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  confirmButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  confirmButtonDisabled: {
    backgroundColor: '#3d4e64',
  },
  confirmButtonText: {
    color: '#081910',
    fontWeight: '900',
    fontSize: 15,
  },
});
