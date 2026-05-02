import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';

interface MessageBubbleProps {
  content: string;
  isMe: boolean;
  timestamp: string;
}

export const MessageBubble = ({ content, isMe, timestamp }: MessageBubbleProps) => {
  const theme = useTheme();

  return (
    <Animated.View 
      entering={FadeInUp.duration(400).springify()}
      layout={Layout.springify()}
      style={[styles.container, isMe ? styles.myMessage : styles.partnerMessage]}
    >
      {isMe ? (
        <LinearGradient
          colors={[theme.primary, theme.primary + 'DD']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.bubble,
            { borderBottomRightRadius: 4, borderRadius: theme.radius.lg }
          ]}
        >
          <Text style={[styles.text, { color: '#FFFFFF' }]}>{content}</Text>
        </LinearGradient>
      ) : (
        <View style={[
          styles.bubble, 
          { backgroundColor: theme.bubblePartner, borderBottomLeftRadius: 4 },
          { borderRadius: theme.radius.lg }
        ]}>
          <Text style={[styles.text, { color: theme.text }]}>{content}</Text>
        </View>
      )}
      <Text style={[styles.timestamp, { color: theme.textLight }]}>
        {timestamp}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '85%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  partnerMessage: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '700',
    opacity: 0.6,
    marginHorizontal: 4,
  },
});
