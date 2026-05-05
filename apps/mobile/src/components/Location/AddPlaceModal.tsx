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
  Dimensions
} from 'react-native';
import { useTheme } from '../../theme';
import { 
  MapPin, 
  X, 
  Home, 
  Briefcase, 
  BookOpen, 
  School, 
  GraduationCap, 
  Building2, 
  Dumbbell 
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AddPlaceModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, type: string) => void;
}

const PLACE_TYPES = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'office', label: 'Office', icon: Briefcase },
  { id: 'tuition', label: 'Tuition', icon: BookOpen },
  { id: 'school', label: 'School', icon: School },
  { id: 'college', label: 'College', icon: GraduationCap },
  { id: 'hostel', label: 'Hostel', icon: Building2 },
  { id: 'gym', label: 'Gym', icon: Dumbbell },
  { id: 'other', label: 'Other', icon: MapPin },
];

export const AddPlaceModal = ({ visible, onClose, onSave }: AddPlaceModalProps) => {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState('other');

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), selectedType);
      setName('');
      setSelectedType('other');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.centeredView} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalView, { backgroundColor: theme.surface }]}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>Save this location</Text>
                <TouchableOpacity 
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={24} color={theme.textLight} />
                </TouchableOpacity>
              </View>

              <View style={[styles.inputContainer, { backgroundColor: theme.background }]}>
                <MapPin size={20} color={theme.primary} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="e.g. My Home, Tuition Center"
                  placeholderTextColor={theme.textLight}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <Text style={[styles.sectionTitle, { color: theme.textLight }]}>CATEGORY</Text>
              <View style={styles.typesGrid}>
                {PLACE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeBtn,
                      { backgroundColor: theme.background },
                      selectedType === type.id && { borderColor: theme.primary, borderWidth: 2 }
                    ]}
                    onPress={() => setSelectedType(type.id)}
                  >
                    <type.icon 
                      size={18} 
                      color={selectedType === type.id ? theme.primary : theme.textLight} 
                      strokeWidth={2.5}
                    />
                    <Text style={[
                      styles.typeLabel, 
                      { color: selectedType === type.id ? theme.primary : theme.text }
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: name.trim() ? theme.primary : theme.border }
                ]}
                onPress={handleSave}
                disabled={!name.trim()}
              >
                <Text style={styles.saveBtnText}>Save to Map</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardView: {
    width: '100%',
  },
  modalView: {
    width: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  closeBtn: {
    padding: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 52,
    borderRadius: 15,
    marginBottom: 15,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 1,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  typeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '22%',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  saveBtn: {
    height: 55,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
});
