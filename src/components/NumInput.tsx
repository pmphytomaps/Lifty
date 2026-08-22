import React, { useEffect, useRef, useState } from 'react';
import { TextInput, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

interface Props {
  value: number | null;
  onCommit: (v: number | null) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  integer?: boolean;
  width?: number;
  completed?: boolean;
  placeholder?: string;
}

function fmt(v: number | null, integer: boolean): string {
  if (v == null) return '';
  return integer ? String(Math.round(v)) : (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
}

/** Numeric field: keeps local text while editing, commits on blur, tracks external changes. */
export function NumInput({ value, onCommit, onFocus, onBlur, integer = false, width = 80, completed = false, placeholder }: Props) {
  const c = useTheme();
  const [text, setText] = useState(fmt(value, integer));
  const [focused, setFocused] = useState(false);
  const latest = useRef(value);

  useEffect(() => {
    latest.current = value;
    if (!focused) setText(fmt(value, integer));
  }, [value, focused, integer]);

  const commit = () => {
    const cleaned = text.replace(',', '.').trim();
    if (cleaned === '') {
      onCommit(null);
    } else {
      const n = Number(cleaned);
      if (Number.isFinite(n) && n >= 0) onCommit(integer ? Math.round(n) : Math.round(n * 100) / 100);
      else setText(fmt(latest.current, integer));
    }
  };

  const style: StyleProp<TextStyle> = {
    width,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 16.5,
    paddingVertical: 0,
    color: completed ? c.text : c.text,
    backgroundColor: completed ? 'transparent' : c.input,
    borderColor: completed ? 'transparent' : focused ? c.accent : c.borderStrong,
  };

  return (
    <TextInput
      value={text}
      onChangeText={setText}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      style={style}
      placeholder={placeholder}
      placeholderTextColor={c.faint}
      selectTextOnFocus
      onFocus={() => { setFocused(true); onFocus?.(); }}
      onBlur={() => { setFocused(false); commit(); onBlur?.(); }}
    />
  );
}
