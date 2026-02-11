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
      <Text style={styles.title}>How recovered do you feel? (0-10)</Text>
      <View style={styles.grid}>
        {values.map((score) => {
          const selected = value === score;
          return (
            <Pressable
              accessibilityRole="button"
              key={score}
              onPress={() => onChange(score)}
              style={[styles.button, selected && styles.buttonSelected]}
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
    gap: 12,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  buttonSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  buttonLabel: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonLabelSelected: {
    color: '#04150f',
  },
});
