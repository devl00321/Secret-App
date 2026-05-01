import React from 'react';
import { Alert, StyleSheet, View, Text, TouchableOpacity, Platform, SafeAreaView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Phone, Mail, Globe } from 'lucide-react-native';
import { Href, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { authService } from '../../src/services/authService';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { height } = Dimensions.get('window');
WebBrowser.maybeCompleteAuthSession();

export default function AuthChoiceScreen() {
  const router = useRouter();
  const setAuthMethod = useAuthStore((state) => state.setAuthMethod);
  const setLoading = useAuthStore((state) => state.setLoading);
  const googleConfig = Platform.select({
    ios: {
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? 'disabled-client-id',
    },
    android: {
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? 'disabled-client-id',
    },
    default: {
      webClientId:
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
        '770174432504-l97eal4glkvq2dlgh8qq50p4hs64jt8u.apps.googleusercontent.com',
    },
  });
  const isGoogleAuthConfigured = Platform.select({
    ios: Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    android: Boolean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
    default: true,
  });
  const [request, response, promptAsync] = Google.useAuthRequest(googleConfig);

  React.useEffect(() => {
    if (response?.type === 'success' && response.params.id_token) {
      const { id_token } = response.params;

      const signInWithGoogle = async () => {
        setLoading(true);
        try {
          setAuthMethod('google');
          await authService.signInWithGoogle(id_token);
        } catch (error) {
          console.warn('Google sign-in failed:', error);
          Alert.alert('Google sign-in failed', 'Please try again or use another sign-in method.');
        } finally {
          setLoading(false);
        }
      };

      void signInWithGoogle();
    } else if (response?.type === 'error') {
      Alert.alert('Google sign-in failed', 'We could not complete the sign-in request.');
    }
  }, [response, setAuthMethod, setLoading]);

  const handlePress = (target: Href, method: 'phone' | 'email') => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setAuthMethod(method);
    router.push(target);
  };

  const handleGooglePress = () => {
    if (!isGoogleAuthConfigured) {
      Alert.alert(
        'Google sign-in needs setup',
        'Add the Google client ID for this platform in apps/mobile/.env to enable this option.'
      );
      return;
    }

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    void promptAsync();
  };

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={['#FF6B6B', '#FF4E50', '#F9D423']} 
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.View 
            entering={FadeInUp.delay(200).duration(1000)}
            style={styles.header}
          >
            <View style={styles.logoBadge}>
              <Heart size={40} color="#FF6B6B" fill="#FF6B6B" />
            </View>
            <Text style={styles.title}>LUVV</Text>
            <Text style={styles.subtitle}>Private, Secure, Yours.</Text>
          </Animated.View>

          <Animated.View 
            entering={FadeInDown.delay(400).duration(1000)}
            style={styles.buttonContainer}
          >
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handlePress('/(auth)/phone', 'phone')}
              activeOpacity={0.9}
            >
              <Phone size={22} color="#FF6B6B" style={styles.icon} />
              <Text style={styles.primaryButtonText}>Continue with Phone</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleGooglePress}
              disabled={!request || !isGoogleAuthConfigured}
              activeOpacity={0.8}
            >
              <Globe size={22} color="white" style={styles.icon} />
              <Text style={styles.secondaryButtonText}>Google Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ghostButton}
              onPress={() => handlePress('/(auth)/email', 'email')}
              activeOpacity={0.7}
            >
              <Mail size={18} color="white" style={styles.iconSmall} />
              <Text style={styles.ghostButtonText}>Email Login</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View 
            entering={FadeInDown.delay(600).duration(1000)}
            style={styles.footer}
          >
            <Text style={styles.footerText}>
              Built for two. Protected for life.
            </Text>
            <TouchableOpacity style={styles.legalButton}>
              <Text style={styles.legalText}>Privacy & Terms</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF6B6B',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 30,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: height * 0.12,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 20,
    transform: [{ rotate: '-10deg' }],
  },
  title: {
    fontSize: 56,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -2,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: 'white',
    borderRadius: 24,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  secondaryButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 24,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  ghostButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.9,
  },
  icon: {
    marginRight: 12,
  },
  iconSmall: {
    marginRight: 8,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  legalButton: {
    marginTop: 8,
    padding: 10,
  },
  legalText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
    opacity: 0.8,
  },
});
