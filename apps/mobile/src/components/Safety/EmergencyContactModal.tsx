import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform,
  Dimensions,
  ScrollView
} from 'react-native';
import { useTheme } from '../../theme';
import { User, Phone, X, ShieldCheck } from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { db, doc, updateDoc } from '../../services/firebase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface EmergencyContactModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EmergencyContactModal = ({ visible, onClose }: EmergencyContactModalProps) => {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (name.trim() && phone.trim() && user?.uid) {
      setLoading(true);
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          emergencyContact: {
            name: name.trim(),
            phone: phone.trim(),
            updatedAt: new Date().toISOString()
          }
        });
        onClose();
      } catch (err) {
        console.error('Failed to save emergency contact:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalView, { backgroundColor: theme.surface }]}>
              <ScrollView 
                style={{ width: '100%' }} 
                contentContainerStyle={{ alignItems: 'center' }}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.iconHeader}>
                  <View style={[styles.shieldBox, { backgroundColor: theme.primary + '20' }]}>
                    <ShieldCheck size={32} color={theme.primary} />
                  </View>
                </View>

                <Text style={[styles.title, { color: theme.text }]}>Emergency Contact</Text>
                <Text style={[styles.subtitle, { color: theme.textLight }]}>
                  Add a trusted person (like a parent or friend) to contact in case of an emergency.
                </Text>

                <View style={[styles.inputGroup, { backgroundColor: theme.background }]}>
                  <User size={20} color={theme.primary} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Full Name"
                    placeholderTextColor={theme.textLight}
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={[styles.inputGroup, { backgroundColor: theme.background }]}>
                  <Phone size={20} color={theme.primary} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Phone Number"
                    placeholderTextColor={theme.textLight}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    { backgroundColor: (name.trim() && phone.trim()) ? theme.primary : theme.border }
                  ]}
                  onPress={handleSave}
                  disabled={loading || !(name.trim() && phone.trim())}
                >
                  <Text style={styles.saveBtnText}>
                    {loading ? "Saving..." : "Secure My Account"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipBtn} onPress={onClose}>
                  <Text style={[styles.skipText, { color: theme.textLight }]}>I'll do this later</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    width: '100%',
  },
  modalView: {
    width: '100%',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    padding: 30,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconHeader: {
    marginBottom: 15,
  },
  shieldBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 55,
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    width: '100%',
    height: 55,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  skipBtn: {
    marginTop: 15,
    padding: 10,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '700',
  }
});
