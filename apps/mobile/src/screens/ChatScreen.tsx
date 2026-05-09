import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  View, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  Text,
  Keyboard,
  Alert,
  AlertButton
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { MessageBubble } from '../components/MessageBubble';
import { MessageContextMenu } from '../components/MessageContextMenu';
import { Send, Image as ImageIcon, Plus, Heart } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/chat';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTheme } from '../theme';
import Animated, { FadeIn } from 'react-native-reanimated';

export const ChatScreen = () => {
  const theme = useTheme();
  const [message, setMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);
  
  // Context Menu State
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<{ id: string; text: string; isMe: boolean; imageUrl?: string; createdAt?: any } | null>(null);
  const [messagePosition, setMessagePosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const { user, coupleId } = useAuthStore();
  const { 
    messages, 
    sendMessage, 
    sendMedia, 
    cancelUpload, 
    uploadProgress, 
    subscribeToMessages, 
    clearMessages, 
    deleteMessage, 
    markMessagesAsRead, 
    deleteMessageLocally 
  } = useChatStore();
  const { readReceiptsEnabled } = useSettingsStore();

  // 1. Subscribe to real-time messages
  useEffect(() => {
    if (!coupleId || !user?.uid) {
      clearMessages();
      return;
    }
    return subscribeToMessages(coupleId, user.uid);
  }, [coupleId, user?.uid, clearMessages, subscribeToMessages]);

  // 2. Mark messages as read when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (coupleId && user?.uid && readReceiptsEnabled) {
        markMessagesAsRead(coupleId, user.uid);
      }
    }, [messages.length, coupleId, user?.uid, readReceiptsEnabled])
  );

  const handlePickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your photos to send them!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && user?.uid && coupleId) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'image';
      sendMedia(asset.uri, type, user.uid, coupleId);
    }
  };

  const handleSend = async () => {
    if (message.trim() && user?.uid && coupleId) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      const text = message;
      setMessage(''); // Clear input immediately
      
      await sendMessage(text, user.uid, coupleId);
    }
  };

  const handleMessageLongPress = (messageId: string, text: string, isMe: boolean, imageUrl: string | undefined, createdAt: any, ref: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (ref?.current) {
      ref.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setMessagePosition({ x, y, width, height });
        setSelectedMessage({ id: messageId, text, isMe, imageUrl, createdAt });
        setContextMenuVisible(true);
      });
    }
  };

  const handleUnsend = () => {
    if (!selectedMessage) return;
    Alert.alert(
      'Unsend Message?',
      'Within 2 min, this removes it for everyone. After that, only for you.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unsend', style: 'destructive', onPress: () => {
          if (coupleId) deleteMessage(selectedMessage.id, coupleId);
        } }
      ]
    );
  };

  const handleDeleteLocally = () => {
    if (!selectedMessage) return;
    deleteMessageLocally(selectedMessage.id);
  };


  const renderEmptyState = () => (
    <View style={[
      styles.emptyContainer, 
      Platform.OS === 'ios' && { transform: [{ scaleY: -1 }] }
    ]}>
      <View style={[styles.emptyHeartWrapper, { backgroundColor: theme.surface, ...theme.shadows.soft }]}>
        <Heart size={40} color={theme.heartPink} fill={theme.heartPink} opacity={0.2} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>Start your story on Luvv ❤️</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textLight }]}>Every message is a memory in the making.</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Private Chat" showBack />
      
      <View style={styles.chatContainer}>
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={Keyboard.dismiss} 
          style={StyleSheet.absoluteFill}
        />
        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()} // Newest at bottom with inverted={true}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isMe = item.senderId === user?.uid;
            return (
              <MessageBubble 
                id={item.id}
                content={item.text} 
                imageUrl={item.imageUrl}
                localImageUrl={item.localImageUrl}
                localVideoUrl={item.localVideoUrl}
                isMe={isMe} 
                isRead={item.isRead}
                timestamp={item.createdAt?.toDate?.() ? item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'} 
                onLongPress={(ref) => handleMessageLongPress(item.id, item.text, isMe, item.imageUrl, item.createdAt, ref)}
                isDelivered={item.isDelivered}
                isPending={item.isPending}
                uploadProgress={uploadProgress[item.id]}
                onCancelUpload={cancelUpload}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          inverted={true}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.inputArea, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={styles.inputRow}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => Alert.alert('More', 'More features coming soon!')}
              activeOpacity={0.7}
              hitSlop={{ top: 20, bottom: 20, left: 15, right: 15 }}
            >
              <Plus color={theme.textLight} size={24} />
            </TouchableOpacity>
            
            <View style={[styles.inputFieldWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Write something sweet..."
                value={message}
                onChangeText={setMessage}
                multiline
                placeholderTextColor={theme.textLight + '90'}
              />
              <TouchableOpacity 
                style={styles.innerIconButton}
                onPress={handlePickMedia}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 5 }}
              >
                <ImageIcon color={theme.textLight} size={20} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[
                styles.sendButton, 
                { backgroundColor: theme.primary },
                !message.trim() && { backgroundColor: theme.primary + '50', elevation: 0, shadowOpacity: 0 }
              ]} 
              onPress={handleSend}
              disabled={!message.trim()}
              activeOpacity={0.7}
              hitSlop={{ top: 15, bottom: 15, left: 0, right: 15 }}
            >
              <View pointerEvents="none">
                <Send color="white" size={20} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* CUSTOM CONTEXT MENU */}
      <MessageContextMenu
        visible={contextMenuVisible}
        onClose={() => setContextMenuVisible(false)}
        messageText={selectedMessage?.text || ''}
        imageUrl={selectedMessage?.imageUrl}
        messagePosition={messagePosition}
        isMe={selectedMessage?.isMe || false}
        createdAt={selectedMessage?.createdAt}
        onCopy={() => {
          if (selectedMessage) Clipboard.setStringAsync(selectedMessage.text);
        }}
        onUnsend={handleUnsend}
        onDelete={handleDeleteLocally}
        onReply={() => Alert.alert('Reply', 'Reply feature coming soon!')}
        onEdit={() => Alert.alert('Edit', 'Edit feature coming soon!')}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    paddingBottom: 30,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 260, // Increased to push it higher up in the inverted list
  },
  emptyHeartWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    maxWidth: '70%',
    lineHeight: 22,
    fontWeight: '600',
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 6 : 10, 
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputFieldWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    minHeight: 48,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontWeight: '600',
  },
  innerIconButton: {
    padding: 6,
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
