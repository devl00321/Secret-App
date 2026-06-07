import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  Platform,
  ActivityIndicator,
  TextInput,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { useTheme } from '../theme';
import { useAuthStore } from '../store/useAuthStore';
import { db, doc, updateDoc } from '../services/firebase';
import * as Contacts from 'expo-contacts';
import DraggableFlatList, { 
  RenderItemParams,
  ScaleDecorator
} from 'react-native-draggable-flatlist';
import { 
  GripVertical, 
  Plus, 
  UserPlus, 
  Trash2, 
  Phone, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  priority: number;
  updatedAt: string;
}

export const EmergencyContactsScreen = () => {
  const theme = useTheme();
  const { currentUserProfile, user, setCurrentUserProfile } = useAuthStore();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize contacts from profile
  useEffect(() => {
    if (currentUserProfile?.emergencyContacts) {
      setContacts([...currentUserProfile.emergencyContacts].sort((a, b) => a.priority - b.priority));
    } else if (currentUserProfile?.emergencyContact) {
      // Migrate old single contact to array
      const oldContact: EmergencyContact = {
        ...currentUserProfile.emergencyContact as any,
        id: 'primary-legacy',
        priority: 0,
        updatedAt: new Date().toISOString()
      };
      setContacts([oldContact]);
    }
  }, [currentUserProfile]);

  const saveContacts = async (newContacts: EmergencyContact[]) => {
    if (!user?.uid) {
      console.error('[Guardians] No user UID found');
      return;
    }
    setLoading(true);
    try {
      console.log('[Guardians] Saving contacts:', newContacts.length);
      const formattedContacts = newContacts.map((c, index) => ({
        ...c,
        priority: index,
        updatedAt: new Date().toISOString()
      }));

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        emergencyContacts: formattedContacts
      });

      console.log('[Guardians] Firestore update successful');

      // Update local store immediately for instant UI feedback
      if (setCurrentUserProfile) {
        setCurrentUserProfile({
          ...currentUserProfile,
          emergencyContacts: formattedContacts
        } as any);
      }
    } catch (err: any) {
      console.error('[Guardians] Save failed:', err);
      Alert.alert('Save Error', err.message || 'Failed to sync with cloud.');
    } finally {
      setLoading(false);
    }
  };

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  const addManualContact = () => {
    console.log('[Guardians] Attempting manual add:', manualName, manualPhone);
    if (manualName.trim() && manualPhone.trim()) {
      const newContact: EmergencyContact = {
        id: 'manual-' + Math.random().toString(36).substring(7),
        name: manualName.trim(),
        phone: manualPhone.trim(),
        priority: contacts.length,
        updatedAt: new Date().toISOString()
      };
      const updated = [...contacts, newContact];
      setContacts(updated);
      saveContacts(updated);
      setShowManualModal(false);
      setManualName('');
      setManualPhone('');
    } else {
      Alert.alert('Incomplete', 'Please provide both a name and phone number.');
    }
  };

  const pickContact = async () => {
    console.log('[Guardians] Opening phone book...');
    if (contacts.length >= 10) {
      Alert.alert('Limit Reached', 'You can only have up to 10 emergency contacts.');
      return;
    }

    const { status } = await Contacts.requestPermissionsAsync();
    console.log('[Guardians] Contacts permission:', status);
    if (status === 'granted') {
      try {
        const contact = await Contacts.presentContactPickerAsync();
        console.log('[Guardians] Pick result:', contact?.name);
        if (contact && contact.name) {
          const phoneNumber = contact.phoneNumbers?.[0]?.number;
          if (phoneNumber) {
            const newContact: EmergencyContact = {
              id: contact.id || 'picked-' + Math.random().toString(36).substring(7),
              name: contact.name,
              phone: phoneNumber,
              priority: contacts.length,
              updatedAt: new Date().toISOString()
            };
            const updated = [...contacts, newContact];
            setContacts(updated);
            saveContacts(updated);
          } else {
            Alert.alert('No Number', 'This contact does not have a phone number saved.');
          }
        }
      } catch (err) {
        console.error('[Guardians] Pick failed:', err);
      }
    } else {
      Alert.alert('Permission Denied', 'Please enable contacts access in settings to pick from phone book.');
    }
  };

  const removeContact = (id: string) => {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    saveContacts(updated);
  };

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<EmergencyContact>) => {
    return (
      <ScaleDecorator>
        <View
          style={[
            styles.itemContainer,
            { 
              backgroundColor: isActive ? theme.accentRose + '20' : theme.bgSurface,
              borderColor: isActive ? theme.accentRose : theme.borderDefault,
              opacity: isActive ? 0.95 : 1,
            }
          ]}
        >
          {/* Drag handle — touch here to drag immediately */}
          <TouchableOpacity
            onPressIn={drag}
            disabled={isActive}
            style={styles.dragHandle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <GripVertical size={22} color={isActive ? theme.accentRose : theme.textSecondary} />
          </TouchableOpacity>
          
          <View style={styles.itemContent}>
            <View style={styles.nameRow}>
              <Text style={[styles.contactName, { color: theme.textPrimary }]}>{item.name}</Text>
              {item.priority === 0 && (
                <View style={[styles.priorityBadge, { backgroundColor: theme.accentRose + '20' }]}>
                  <ShieldCheck size={12} color={theme.accentRose} />
                  <Text style={[styles.priorityText, { color: theme.accentRose }]}>PRIMARY</Text>
                </View>
              )}
            </View>
            <View style={styles.phoneRow}>
              <Phone size={14} color={theme.textSecondary} />
              <Text style={[styles.contactPhone, { color: theme.textSecondary }]}>{item.phone}</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.deleteBtn} 
            onPress={() => removeContact(item.id)}
          >
            <Trash2 size={20} color={theme.dangerRed || '#FF4444'} />
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
    );
  }, [theme, contacts]);


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
        <Header title="Manage Guardians" showBack />
        
        <View style={styles.headerInfo}>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Set the priority of your emergency contacts. The top person will be contacted first during an SOS event.
          </Text>
        </View>

        {contacts.length > 0 ? (
          <DraggableFlatList
            data={contacts}
            onDragEnd={({ data }) => {
              setContacts(data);
              saveContacts(data);
            }}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.emptyState}>
            <AlertCircle size={60} color={theme.textSecondary} strokeWidth={1} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No guardians added yet</Text>
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.addBtn, { backgroundColor: theme.accentRose }]}
            onPress={() => Alert.alert("Add Contact", "Choose method", [
              { text: "Phone Book", onPress: pickContact },
              { text: "Type Manually", onPress: () => setShowManualModal(true) },
              { text: "Cancel", style: "cancel" }
            ])}
          >
            <UserPlus size={24} color="white" />
            <Text style={styles.addBtnText}>Add New Guardian</Text>
          </TouchableOpacity>
          <Text style={[styles.limitText, { color: theme.textSecondary }]}>
            {contacts.length} / 10 Contacts Used
          </Text>
        </View>

        {/* MANUAL ADD MODAL */}
        <Modal
          visible={showManualModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowManualModal(false)}
        >
          <View style={styles.overlay}>
            <TouchableOpacity 
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowManualModal(false)}
            />
            <View style={[styles.manualModal, { backgroundColor: theme.bgSurface }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Add Guardian</Text>
              <TextInput
                style={[styles.manualInput, { backgroundColor: theme.bgPrimary, color: theme.textPrimary }]}
                placeholder="Name"
                placeholderTextColor={theme.textSecondary}
                value={manualName}
                onChangeText={setManualName}
                autoFocus
              />
              <TextInput
                style={[styles.manualInput, { backgroundColor: theme.bgPrimary, color: theme.textPrimary }]}
                placeholder="Phone Number"
                placeholderTextColor={theme.textSecondary}
                value={manualPhone}
                onChangeText={setManualPhone}
                keyboardType="phone-pad"
              />
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: theme.borderDefault }]}
                  onPress={() => setShowManualModal(false)}
                >
                  <Text style={[styles.modalBtnText, { color: theme.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: theme.accentRose }]}
                  onPress={addManualContact}
                >
                  <Text style={[styles.modalBtnText, { color: 'white' }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.accentRose} />
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerInfo: {
    padding: 20,
    paddingTop: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  dragHandle: {
    paddingRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '800',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 10,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '900',
    marginLeft: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactPhone: {
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    padding: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    width: '100%',
    height: 55,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  addBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 12,
  },
  limitText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  manualModal: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    right: '10%',
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 20,
    textAlign: 'center',
  },
  manualInput: {
    height: 55,
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnText: {
    fontWeight: '800',
    fontSize: 15,
  }
});
