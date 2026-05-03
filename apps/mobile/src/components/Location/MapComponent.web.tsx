import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const MapComponent = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Maps are currently available on mobile only 📱</Text>
      <Text style={styles.subText}>Open the app on iOS or Android for the full experience.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 40,
  },
  text: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  }
});
