import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';

interface ExerciseCardProps {
  title: string;
  setSummary: string;
  targetLabel: string;
  notes?: string | null;
  expanded: boolean;
  completed?: boolean;
  accentColor?: string;
  onToggle: () => void;
  onOpenSwap: () => void;
  progressionHint?: string | null;
  children?: React.ReactNode;
}

export function ExerciseCard({
  title,
  setSummary,
  targetLabel,
  notes,
  expanded,
  completed = false,
  accentColor = theme.colors.borderFocus,
  onToggle,
  onOpenSwap,
  progressionHint,
  children,
}: ExerciseCardProps) {
  return (
    <View
      style={[
        styles.card,
        { borderLeftColor: accentColor },
        expanded && styles.cardExpanded,
        completed && styles.cardComplete,
      ]}
    >
      <Pressable onPress={onToggle} style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.notesInline}>{notes ?? targetLabel}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.subtitle}>{setSummary}</Text>
            <View style={[styles.statusPill, completed && styles.statusPillComplete]}>
              <Text style={[styles.statusText, completed && styles.statusTextComplete]}>
                {completed ? 'COMPLETE' : 'ACTIVE'}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.toggleText}>{expanded ? 'HIDE' : 'OPEN'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.expandedContent}>
          <View style={styles.actionRow}>
            <Text style={styles.target}>{targetLabel}</Text>
            <Pressable
              onPress={onOpenSwap}
              style={({ pressed }) => [styles.swapButton, pressed && styles.pressed]}
            >
              <Text style={styles.swapText}>Swap</Text>
            </Pressable>
          </View>

          {progressionHint ? (
            <View style={styles.hintBanner}>
              <Text style={styles.hintText}>UP {progressionHint}</Text>
            </View>
          ) : null}

          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    backgroundColor: theme.colors.bg2,
    overflow: 'hidden',
  },
  cardExpanded: {
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
  },
  cardComplete: {
    borderColor: theme.colors.accent,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.lg,
    fontWeight: '800',
  },
  notesInline: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  statusPill: {
    minHeight: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  statusPillComplete: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  statusText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusTextComplete: {
    color: theme.colors.accent,
  },
  toggleText: {
    color: theme.colors.info,
    fontWeight: '800',
    fontSize: theme.fontSize.xs,
    letterSpacing: 0.5,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  target: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  swapButton: {
    minHeight: 38,
    minWidth: 80,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg1,
    paddingHorizontal: 10,
  },
  swapText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
  },
  hintBanner: {
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  hintText: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
