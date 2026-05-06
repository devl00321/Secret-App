import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  limit,
  Timestamp,
  doc,
  deleteDoc,
  writeBatch,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { encryptionService } from '../services/encryptionService';
import * as FileSystem from 'expo-file-system/legacy';
import { deleteObject } from 'firebase/storage';

interface Message {
  id: string;
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  type?: 'text' | 'image' | 'video';
  senderId: string;
  coupleId: string;
  createdAt?: Timestamp | null;
  isRead?: boolean;
  isDelivered?: boolean;
  isPending?: boolean;
  localImageUrl?: string;
  localVideoUrl?: string;
  storagePath?: string;
  localTimestamp: number;
}

interface ChatState {
  messages: Message[];
  hiddenMessageIds: string[];
  uploadProgress: Record<string, number>;
  uploadTasks: Record<string, any>;
  loading: boolean;
  clearMessages: () => void;
  subscribeToMessages: (coupleId: string, currentUserId: string) => () => void;
  sendMessage: (text: string, senderId: string, coupleId: string, imageUrl?: string) => Promise<void>;
  sendMedia: (uri: string, type: 'image' | 'video', senderId: string, coupleId: string) => Promise<void>;
  cancelUpload: (messageId: string) => void;
  deleteMessage: (messageId: string, coupleId: string) => Promise<void>;
  deleteMessageLocally: (messageId: string) => void;
  markMessagesAsRead: (coupleId: string, currentUserId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      hiddenMessageIds: [],
      uploadProgress: {},
      uploadTasks: {},
      loading: false,

      clearMessages: () => set({ messages: [], hiddenMessageIds: [], loading: false }),

      subscribeToMessages: (coupleId, currentUserId) => {
        set({ loading: true });
        
        const q = query(
          collection(db, 'couples', coupleId, 'messages'),
          orderBy('createdAt', 'desc'),
          limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          set((state) => {
            let updatedMessages = [...state.messages];
            const { hiddenMessageIds } = state;

            snapshot.docChanges().forEach((change) => {
              const data = change.doc.data();
              const id = change.doc.id;
              
              if (change.type === 'added') {
                // Mark as delivered if from partner (Receiving end)
                if (data.senderId !== currentUserId && !data.isDelivered) {
                  updateDoc(change.doc.ref, { isDelivered: true });
                }

                // Decrypt and add if not already present
                if (!updatedMessages.find(m => m.id === id) && !hiddenMessageIds.includes(id)) {
                  const createdAtMillis = data.createdAt?.toMillis?.() || Date.now();
                  const newMessage: Message = {
                    id,
                    ...data,
                    text: encryptionService.decrypt(data.text || '', coupleId),
                    localTimestamp: createdAtMillis,
                  } as Message;
                  
                  updatedMessages.push(newMessage);

                  // AUTO-DOWNLOAD MEDIA (Fire and forget in background)
                  if (newMessage.imageUrl || newMessage.videoUrl) {
                    const remoteUrl = newMessage.imageUrl || newMessage.videoUrl;
                    const isVideo = !!newMessage.videoUrl;
                    // Decode and flatten the filename to avoid directory structure issues on Android
                    const urlPath = remoteUrl!.split('/o/')[1]?.split('?')[0] || '';
                    const decodedPath = decodeURIComponent(urlPath);
                    const extension = decodedPath.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
                    const filename = `media_${id}.${extension}`;
                    
                    const localUri = `${(FileSystem as any).documentDirectory}${filename}`;
                    
                    FileSystem.getInfoAsync(localUri).then(async (fileInfo) => {
                      if (!fileInfo.exists) {
                        const { uri } = await FileSystem.downloadAsync(remoteUrl!, localUri);
                        set(state => ({
                          messages: state.messages.map(m => 
                            m.id === id ? { ...m, localImageUrl: isVideo ? undefined : uri, localVideoUrl: isVideo ? uri : undefined } : m
                          )
                        }));
                      } else {
                        set(state => ({
                          messages: state.messages.map(m => 
                            m.id === id ? { ...m, localImageUrl: isVideo ? undefined : fileInfo.uri, localVideoUrl: isVideo ? fileInfo.uri : undefined } : m
                          )
                        }));
                      }
                    }).catch(err => console.error('Auto-download failed:', err));
                  }
                }
              }

              if (change.type === 'modified') {
                updatedMessages = updatedMessages.map(m => 
                  m.id === id 
                    ? { 
                        ...m, 
                        ...data, 
                        text: encryptionService.decrypt(data.text || '', coupleId),
                        localTimestamp: m.localTimestamp || data.createdAt?.toMillis?.() || Date.now()
                      } 
                    : m
                );

                // PRIVACY CLEANUP TRIGGER (Sender side)
                // If I sent it and partner read it, wait 2m then wipe from cloud
                if (data.senderId === currentUserId && data.isRead) {
                  const storagePath = data.storagePath;
                  setTimeout(async () => {
                    try {
                      await deleteDoc(doc(db, 'couples', coupleId, 'messages', id));
                      if (storagePath) {
                        const storageRef = ref(storage, `chat_media/${storagePath}`);
                        await deleteObject(storageRef);
                      }
                    } catch (e) {}
                  }, 120000);
                }
              }

              if (change.type === 'removed') {
                const existing = updatedMessages.find(m => m.id === id);
                // Only delete locally if it was NEVER read (true Un-send)
                if (existing && !existing.isRead) {
                  updatedMessages = updatedMessages.filter(m => m.id !== id);
                }
              }
            });

            // Cleanup any pending messages that are now in the cloud
            const cloudIds = new Set(snapshot.docs.map(d => d.id));
            updatedMessages = updatedMessages.filter(m => {
              if (m.isPending && cloudIds.has(m.id)) return false; // Redundant
              return true;
            });

            // Final sorting using the permanent local anchor
            updatedMessages.sort((a, b) => a.localTimestamp - b.localTimestamp);

            return { messages: updatedMessages, loading: false };
          });
        });
        
        return unsubscribe;
      },

