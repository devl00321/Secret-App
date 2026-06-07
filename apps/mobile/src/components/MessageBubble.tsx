import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Modal, TouchableOpacity, Platform, Alert } from 'react-native';
import { CheckCheck, Check, X, Download, Heart } from 'lucide-react-native';
import { CircularProgress } from './CircularProgress';
import { useTheme } from '../theme';
import Animated, { FadeIn, FadeInUp, Layout, ZoomIn } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/src/legacy';

interface MessageBubbleProps {
  id: string;
  content: string;
  isMe: boolean;
  isRead?: boolean;
  isDelivered?: boolean;
  timestamp: string;
  imageUrl?: string;
  videoUrl?: string;
  type?: 'text' | 'image' | 'video' | 'reaction';
  isPending?: boolean;
  uploadProgress?: number;
  localImageUrl?: string;
  localVideoUrl?: string;
  onCancelUpload?: (id: string) => void;
  onLongPress?: (ref: any) => void;
}

export const MessageBubble = ({ 
  id, content, isMe, isRead, isDelivered, timestamp, 
  imageUrl, videoUrl, type, isPending, uploadProgress = 0,
  localImageUrl, localVideoUrl, onCancelUpload, onLongPress 
}: MessageBubbleProps) => {
  const theme = useTheme();
  const bubbleRef = React.useRef<View>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasMedia = imageUrl || videoUrl || localImageUrl || localVideoUrl;

  const handleSaveToGallery = async () => {
    try {
      let MediaLibrary;
      try { MediaLibrary = require('expo-media-library'); } 
      catch (e) {
        Alert.alert('Rebuild Required', 'Save to Gallery requires a fresh build.');
        return;
      }
      setIsSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission Required', 'Please allow gallery access.');
      const remoteUrl = localImageUrl || localVideoUrl || imageUrl || videoUrl;
      if (!remoteUrl) return;
      const filename = remoteUrl.split('/').pop()?.split('?')[0] || 'luvv_media.jpg';
      const fileUri = FileSystem.documentDirectory + filename;
      const { uri } = await FileSystem.downloadAsync(remoteUrl, fileUri);
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('Luvv', asset, false);
      Alert.alert('Saved! ✅', 'Photo saved to your Luvv album.');
    } catch (err) {
      console.error(err);
      Alert.alert('Save Failed', 'Could not save to gallery.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Animated.View 
      entering={FadeInUp.duration(400).springify()}
      layout={Layout.springify()}
      style={[styles.container, isMe ? styles.myMessage : styles.partnerMessage, Platform.OS === 'android' && { transform: [{ scaleY: -1 }] }]}
    >
      <Pressable 
        ref={bubbleRef}
        onLongPress={() => onLongPress?.(bubbleRef)}
        onPress={() => hasMedia && !isPending && setIsPreviewOpen(true)}
      >
        <View style={[
          styles.bubble,
          { 
            backgroundColor: type === 'reaction' ? (isMe ? theme.accentRose : theme.bgSurface) : (isMe ? theme.accentRoseSoft : theme.bgSurface), 
            borderColor: type === 'reaction' ? theme.accentRose : (isMe ? theme.accentRoseSoft : theme.borderDefault),
            ...(type === 'reaction' && {
              shadowColor: theme.accentRose,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.6,
              shadowRadius: 12,
              elevation: 8,
            })
          },
          isMe ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 },
          hasMedia && { padding: 4 }
        ]}>
          <View style={styles.bubbleContent}>
            {hasMedia && (
              <View>
                <Image source={{ uri: localImageUrl || localVideoUrl || imageUrl || videoUrl }} style={[styles.image, isPending && { opacity: 0.6 }]} resizeMode="cover" />
                {isPending && (
                  <Animated.View entering={FadeIn.duration(300)} style={styles.uploadOverlay}>
                    <CircularProgress progress={uploadProgress} onCancel={() => onCancelUpload?.(id)} />
                  </Animated.View>
                )}
              </View>
            )}
            {content ? (
              <Text style={[styles.text, { 
                color: type === 'reaction' ? (isMe ? 'white' : theme.accentRose) : theme.textPrimary, 
                fontWeight: type === 'reaction' ? '800' : '400',
                paddingHorizontal: hasMedia ? 12 : 0, 
                paddingBottom: hasMedia ? 8 : 0 
              }]}>
                {content}
              </Text>
            ) : null}
            
            {/* FLOATING HEARTS EFFECT FOR REACTIONS */}
            {type === 'reaction' && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Animated.View entering={ZoomIn.duration(600).delay(100).springify()} style={{ position: 'absolute', right: -20, top: -25, transform: [{ rotate: '15deg' }] }}>
                  <Heart size={36} color={theme.accentRose} fill={theme.accentRose} />
                </Animated.View>
                <Animated.View entering={ZoomIn.duration(600).delay(300).springify()} style={{ position: 'absolute', left: -15, bottom: -20, transform: [{ rotate: '-25deg' }] }}>
                  <Heart size={24} color={theme.accentRoseSoft} fill={theme.accentRoseSoft} opacity={0.8} />
                </Animated.View>
                <Animated.View entering={ZoomIn.duration(500).delay(500).springify()} style={{ position: 'absolute', right: 20, bottom: -15, transform: [{ rotate: '10deg' }] }}>
                  <Heart size={18} color={theme.accentRose} fill={theme.accentRose} opacity={0.6} />
                </Animated.View>
              </View>
            )}
          </View>
        </View>
        
        <Modal visible={isPreviewOpen} transparent animationType="fade" onRequestClose={() => setIsPreviewOpen(false)}>
          <View style={styles.previewOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsPreviewOpen(false)} />
            <TouchableOpacity style={styles.closePreviewBtn} onPress={() => setIsPreviewOpen(false)} hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}>
              <X size={28} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.downloadBtn} onPress={handleSaveToGallery} disabled={isSaving}>
              <Download size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.fullImageContainer} pointerEvents="none">
              <Image source={{ uri: localImageUrl || localVideoUrl || imageUrl || videoUrl }} style={styles.fullImage} resizeMode="contain" />
            </View>
          </View>
        </Modal>

        <View style={[styles.timestampContainer, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
          <Text style={[styles.timestamp, { color: theme.textTertiary }]}>{timestamp}</Text>
          {isMe && (
            <View style={styles.readIconContainer}>
              {isDelivered || isRead ? (
                <CheckCheck size={14} color={isRead ? theme.accentRose : theme.textTertiary} />
              ) : (
                <Check size={14} color={theme.textTertiary} />
              )}
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 4, maxWidth: '85%' },
  myMessage: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  partnerMessage: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 16, borderWidth: 1,
  },
  text: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22 },
  bubbleContent: { gap: 4 },
  image: { width: 260, height: 260, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)' },
  timestampContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginHorizontal: 4 },
  timestamp: { fontFamily: 'DMSans_300Light', fontSize: 10 },
  readIconContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 12 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closePreviewBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, right: 20, zIndex: 10, padding: 10 },
  downloadBtn: { position: 'absolute', bottom: Platform.OS === 'ios' ? 60 : 40, right: 30, zIndex: 10, width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  fullImageContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  fullImage: { width: '100%', height: '80%' },
});
