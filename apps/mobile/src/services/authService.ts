import { authInstance, GoogleAuthProvider } from './firebase';

export const authService = {
  /**
   * Login with email and password
   */
  login: async (email: string, password: string) => {
    try {
      const userCredential = await authInstance.signInWithEmailAndPassword(email, password);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Signup with email and password
   */
  signup: async (email: string, password: string) => {
    try {
      const userCredential = await authInstance.createUserWithEmailAndPassword(email, password);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Logout the current user
   */
  logout: async () => {
    try {
      await authInstance.signOut();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Sign in with phone number (triggers OTP)
   */
  signInWithPhone: async (phoneNumber: string) => {
    try {
      // Native Firebase handles recaptcha automatically
      const confirmation = await authInstance.signInWithPhoneNumber(phoneNumber);
      return confirmation;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Verify OTP code
   */
  verifyOTP: async (confirmationResult: any, code: string) => {
    try {
      const userCredential = await confirmationResult.confirm(code);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Sign in with Google using ID Token
   */
  signInWithGoogle: async (idToken: string) => {
    try {
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await authInstance.signInWithCredential(googleCredential);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  }
};
