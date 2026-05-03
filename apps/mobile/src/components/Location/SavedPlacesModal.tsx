import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import {
  X,
  Plus,
  Home,
  Briefcase,
  School,
  GraduationCap,
  Building2,
  Dumbbell,
  MapPin,
  BookOpen,
  Trash2,
  Navigation
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { useLocationStore, SavedPlace } from '../../store/useLocationStore';

interface SavedPlacesModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectOnMap: () => void;
  initialLocation?: { latitude: number; longitude: number } | null;
}

const PLACE_TYPES = [
  { label: 'Home', value: 'home', icon: Home },
  { label: 'Office', value: 'office', icon: Briefcase },
  { label: 'Tuition', value: 'tuition', icon: BookOpen },
  { label: 'School', value: 'school', icon: School },
  { label: 'College', value: 'college', icon: GraduationCap },
  { label: 'Hostel', value: 'hostel', icon: Building2 },
  { label: 'Gym', value: 'gym', icon: Dumbbell },
  { label: 'Other', value: 'other', icon: MapPin },
];

export const SavedPlacesModal = ({ visible, onClose, onSelectOnMap, initialLocation }: SavedPlacesModalProps) => {
  const theme = useTheme();
  const { savedPlaces, userLocation, addSavedPlace, removeSavedPlace } = useLocationStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedType, setSelectedType] = useState<SavedPlace['type']>('home');

  React.useEffect(() => {
    if (initialLocation && visible) {
      setIsAdding(true);
    }
  }, [initialLocation, visible]);

  const handleAddCurrent = () => {
    const location = initialLocation || (userLocation ? {
      latitude: userLocation.coords.latitude,
      longitude: userLocation.coords.longitude
    } : null);

    if (!location) {
      Alert.alert('Error', 'Location not available!');
      return;
    }

    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a name for this place.');
      return;
    }

    addSavedPlace({
      name: newName.trim(),
      type: selectedType,
      latitude: location.latitude,
      longitude: location.longitude,
      radius: 150, // Default 150m geofence
    });

    setNewName('');
    setIsAdding(false);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete Place',
      `Are you sure you want to remove "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeSavedPlace(id) },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Safe Places 📍</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={theme.textLight} />
            </TouchableOpacity>
          </View>

          {isAdding ? (
            <View style={styles.addSection}>
              <Text style={[styles.sectionTitle, { color: theme.textLight }]}>ADD NEW PLACE</Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: theme.isDark ? '#222' : '#F8F8F8',
                  color: theme.text,
                  borderColor: theme.border
                }]}
                placeholder="Place Name (e.g. My School)"
                placeholderTextColor={theme.textLight}
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />

              <Text style={[styles.sectionTitle, { color: theme.textLight, marginTop: 20 }]}>SELECT CATEGORY</Text>
              <View style={styles.typeGrid}>
                {PLACE_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = selectedType === type.value;
                  return (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeItem,
                        { backgroundColor: theme.isDark ? '#222' : '#F8F8F8' },
                        isSelected && { borderColor: theme.primary, borderWidth: 2 }
                      ]}
                      onPress={() => setSelectedType(type.value as any)}
                    >
                      <Icon size={20} color={isSelected ? theme.primary : theme.textLight} />
                      <Text style={[
                        styles.typeLabel,
                        { color: isSelected ? theme.primary : theme.textLight, fontWeight: isSelected ? 'bold' : 'normal' }
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.buttonRow}>
                <Button
                  title="Back"
                  onPress={() => setIsAdding(false)}
                  variant="outline"
                  style={{ flex: 1, marginRight: 10 }}
                />
                <View style={{ flex: 1.5 }}>
                  <Button
                    title={initialLocation ? "Confirm Picked" : "Save Current"}
                    onPress={handleAddCurrent}
                    style={{ marginBottom: 8 }}
                  />
                  {!initialLocation && (
                    <Button
                      title="Pick on Map"
                      onPress={onSelectOnMap}
                      variant="outline"
                    />
                  )}
                </View>
              </View>
            </View>
          ) : (
            <>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {savedPlaces.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Navigation size={48} color={theme.textLight} style={{ opacity: 0.3, marginBottom: 15 }} />
                    <Text style={[styles.emptyText, { color: theme.textLight }]}>
                      No safe places added yet.
                    </Text>
                    <Text style={[styles.emptySubText, { color: theme.textLight }]}>
                      Add places to get automatic arrival alerts.
                    </Text>
                  </View>
                ) : (
                  savedPlaces.map((place) => {
                    const typeInfo = PLACE_TYPES.find(t => t.value === place.type) || PLACE_TYPES[7];
                    const Icon = typeInfo.icon;
                    return (
                      <View
                        key={place.id}
                        style={[styles.placeItem, { backgroundColor: theme.isDark ? '#222' : '#F8F8F8' }]}
                      >
                        <View style={[styles.placeIcon, { backgroundColor: theme.primary + '15' }]}>
                          <Icon size={20} color={theme.primary} />
                        </View>
                        <View style={styles.placeInfo}>
                          <Text style={[styles.placeName, { color: theme.text }]}>{place.name}</Text>
                          <Text style={[styles.placeType, { color: theme.textLight }]}>{typeInfo.label}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDelete(place.id, place.name)}
                          style={styles.deleteButton}
                        >
                          <Trash2 size={18} color={theme.error || '#FF4444'} />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <Button
                title="Add New Safe Place"
                onPress={() => setIsAdding(true)}
                icon={<Plus size={20} color="white" />}
                style={styles.addButton}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    paddingBottom: 40,
    height: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 1,
  },
  addSection: {
    flex: 1,
  },
  input: {
    height: 55,
    borderRadius: 15,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  typeItem: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeLabel: {
    fontSize: 10,
    marginTop: 6,
  },
  list: {
    flex: 1,
    marginBottom: 20,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 18,
    marginBottom: 12,
  },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeInfo: {
    flex: 1,
    marginLeft: 15,
  },
  placeName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  placeType: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    padding: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 'auto',
    paddingTop: 20,
    alignItems: 'stretch',
    minHeight: 75,
  },
  addButton: {
    marginTop: 10,
  }
});
