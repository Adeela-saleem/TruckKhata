import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureNotifications } from '../services/reminders';
import { AppProvider } from '../ui/context';
import { DialogProvider } from '../ui/dialog';
import { colors } from '../ui/theme';

export default function RootLayout() {
  useEffect(configureNotifications, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppProvider fallback={<View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.brand} size="large" /></View>}>
        <DialogProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }} />
        </DialogProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
