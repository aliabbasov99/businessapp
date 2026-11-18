import { Alert } from 'react-native';
import { router } from 'expo-router';

import { loadDatabase, setApiTarget, type AuthUser } from '@/data/api';
import { getSnapshot } from '@/data/database';

/**
 * Shared post-authentication step: point the data layer at this user's D1
 * snapshot, load it, then open the dashboard. Returns false when the data
 * could not be loaded so callers can offer a retry.
 */
export async function finishLogin(user?: AuthUser): Promise<boolean> {
  setApiTarget(user?.database_target);
  const loaded = await loadDatabase();
  if (!loaded && !getSnapshot()) {
    Alert.alert('Şəbəkə xətası', 'Məlumatlar yüklənmədi. İnternet bağlantınızı yoxlayın.');
    return false;
  }
  router.replace('/demo');
  return true;
}
