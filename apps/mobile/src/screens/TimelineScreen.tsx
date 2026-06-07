import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView as FlatScrollView } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { TimelineItem } from '../components/ui/TimelineItem';
import { 
  Plus,
  MapPin, 
  ShieldAlert, 
  Heart, 
  Navigation2,
  CalendarDays,
  Camera,
  FileText
} from 'lucide-react-native';
import { useTheme } from '../theme';
import { useAuthStore } from '../store/useAuthStore';
import { activityService, Activity } from '../services/activityService';
import { imageService } from '../services/imageService';
import { format } from 'date-fns';
import { BlurView as ExpoBlur } from 'expo-blur';

export const TimelineScreen = () => {
  const theme = useTheme();
  const { coupleId, user, sharedSecret } = useAuthStore();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [captionModalVisible, setCaptionModalVisible] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [modalType, setModalType] = useState<'photo' | 'note'>('photo');

  useEffect(() => {
    if (!coupleId) return;
    const unsubscribe = activityService.subscribeToActivities(coupleId, (data) => {
      setActivities(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [coupleId]);

  useEffect(() => {
    if (sharedSecret && activities.length > 0) {
      const reDecrypt = async () => {
        const decrypted = await activityService.decryptActivities(activities, sharedSecret, coupleId || undefined);
        setActivities(decrypted);
      };
      reDecrypt();
    }
  }, [sharedSecret]);

  const handleAddPhoto = async () => {
    try {
      const compressedUri = await imageService.pickAndCompressImage();
      if (!compressedUri) return;
      setPendingImage(compressedUri);
      setModalType('photo');
      setCaption('');
      setCaptionModalVisible(true);
    } catch (err) {
      console.error('[TimelineScreen] Failed to pick photo:', err);
    }
  };

  const handleShareNote = () => {
    setPendingImage(null);
    setModalType('note');
    setCaption('');
    setCaptionModalVisible(true);
  };

  const handleAddPress = () => {
    Alert.alert(
      "Create Post",
      "Choose what you want to share",
      [
        { text: "Photo / Video", onPress: handleAddPhoto },
        { text: "Text Note", onPress: handleShareNote },
        { text: "Cancel", style: "cancel" }
      ],
      { cancelable: true }
    );
  };

  const handleConfirmUpload = async () => {
    setCaptionModalVisible(false);
    setIsUploading(true);
    try {
      if (modalType === 'photo' && pendingImage) {
        const downloadUrl = await imageService.uploadImage(pendingImage, 'timeline');
        if (downloadUrl) {
          await activityService.logActivity('memory', caption || 'Shared a new photo! 📸', { imageUrl: downloadUrl });
        }
      } else if (modalType === 'note') {
        await activityService.logActivity('memory', caption || 'Pinned a special note 📝');
      }
    } finally {
      setIsUploading(false);
      setPendingImage(null);
      setCaption('');
    }
  };

  const getActivityIcon = (item: Activity) => {
    switch (item.type) {
      case 'travel': return Navigation2;
      case 'sos': return ShieldAlert;
      case 'anniversary': return Heart;
      case 'location_saved': return MapPin;
      case 'memory': return item.imageUrl ? Camera : FileText;
      default: return FileText;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <Header 
        title="Timeline" 
        showBack 
        transparent 
        rightElement={
          <TouchableOpacity 
            onPress={handleAddPress} 
            style={{ padding: 8, marginRight: -8 }}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            {isUploading ? (
               <ActivityIndicator size="small" color={theme.textPrimary} />
            ) : (
               <Plus size={26} color={theme.textPrimary} strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        }
      />
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accentRose} />
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconBox, { backgroundColor: theme.accentRoseSoft }]}>
            <CalendarDays size={40} color={theme.accentRose} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No memories yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Your shared journey starts here. Post a photo or note to capture the moment!
          </Text>
        </View>
      ) : (
        <FlatScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {activities.map((item, index) => {
            const isLast = index === activities.length - 1;
            return (
              <TimelineItem 
                key={item.id}
                icon={getActivityIcon(item)}
                title={item.content}
                timestamp={format(item.timestamp, 'MMMM do, yyyy')}
                isLast={isLast}
              />
            );
          })}
        </FlatScrollView>
      )}

      <Modal visible={captionModalVisible} transparent animationType="slide" onRequestClose={() => setCaptionModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <ExpoBlur intensity={80} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalCard, { backgroundColor: theme.bgSurface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {modalType === 'photo' ? 'New Memory' : 'New Note'}
              </Text>
              <TouchableOpacity onPress={() => setCaptionModalVisible(false)}>
                <Text style={{ color: theme.textTertiary, fontFamily: 'DMSans_700Bold' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {pendingImage && (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: pendingImage }} style={styles.previewImage} contentFit="cover" />
                </View>
              )}
              <TextInput
                style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.bgElevated, borderColor: theme.borderDefault }]}
                placeholder="Write something special..."
                placeholderTextColor={theme.textTertiary}
                multiline
                autoFocus
                value={caption}
                onChangeText={setCaption}
              />
              <TouchableOpacity style={[styles.shareBtn, { backgroundColor: theme.textPrimary }]} onPress={handleConfirmUpload}>
                <Text style={[styles.shareBtnText, { color: theme.bgPrimary }]}>Share to Timeline</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  scrollContent: { padding: 24, paddingBottom: 150 },
  emptyIconBox: { width: 80, height: 80, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 20, marginBottom: 8 },
  emptySubtitle: { fontFamily: 'DMSans_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalCard: { width: '100%', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingTop: 16, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, letterSpacing: -0.5 },
  previewContainer: { width: '100%', aspectRatio: 1, borderRadius: 24, overflow: 'hidden', marginBottom: 20 },
  previewImage: { width: '100%', height: '100%' },
  input: { width: '100%', minHeight: 120, borderRadius: 24, padding: 18, fontFamily: 'DMSans_500Medium', fontSize: 16, borderWidth: 1, textAlignVertical: 'top', marginBottom: 24 },
  shareBtn: { width: '100%', height: 56, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  shareBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 16 },
});
