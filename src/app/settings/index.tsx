import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { theme } from '../../constants/theme';
import {
  exportAllData,
  getBodyweightLog,
  logBodyweight,
  restoreFromExportData,
} from '../../db/queries';
import { useSettingsStore } from '../../stores/settingsStore';
import type { BodyweightEntry, ExportPayload } from '../../types';

export default function SettingsScreen() {
  const router = useRouter();
  const [bodyweightInput, setBodyweightInput] = useState('');
  const [bodyweightEntries, setBodyweightEntries] = useState<BodyweightEntry[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAddingBodyweight, setIsAddingBodyweight] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  const defaultRestSeconds = useSettingsStore((state) => state.defaultRestSeconds);
  const units = useSettingsStore((state) => state.units);
  const setDefaultRestSeconds = useSettingsStore((state) => state.setDefaultRestSeconds);
  const setUnits = useSettingsStore((state) => state.setUnits);

  const refreshBodyweight = useCallback(async () => {
    try {
      const entries = await getBodyweightLog(20);
      setBodyweightEntries(entries);
    } catch (error) {
      Alert.alert(
        'Bodyweight load failed',
        error instanceof Error ? error.message : 'Unknown bodyweight load error.'
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshBodyweight();
    }, [refreshBodyweight])
  );

  const latestBodyweight = useMemo(
    () => bodyweightEntries[0]?.weightKg ?? null,
    [bodyweightEntries]
  );

  const addBodyweight = async () => {
    const weight = Number(bodyweightInput);
    if (!Number.isFinite(weight) || weight <= 0) {
      Alert.alert('Invalid bodyweight', 'Enter a valid number in kg.');
      return;
    }

    setIsAddingBodyweight(true);
    try {
      await logBodyweight({ weightKg: weight });
      setBodyweightInput('');
      await refreshBodyweight();
    } catch (error) {
      Alert.alert(
        'Bodyweight save failed',
        error instanceof Error ? error.message : 'Unknown bodyweight save error.'
      );
    } finally {
      setIsAddingBodyweight(false);
    }
  };

  const updateUnits = async (nextUnits: 'kg' | 'lb') => {
    if (nextUnits === units) {
      return;
    }

    setIsSavingPreferences(true);
    try {
      await setUnits(nextUnits);
    } catch (error) {
      Alert.alert(
        'Preference save failed',
        error instanceof Error ? error.message : 'Could not update units.'
      );
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const updateRestSeconds = async (nextRestSeconds: number) => {
    setIsSavingPreferences(true);
    try {
      await setDefaultRestSeconds(nextRestSeconds);
    } catch (error) {
      Alert.alert(
        'Preference save failed',
        error instanceof Error ? error.message : 'Could not update rest timer.'
      );
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const exportJson = async () => {
    setIsExporting(true);
    try {
      const payload = await exportAllData();
      const directory = FileSystem.cacheDirectory;
      if (!directory) {
        throw new Error('Cache directory unavailable.');
      }

      const fileUri = `${directory}workout-tracker-export-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2));

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Export complete', `Saved to ${fileUri}`);
      }
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Unknown export error.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const parseExportPayload = (raw: string): ExportPayload => {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Import file must be a JSON object.');
    }

    const candidate = parsed as Partial<ExportPayload>;
    if (
      !Array.isArray(candidate.workouts) ||
      !Array.isArray(candidate.sets) ||
      !Array.isArray(candidate.exercises) ||
      !Array.isArray(candidate.exercise_muscle_mappings) ||
      !Array.isArray(candidate.bodyweight_log)
    ) {
      throw new Error('Import file does not match the expected export format.');
    }

    return candidate as ExportPayload;
  };

  const executeRestore = async (payload: ExportPayload) => {
    setIsImporting(true);
    try {
      const summary = await restoreFromExportData(payload);
      await refreshBodyweight();
      Alert.alert(
        'Restore complete',
        `Restored ${summary.workouts} workouts, ${summary.sets} sets, and ${summary.bodyweightEntries} bodyweight entries.`
      );
    } catch (error) {
      Alert.alert(
        'Restore failed',
        error instanceof Error ? error.message : 'Unknown restore error.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const importJson = async () => {
    setIsImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets?.[0];
      if (!selectedAsset?.uri) {
        throw new Error('Could not read selected file.');
      }

      const raw = await FileSystem.readAsStringAsync(selectedAsset.uri);
      const payload = parseExportPayload(raw);

      Alert.alert(
        'Restore from backup?',
        `This will replace current workouts with ${payload.workouts.length} workouts and ${payload.sets.length} sets.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => {
              void executeRestore(payload);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Import failed',
        error instanceof Error ? error.message : 'Unknown import error.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTag}>Settings</Text>
        <Text style={styles.heroTitle}>Local Preferences</Text>
        <Text style={styles.heroSubtitle}>Offline only. Backup with JSON export.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data Backup</Text>
        <View style={styles.rowButtons}>
          <Pressable
            disabled={isExporting}
            onPress={() => {
              void exportJson();
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.flex,
              isExporting && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{isExporting ? 'Exporting...' : 'Export JSON'}</Text>
          </Pressable>

          <Pressable
            disabled={isImporting}
            onPress={() => {
              void importJson();
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              isImporting && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>{isImporting ? 'Working...' : 'Import JSON'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preferences</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Units</Text>
          <View style={styles.segmentedRow}>
            <Pressable
              onPress={() => void updateUnits('kg')}
              disabled={isSavingPreferences}
              style={({ pressed }) => [
                styles.segmentedButton,
                units === 'kg' && styles.segmentedButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.segmentedText, units === 'kg' && styles.segmentedTextActive]}>kg</Text>
            </Pressable>
            <Pressable
              onPress={() => void updateUnits('lb')}
              disabled={isSavingPreferences}
              style={({ pressed }) => [
                styles.segmentedButton,
                units === 'lb' && styles.segmentedButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.segmentedText, units === 'lb' && styles.segmentedTextActive]}>lb</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Default Rest</Text>
          <View style={styles.restControlRow}>
            <Pressable
              onPress={() => void updateRestSeconds(Math.max(30, defaultRestSeconds - 15))}
              disabled={isSavingPreferences}
              style={({ pressed }) => [styles.restControlButton, pressed && styles.pressed]}
            >
              <Text style={styles.restControlButtonText}>-15s</Text>
            </Pressable>
            <View style={styles.restValuePill}>
              <Text style={styles.restValueText}>{defaultRestSeconds}s</Text>
            </View>
            <Pressable
              onPress={() => void updateRestSeconds(defaultRestSeconds + 15)}
              disabled={isSavingPreferences}
              style={({ pressed }) => [styles.restControlButton, pressed && styles.pressed]}
            >
              <Text style={styles.restControlButtonText}>+15s</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bodyweight Log</Text>
        <Text style={styles.metaText}>
          Latest: {latestBodyweight !== null ? `${latestBodyweight.toFixed(1)} kg` : 'No entries'}
        </Text>

        <View style={styles.rowButtons}>
          <TextInput
            value={bodyweightInput}
            onChangeText={setBodyweightInput}
            keyboardType="decimal-pad"
            placeholder="kg"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, styles.flex]}
          />
          <Pressable
            disabled={isAddingBodyweight}
            onPress={() => void addBodyweight()}
            style={({ pressed }) => [
              styles.secondaryButton,
              isAddingBodyweight && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>{isAddingBodyweight ? 'Saving...' : 'Add'}</Text>
          </Pressable>
        </View>

        {bodyweightEntries.length === 0 ? (
          <Text style={styles.metaText}>No bodyweight entries recorded yet.</Text>
        ) : (
          bodyweightEntries.map((entry) => (
            <View key={entry.id} style={styles.logRow}>
              <Text style={styles.logDate}>{new Date(entry.loggedAt).toLocaleDateString()}</Text>
              <Text style={styles.logValue}>{entry.weightKg.toFixed(1)} kg</Text>
              <Text style={styles.logSource}>{entry.source}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.metaText}>Hybrid Bodybuilding tracker running fully on-device.</Text>
        <Pressable
          onPress={() => router.push('/settings/exercises')}
          style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
        >
          <Text style={styles.navLabel}>Exercise Library</Text>
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/settings/program')}
          style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
        >
          <Text style={styles.navLabel}>Program Templates</Text>
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  heroTag: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.xl,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  card: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg2,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.lg,
    fontWeight: '800',
  },
  rowButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#03241d',
    fontWeight: '900',
    fontSize: theme.fontSize.sm,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: theme.fontSize.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  settingLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  segmentedButton: {
    minHeight: 36,
    minWidth: 56,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  segmentedButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentDim,
  },
  segmentedText: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  segmentedTextActive: {
    color: theme.colors.accent,
  },
  restControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  restControlButton: {
    minHeight: 36,
    minWidth: 54,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restControlButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  restValuePill: {
    minHeight: 36,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.bg3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  restValueText: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: theme.fontSize.md,
    fontVariant: ['tabular-nums'],
  },
  input: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
    fontVariant: ['tabular-nums'],
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  logRow: {
    minHeight: 38,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logDate: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  logValue: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
    fontSize: theme.fontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  logSource: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
    textTransform: 'uppercase',
  },
  navRow: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  navArrow: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.7,
  },
});
