import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { authService } from '../../src/services/authService';

export default function OTPScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { confirmationResult, setConfirmationResult, setUser } = useAuthStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const displayPhone = Array.isArray(phone) ? phone[0] : phone;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleVerifyOTP = async () => {
    if (code.length < 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    if (!confirmationResult) {
      Alert.alert('Error', 'Session expired. Please request a new OTP.');
      router.back();
      return;
    }

    setLoading(true);
    try {
      const user = await authService.verifyOTP(confirmationResult, code);
      if (user) {
        setUser(user);
        setConfirmationResult(null);
        router.replace('/(app)/(tabs)');
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn('OTP verification failed:', error.message);
      }
      Alert.alert('Error', 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#FF6B6B', '#FF8E8E']} style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={28} color="white" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={40} color="white" />
          </View>
          <Text style={styles.title}>Verification</Text>
          <Text style={styles.subtitle}>Enter the code sent to {displayPhone}</Text>
        </View>

        <View style={styles.form}>
          <TextInput 
            style={styles.otpInput}
            placeholder="000000"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={6}
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            autoFocus
          />

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerifyOTP}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify & Continue'}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.resendButton} 
            disabled={timer > 0}
            onPress={() => {
              setConfirmationResult(null);
              router.back();
            }}
          >
            <Text style={[styles.resendText, timer > 0 && styles.resendTextDisabled]}>
              {timer > 0 ? `Resend code in ${timer}s` : 'Go back and request a new code'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 30,
  },
  backButton: {
    marginTop: 50,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 50,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 10,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  otpInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 20,
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  button: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendButton: {
    marginTop: 25,
    alignItems: 'center',
  },
  resendText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  resendTextDisabled: {
    opacity: 0.5,
  },
});
