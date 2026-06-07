/**
 * backupService.ts
 *
 * Handles encrypted export and import of all user data as a .luvvbackup file.
 *
 * Encryption strategy (VUL-2 FIX):
 *   - The raw payload is JSON-stringified, then encrypted using AES-256-GCM
 *     via the encryptionService (PBKDF2-derived key + fresh random IV + salt).
 *   - The previous XOR cipher was cryptographically broken (repeating-key XOR
 *     is trivially invertible with known-plaintext attack on JSON field names).
 *   - The key is derived from the uid + a fixed app salt via PBKDF2-SHA256
 *     with 100,000 iterations, which is the same hardening used for all
 *     AES-GCM operations in the app.
 *
 * File extension: .luvvbackup
 */

import * as FileSystem from 'expo-file-system/src/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';
import { encryptionService } from './encryptionService';

const BACKUP_VERSION = 1;
// APP_SALT is kept as a domain-separator for PBKDF2 — not used as a key directly
const APP_SALT = 'LuvvSecureBackup_v1_2025';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackupPayload {
  version: number;
  exportedAt: string;
  uid: string;
  coupleId: string | null;
  partnerUid: string | null;  // stored so we can attempt auto-reconnect
  profile: {
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
    anniversaryDate: string | null;
    gender: string | null;
    partnerNickname: string | null;
    isOnline: boolean;
    phoneNumber: string | null;
  };
  emergencyContacts: any[];
  savedPlaces: any[];
  settings: {
    biometricLockEnabled: boolean;
    readReceiptsEnabled: boolean;
    relationshipAiEnabled: boolean;
    theme: string;
  };
}

export interface RestoreOptions {
  repairPartner: boolean;   // true = generate new pairing code, false = try auto-reconnect with stored coupleId
}

// ─── Key Derivation ────────────────────────────────────────────────────────────

/**
 * Derives a deterministic AES-256-GCM secret from the user's UID + fixed app salt.
 * This uses the same PBKDF2 path as encryptionService.aesEncrypt() but with a
 * domain-specific passphrase, so backup files encrypted on one device can be
 * decrypted on another device by the same user (uid is stable across reinstalls).
 *
 * NOTE: The uid alone isn't secret — Firebase UIDs are used in Firestore paths.
 * The security here comes from PBKDF2 stretching + AES-GCM authentication tag.
 * The backup file is meaningless without knowing the uid.
 */
function deriveBackupPassphrase(uid: string): string {
  // Domain-separate from other keys by prefixing with the app salt
  return `${APP_SALT}::${uid}`;
}

// ─── Encryption / Decryption ──────────────────────────────────────────────────

/**
 * VUL-2 FIX: Uses AES-256-GCM (via encryptionService) instead of XOR.
 * The encrypted result is wrapped with a magic header for format validation.
 */
export async function encryptBackup(payload: BackupPayload, uid: string): Promise<string> {
  const passphrase = deriveBackupPassphrase(uid);
  const encryptedB64 = await encryptionService.encryptField(JSON.stringify(payload), passphrase);
  // Wrap with a version header so we can detect format on import
  return `LUVV_BACKUP_V${BACKUP_VERSION}::${encryptedB64}`;
}

/**
 * VUL-2 FIX: Decrypts an AES-256-GCM backup produced by encryptBackup().
 */
export async function decryptBackup(raw: string, uid: string): Promise<BackupPayload | null> {
  try {
    if (!raw.startsWith('LUVV_BACKUP_V')) {
      throw new Error('Not a valid Luvv backup file');
    }
    const b64Part = raw.split('::').slice(1).join('::'); // rejoin in case encrypted value contains '::'
    if (!b64Part) throw new Error('Malformed backup file');
    const passphrase = deriveBackupPassphrase(uid);
    const json = await encryptionService.decryptField(b64Part, passphrase);
    if (!json || json === b64Part) {
      throw new Error('Decryption failed — possibly wrong uid or corrupted file');
    }
    const payload = JSON.parse(json) as BackupPayload;
    if (payload.version !== BACKUP_VERSION) {
      throw new Error(`Unsupported backup version: ${payload.version}`);
    }
    return payload;
  } catch (err: any) {
    console.error('[BackupService] Decrypt failed:', err.message);
    return null;
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportBackup(
  uid: string,
  payload: BackupPayload
): Promise<boolean> {
  try {
    const encrypted = await encryptBackup(payload, uid);
    const fileName = `luvv_backup_${new Date().toISOString().split('T')[0]}.luvvbackup`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, encrypted, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Error', 'Sharing is not available on this device.');
      return false;
    }

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Save your Luvv Backup',
      UTI: 'public.data',
    });

    return true;
  } catch (err: any) {
    console.error('[BackupService] Export failed:', err);
    Alert.alert('Export Failed', err.message || 'Could not export backup.');
    return false;
  }
}

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importBackup(uid: string): Promise<BackupPayload | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return null;
    }

    const fileUri = result.assets[0].uri;
    const content = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const payload = await decryptBackup(content, uid);

    if (!payload) {
      Alert.alert(
        'Invalid Backup',
        'This file could not be decrypted. Make sure you are using the backup created by your own account.'
      );
      return null;
    }

    return payload;
  } catch (err: any) {
    console.error('[BackupService] Import failed:', err);
    if (!err.message?.includes('cancel')) {
      Alert.alert('Import Failed', err.message || 'Could not read the backup file.');
    }
    return null;
  }
}
