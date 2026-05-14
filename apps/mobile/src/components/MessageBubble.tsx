import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Modal, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCheck, Check, X, Download } from 'lucide-react-native';
import { CircularProgress } from './CircularProgress';

import { useTheme } from '../theme';
import { useAuthStore } from '../store/useAuthStore';
import Animated, { FadeIn, FadeInUp, Layout } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';

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
  const [isSaving, setIsSaving] = useState(false);

  const isAnniversary = !!currentUserProfile?.anniversaryDate;
  const isGirl = currentUserProfile?.gender === 'Female';

  const hasMedia = imageUrl || videoUrl || localImageUrl || localVideoUrl;

  const handleSaveToGallery = async () => {
    try {
      // ── DYNAMIC CHECK FOR NATIVE MODULE ──
      let MediaLibrary;
      try {
        MediaLibrary = require('expo-media-library');
      } catch (e) {
        Alert.alert(
          'Rebuild Required', 
          'The "Save to Gallery" feature requires a fresh build. Please run "npx expo run:android" or "ios" to enable this!'
        );
        return;
      }

      setIsSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your gallery to save photos.');
        return;
      }

      const remoteUrl = localImageUrl || localVideoUrl || imageUrl || videoUrl;
      if (!remoteUrl) return;

      const filename = remoteUrl.split('/').pop()?.split('?')[0] || 'luvv_media.jpg';
      const fileUri = FileSystem.documentDirectory + filename;

      // Download first
      const { uri } = await FileSystem.downloadAsync(remoteUrl, fileUri);
      
      // Save to gallery
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('Luvv', asset, false);
      
      Alert.alert('Saved! ✅', 'Photo saved to your Luvv album.');
    } catch (err) {
      console.error('[MessageBubble] Save failed:', err);
      Alert.alert('Save Failed', 'Could not save to gallery.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Animated.View 
      entering={FadeInUp.duration(400).springify()}
      layout={Layout.springify()}
      style={[
        styles.container, 
        isMe ? styles.myMessage : styles.partnerMessage,
        Platform.OS === 'android' && { transform: [{ scaleY: -1 }] }
      ]}
    >
      <Pressable 
        ref={bubbleRef}
        onLongPress={() => onLongPress?.(bubbleRef)}
        onPress={() => hasMedia && !isPending && setIsPreviewOpen(true)}
      >
      {isMe ? (
        <LinearGradient
          colors={[theme.primary, theme.primary + 'DD']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.bubble,
            { borderBottomRightRadius: 4, borderRadius: theme.radius.lg },
            hasMedia && { padding: 2 }
          ]}
        >
          <View style={styles.bubbleContent}>
            {hasMedia && (
              <View>
                <Image 
                  source={{ uri: localImageUrl || localVideoUrl || imageUrl || videoUrl }} 
                  style={[styles.image, isPending && { opacity: 0.6 }]} 
                  resizeMode="cover"
                />
                {isPending && (
                  <Animated.View 
                    entering={FadeIn.duration(300)}
                    style={styles.uploadOverlay}
                  >
                    <CircularProgress 
                      progress={uploadProgress} 
                      onCancel={() => onCancelUpload?.(id)}
                    />
                  </Animated.View>
                )}
              </View>
            )}
            {content ? <Text style={[styles.text, { color: '#FFFFFF', paddingHorizontal: hasMedia ? 12 : 0, paddingBottom: hasMedia ? 8 : 0 }]}>{content}</Text> : null}
          </View>
        </LinearGradient>
      ) : (
        <View style={[
          styles.bubble, 
          { backgroundColor: theme.bubblePartner, borderBottomLeftRadius: 4 },
          { borderRadius: theme.radius.lg },
          hasMedia && { padding: 4 }
        ]}>
          <View style={styles.bubbleContent}>
            {hasMedia && (
              <Image 
                source={{ uri: localImageUrl || localVideoUrl || imageUrl || videoUrl }} 
                style={styles.image} 
                resizeMode="cover"
              />
            )}
            {content ? <Text style={[styles.text, { color: theme.text, paddingHorizontal: hasMedia ? 12 : 0, paddingBottom: hasMedia ? 8 : 0 }]}>{content}</Text> : null}
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
        <View style={styles.previewOverlay}>
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={() => setIsPreviewOpen(false)} 
          />
          
          <TouchableOpacity 
            style={styles.closePreviewBtn}
            onPress={() => setIsPreviewOpen(false)}
            hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
            activeOpacity={0.7}
          >
            <X size={28} color="white" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.downloadBtn}
            onPress={handleSaveToGallery}
            disabled={isSaving}
          >
            <Download size={24} color="white" />
          </TouchableOpacity>
          
          <View style={styles.fullImageContainer} pointerEvents="none">
            <Image 
              source={{ uri: localImageUrl || localVideoUrl || imageUrl || videoUrl }} 
              style={styles.fullImage} 
              resizeMode="contain" 
            />
          </View>
        </View>
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
                  ? (isAnniversary ? '#FFD700' : (isGirl ? theme.heartPink : theme.primary)) 
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
    gap: 4,
  },
  image: {
    width: 260,
    height: 260,
    borderRadius: 20, // Match bubble radius for a seamless look
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
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 20,
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
  downloadBtn: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 60 : 40,
    right: 30,
    zIndex: 10,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fullImageContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});
