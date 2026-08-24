import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { CheckIcon } from './icons';

export interface SheetOption {
  label: string;
  hint?: string;
  destructive?: boolean;
  selected?: boolean;
  onPress?: () => void;
}

interface SheetConfig {
  title?: string;
  message?: string;
  options: SheetOption[];
  /** Called when the sheet closes without a choice, so awaiting callers settle. */
  onDismiss?: () => void;
}

interface SheetState {
  visible: boolean;
  title?: string;
  message?: string;
  options: SheetOption[];
  onDismiss?: () => void;
  chosen: boolean;
  open(cfg: SheetConfig): void;
  close(): void;
  choose(o: SheetOption): void;
}

const useSheet = create<SheetState>((set, get) => ({
  visible: false,
  options: [],
  chosen: false,
  open: (cfg) => {
    get().onDismiss?.(); // never strand a previous caller
    set({ ...cfg, visible: true, chosen: false });
  },
  close: () => {
    const { chosen, onDismiss } = get();
    set({ visible: false, onDismiss: undefined });
    if (!chosen) onDismiss?.();
  },
  choose: (o) => {
    set({ visible: false, chosen: true, onDismiss: undefined });
    o.onPress?.();
  },
}));

/**
 * Android's Alert renders at most three buttons and silently drops the rest,
 * so any menu longer than that must go through here.
 */
export function showActionSheet(cfg: SheetConfig): void {
  useSheet.getState().open(cfg);
}

export function ActionSheetHost() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const visible = useSheet((s) => s.visible);
  const title = useSheet((s) => s.title);
  const message = useSheet((s) => s.message);
  const options = useSheet((s) => s.options);
  const close = useSheet((s) => s.close);
  const pick = useSheet((s) => s.choose);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            borderColor: c.border,
            paddingBottom: insets.bottom + 10,
            maxHeight: '78%',
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: c.borderStrong }} />
          </View>

          {(title || message) && (
            <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, gap: 3 }}>
              {title && (
                <Text numberOfLines={2} style={{ fontFamily: fonts.condBold, fontSize: 21, color: c.text }}>
                  {title}
                </Text>
              )}
              {message && (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: c.secondary, lineHeight: 18 }}>
                  {message}
                </Text>
              )}
            </View>
          )}

          <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 6 }}>
            {options.map((o, i) => (
              <Pressable
                key={`${o.label}-${i}`}
                onPress={() => pick(o)}
                style={({ pressed }) => ({
                  minHeight: 56,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderTopWidth: 1,
                  borderTopColor: c.divider,
                  backgroundColor: pressed ? c.input : 'transparent',
                })}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{
                    fontFamily: o.selected ? fonts.bold : fonts.medium,
                    fontSize: 16,
                    color: o.destructive ? c.danger : o.selected ? c.accent : c.text,
                  }}>
                    {o.label}
                  </Text>
                  {o.hint && (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: c.dim }}>{o.hint}</Text>
                  )}
                </View>
                {o.selected && <CheckIcon size={19} color={c.accent} strokeWidth={2.8} />}
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={close}
            style={{
              marginHorizontal: 16,
              marginTop: 8,
              height: 50,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: c.borderStrong,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: c.emphasisLow }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
