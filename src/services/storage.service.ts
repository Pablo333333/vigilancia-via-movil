/**
 * Capa de persistencia segura para el JWT.
 *
 * Usa expo-secure-store en dispositivos físicos (cifrado en hardware).
 * En emuladores/web, hace fallback a AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'vigilancia_via_access_token';

const isSecureStoreAvailable = Platform.OS !== 'web';

export const StorageService = {
  async saveToken(token: string): Promise<void> {
    if (isSecureStoreAvailable) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    }
  },

  async getToken(): Promise<string | null> {
    if (isSecureStoreAvailable) {
      return SecureStore.getItemAsync(TOKEN_KEY);
    }
    return AsyncStorage.getItem(TOKEN_KEY);
  },

  async removeToken(): Promise<void> {
    if (isSecureStoreAvailable) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  },
};
