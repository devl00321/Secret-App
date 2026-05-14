import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { useAuthStore } from '../store/useAuthStore';
import { useTheme } from '../theme';
import { userService } from '../services/userService';
import { imageService } from '../services/imageService';
import { Image } from 'expo-image';
import { Camera, ShieldCheck, Info, User, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

export const EditProfileScreen = () => {
  const theme = useTheme();
  const router = useRouter();
  const { user, currentUserProfile, setCurrentUserProfile } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editName, setEditName] = useState(currentUserProfile?.displayName || user?.displayName || '');
  const [editGender, setEditGender] = useState(currentUserProfile?.gender || '');
  const [editDob, setEditDob] = useState(currentUserProfile?.dob || '');
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);

  // Sync local state when the store's profile is updated (e.g., after decryption secret loads)
  useEffect(() => {
    if (currentUserProfile) {
      // Only sync if local state is empty or looks like an encrypted string
      // Encrypted strings in this app typically start with Base64-like characters and are long
      const isEncrypted = (str: string) => str.length > 30 && /^[a-zA-Z0-9+/=]+$/.test(str);

      if (currentUserProfile.displayName && (!editName || editName === 'Unknown X_X')) {
        setEditName(currentUserProfile.displayName);
      }
      if (currentUserProfile.gender && !editGender) {
        setEditGender(currentUserProfile.gender);
      }
      if (currentUserProfile.dob && (!editDob || isEncrypted(editDob))) {
        setEditDob(currentUserProfile.dob);
      }
    }
  }, [currentUserProfile]);

  const handlePickImage = async () => {
    const uri = await imageService.pickAndCompressImage();
    if (uri) {
      setLocalPhotoUri(uri);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  };

  const handleDeletePhoto = () => {
    Alert.alert(
      "Remove Photo",
      "Are you sure you want to remove your profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: () => {
            setLocalPhotoUri('REMOVE');
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      let photoURL = currentUserProfile?.photoURL || '';

      // 1. Handle photo changes
      if (localPhotoUri === 'REMOVE') {
        photoURL = '';
      } else if (localPhotoUri) {
        setUploading(true);
        const path = `profiles/${user.uid}/avatar_${Date.now()}.jpg`;
        const uploadedUrl = await imageService.uploadImage(localPhotoUri, path);
        if (uploadedUrl) {
          photoURL = uploadedUrl;
        }
        setUploading(false);
      }

      // 2. Update profile
      const updates = {
        displayName: editName.trim(),
        gender: editGender as any,
        dob: editDob.trim(),
        photoURL,
      };

      await userService.updateUserProfile(user.uid, updates);
      
      if (currentUserProfile) {
        setCurrentUserProfile({ ...currentUserProfile, ...updates } as any);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert("Success", "Profile updated successfully!");
      router.back();
    } catch (e) {
      console.warn("Failed to update profile", e);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Edit Profile" showBack />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(600)} style={styles.photoSection}>
          <TouchableOpacity 
            style={[styles.photoContainer, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={handlePickImage}
            disabled={uploading}
          >
            {localPhotoUri && localPhotoUri !== 'REMOVE' ? (
              <Image 
                source={{ uri: localPhotoUri }} 
                style={styles.photo}
                contentFit="cover"
              />
            ) : currentUserProfile?.photoURL && localPhotoUri !== 'REMOVE' ? (
              <Image 
                source={{ uri: currentUserProfile.photoURL }} 
                style={styles.photo}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.placeholderPhoto, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.placeholderText, { color: theme.primary }]}>
                  {(currentUserProfile?.displayName || user?.displayName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            
            <View style={[styles.editIconBadge, { backgroundColor: theme.primary }]}>
              {uploading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Camera size={16} color="white" />
              )}
            </View>
          </TouchableOpacity>
          
          {(localPhotoUri && localPhotoUri !== 'REMOVE') || (currentUserProfile?.photoURL && localPhotoUri !== 'REMOVE') ? (
            <TouchableOpacity 
              style={[styles.deleteBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={handleDeletePhoto}
            >
              <Trash2 size={14} color={theme.error} />
              <Text style={[styles.deleteBtnText, { color: theme.error }]}>Remove Photo</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.photoHint, { color: theme.textLight }]}>
              Tap to change profile picture
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.privacyCard}>
          <View style={[styles.privacyBadge, { backgroundColor: theme.success + '20' }]}>
            <ShieldCheck size={16} color={theme.success} />
            <Text style={[styles.privacyText, { color: theme.success }]}>End-to-End Private</Text>
          </View>
          <Text style={[styles.privacyDetail, { color: theme.textLight }]}>
            Your profile photo and details are only shared with your partner. No one else can see this information.
          </Text>
        </Animated.View>

        <View style={styles.form}>
          <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textLight }]}>Display Name</Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={theme.textLight}
            />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textLight }]}>Gender</Text>
            <View style={styles.genderRow}>
              {(['Male', 'Female', 'Non-binary'] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.genderBtn,
                    { borderColor: theme.border },
                    editGender === g && { backgroundColor: theme.primary, borderColor: theme.primary }
                  ]}
                  onPress={() => setEditGender(g)}
                >
                  <Text style={[
                    styles.genderBtnText,
                    { color: editGender === g ? 'white' : theme.textLight }
                  ]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textLight }]}>Date of Birth</Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={editDob}
              onChangeText={(text) => {
                // Handle deletion
                if (text.length < editDob.length) {
                  setEditDob(text);
                  return;
                }

                // Auto-format DD/MM/YYYY
                const cleaned = text.replace(/\D/g, '');
                let formatted = cleaned;
                
                if (cleaned.length > 2) {
                  formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
                }
                if (cleaned.length > 4) {
                  formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
                }
                setEditDob(formatted);
              }}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={theme.textLight}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        </View>

        <View style={styles.infoBox}>
          <Info size={14} color={theme.textLight} />
          <Text style={[styles.infoText, { color: theme.textLight }]}>
            Updating these details will instantly reflect on your partner's app.
          </Text>
        </View>

        <Button 
          title={loading ? "Saving..." : "Save Changes"}
          onPress={handleSave}
          loading={loading}
          style={styles.saveButton}
        />
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  photoSection: {
    alignItems: 'center',
    marginVertical: 30,
  },
  photoContainer: {
    width: 140,
    height: 140,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  placeholderPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 48,
    fontWeight: '900',
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  photoHint: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  privacyCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.1)',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  privacyDetail: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  form: {
    gap: 16,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    fontSize: 17,
    fontWeight: '600',
    padding: 0,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  genderBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  saveButton: {
    height: 56,
    borderRadius: 18,
  },
});
