import { create } from 'zustand';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../services/firebase';

interface Message {
  id: string;
  text: string;
  senderId: string;
  coupleId: string;
  createdAt?: Timestamp | null;
}

interface ChatState {
  messages: Message[];
  loading: boolean;
  clearMessages: () => void;
  subscribeToMessages: (coupleId: string) => () => void;
  sendMessage: (text: string, senderId: string, coupleId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  loading: false,
  clearMessages: () => set({ messages: [], loading: false }),

  subscribeToMessages: (coupleId) => {
    set({ loading: true });
    
    const q = query(
      collection(db, 'messages'),
      where('coupleId', '==', coupleId),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      
      set({ messages, loading: false });
    });

    return () => {
      unsubscribe();
      set({ messages: [], loading: false });
    };
  },

  sendMessage: async (text, senderId, coupleId) => {
    try {
      await addDoc(collection(db, 'messages'), {
        text,
        senderId,
        coupleId,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  },
}));
