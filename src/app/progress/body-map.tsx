import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';

export default function BodyMapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Body Map</Text>
      <Text style={styles.text}>Phase 4 visual muscle map placeholder.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: 24,
    gap: 8,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  text: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
