import * as Network from 'expo-network';
import { useCallback, useEffect, useRef, useState } from 'react';

export type NetworkStatusPhase = 'online' | 'offline' | 'checking' | 'success';

// Mirrors the timing of the connectivity notices in the PROMAR prototype.
const CHECK_DELAY_MS = 900;
const SUCCESS_DURATION_MS = 2800;
const TOAST_DURATION_MS = 4200;

function isOnlineState(state: Network.NetworkState | null | undefined) {
  return state?.isConnected !== false && state?.isInternetReachable !== false;
}

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

/**
 * Tracks device connectivity and exposes the same offline / checking /
 * restored phases used by the prototype's connection banner.
 */
export function useNetworkStatus() {
  const state = Network.useNetworkState();
  const online = isOnlineState(state);

  const [phase, setPhase] = useState<NetworkStatusPhase>('online');
  const [toast, setToast] = useState<string | null>(null);

  const onlineRef = useRef(online);
  const wasOffline = useRef(false);
  const checking = useRef(false);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  const clearPhaseTimer = useCallback(() => {
    if (phaseTimer.current) {
      clearTimeout(phaseTimer.current);
      phaseTimer.current = null;
    }
  }, []);

  const clearToast = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast(null);
  }, []);

  const showSuccess = useCallback(() => {
    clearPhaseTimer();
    setPhase('success');
    phaseTimer.current = setTimeout(() => {
      phaseTimer.current = null;
      setPhase('online');
    }, SUCCESS_DURATION_MS);
  }, [clearPhaseTimer]);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => {
      toastTimer.current = null;
      setToast(null);
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    if (online) {
      if (wasOffline.current) {
        wasOffline.current = false;
        clearToast();
        showSuccess();
      }
      return;
    }

    wasOffline.current = true;
    if (checking.current) return;
    clearPhaseTimer();
    setPhase('offline');
  }, [online, clearToast, clearPhaseTimer, showSuccess]);

  const retry = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    clearToast();
    clearPhaseTimer();
    setPhase('checking');

    await wait(CHECK_DELAY_MS);
    const next = await Network.getNetworkStateAsync().catch(() => null);
    checking.current = false;

    if (isOnlineState(next) || onlineRef.current) {
      wasOffline.current = false;
      showSuccess();
      return;
    }

    wasOffline.current = true;
    setPhase('offline');
    showToast('network.toast.stillOffline');
  }, [clearPhaseTimer, clearToast, showSuccess, showToast]);

  const requireOnline = useCallback(() => {
    if (online) return true;
    showToast('network.toast.required');
    return false;
  }, [online, showToast]);

  useEffect(() => () => {
    if (phaseTimer.current) clearTimeout(phaseTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  return { phase, online, toast, retry, requireOnline, showToast };
}
