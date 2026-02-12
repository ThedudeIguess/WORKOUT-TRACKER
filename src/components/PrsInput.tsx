import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';

interface PrsInputProps {
  value: number | null;
  onChange: (value: number) => void;
}

export function PrsInput({ value, onChange }: PrsInputProps) {
  const values = Array.from({ length: 11 }, (_, index) => index);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perceived Recovery Status (0-10)</Text>
      <View style={styles.grid}>
        {values.map((score) => {
          const selected = value === score;
          return (
            <Pressable
              accessibilityRole="button"
              key={score}
              onPress={() => onChange(score)}
              style={({ pressed }) => [
                styles.button,
                selected && styles.buttonSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.buttonLabel, selected && styles.buttonLabelSelected]}>
                {score}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  button: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg1,
  },
  buttonSelected: {
    backgroundColor: theme.colors.accentDim,
    borderColor: theme.colors.accent,
  },
  buttonLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  buttonLabelSelected: {
    color: theme.colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
});
