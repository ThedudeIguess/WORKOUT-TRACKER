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
        <Text style={styles.heroSubtitle}>
          Everything stays on-device. Export JSON periodically for backup.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data Export</Text>
        <Text style={styles.metaText}>Generate and restore JSON backups of local data.</Text>

        <View style={styles.inlineRow}>
          <Pressable
            disabled={isExporting}
            onPress={() => {
              void exportJson();
            }}
            style={[styles.primaryButton, styles.flexGrow, isExporting && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>
              {isExporting ? 'Exporting...' : 'Export JSON'}
            </Text>
          </Pressable>

          <Pressable
            disabled={isImporting}
            onPress={() => {
              void importJson();
            }}
            style={[styles.secondaryButton, isImporting && styles.primaryButtonDisabled]}
          >
            <Text style={styles.secondaryButtonText}>
              {isImporting ? 'Working...' : 'Import JSON'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Preferences</Text>

        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Units</Text>
          <View style={styles.segmentedRow}>
            <Pressable
              onPress={() => void updateUnits('kg')}
              disabled={isSavingPreferences}
              style={[
                styles.segmentedButton,
                units === 'kg' && styles.segmentedButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentedText,
                  units === 'kg' && styles.segmentedTextActive,
                ]}
              >
                kg
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void updateUnits('lb')}
              disabled={isSavingPreferences}
              style={[
                styles.segmentedButton,
                units === 'lb' && styles.segmentedButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentedText,
                  units === 'lb' && styles.segmentedTextActive,
                ]}
              >
                lb
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Default Rest Timer</Text>
          <View style={styles.restControlRow}>
            <Pressable
              onPress={() => void updateRestSeconds(Math.max(30, defaultRestSeconds - 15))}
              disabled={isSavingPreferences}
              style={styles.restControlButton}
            >
              <Text style={styles.restControlButtonText}>-15s</Text>
            </Pressable>
            <View style={styles.restValuePill}>
              <Text style={styles.restValueText}>{defaultRestSeconds}s</Text>
            </View>
            <Pressable
              onPress={() => void updateRestSeconds(defaultRestSeconds + 15)}
              disabled={isSavingPreferences}
              style={styles.restControlButton}
            >
              <Text style={styles.restControlButtonText}>+15s</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bodyweight Log</Text>
        <Text style={styles.metaText}>
          Latest: {latestBodyweight !== null ? `${latestBodyweight.toFixed(1)} kg` : 'No entries yet'}
        </Text>

        <View style={styles.inlineRow}>
          <TextInput
            value={bodyweightInput}
            onChangeText={setBodyweightInput}
            keyboardType="decimal-pad"
            placeholder="kg"
            placeholderTextColor={theme.colors.textSecondary}
            style={[styles.input, styles.flexGrow]}
          />
          <Pressable
            disabled={isAddingBodyweight}
            onPress={() => void addBodyweight()}
            style={[styles.smallButton, isAddingBodyweight && styles.smallButtonDisabled]}
          >
            <Text style={styles.smallButtonText}>
              {isAddingBodyweight ? 'Saving...' : 'Add'}
            </Text>
          </Pressable>
        </View>

        {bodyweightEntries.length === 0 ? (
          <Text style={styles.metaText}>No bodyweight entries recorded yet.</Text>
        ) : (
          bodyweightEntries.map((entry) => (
            <View key={entry.id} style={styles.bodyweightRow}>
              <Text style={styles.bodyweightDate}>
                {new Date(entry.loggedAt).toLocaleDateString()}
              </Text>
              <Text style={styles.bodyweightValue}>{entry.weightKg.toFixed(1)} kg</Text>
              <Text style={styles.bodyweightSource}>{entry.source}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.metaText}>Offline-only tracker for Hybrid Bodybuilding 2.0.</Text>
        <Pressable onPress={() => router.push('/settings/exercises')} style={styles.linkButton}>
          <Text style={styles.linkText}>Exercise Library Editor</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings/program')} style={styles.linkButton}>
          <Text style={styles.linkText}>Program Settings</Text>
        </Pressable>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  heroTag: {
    color: '#a7c6ec',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: '#ebf3ff',
    fontSize: 23,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#b2c7e3',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#304868',
    backgroundColor: '#0f192a',
    padding: 12,
    gap: 8,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#456075',
  },
  primaryButtonText: {
    color: '#071911',
    fontWeight: '900',
    fontSize: 14,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#39557a',
    backgroundColor: '#122138',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#cce0fa',
    fontWeight: '800',
    fontSize: 13,
  },
  preferenceRow: {
    gap: 7,
  },
  preferenceLabel: {
    color: '#a4bedf',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentedButton: {
    minHeight: 42,
    minWidth: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#39557a',
    backgroundColor: '#122138',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  segmentedButtonActive: {
    borderColor: '#4aa987',
    backgroundColor: '#173f34',
  },
  segmentedText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
  },
  segmentedTextActive: {
    color: '#b8f2d8',
  },
  restControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restControlButton: {
    minHeight: 42,
    minWidth: 66,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#39557a',
    backgroundColor: '#122138',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  restControlButtonText: {
    color: '#cce0fa',
    fontWeight: '800',
  },
  restValuePill: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#44648f',
    backgroundColor: '#17324f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  restValueText: {
    color: '#d8e9ff',
    fontWeight: '900',
    fontSize: 14,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38567a',
    backgroundColor: '#122139',
    color: theme.colors.textPrimary,
    paddingHorizontal: 12,
  },
  flexGrow: {
    flex: 1,
  },
  smallButton: {
    minHeight: 42,
    minWidth: 74,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#39557a',
    backgroundColor: '#122138',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  smallButtonDisabled: {
    opacity: 0.65,
  },
  smallButtonText: {
    color: '#cce0fa',
    fontWeight: '800',
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  bodyweightRow: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2f4565',
    backgroundColor: '#122036',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bodyweightDate: {
    color: '#bad0ea',
    fontWeight: '700',
    fontSize: 12,
  },
  bodyweightValue: {
    color: '#e8f2ff',
    fontWeight: '800',
    fontSize: 13,
  },
  bodyweightSource: {
    color: '#9db5d4',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  linkButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#39557a',
    backgroundColor: '#122138',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  linkText: {
    color: '#deebff',
    fontWeight: '800',
  },
});
