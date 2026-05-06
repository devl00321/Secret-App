import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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
  CalendarDays
} from 'lucide-react-native';
import { useTheme } from '../theme';
import { useAuthStore } from '../store/useAuthStore';
import { activityService, Activity } from '../services/activityService';
import { imageService } from '../services/imageService';
import { format } from 'date-fns';

export const TimelineScreen = () => {
  const theme = useTheme();
  const { coupleId, user } = useAuthStore();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!coupleId) return;

    const unsubscribe = activityService.subscribeToActivities(coupleId, (data) => {
      setActivities(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [coupleId]);

  const handleAddPhoto = async () => {
    setIsUploading(true);
    try {
      const compressedUri = await imageService.pickAndCompressImage();
      if (!compressedUri) return;

      const downloadUrl = await imageService.uploadImage(compressedUri, 'timeline');
      if (downloadUrl) {
        await activityService.logActivity('memory', 'Shared a new photo! 📸', { imageUrl: downloadUrl });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    const size = 20;
    const color = theme.primary;
    switch (type) {
      case 'travel': return <Navigation2 size={size} color={color} />;
      case 'sos': return <ShieldAlert size={size} color={theme.error} />;
      case 'anniversary': return <Heart size={size} color="#FFD700" fill="#FFD700" />;
      case 'location_saved': return <MapPin size={size} color={color} />;
      case 'memory': return <Camera size={size} color={color} />;
      default: return <FileText size={size} color={color} />;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header 
        title="Our Timeline" 
        showBack 
        rightElement={
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={() => activityService.logActivity('memory', 'Capturing a special moment... 📸')}
          >
            <Plus color="white" size={24} />
          </TouchableOpacity>
        }
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
            Your shared journey starts here. Reached safely or save a place to see it here!
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {activities.map((item) => (
            <Card key={item.id} style={[styles.memoryCard, { backgroundColor: theme.surface }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}>
                  {getActivityIcon(item.type)}
                </View>
                <View style={styles.headerInfo}>
                  <Text style={[styles.date, { color: theme.textLight }]}>
                    {format(item.timestamp, 'MMM dd, yyyy • h:mm a')}
                  </Text>
                  <Text style={[styles.author, { color: theme.primary }]}>
                    {item.userId === user?.uid ? 'You' : item.userName}
                  </Text>
                </View>
              </View>

              <Text style={[styles.content, { color: theme.text }]}>{item.content}</Text>
              
              {item.imageUrl && (
                <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
              )}
            </Card>
          ))}
        </ScrollView>
      )}

      <View style={[styles.fabContainer, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: theme.isDark ? 1 : 0 }]}>
        <TouchableOpacity style={styles.fabItem} onPress={handleAddPhoto} disabled={isUploading}>
          {isUploading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Camera size={24} color={theme.primary} />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabItem} onPress={() => activityService.logActivity('memory', 'Thinking of you... ❤️')}>
          <Heart size={24} color={theme.secondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabItem} onPress={() => activityService.logActivity('memory', 'Pinned a special note 📝')}>
          <FileText size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>
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
    padding: 20,
    paddingBottom: 120,
  },
  addButton: {
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  memoryCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  date: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  author: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    marginTop: 10,
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
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
    bottom: 30,
    right: 20,
    flexDirection: 'row',
    borderRadius: 30,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  fabItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
});
