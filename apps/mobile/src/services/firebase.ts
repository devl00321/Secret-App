import 'react-native-get-random-values';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// Core exports to silence deprecation warnings
export const db = firestore();
export const serverTimestamp = () => firestore.FieldValue.serverTimestamp();
export { auth };
export const storageInstance = storage();
