import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, serverTimestamp, storageInstance, collection, doc, addDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, limit, where, getDocs, writeBatch } from '../services/firebase';
import { encryptionService } from '../services/encryptionService';
import * as FileSystem from 'expo-file-system/legacy';

interface Message {
  id: string;
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  type?: 'text' | 'image' | 'video';
  senderId: string;
  coupleId: string;
  createdAt?: any;
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
          if (!snapshot) return;

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

                  // AUTO-DOWNLOAD MEDIA
                  if (newMessage.imageUrl || newMessage.videoUrl) {
                    const remoteUrl = newMessage.imageUrl || newMessage.videoUrl;
                    const isVideo = !!newMessage.videoUrl;
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
                if (data.senderId === currentUserId && data.isRead) {
                  const storagePath = data.storagePath;
                  setTimeout(async () => {
                    try {
                      await deleteDoc(doc(db, 'couples', coupleId, 'messages', id));
                      if (storagePath) {
                        await storageInstance.ref(`chat_media/${storagePath}`).delete();
                      }
                    } catch (e) {}
                  }, 120000);
                }
              }

              if (change.type === 'removed') {
                const existing = updatedMessages.find(m => m.id === id);
                if (existing && !existing.isRead) {
                  updatedMessages = updatedMessages.filter(m => m.id !== id);
                }
              }
            });

            // Final sorting
            updatedMessages.sort((a, b) => a.localTimestamp - b.localTimestamp);

            return { messages: updatedMessages, loading: false };
          });
        });
        
        return unsubscribe;
      },

      sendMedia: async (uri, type, senderId, coupleId) => {
        const tempId = `temp-${Date.now()}`;
        
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
          const extension = uri.split('.').pop();
          const fileName = `${coupleId}/${Date.now()}.${extension}`;
          const storageRef = storageInstance.ref(`chat_media/${fileName}`);
          
          const uploadTask = storageRef.putFile(uri);
          
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
              set(state => ({
                messages: state.messages.filter(m => m.id !== tempId)
              }));
            }, 
            async () => {
              const downloadURL = await storageRef.getDownloadURL();
              
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

              set(state => ({
                messages: state.messages.filter(m => m.id !== tempId),
                uploadProgress: (({ [tempId]: _, ...rest }) => rest)(state.uploadProgress),
                uploadTasks: (({ [tempId]: _, ...rest }) => rest)(state.uploadTasks)
              }));
            }
          );
        } catch (err) {
          console.error('sendMedia failed:', err);
        }
      },

      cancelUpload: (messageId) => {
        const task = get().uploadTasks[messageId];
        if (task) {
          // Native SDK cancel is different if using putFile
          // Actually it has a .pause() / .resume() / .cancel()
          try { task.cancel(); } catch (e) {}
          set(state => ({
            messages: state.messages.filter(m => m.id !== messageId),
            uploadTasks: (({ [messageId]: _, ...rest }) => rest)(state.uploadTasks),
            uploadProgress: (({ [messageId]: _, ...rest }) => rest)(state.uploadProgress)
          }));
        }
      },

      sendMessage: async (text, senderId, coupleId, imageUrl) => {
        try {
          const encryptedText = encryptionService.encrypt(text, coupleId);
          await addDoc(collection(db, 'couples', coupleId, 'messages'), {
            text: encryptedText,
            senderId,
            imageUrl: imageUrl || null,
            createdAt: serverTimestamp(),
            isRead: false,
            isDelivered: false,
          });
        } catch (error) {
          console.error('Error sending message:', error);
        }
      },

      deleteMessage: async (messageId: string, coupleId: string) => {
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
          const messagesRef = collection(db, 'couples', coupleId, 'messages');
          const q = query(
            messagesRef,
            where('senderId', '!=', currentUserId),
            where('isRead', '==', false)
          );
          const snapshot = await getDocs(q);

          if (snapshot.empty) return;

          const batch = writeBatch(db);
          snapshot.docs.forEach((msgDoc) => {
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
