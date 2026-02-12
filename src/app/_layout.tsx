import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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
      <SafeAreaProvider>
        <SafeAreaView style={styles.centeredScreen}>
          <StatusBar style="light" />
          <Text style={styles.errorTitle}>Failed to start app</Text>
          <Text style={styles.errorText}>{error}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centeredScreen}>
          <StatusBar style="light" />
          <ActivityIndicator color={theme.colors.accent} size="large" />
          <Text style={styles.loadingText}>Preparing your tracker...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.bg1,
          },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: {
            color: theme.colors.textPrimary,
            fontWeight: '700',
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: theme.colors.bg1,
          },
        }}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centeredScreen: {
    flex: 1,
    backgroundColor: theme.colors.bg1,
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
