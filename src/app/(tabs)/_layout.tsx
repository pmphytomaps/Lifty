import { Tabs } from 'expo-router';
import React from 'react';
import { fonts } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { BarbellIcon, CalendarIcon, ChartIcon } from '../../components/icons';

export default function TabsLayout() {
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
        tabBarStyle: {
          backgroundColor: c.tabBg,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: 76,
          paddingTop: 8,
        },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, marginTop: 3 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Workout', tabBarIcon: ({ color }) => <BarbellIcon color={String(color)} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: ({ color }) => <CalendarIcon color={String(color)} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarIcon: ({ color }) => <ChartIcon color={String(color)} /> }}
      />
    </Tabs>
  );
}
