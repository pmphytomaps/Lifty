import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

export interface DialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm action in the danger colour. */
  destructive?: boolean;
  /** Omits the cancel action — an acknowledgement rather than a choice. */
  acknowledge?: boolean;
}

interface DialogState {
  visible: boolean;
  opts: DialogOptions | null;
  resolver: ((confirmed: boolean) => void) | null;
  open(opts: DialogOptions, resolver: (confirmed: boolean) => void): void;
  settle(confirmed: boolean): void;
}

const useDialog = create<DialogState>((set, get) => ({
  visible: false,
  opts: null,
  resolver: null,
  open: (opts, resolver) => {
    // Never strand an earlier caller if a second dialog opens over it.
    get().resolver?.(false);
    set({ visible: true, opts, resolver });
  },
  settle: (confirmed) => {
    const { resolver } = get();
    set({ visible: false, resolver: null });
    resolver?.(confirmed);
  },
}));

/**
 * Themed replacement for Alert.alert. Every exit path settles the promise —
 * a backdrop tap or the hardware back button resolves false rather than
 * leaving the caller awaiting forever, which is how the native Alert behaved.
 */
export function confirm(opts: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => useDialog.getState().open(opts, resolve));
}

/** Single-button notice. Resolves once dismissed, however it is dismissed. */
export function notify(title: string, message?: string): Promise<void> {
  return confirm({ title, message, acknowledge: true, confirmLabel: 'OK' }).then(() => undefined);
}

export function DialogHost() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const visible = useDialog((s) => s.visible);
  const opts = useDialog((s) => s.opts);
  const settle = useDialog((s) => s.settle);

  if (!opts) return null;
  const confirmTint = opts.destructive ? c.danger : c.accent;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => settle(false)}
    >
      <Pressable
        onPress={() => settle(false)}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.66)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 26,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: c.card,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: c.border,
            paddingTop: 22,
            paddingHorizontal: 22,
            paddingBottom: 18,
            gap: 10,
          }}
        >
          <Text style={{ fontFamily: fonts.condBold, fontSize: 24, color: c.text, lineHeight: 28 }}>
            {opts.title}
          </Text>

          {opts.message ? (
            <ScrollView bounces={false} style={{ maxHeight: 260 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: c.secondary, lineHeight: 22 }}>
                {opts.message}
              </Text>
            </ScrollView>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {!opts.acknowledge && (
              <Pressable
                onPress={() => settle(false)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 50,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: c.borderStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? c.input : 'transparent',
                })}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: c.emphasisLow }}>
                  {opts.cancelLabel ?? 'Cancel'}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => settle(true)}
              style={({ pressed }) => ({
                flex: 1,
                height: 50,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: confirmTint,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: opts.destructive ? '#FFF3F1' : c.onAccent }}>
                {opts.confirmLabel ?? 'OK'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
