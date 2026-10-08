/**
 * OneDelivery — Mobile Security Utilities
 * Runtime integrity checks, biometric auth helpers,
 * root/jailbreak detection, SSL pinning guidance
 */
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

// ── Secure Storage Wrapper ─────────────────────────────────────────────────────
// ALL sensitive data must go through this — never AsyncStorage
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "onedelivery.keychain",
  requireAuthentication: false,
};

export const SecureStorage = {
  async set(key: string, value: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
      return true;
    } catch (err) {
      console.error("[SecureStorage] set error:", err);
      return false;
    }
  },

  async get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key, SECURE_OPTIONS);
    } catch (err) {
      console.error("[SecureStorage] get error:", err);
      return null;
    }
  },

  async delete(key: string): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
      return true;
    } catch {
      return false;
    }
  },

  async clearAll(keys: string[]): Promise<void> {
    await Promise.allSettled(keys.map((k) => SecureStore.deleteItemAsync(k)));
  },
};

// ── Biometric Authentication ──────────────────────────────────────────────────
export async function checkBiometricAvailability(): Promise<{
  available: boolean;
  type: string[];
}> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
    const types       = await LocalAuthentication.supportedAuthenticationTypesAsync();

    const typeNames = types.map((t) => {
      if (t === LocalAuthentication.AuthenticationType.FINGERPRINT)  return "Fingerprint";
      if (t === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) return "Face ID";
      if (t === LocalAuthentication.AuthenticationType.IRIS)          return "Iris";
      return "Unknown";
    });

    return { available: hasHardware && isEnrolled, type: typeNames };
  } catch {
    return { available: false, type: [] };
  }
}

export async function authenticateWithBiometric(reason = "Confirm your identity"): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: "Use passcode",
      disableDeviceFallback: false,
      cancelLabel: "Cancel",
    });
    return result.success;
  } catch {
    return false;
  }
}

// ── Root / Jailbreak Detection ────────────────────────────────────────────────
// Soft detection — log and warn, but don't hard-block (reduces false positives)
// For hard enforcement, integrate with Play Integrity API / DeviceCheck on native side
export function checkDeviceIntegrity(): { compromised: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (Platform.OS === "android") {
    // These checks are heuristic — not foolproof without native Play Integrity
    // A proper implementation requires a native module or react-native-device-info
    const suspicious = [
      typeof (global as any).__frida_agent__ !== "undefined",
      typeof (global as any).cytia         !== "undefined",
    ].filter(Boolean);

    if (suspicious.length > 0) reasons.push("Debugging tools detected");
  }

  return { compromised: reasons.length > 0, reasons };
}

// ── Anti-Screenshot (Android) ─────────────────────────────────────────────────
// Call in screens with sensitive data (checkout, profile)
// Requires FLAG_SECURE — set via react-native-screens or native module
export function sensitiveScreenWarning() {
  if (process.env.EXPO_PUBLIC_APP_ENV === "production") {
    // In a full native build, use:
    // import { setFlagSecure } from 'react-native-flag-secure-android';
    // setFlagSecure(true);
    console.warn("[Security] FLAG_SECURE not set — add react-native-flag-secure-android for production");
  }
}

// ── Certificate Pinning Note ──────────────────────────────────────────────────
// Expo Go does NOT support certificate pinning.
// For production builds, use:
//   react-native-ssl-pinning: https://github.com/MaxToyberman/react-native-ssl-pinning
// Pin your API server's certificate SHA-256 hashes in that library's config.

// ── Session Security ──────────────────────────────────────────────────────────
// Clerk handles JWT rotation. This helper clears any local state on sign-out.
export async function secureSignOut(): Promise<void> {
  // Clear all secure store keys on sign-out
  await SecureStorage.clearAll([
    "onedelivery_user_prefs",
    "onedelivery_draft_order",
  ]);
}
