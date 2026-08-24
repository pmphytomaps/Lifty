import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import { notify } from '../../components/Dialog';
import { BackIcon } from '../../components/icons';
import { Body, Button, Cap, Card, Row, Title } from '../../components/ui';
import { countInRange, exportCsv } from '../../export/csv';
import { createBackup } from '../../export/backup';
import { FolderSaveUnsupported, saveToFolder, writeCacheFile } from '../../lib/fileio';
import { useSettings } from '../../state/settings';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { surface } from '../../lib/reportError';

const DAY = 86400000;
const PRESETS = [
  { key: 'Last 30 days', days: 30 },
  { key: 'Last 3 months', days: 92 },
  { key: 'This year', days: -1 },
  { key: 'All time', days: 0 },
] as const;

function rangeFor(p: (typeof PRESETS)[number]): { from: number; to: number } {
  const to = Date.now() + DAY;
  if (p.days === 0) return { from: 0, to };
  if (p.days === -1) return { from: new Date(new Date().getFullYear(), 0, 1).getTime(), to };
  return { from: Date.now() - p.days * DAY, to };
}

function stamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export default function ExportScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const markBackupDone = useSettings((s) => s.markBackupDone);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>(PRESETS[1]);
  const [format, setFormat] = useState<'csv' | 'json'>('json');
  const [counts, setCounts] = useState<{ workouts: number; sets: number }>({ workouts: 0, sets: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { from, to } = rangeFor(preset);
    countInRange(from, to).then(setCounts).catch(surface('Could not read your workout counts.'));
  }, [preset]);

  const buildFile = async (): Promise<{ filename: string; contents: string; mime: string }> => {
    if (format === 'csv') {
      const { from, to } = rangeFor(preset);
      return {
        filename: `lifty-workouts-${stamp()}.csv`,
        contents: await exportCsv(from, to),
        mime: 'text/csv',
      };
    }
    const backup = await createBackup();
    return {
      filename: `lifty-backup-${stamp()}.json`,
      contents: JSON.stringify(backup),
      mime: 'application/json',
    };
  };

  const doShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const f = await buildFile();
      const uri = await writeCacheFile(f.filename, f.contents);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: f.mime, dialogTitle: f.filename });
      }
      if (format === 'json') await markBackupDone(Date.now());
    } catch (e) {
      await notify('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doSaveToFolder = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const f = await buildFile();
      const ok = await saveToFolder(f.filename, f.contents, f.mime);
      if (ok) {
        if (format === 'json') await markBackupDone(Date.now());
        await notify('Saved', `${f.filename} was written to the folder you picked.`);
      }
    } catch (e) {
      if (e instanceof FolderSaveUnsupported) {
        await notify('Not available here', 'Use "Share / send" instead — it can save to Drive, Files or anywhere else.');
      } else {
        await notify('Save failed', e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 16, height: 52, gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginLeft: -6, padding: 4 }}>
          <BackIcon color={c.emphasisLow} />
        </Pressable>
        <Title style={{ fontSize: 26 }}>Export</Title>
      </Row>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <View style={{ gap: 8 }}>
          <Cap>Format</Cap>
          <Row style={{ gap: 9, alignItems: 'stretch' }}>
            <FormatCard
              title="JSON backup"
              blurb="Everything, restorable. This is the one that protects your history."
              active={format === 'json'}
              onPress={() => setFormat('json')}
            />
            <FormatCard
              title="CSV"
              blurb="One row per set. Opens in Sheets or Excel."
              active={format === 'csv'}
              onPress={() => setFormat('csv')}
            />
          </Row>
        </View>

        {format === 'csv' ? (
          <View style={{ gap: 8 }}>
            <Cap>Date range</Cap>
            <Row style={{ gap: 7, flexWrap: 'wrap' }}>
              {PRESETS.map((p) => {
                const on = p.key === preset.key;
                return (
                  <Pressable key={p.key} onPress={() => setPreset(p)} style={{
                    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999,
                    backgroundColor: on ? c.accent : 'transparent',
                    borderWidth: on ? 0 : 1, borderColor: c.borderStrong,
                  }}>
                    <Text style={{
                      fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 13,
                      color: on ? c.onAccent : c.emphasis,
                    }}>{p.key}</Text>
                  </Pressable>
                );
              })}
            </Row>
            <Body style={{ fontSize: 12.5, color: c.secondary }}>
              {counts.workouts} workouts · {counts.sets} sets in this range
            </Body>
          </View>
        ) : (
          <Card style={{ padding: 13 }}>
            <Body style={{ fontSize: 13, color: c.secondary, lineHeight: 19 }}>
              A backup always contains everything — workouts, routines, records and settings —
              so it can be restored onto a new phone exactly as it is now.
            </Body>
          </Card>
        )}

        <Button label={busy ? 'Working…' : 'Share / send'} onPress={doShare} disabled={busy} />
        <Button label="Save to a folder on this phone" kind="outline" onPress={doSaveToFolder} disabled={busy} />
        <Body style={{ fontSize: 12, color: c.dim, textAlign: 'center', lineHeight: 17 }}>
          Tip: share the JSON backup to your Google Drive now and then.{'\n'}A phone can be lost — your training history doesn&apos;t have to be.
        </Body>
      </ScrollView>
    </View>
  );
}

function FormatCard({ title, blurb, active, onPress }: {
  title: string; blurb: string; active: boolean; onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} style={{
      flex: 1, padding: 12, borderRadius: 11, gap: 4,
      borderWidth: 1.5, borderColor: active ? c.accent : c.borderStrong,
      backgroundColor: active ? c.accentSoft : 'transparent',
    }}>
      <Row style={{ gap: 7 }}>
        <View style={{
          width: 15, height: 15, borderRadius: 999,
          borderWidth: active ? 4.5 : 1.5, borderColor: active ? c.accent : c.dim,
        }} />
        <Body style={{ fontFamily: fonts.bold, fontSize: 14.5 }}>{title}</Body>
      </Row>
      <Body style={{ fontSize: 11.5, color: c.secondary, lineHeight: 16 }}>{blurb}</Body>
    </Pressable>
  );
}