      sendMedia: async (uri, type, senderId, coupleId) => {
        const tempId = `temp-${Date.now()}`;
        
        // 1. Create Optimistic Local Message
        const tempMsg: any = {
          id: tempId,
          text: '',
          senderId,
          coupleId,
          createdAt: null,
          _localTime: Date.now(),
          isRead: false,
          isDelivered: false,
          isPending: true,
          localTimestamp: Date.now(),
          type,
          imageUrl: type === 'image' ? uri : undefined,
          videoUrl: type === 'video' ? uri : undefined,
        };

        set(state => ({ 
          messages: [...state.messages, tempMsg],
          uploadProgress: { ...state.uploadProgress, [tempId]: 0 }
        }));

        try {
          // 2. Prepare Storage Reference
          const extension = uri.split('.').pop();
          const fileName = `${coupleId}/${Date.now()}.${extension}`;
          const storageRef = ref(storage, `chat_media/${fileName}`);
          
          // Convert URI to Blob
          const response = await fetch(uri);
          const blob = await response.blob();
          
          // 3. Start Upload
          const uploadTask = uploadBytesResumable(storageRef, blob);
          
          set(state => ({
            uploadTasks: { ...state.uploadTasks, [tempId]: uploadTask }
          }));

          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              set(state => ({
                uploadProgress: { ...state.uploadProgress, [tempId]: progress }
              }));
            }, 
            (error) => {
              console.error('Upload Error:', error);
              // Handle error (e.g., remove temp message)
              set(state => {
                const newMsgs = state.messages.filter(m => m.id !== tempId);
                return { messages: newMsgs };
              });
            }, 
            async () => {
              // 4. On Complete
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              // Send actual Firestore message
              await addDoc(collection(db, 'couples', coupleId, 'messages'), {
                text: '',
                senderId,
                createdAt: serverTimestamp(),
                isRead: false,
                isDelivered: false,
                imageUrl: type === 'image' ? downloadURL : null,
                videoUrl: type === 'video' ? downloadURL : null,
                storagePath: fileName,
                type,
              });

              // Cleanup temp message and progress
              set(state => {
                const { [tempId]: _, ...restProgress } = state.uploadProgress;
                const { [tempId]: __, ...restTasks } = state.uploadTasks;
                return {
                  messages: state.messages.filter(m => m.id !== tempId),
                  uploadProgress: restProgress,
                  uploadTasks: restTasks
                };
              });
            }
          );
        } catch (err) {
          console.error('sendMedia failed:', err);
        }
      },

      cancelUpload: (messageId) => {
        const task = get().uploadTasks[messageId];
        if (task) {
          task.cancel();
          set(state => {
            const { [messageId]: _, ...restTasks } = state.uploadTasks;
            const { [messageId]: __, ...restProgress } = state.uploadProgress;
            return {
              messages: state.messages.filter(m => m.id !== messageId),
              uploadTasks: restTasks,
              uploadProgress: restProgress
            };
          });
        }
      },

      sendMessage: async (text, senderId, coupleId, imageUrl) => {
        try {
          const encryptedText = encryptionService.encrypt(text, coupleId);
          const messageData = {
            text: encryptedText,
            senderId,
            imageUrl: imageUrl || null,
            createdAt: serverTimestamp(),
            isRead: false,
            isDelivered: false,
          };

          await addDoc(collection(db, 'couples', coupleId, 'messages'), messageData);
        } catch (error) {
          console.error('Error sending message:', error);
        }
      },

      deleteMessage: async (messageId: string, coupleId: string) => {
        // Optimistic UI update
        set((state) => ({
          messages: state.messages.filter(m => m.id !== messageId)
        }));

        try {
          await deleteDoc(doc(db, 'couples', coupleId, 'messages', messageId));
        } catch (error) {
          console.error('Error deleting message from cloud:', error);
        }
      },

      deleteMessageLocally: (messageId) => {
        set((state) => ({
          messages: state.messages.filter(m => m.id !== messageId),
          hiddenMessageIds: [...state.hiddenMessageIds, messageId]
        }));
      },

      markMessagesAsRead: async (coupleId, currentUserId) => {
        try {
          const { getDocs } = await import('firebase/firestore');
          const messagesRef = collection(db, 'couples', coupleId, 'messages');
          const q = query(
            messagesRef,
            where('senderId', '!=', currentUserId),
            where('isRead', '==', false)
          );

          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) return;

          const batch = writeBatch(db);
          querySnapshot.docs.forEach((msgDoc) => {
            batch.update(msgDoc.ref, { isRead: true });
          });
          await batch.commit();
        } catch (error) {
          console.error('Error marking messages as read:', error);
        }
      },
    }),
    {
      name: 'luvv-chat-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        messages: state.messages,
        hiddenMessageIds: state.hiddenMessageIds
      }),
    }
  )
);
