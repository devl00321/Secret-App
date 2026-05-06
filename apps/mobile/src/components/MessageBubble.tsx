import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Modal, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCheck, Check, X } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useAuthStore } from '../store/useAuthStore';
import Animated, { FadeInUp, Layout, useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface MessageBubbleProps {
  id: string;
  content: string;
  isMe: boolean;
  isRead?: boolean;
  isDelivered?: boolean;
  timestamp: string;
  imageUrl?: string;
  videoUrl?: string;
  type?: 'text' | 'image' | 'video';
  isPending?: boolean;
  uploadProgress?: number;
  localImageUrl?: string;
  localVideoUrl?: string;
  onCancelUpload?: (id: string) => void;
  onLongPress?: (ref: any) => void;
}

export const MessageBubble = ({ 
  id,
  content, 
  isMe, 
  isRead, 
  isDelivered,
  timestamp, 
  imageUrl, 
  videoUrl,
  type,
  isPending,
  uploadProgress = 0,
  localImageUrl,
  localVideoUrl,
  onCancelUpload,
  onLongPress 
}: MessageBubbleProps) => {
  const theme = useTheme();
  const { currentUserProfile } = useAuthStore();
  const bubbleRef = React.useRef<View>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const isGirl = currentUserProfile?.gender === 'female';
  const isAnniversary = !!currentUserProfile?.anniversaryDate;

  return (
    <Animated.View 
      entering={FadeInUp.duration(400).springify()}
      layout={Layout.springify()}
      style={[styles.container, isMe ? styles.myMessage : styles.partnerMessage]}
    >
      <Pressable 
        ref={bubbleRef}
        onLongPress={() => onLongPress?.(bubbleRef)}
        onPress={() => (imageUrl || videoUrl) && !isPending && setIsPreviewOpen(true)}
      >
      {isMe ? (
        <LinearGradient
          colors={[theme.primary, theme.primary + 'DD']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.bubble,
            { borderBottomRightRadius: 4, borderRadius: theme.radius.lg },
            (imageUrl || videoUrl || localImageUrl || localVideoUrl) && { padding: 4 }
          ]}
        >
          <View style={styles.bubbleContent}>
            {(imageUrl || videoUrl || localImageUrl || localVideoUrl) && (
              <View>
                <Image 
                  source={{ uri: localImageUrl || localVideoUrl || imageUrl || videoUrl }} 
                  style={[styles.image, isPending && { opacity: 0.6 }]} 
                  resizeMode="cover"
                />
                {isPending && (
                  <View style={styles.uploadOverlay}>
                    <View style={styles.progressRing}>
                      <View style={[styles.progressInner, { height: `${uploadProgress}%` }]} />
                    </View>
                    <Pressable 
                      style={styles.cancelBtn}
                      onPress={() => onCancelUpload?.(id)}
                    >
                      <X size={16} color="white" />
                    </Pressable>
                  </View>
                )}
              </View>
            )}
            {content ? <Text style={[styles.text, { color: '#FFFFFF', paddingHorizontal: (imageUrl || videoUrl) ? 12 : 0, paddingBottom: (imageUrl || videoUrl) ? 8 : 0 }]}>{content}</Text> : null}
          </View>
        </LinearGradient>
      ) : (
        <View style={[
          styles.bubble, 
          { backgroundColor: theme.bubblePartner, borderBottomLeftRadius: 4 },
          { borderRadius: theme.radius.lg },
          (imageUrl || videoUrl || localImageUrl || localVideoUrl) && { padding: 4 }
        ]}>
          <View style={styles.bubbleContent}>
            {(imageUrl || videoUrl || localImageUrl || localVideoUrl) && (
              <Image 
                source={{ uri: localImageUrl || localVideoUrl || imageUrl || videoUrl }} 
                style={styles.image} 
                resizeMode="cover"
              />
            )}
            {content ? <Text style={[styles.text, { color: theme.text, paddingHorizontal: (imageUrl || videoUrl) ? 12 : 0, paddingBottom: (imageUrl || videoUrl) ? 8 : 0 }]}>{content}</Text> : null}
          </View>
        </View>
      )}
      
      {/* FULL SCREEN PREVIEW MODAL */}
      <Modal
        visible={isPreviewOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPreviewOpen(false)}
      >
        <TouchableOpacity 
          style={styles.previewOverlay} 
          activeOpacity={1} 
          onPress={() => setIsPreviewOpen(false)}
        >
          <TouchableOpacity 
            style={styles.closePreviewBtn}
            onPress={() => setIsPreviewOpen(false)}
          >
            <X size={28} color="white" />
          </TouchableOpacity>
          
          <Image 
            source={{ uri: localImageUrl || localVideoUrl || imageUrl || videoUrl }} 
            style={styles.fullImage} 
            resizeMode="contain" 
          />
        </TouchableOpacity>
      </Modal>

      <View style={[styles.timestampContainer, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
        <Text style={[styles.timestamp, { color: theme.textLight }]}>
          {timestamp}
        </Text>
        {isMe && (
          <View style={styles.readIconContainer}>
            {isDelivered || isRead ? (
              <CheckCheck 
                size={14} 
                color={isRead 
                  ? (isAnniversary ? '#FFD700' : (isGirl ? theme.heartPink : '#8B5CF6')) 
                  : theme.textLight
                } 
              />
            ) : (
              <Check 
                size={14} 
                color="#94A3B8" 
              />
            )}
          </View>
        )}
      </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '85%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  partnerMessage: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  bubbleContent: {
    gap: 8,
  },
  image: {
    width: 240,
    height: 240,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginHorizontal: 4,
  },
  timestamp: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.6,
  },
  readIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  readIcon: {
    marginLeft: 4,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
  },
  progressRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  progressInner: {
    width: '100%',
    backgroundColor: 'white',
    opacity: 0.8,
  },
  cancelBtn: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePreviewBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
