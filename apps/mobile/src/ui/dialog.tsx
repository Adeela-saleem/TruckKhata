import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppError } from '../db/core';
import { useApp } from './context';
import { T } from './text';
import { Button } from './controls';
import { colors, space } from './theme';

export type DialogAction = { label: string; value: string; tone?: 'primary' | 'danger' | 'plain' };
type DialogRequest = { title: string; message?: string; lines?: string[]; actions: DialogAction[] };

type DialogApi = {
  ask: (request: DialogRequest) => Promise<string | null>;
  confirm: (title: string, message: string, label: string, tone?: 'primary' | 'danger', lines?: string[]) => Promise<boolean>;
  toast: (message: string) => void;
  showError: (error: unknown) => void;
};

const DialogContext = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useApp();
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const resolver = useRef<((value: string | null) => void) | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));

  const close = useCallback((value: string | null) => {
    setRequest(null);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  const api = useMemo<DialogApi>(() => {
    const ask: DialogApi['ask'] = (next) => new Promise((resolve) => {
      resolver.current = resolve;
      setRequest(next);
    });
    return {
      ask,
      confirm: async (title, message, label, tone = 'primary', lines) =>
        (await ask({ title, message, lines, actions: [{ label, value: 'yes', tone }, { label: t('actions.cancel'), value: 'no', tone: 'plain' }] })) === 'yes',
      toast: (message) => {
        setToastText(message);
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.delay(1800),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setToastText(null));
      },
      showError: (error) => {
        if (!(error instanceof AppError)) console.error(error);
        const key = error instanceof AppError ? error.key : 'errors.unknown';
        ask({ title: t('errors.title'), message: t(key), actions: [{ label: t('actions.ok'), value: 'ok', tone: 'primary' }] });
      },
    };
  }, [opacity, t]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {toastText && (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
          <T color={colors.white} variant="bodyStrong">{toastText}</T>
        </Animated.View>
      )}
      <Modal visible={request !== null} transparent animationType="fade" onRequestClose={() => close(null)}>
        <Pressable style={styles.backdrop} onPress={() => close(null)}>
          <Pressable style={styles.box} accessibilityViewIsModal>
            <T variant="title">{request?.title}</T>
            {request?.message ? <T>{request.message}</T> : null}
            {request?.lines?.map((line) => <T key={line} color={colors.crimson}>{line}</T>)}
            <View style={styles.actions}>
              {request?.actions.map((a) => <Button key={a.value} label={a.label} tone={a.tone ?? 'plain'} onPress={() => close(a.value)} />)}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const value = useContext(DialogContext);
  if (!value) throw new Error('useDialog must be used inside DialogProvider');
  return value;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(21,25,43,0.55)', justifyContent: 'center', padding: space.lg },
  box: { backgroundColor: colors.card, borderRadius: 14, padding: space.lg, gap: space.md, maxWidth: 480, width: '100%', alignSelf: 'center' },
  actions: { gap: space.sm, marginTop: space.xs },
  toast: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: colors.ink, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: 24, maxWidth: '90%' },
});
