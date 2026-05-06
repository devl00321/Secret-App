import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Pressable 
} from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

interface SOSButtonProps {
  onTrigger: () => void;
  onCancel: () => void;
  progressAnim: Animated.Value; // Passed down from parent for sync
  isActive: boolean;
  isSilent?: boolean;
}

export const SOSButton = ({ onTrigger, onCancel, progressAnim, isActive, isSilent }: SOSButtonProps) => {
  const [isPressing, setIsPressing] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hapticTimer = useRef<any>(null);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    
    if (!isActive && !isPressing) {
      pulse.start();
    } else {
      pulse.stop();
      pulseAnim.setValue(1);
    }
    
    return () => pulse.stop();
  }, [isActive, isPressing]);

  const startHaptics = () => {
    let speed = 400;
    const pulse = () => {
      if (!isSilent) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      speed = Math.max(70, speed - 50);
      hapticTimer.current = setTimeout(pulse, speed);
    };
    pulse();
  };

  const stopHaptics = () => {
    if (hapticTimer.current) {
      clearTimeout(hapticTimer.current);
      hapticTimer.current = null;
    }
  };

  const handlePressIn = () => {
    if (isActive) return;
    setIsPressing(true);
    startHaptics();

    // Start progress timer on the shared animation value
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        triggerSOS();
      }
    });

    Animated.spring(scaleAnim, {
      toValue: 0.88,
      useNativeDriver: true,
      friction: 4,
    }).start();
  };

  const handlePressOut = () => {
    if (isActive) return;
    setIsPressing(false);
    stopHaptics();
    
    progressAnim.stopAnimation();
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: false,
    }).start();

    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
    }).start();
  };

  const triggerSOS = async () => {
    stopHaptics();
    if (!isSilent) {
      // Triple heavy impact for a solid "thuk" feeling
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 50);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
    }
    
    onTrigger();
  };

  if (isActive) {
    return (
      <View style={isSilent ? null : styles.outerGlow}>
        <TouchableOpacity 
          activeOpacity={0.9}
          style={[
            styles.sosButton, 
            isSilent ? styles.silentActiveButton : styles.activeButton
          ]}
          onPress={() => {
            if (!isSilent) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            onCancel();
          }}
        >
          <LinearGradient
            colors={isSilent ? ['#333', '#111'] : ['#FF3B30', '#FF2D55']}
            style={styles.gradient}
          />
          <ShieldAlert size={40} color={isSilent ? '#FF3B30' : "white"} />
          <Text style={[styles.sosTextActive, isSilent && { color: '#FF3B30' }]}>
            {isSilent ? 'ACTIVATED' : 'ACTIVE'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.glowRing, { transform: [{ scale: pulseAnim }], opacity: isPressing ? 0 : 0.1 }]} />
      
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.sosButton}
        >
          <LinearGradient
            colors={['#FF3B30', '#FF2D55']}
            style={styles.gradient}
          />
          <View style={styles.content}>
            <Text style={styles.sosText}>SOS</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 260,
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#FF3B30',
  },
  sosButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 85,
  },
  activeButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  silentActiveButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: '#FF3B3040',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  sosText: {
    color: 'white',
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: -1,
  },
  sosTextActive: {
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 5,
  },
  outerGlow: {
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
  }
});
