import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { 
  Plus, 
  Image as ImageIcon, 
  FileText, 
  Camera, 
  MapPin, 
  ShieldAlert, 
  Heart, 
  Navigation2,
  CalendarDays,
  Leaf,
  Flower,
  Sprout,
  Wind,
  Sun,
  Palette
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { useAuthStore } from '../store/useAuthStore';
import { activityService, Activity } from '../services/activityService';
import { imageService } from '../services/imageService';
import { format } from 'date-fns';
import { Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView as FlatScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BlurView as ExpoBlur } from 'expo-blur';

const MEMORY_THEMES = [
  { id: 'default', name: 'Clean', colors: ['#FFFFFF', '#F8FAFC'], icon: 'palette', accent: '#94A3B8' },
  { id: 'lavender', name: 'Lavender', colors: ['#F5F3FF', '#EDE9FE'], icon: 'flower', accent: '#8B5CF6' },
  { id: 'meadow', name: 'Meadow', colors: ['#F0FDF4', '#DCFCE7'], icon: 'sprout', accent: '#22C55E' },
  { id: 'rose', name: 'Rose', colors: ['#FFF1F2', '#FFE4E6'], icon: 'heart', accent: '#F43F5E' },
  { id: 'breeze', name: 'Breeze', colors: ['#F0F9FF', '#E0F2FE'], icon: 'wind', accent: '#0EA5E9' },
  { id: 'bloom', name: 'Bloom', colors: ['#FFFBEB', '#FEF3C7'], icon: 'sun', accent: '#F59E0B' },
  { id: 'forest', name: 'Forest', colors: ['#F7FEE7', '#ECFCCB'], icon: 'leaf', accent: '#84CC16' },
];

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
  const [selectedTheme, setSelectedTheme] = useState('default');
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);

  useEffect(() => {
    if (!coupleId) return;

    const unsubscribe = activityService.subscribeToActivities(coupleId, (data) => {
      setActivities(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [coupleId]);

  // Re-decrypt existing activities when the secret becomes available
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

  const handleConfirmUpload = async () => {
    setCaptionModalVisible(false);
    setIsUploading(true);
    try {
      if (editingActivityId && coupleId) {
        // UPDATE EXISTING
        await activityService.updateActivity(coupleId, editingActivityId, caption, selectedTheme);
      } else if (modalType === 'photo' && pendingImage) {
        // NEW PHOTO
        const downloadUrl = await imageService.uploadImage(pendingImage, 'timeline');
        if (downloadUrl) {
          await activityService.logActivity('memory', caption || 'Shared a new photo! 📸', { 
            imageUrl: downloadUrl,
            theme: selectedTheme !== 'default' ? selectedTheme : null 
          });
        }
      } else if (modalType === 'note') {
        // NEW NOTE
        await activityService.logActivity('memory', caption || 'Pinned a special note 📝', {
          theme: selectedTheme !== 'default' ? selectedTheme : null
        });
      }
    } finally {
      setIsUploading(false);
      setPendingImage(null);
      setCaption('');
      setSelectedTheme('default');
      setEditingActivityId(null);
    }
  };

  const handleLongPress = (item: Activity) => {
    // Only allow editing own posts or if you are the one deleting
    // In a couple app, usually both can delete but only creator can edit? 
    // User said "options like chat screen"
    
    if (Platform.OS !== 'web') {
      // We'll just use standard React Native Alert for the context menu
      // to keep it simple and native-feeling as requested
      Alert.alert(
        'Manage Post',
        'What would you like to do with this memory?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Edit Post', 
            onPress: () => {
              setEditingActivityId(item.id);
              setCaption(item.content);
              setSelectedTheme((item as any).theme || 'default');
              setPendingImage(item.imageUrl || null);
              setModalType(item.imageUrl ? 'photo' : 'note');
              setCaptionModalVisible(true);
            } 
          },
          { 
            text: 'Delete Permanently', 
            style: 'destructive', 
            onPress: () => {
              Alert.alert(
                'Are you sure?',
                'This will remove this memory from your story forever.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Delete', 
                    style: 'destructive', 
                    onPress: async () => {
                      if (coupleId) {
                        await activityService.deleteActivity(coupleId, item.id);
                      }
                    } 
                  }
                ]
              );
            } 
          }
        ]
      );
    }
  };

  const renderThemedCard = (item: Activity) => {
    const themeData = MEMORY_THEMES.find(t => t.id === (item as any).theme) || MEMORY_THEMES[0];
    const isThemed = (item as any).theme && (item as any).theme !== 'default';

    const defaultColors = theme.isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC'];
    const cardColors = isThemed ? themeData.colors : defaultColors;

    return (
      <Animated.View entering={FadeIn.duration(600)} key={item.id}>
        <TouchableOpacity 
          activeOpacity={0.9}
          onLongPress={() => handleLongPress(item)}
          style={[styles.memoryCard, { shadowColor: theme.isDark ? '#000' : theme.primary }]}
        >
        <LinearGradient
          colors={cardColors as any}
          style={styles.cardGradient}
        >
          {item.imageUrl && (
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: item.imageUrl }} 
                style={styles.image} 
                contentFit="cover" 
                transition={500}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.imageOverlay}>
                <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  {getActivityIcon(item, 'white')}
                  <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={[styles.cardContent, !item.imageUrl && { paddingTop: 20 }]}>
            <View style={styles.cardHeader}>
              <View style={styles.headerInfo}>
                <Text style={[styles.author, { color: isThemed ? themeData.accent : theme.primary }]}>
                  {item.userId === user?.uid ? 'You' : item.userName}
                </Text>
                <Text style={[styles.date, { color: theme.textLight }]}>
                  {format(item.timestamp, 'MMMM do • h:mm a')}
                </Text>
              </View>
            </View>

            <Text style={[
              styles.content, 
              { 
                color: isThemed ? '#1E293B' : theme.text,
                fontSize: item.imageUrl ? 15 : 18,
                lineHeight: item.imageUrl ? 22 : 28,
              }
            ]}>
              {item.content}
            </Text>
            
            {isThemed && !item.imageUrl && (
              <View style={styles.themeDecorator}>
                {(item as any).theme === 'lavender' && <Flower size={120} color={themeData.accent} opacity={0.05} />}
                {(item as any).theme === 'meadow' && <Sprout size={120} color={themeData.accent} opacity={0.05} />}
                {(item as any).theme === 'rose' && <Heart size={120} color={themeData.accent} opacity={0.05} />}
                {(item as any).theme === 'breeze' && <Wind size={120} color={themeData.accent} opacity={0.05} />}
                {(item as any).theme === 'bloom' && <Sun size={120} color={themeData.accent} opacity={0.05} />}
                {(item as any).theme === 'forest' && <Leaf size={120} color={themeData.accent} opacity={0.05} />}
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
    );
  };

  const getActivityIcon = (item: Activity, forceColor?: string) => {
    const size = 16;
    const color = forceColor || theme.primary;
    switch (item.type) {
      case 'travel': return <Navigation2 size={size} color={color} />;
      case 'sos': return <ShieldAlert size={size} color={theme.error} />;
      case 'anniversary': return <Heart size={size} color="#FFD700" fill="#FFD700" />;
      case 'location_saved': return <MapPin size={size} color={color} />;
      case 'memory': 
        return item.imageUrl ? <Camera size={size} color={color} /> : <FileText size={size} color={color} />;
      default: return <FileText size={size} color={color} />;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header 
        title="Our Story" 
        showBack 
        transparent
      />
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconBox, { backgroundColor: theme.primarySoft }]}>
            <CalendarDays size={40} color={theme.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No memories yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textLight }]}>
            Your shared journey starts here. Post a photo or note to capture the moment!
          </Text>
        </View>
      ) : (
        <FlatScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.timelineLine} />
          {activities.map((item) => renderThemedCard(item))}
        </FlatScrollView>
      )}

      {/* FLOATING ACTION BUTTONS */}
      <View style={[styles.fabContainer, { backgroundColor: theme.isDark ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.9)', borderColor: theme.border }]}>
        <TouchableOpacity 
          style={styles.fabItem} 
          onPress={handleAddPhoto} 
          disabled={isUploading}
          hitSlop={{ top: 25, bottom: 25, left: 20, right: 20 }}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Camera size={22} color={theme.primary} />
          )}
        </TouchableOpacity>
        <View style={[styles.fabDivider, { backgroundColor: theme.border }]} />
        <TouchableOpacity 
          style={styles.fabItem} 
          onPress={handleShareNote}
          hitSlop={{ top: 25, bottom: 25, left: 20, right: 20 }}
        >
          <FileText size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* CAPTION MODAL */}
      <Modal
        visible={captionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCaptionModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <ExpoBlur intensity={80} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingActivityId ? 'Edit Memory' : (modalType === 'photo' ? 'New Memory' : 'New Note')}
              </Text>
              <TouchableOpacity 
                onPress={() => setCaptionModalVisible(false)}
                hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
              >
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {pendingImage && (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: pendingImage }} style={styles.previewImage} contentFit="cover" />
                </View>
              )}

              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                placeholder={modalType === 'photo' ? "Share what's happening..." : "Write something special..."}
                placeholderTextColor={theme.textLight}
                multiline
                autoFocus
                value={caption}
                onChangeText={setCaption}
                maxLength={500}
              />

              <Text style={[styles.themeLabel, { color: theme.textLight }]}>Style this memory</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themeList}>
                {MEMORY_THEMES.map((t) => (
                  <TouchableOpacity 
                    key={t.id}
                    style={[
                      styles.themeItem, 
                      { backgroundColor: t.colors[0], borderColor: selectedTheme === t.id ? theme.primary : 'transparent' }
                    ]}
                    onPress={() => setSelectedTheme(t.id)}
                  >
                    <View style={[styles.themeIcon, { backgroundColor: t.accent + '20' }]}>
                      {t.icon === 'flower' && <Flower size={16} color={t.accent} />}
                      {t.icon === 'sprout' && <Sprout size={16} color={t.accent} />}
                      {t.icon === 'heart' && <Heart size={16} color={t.accent} />}
                      {t.icon === 'wind' && <Wind size={16} color={t.accent} />}
                      {t.icon === 'sun' && <Sun size={16} color={t.accent} />}
                      {t.icon === 'leaf' && <Leaf size={16} color={t.accent} />}
                      {t.icon === 'palette' && <Palette size={16} color={t.accent} />}
                    </View>
                    <Text style={[styles.themeName, { color: '#1E293B' }]}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity 
                style={[styles.shareBtn, { backgroundColor: theme.primary }]} 
                onPress={handleConfirmUpload}
              >
                <Text style={styles.shareBtnText}>{editingActivityId ? 'Save Changes' : 'Share to Story'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 150,
  },
  timelineLine: {
    position: 'absolute',
    left: 36,
    top: 40,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0,0,0,0.03)',
    zIndex: -1,
  },
  addButton: {
    borderRadius: 14,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  memoryCard: {
    marginBottom: 20,
    borderRadius: 28,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  cardGradient: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 0.85,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 15,
    left: 15,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  typeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerInfo: {
    flex: 1,
  },
  date: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.6,
  },
  author: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  content: {
    fontWeight: '500',
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.7,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 130,
    right: 25,
    flexDirection: 'row',
    borderRadius: 30,
    padding: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
  },
  fabItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  fabDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 24,
    paddingTop: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  previewContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  input: {
    width: '100%',
    minHeight: 120,
    borderRadius: 24,
    padding: 18,
    fontSize: 17,
    fontWeight: '600',
    borderWidth: 1,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.6,
  },
  themeList: {
    marginBottom: 30,
  },
  themeItem: {
    width: 85,
    height: 95,
    borderRadius: 24,
    padding: 10,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  themeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  themeName: {
    fontSize: 11,
    fontWeight: '800',
  },
  shareBtn: {
    width: '100%',
    height: 64,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  shareBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
  },
  themeDecorator: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    transform: [{ rotate: '-15deg' }],
  }
});

