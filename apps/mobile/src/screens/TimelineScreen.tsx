import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, SafeAreaView, Image } from 'react-native';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Plus, Image as ImageIcon, FileText, Camera } from 'lucide-react-native';

export const TimelineScreen = () => {
  const memories = [
    {
      id: '1',
      type: 'image',
      content: 'Our weekend getaway was amazing! 🏔️',
      date: 'Oct 24, 2023',
      imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: '2',
      type: 'note',
      content: 'Dont forget to pick up the groceries on your way home. Love you!',
      date: 'Oct 23, 2023',
    },
    {
      id: '3',
      type: 'image',
      content: 'Coffee dates are the best ☕️',
      date: 'Oct 22, 2023',
      imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80',
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Shared Timeline" 
        showBack 
        rightElement={
          <TouchableOpacity style={styles.addButton}>
            <Plus color="white" size={24} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {memories.map((item) => (
          <Card key={item.id} style={styles.memoryCard}>
            <Text style={styles.date}>{item.date}</Text>
            {item.imageUrl && (
              <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
            )}
            <Text style={styles.content}>{item.content}</Text>
            <View style={styles.footer}>
              <View style={styles.avatarMini} />
              <Text style={styles.author}>Shared by you</Text>
            </View>
          </Card>
        ))}
      </ScrollView>

      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fabItem}>
          <Camera size={24} color="#FF6B6B" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabItem}>
          <FileText size={24} color="#FF6B6B" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabItem}>
          <ImageIcon size={24} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  addButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryCard: {
    marginBottom: 20,
  },
  date: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 15,
    marginBottom: 15,
  },
  content: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 15,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  avatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFE5E5',
    marginRight: 8,
  },
  author: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  fabItem: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
});
