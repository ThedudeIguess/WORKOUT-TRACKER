import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';

interface ExerciseCardProps {
  title: string;
  setSummary: string;
  targetLabel: string;
  notes?: string | null;
  expanded: boolean;
  completed?: boolean;
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
  onToggle,
  onOpenSwap,
  progressionHint,
  children,
}: ExerciseCardProps) {
  return (
    <View style={[styles.card, expanded && styles.cardExpanded, completed && styles.cardComplete]}>
      <Pressable onPress={onToggle} style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.subtitle}>{setSummary}</Text>
            <View style={[styles.statusPill, completed && styles.statusPillComplete]}>
              <Text style={[styles.statusText, completed && styles.statusTextComplete]}>
                {completed ? 'Complete' : 'In Progress'}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.toggleText}>{expanded ? 'Hide' : 'Open'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.expandedContent}>
          <View style={styles.metaRow}>
            <Text style={styles.target}>{targetLabel}</Text>
            <Pressable onPress={onOpenSwap} style={styles.swapButton}>
              <Text style={styles.swapText}>Swap Exercise</Text>
            </Pressable>
          </View>

          {notes ? <Text style={styles.notes}>{notes}</Text> : null}

          {progressionHint ? <Text style={styles.hint}>{progressionHint}</Text> : null}

          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#0c1422',
    overflow: 'hidden',
  },
  cardExpanded: {
    borderColor: '#3a4f70',
    backgroundColor: '#0f1829',
  },
  cardComplete: {
    borderColor: '#2f6b56',
  },
  header: {
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleText: {
    color: theme.colors.info,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusPill: {
    minHeight: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#41577a',
    backgroundColor: '#15253f',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  statusPillComplete: {
    borderColor: '#2f6b56',
    backgroundColor: '#163529',
  },
  statusText: {
    color: '#b9d7ff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  statusTextComplete: {
    color: '#99f0c9',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#324a70',
    padding: 12,
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  target: {
    color: '#d3deef',
    fontSize: 13,
    fontWeight: '700',
  },
  swapButton: {
    minHeight: 44,
    minWidth: 116,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#456797',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a2940',
    paddingHorizontal: 12,
  },
  swapText: {
    color: '#d6e7ff',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  notes: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  hint: {
    color: theme.colors.success,
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: '#173326',
    borderWidth: 1,
    borderColor: '#2d6d53',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
});
