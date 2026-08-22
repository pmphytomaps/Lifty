import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts, muscleColors } from '../theme/tokens';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View style={[{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14 }, style]}>
      {children}
    </View>
  );
}

export function Cap({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useTheme();
  return (
    <Text style={[{
      fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1,
      textTransform: 'uppercase', color: c.muted,
    }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, style, numberOfLines }: {
  children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number;
}) {
  const c = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.regular, fontSize: 15, color: c.text }, style]}>
      {children}
    </Text>
  );
}

export function Stat({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useTheme();
  return (
    <Text style={[{ fontFamily: fonts.condBold, fontSize: 24, color: c.text }, style]}>
      {children}
    </Text>
  );
}

export function Title({ children, style, numberOfLines }: {
  children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number;
}) {
  const c = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.condBold, fontSize: 26, color: c.text }, style]}>
      {children}
    </Text>
  );
}

export function Button({ label, onPress, kind = 'primary', style, disabled }: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'outline' | 'danger-text' | 'good';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const c = useTheme();
  const base: ViewStyle = {
    height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.45 : 1,
  };
  const bg: ViewStyle =
    kind === 'primary' ? { backgroundColor: c.accent }
      : kind === 'good' ? { backgroundColor: c.good }
        : kind === 'outline' ? { borderWidth: 1.5, borderColor: c.borderStrong }
          : {};
  const color = kind === 'primary' ? c.onAccent : kind === 'good' ? c.onGood : kind === 'danger-text' ? c.danger : c.text;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [base, bg, { opacity: pressed ? 0.75 : disabled ? 0.45 : 1 }, style]}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color }}>{label}</Text>
    </Pressable>
  );
}

export function MuscleChip({ muscle, small }: { muscle: string; small?: boolean }) {
  const color = muscleColors[muscle] ?? muscleColors.Other;
  return (
    <View style={{
      backgroundColor: `${color}26`, borderRadius: 999,
      paddingHorizontal: small ? 9 : 12, paddingVertical: small ? 3 : 5,
    }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: small ? 11.5 : 12, color }}>{muscle}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});

export function Divider() {
  const c = useTheme();
  return <View style={{ height: 1, backgroundColor: c.divider, marginHorizontal: 14 }} />;
}
