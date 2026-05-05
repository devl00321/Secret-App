import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Shield, Lock } from 'lucide-react-native';
import { useTheme } from '../theme';

interface LockOverlayProps {
  onUnlock: () => void;
  isAuthenticating: boolean;
  title?: string;
  description?: string;
}

export const LockOverlay = ({ 
  onUnlock, 
  isAuthenticating, 
  title = "App is Locked", 
  description = "Authentication required to access your data." 
}: LockOverlayProps) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.lockCircle, { backgroundColor: theme.primary + '10' }]}>
        <Lock size={60} color={theme.primary} />
      </View>
      <Text style={[styles.lockTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.lockDesc, { color: theme.textLight }]}>
        {description}
      </Text>
      <TouchableOpacity 
        style={[styles.unlockButton, { backgroundColor: theme.primary }]}
        onPress={onUnlock}
        disabled={isAuthenticating}
      >
        {isAuthenticating ? (
          <ActivityIndicator color="white" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Shield size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.unlockButtonText}>Unlock App</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  lockCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
  },
  lockDesc: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 32,
    lineHeight: 22,
  },
  unlockButton: {
    flexDirection: 'row',
    height: 56,
    paddingHorizontal: 32,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  unlockButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
