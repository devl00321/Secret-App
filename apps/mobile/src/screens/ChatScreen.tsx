import React, { useState, useRef, useEffect } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { MessageBubble } from '../components/MessageBubble';
import { Send, Image as ImageIcon, Plus, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/chat';
import { useTheme } from '../theme';
import Animated, { FadeIn } from 'react-native-reanimated';

export const ChatScreen = () => {
  const theme = useTheme();
  const [message, setMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);
  
  const { user, coupleId } = useAuthStore();
  const { messages, sendMessage, subscribeToMessages, clearMessages, deleteMessage } = useChatStore();

  useEffect(() => {
    if (!coupleId) {
      clearMessages();
      return;
    }

    const unsubscribe = subscribeToMessages(coupleId);

    return () => unsubscribe();
  }, [clearMessages, coupleId, subscribeToMessages]);

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

  const handleMessageLongPress = (messageId: string, text: string, isMe: boolean) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const options: AlertButton[] = [
      {
        text: 'Copy Text',
        onPress: () => {
          Clipboard.setStringAsync(text);
        }
      }
    ];

    if (isMe) {
      options.push({
        text: 'Unsend Message',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Unsend Message?',
            'This message will be removed for everyone.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Unsend', style: 'destructive', onPress: () => deleteMessage(messageId) }
            ]
          );
        }
      });
    }

    options.push({ text: 'Cancel', style: 'cancel', onPress: () => {} });

    Alert.alert('Message Options', '', options);
  };


  const renderEmptyState = () => (
    <Animated.View entering={FadeIn} style={styles.emptyContainer}>
      <View style={[styles.emptyHeartWrapper, { backgroundColor: theme.surface, ...theme.shadows.soft }]}>
        <Heart size={40} color={theme.primary} fill={theme.primary} opacity={0.2} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>Start your story on Luvv ❤️</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textLight }]}>Every message is a memory in the making.</Text>
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Private Chat" showBack />
      
      <View style={styles.chatContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isMe = item.senderId === user?.uid;
            return (
              <MessageBubble 
                content={item.text} 
                isMe={isMe} 
                timestamp={item.createdAt?.toDate?.() ? item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'} 
                onLongPress={() => handleMessageLongPress(item.id, item.text, isMe)}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -20 : 0}
      >
        <View style={[styles.inputArea, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
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
              <TouchableOpacity style={styles.innerIconButton}>
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
              activeOpacity={0.8}
            >
              <Send color="white" size={18} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    marginTop: 140,
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
    paddingVertical: 12,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
