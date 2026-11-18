import { requireNativeModule } from 'expo-modules-core';

export type GoogleCredentialNativeModule = {
  /**
   * Opens the native Android Credential Manager account picker (bottom sheet)
   * and resolves with a Google ID token.
   */
  signIn(serverClientId: string): Promise<string>;
};

export default requireNativeModule<GoogleCredentialNativeModule>('GoogleCredential');
