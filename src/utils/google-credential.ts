import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type GoogleCredentialNativeModule = {
  /**
   * Opens the native Android Credential Manager account picker (bottom sheet)
   * and resolves with a Google ID token.
   */
  signIn(serverClientId: string): Promise<string>;
};

let nativeModule: GoogleCredentialNativeModule | null = null;

export function isGoogleCredentialAvailable(): boolean {
  return Platform.OS === 'android';
}

export async function signInWithGoogleCredential(serverClientId: string): Promise<string> {
  if (Platform.OS !== 'android') {
    throw new Error('Google Credential Manager yalnız Android-də mövcuddur.');
  }

  if (!nativeModule) {
    nativeModule = requireNativeModule<GoogleCredentialNativeModule>('GoogleCredential');
  }

  return nativeModule.signIn(serverClientId);
}
