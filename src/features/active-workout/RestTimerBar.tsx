import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';

interface RestTimerBarProps {
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  bottomInset: number;
  onPause: () => void;
  onReset: () => void;
  onDismiss: () => void;
}

function formatClock(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    secs
  ).padStart(2, '0')}`;
}

export function RestTimerBar({
  totalSeconds,
  remainingSeconds,
  isRunning,
  bottomInset,
  onPause,
  onReset,
  onDismiss,
}: RestTimerBarProps) {
  if (totalSeconds <= 0) {
    return null;
  }

  const ratio = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const fillColor =
    ratio > 0.5
      ? theme.colors.accent
      : ratio > 0.25
        ? theme.colors.warning
        : theme.colors.danger;

  return (
    <View style={[styles.bar, { bottom: Math.max(10, bottomInset) }]}>
      <View style={styles.headerRow}>
        <Text style={styles.timeBig}>{formatClock(remainingSeconds)}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{isRunning ? 'RUNNING' : 'PAUSED'}</Text>
        </View>
      </View>
      <Text style={styles.label}>
        REST {remainingSeconds}s / {totalSeconds}s
      </Text>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
              backgroundColor: fillColor,
            },
          ]}
        />
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onPause}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>Pause</Text>
        </Pressable>
        <Pressable
          onPress={onReset}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>Reset</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 10,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  timeBig: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: theme.fontSize.xxl,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  statusBadge: {
    minHeight: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  statusText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  label: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.bg1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    minHeight: 36,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: theme.colors.bg3,
  },
  actionText: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  pressed: {
    opacity: 0.7,
  },
});
