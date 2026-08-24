import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ActionSheetHost } from '../components/ActionSheet';
import { migrate, setDb } from '../db/database';
import { openExpoDriver } from '../db/expoDriver';
import { seedExercises, seedRoutines } from '../db/seed';
import { useSettings } from '../state/settings';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const c = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.bg === '#0F0E0D' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="exercise/picker" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="exercise/create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <ActionSheetHost />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Barlow-Regular': require('../../assets/fonts/Barlow-Regular.ttf'),
    'Barlow-Medium': require('../../assets/fonts/Barlow-Medium.ttf'),
    'Barlow-SemiBold': require('../../assets/fonts/Barlow-SemiBold.ttf'),
    'Barlow-Bold': require('../../assets/fonts/Barlow-Bold.ttf'),
    'BarlowCondensed-SemiBold': require('../../assets/fonts/BarlowCondensed-SemiBold.ttf'),
    'BarlowCondensed-Bold': require('../../assets/fonts/BarlowCondensed-Bold.ttf'),
  });
  const [dbReady, setDbReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const initSettings = useSettings((s) => s.init);

  useEffect(() => {
    (async () => {
      try {
        const db = await openExpoDriver();
        await migrate(db);
        setDb(db);
        await seedExercises(db);
        await seedRoutines(db);
        await initSettings();
        setDbReady(true);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [initSettings]);

  useEffect(() => {
    if ((fontsLoaded && dbReady) || bootError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, dbReady, bootError]);

  if (bootError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0E0D', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ color: '#F4F1EA', fontSize: 16, textAlign: 'center' }}>
          Lifty could not open its database.{'\n\n'}{bootError}
        </Text>
      </View>
    );
  }
  if (!fontsLoaded || !dbReady) return <View style={{ flex: 1, backgroundColor: '#0F0E0D' }} />;

  return (
    <ThemeProvider>
      <RootStack />
    </ThemeProvider>
  );
}
