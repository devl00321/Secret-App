import 'react-native-get-random-values';
import auth, { getAuth, FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore, {
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp as firestoreServerTimestamp,
  FieldValue,
  Timestamp as FirestoreTimestamp,
  runTransaction,
  getFirestore,
  writeBatch,
  getDocs,
} from '@react-native-firebase/firestore';
import storage, { getStorage } from '@react-native-firebase/storage';

// ── Modular singleton instances ──────────────────────────────────────────────
// Use getFirestore(), getAuth(), getStorage() to avoid the namespaced
// `firebase.app()` call which triggers the "getApp()" deprecation warning.
const db = getFirestore();
const authInstance = getAuth();
const storageInstance = getStorage();

// Re-export Firestore modular helpers
export {
  db,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  writeBatch,
  FieldValue,
  FirestoreTimestamp,
  runTransaction,
};

// Re-export auth singleton and provider
export { authInstance, storageInstance };
export const GoogleAuthProvider = auth.GoogleAuthProvider;
export type { FirebaseAuthTypes };

export const serverTimestamp = () => firestoreServerTimestamp();
