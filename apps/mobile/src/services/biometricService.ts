import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

export const biometricService = {
  /**
   * Check if the device has biometric hardware and if any biometrics are enrolled.
   */
  isBiometricAvailable: async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  },

  /**
   * Authenticate the user using biometrics (FaceID/Fingerprint).
   * @returns boolean indicating success
   */
  authenticate: async (reason: string = 'Access your secure location data') => {
    try {
      const isAvailable = await biometricService.isBiometricAvailable();
      
      if (!isAvailable) {
        // If biometrics are not available, we skip for now 
        return true; 
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      return result.success;
    } catch (error) {
      console.error('[BiometricService] Authentication error:', error);
      return false;
    }
  },

  /**
   * Shows a security alert if authentication fails
   */
  showSecurityAlert: () => {
    Alert.alert(
      'Security Lock 🔒',
      'Authentication is required to access this screen. This keeps your location data safe if someone else has your phone.',
      [{ text: 'OK' }]
    );
  }
};
