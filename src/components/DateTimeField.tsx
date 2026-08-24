import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { fmtDate, fmtTime } from '../lib/dates';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { CalendarIcon, ChevronRightIcon } from './icons';
import { Body, Card, Row } from './ui';

interface Props {
  value: number;
  onChange: (next: number) => void;
  label?: string;
  /** Refuse a moment in the future — a workout cannot have happened tomorrow. */
  maxDate?: Date;
}

/** Tappable date and time row. Android shows the two pickers in sequence. */
export function DateTimeField({ value, onChange, label = 'Date & time', maxDate }: Props) {
  const c = useTheme();
  const [stage, setStage] = useState<'idle' | 'date' | 'time'>('idle');
  const [draft, setDraft] = useState<number>(value);

  const open = () => {
    setDraft(value);
    setStage('date');
  };

  return (
    <>
      <Pressable onPress={open} testID="datetime-field">
        <Card style={{ paddingHorizontal: 14, minHeight: 54, justifyContent: 'center' }}>
          <Row style={{ gap: 12 }}>
            <CalendarIcon size={19} color={c.secondary} strokeWidth={1.8} />
            <Body style={{ flex: 1 }}>{label}</Body>
            <Body style={{ color: c.emphasisLow, fontSize: 14.5, fontFamily: fonts.medium }}>
              {fmtDate(value)}, {fmtTime(value)}
            </Body>
            <ChevronRightIcon color={c.dim} />
          </Row>
        </Card>
      </Pressable>

      {stage === 'date' && (
        <DateTimePicker
          value={new Date(draft)}
          mode="date"
          maximumDate={maxDate ?? new Date()}
          onChange={(event, picked) => {
            if (event.type !== 'set' || !picked) {
              setStage('idle');
              return;
            }
            // Keep the existing clock time; the next stage adjusts it.
            const merged = new Date(draft);
            merged.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
            setDraft(merged.getTime());
            setStage('time');
          }}
        />
      )}

      {stage === 'time' && (
        <DateTimePicker
          value={new Date(draft)}
          mode="time"
          onChange={(event, picked) => {
            setStage('idle');
            if (event.type !== 'set' || !picked) {
              onChange(draft); // keep the chosen date even if time is dismissed
              return;
            }
            const merged = new Date(draft);
            merged.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
            onChange(merged.getTime());
          }}
        />
      )}
      <View />
    </>
  );
}

/**
 * The same date-then-time sequence with no visible row: opens as soon as it is
 * mounted. Used where a date is requested as a step in a flow.
 */
export function DateTimePrompt({ initial, onPicked, onCancel, maxDate }: {
  initial: number;
  onPicked: (at: number) => void;
  onCancel: () => void;
  maxDate?: Date;
}) {
  const [stage, setStage] = useState<'date' | 'time'>('date');
  const [draft, setDraft] = useState(initial);

  if (stage === 'date') {
    return (
      <DateTimePicker
        value={new Date(draft)}
        mode="date"
        maximumDate={maxDate ?? new Date()}
        onChange={(event, picked) => {
          if (event.type !== 'set' || !picked) {
            onCancel();
            return;
          }
          const merged = new Date(draft);
          merged.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
          setDraft(merged.getTime());
          setStage('time');
        }}
      />
    );
  }
  return (
    <DateTimePicker
      value={new Date(draft)}
      mode="time"
      onChange={(event, picked) => {
        if (event.type !== 'set' || !picked) {
          onPicked(draft); // keep the date even if the time step is dismissed
          return;
        }
        const merged = new Date(draft);
        merged.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
        onPicked(merged.getTime());
      }}
    />
  );
}
