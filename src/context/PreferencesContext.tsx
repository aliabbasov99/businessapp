import { getActiveUser } from '@/data/queries';
import { saveProfile } from '@/data/api';
import { useDatabase } from '@/hooks/use-database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export const NOTIFICATION_KEYS = [
  'cancel', 'discount', 'daily', 'overdue', 'productReturns',
  'cashIn', 'cashOut', 'stockIn', 'stockLow', 'supplierPayments',
] as const;

export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];
export type Profile = { name: string; email: string; phone: string };
type Preferences = {
  profile: Profile;
  notifications: Record<NotificationKey, boolean>;
  biometric: boolean;
  twoFactor: boolean;
  supportMessages: string[];
};

type DevicePreferences = Omit<Preferences, 'profile'>;
const DEFAULTS: DevicePreferences = {
  notifications: Object.fromEntries(NOTIFICATION_KEYS.map(key => [key, true])) as Preferences['notifications'],
  biometric: false,
  twoFactor: true,
  supportMessages: [],
};
const STORAGE_KEY = 'promar.preferences';
const PreferencesContext = createContext<{
  preferences: Preferences;
  initials: string;
  updatePreferences: (update: Partial<Preferences>) => Promise<boolean>;
} | null>(null);

function readPreferences(raw: string | null): DevicePreferences {
  if (!raw) return DEFAULTS;
  const saved = JSON.parse(raw) as Partial<Preferences> | null;
  if (!saved || typeof saved !== 'object') return DEFAULTS;
  return {
    notifications: Object.fromEntries(NOTIFICATION_KEYS.map(key => [
      key, typeof saved.notifications?.[key] === 'boolean' ? saved.notifications[key] : true,
    ])) as Preferences['notifications'],
    biometric: typeof saved.biometric === 'boolean' ? saved.biometric : false,
    twoFactor: typeof saved.twoFactor === 'boolean' ? saved.twoFactor : true,
    supportMessages: Array.isArray(saved.supportMessages) ? saved.supportMessages.filter((message): message is string => typeof message === 'string').slice(-100) : [],
  };
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  useDatabase();
  const activeUser = getActiveUser();
  const [devicePreferences, setDevicePreferences] = useState(DEFAULTS);
  const preferences: Preferences = { ...devicePreferences, profile: { name: activeUser.name, email: activeUser.email, phone: activeUser.phone ?? '' } };
  const [ready, setReady] = useState(false);
  const current = useRef(DEFAULTS);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      const saved = readPreferences(raw);
      if (mounted) {
        current.current = saved;
        setDevicePreferences(saved);
      }
    }).catch(() => undefined).finally(() => {
      if (mounted) setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  const updatePreferences = useCallback(async (update: Partial<Preferences>) => {
    const write = writes.current.then(async () => {
      const { profile, ...deviceUpdate } = update;
      if (profile) await saveProfile(profile);
      if (Object.keys(deviceUpdate).length) {
        const next = { ...current.current, ...deviceUpdate };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        current.current = next;
        setDevicePreferences(next);
      }
    });
    writes.current = write.catch(() => undefined);
    try {
      await write;
      return true;
    } catch {
      return false;
    }
  }, []);

  if (!ready) return null;
  const initials = preferences.profile.name.trim().split(/\s+/).slice(0, 2)
    .map(part => part.charAt(0)).join('').toLocaleUpperCase('az');

  return (
    <PreferencesContext.Provider value={{ preferences, initials, updatePreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider');
  return context;
}
