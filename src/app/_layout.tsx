import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { initializeDatabase } from '../db/queries';
import { useSettingsStore } from '../stores/settingsStore';
import { theme } from '../constants/theme';

export default function RootLayout() {
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const initializeSettings = useSettingsStore((state) => state.initializeSettings);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await initializeDatabase();
        await initializeSettings();
        if (mounted) {
          setIsReady(true);
        }
      } catch (bootstrapError) {
        if (mounted) {
          setError(
            bootstrapError instanceof Error
              ? bootstrapError.message
              : 'Initialization failed.'
          );
        }
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [initializeSettings]);

  if (error) {
    return (
      <View style={styles.centeredScreen}>
        <Text style={styles.errorTitle}>Failed to start app</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
        <Text style={styles.loadingText}>Preparing your tracker...</Text>
      </View>
    );
  }

  return <Stack />;
}

const styles = StyleSheet.create({
  centeredScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorTitle: {
    color: theme.colors.danger,
    fontSize: 20,
    fontWeight: '800',
  },
  errorText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
