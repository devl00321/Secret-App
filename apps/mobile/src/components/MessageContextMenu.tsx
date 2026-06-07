import React, { useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  Image
} from 'react-native';
import { BlurView } from 'expo-blur';
import { 
  Reply, 
  Copy, 
  Pencil, 
  Undo2, 
  Trash2, 
  Forward,
  Star,
  Info,
  MoreHorizontal 
} from 'lucide-react-native';
import Animated, { 
  FadeIn, 
  FadeOut, 
  ZoomIn, 
  ZoomOut,
  useAnimatedStyle,
  withSpring,
  useSharedValue
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ContextMenuProps {
  visible: boolean;
  onClose: () => void;
  onCopy: () => void;
  onUnsend?: () => void;
  onDelete?: () => void;
  onReply?: () => void;
  onEdit?: () => void;
  isMe: boolean;
  messageText: string;
  imageUrl?: string;
  createdAt?: any;
  messagePosition?: { x: number; y: number; width: number; height: number } | null;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];

export const MessageContextMenu = ({ 
  visible, 
  onClose, 
  onCopy, 
  onUnsend, 
  onDelete, 
  onReply, 
  onEdit,
  isMe,
  messageText,
  imageUrl,
  createdAt,
  messagePosition
}: ContextMenuProps) => {
  const theme = useTheme();

  // 2-minute unsend window logic
  const canUnsend = React.useMemo(() => {
    if (!isMe || !createdAt) return false;
    const msgDate = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - msgDate.getTime()) / 1000);
    return diffInSeconds < 120; // 2 minutes
  }, [visible, createdAt, isMe]);

  const { x, y, width, height } = messagePosition || { x: 0, y: 0, width: 0, height: 0 };
  
  // Dynamic positioning logic
  const menuWidth = 240;
  const menuHeight = 300;
  const reactionsHeight = 50;
  
  // CALCULATE FLOAT OFFSET: We now lift the bubble if needed to fit the menu BELOW
  const threshold = SCREEN_HEIGHT - 400;
  const floatOffsetValue = (visible && y + height > threshold) ? -(y + height - threshold + 20) : 0;
  const floatOffset = useSharedValue(0);

  useEffect(() => {
    floatOffset.value = withSpring(visible ? floatOffsetValue : 0);
  }, [visible, floatOffsetValue]);

  // Horizontal Alignment (Precision Docking)
  const menuX = isMe ? (x + width - menuWidth) : x;
  const safeMenuX = Math.min(Math.max(10, menuX), SCREEN_WIDTH - menuWidth - 10);

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatOffset.value }]
  }));

  if (!visible || !messagePosition) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <BlurView 
            intensity={Platform.OS === 'android' ? 80 : 60} 
            style={StyleSheet.absoluteFill} 
            tint={theme.isDark ? 'dark' : 'light'} 
          />
          
          <Animated.View style={[styles.contentContainer, animatedContentStyle]}>
            {/* THE HIGHLIGHTED BUBBLE */}
            <Animated.View 
              entering={FadeIn.duration(200)}
              style={[
                styles.highlightedBubble, 
                { 
                  top: y, 
                  left: x, 
                  width: width, 
                  height: height,
                  transform: [{ scale: 1.05 }] 
                }
              ]}
            >
               {isMe ? (
                <LinearGradient
                  colors={[theme.accentRose, theme.accentRose + 'DD']}
                  style={[styles.bubble, { borderBottomRightRadius: 4, borderRadius: 20 }]}
                >
                  {imageUrl && <Image source={{ uri: imageUrl }} style={styles.bubbleImage} />}
                  {messageText ? <Text style={styles.bubbleTextMe}>{messageText}</Text> : null}
                </LinearGradient>
              ) : (
                <View style={[styles.bubble, { backgroundColor: theme.bgSurface, borderBottomLeftRadius: 4, borderRadius: 20 }]}>
                  {imageUrl && <Image source={{ uri: imageUrl }} style={styles.bubbleImage} />}
                  {messageText ? <Text style={[styles.bubbleTextPartner, { color: theme.textPrimary }]}>{messageText}</Text> : null}
                </View>
              )}
            </Animated.View>

            {/* REACTIONS BAR (Above the text) */}
            <Animated.View 
              entering={ZoomIn.duration(200).delay(50)}
              style={[
                styles.reactionsBar, 
                { 
                  top: y - reactionsHeight - 10,
                  left: isMe ? undefined : Math.max(10, x),
                  right: isMe ? Math.max(10, SCREEN_WIDTH - (x + width)) : undefined,
                  backgroundColor: theme.bgSurface,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 12,
                  elevation: 8,
                }
              ]}
            >
              {EMOJIS.map((emoji, index) => (
                <TouchableOpacity key={index} style={styles.emojiBtn} onPress={onClose}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.emojiBtnMore} onPress={onClose}>
                <Text style={[styles.emojiPlus, { color: theme.textSecondary }]}>+</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* VERTICAL MENU (Just under the text) */}
            <Animated.View 
              entering={ZoomIn.duration(200).delay(100)}
              style={[
                styles.menuContainer, 
                { 
                  top: y + height + 8,
                  left: safeMenuX,
                  backgroundColor: theme.bgSurface,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.18,
                  shadowRadius: 24,
                  elevation: 16,
                }
              ]}
            >
              <MenuAction icon={<Reply size={20} color={theme.textPrimary} />} label="Reply" onPress={() => { onReply?.(); onClose(); }} theme={theme} />
              <MenuAction icon={<Copy size={20} color={theme.textPrimary} />} label="Copy" onPress={() => { onCopy(); onClose(); }} theme={theme} />
              
              {isMe && (
                <MenuAction icon={<Pencil size={20} color={theme.textPrimary} />} label="Edit" onPress={() => { onEdit?.(); onClose(); }} theme={theme} />
              )}
              
              <MenuAction icon={<Star size={20} color={theme.textPrimary} />} label="Star" onPress={onClose} theme={theme} />
              
              <View style={[styles.divider, { backgroundColor: theme.borderDefault }]} />
              
              {canUnsend && (
                <MenuAction 
                  icon={<Undo2 size={20} color="#FF3B30" />} 
                  label="Unsend" 
                  onPress={() => { onUnsend?.(); onClose(); }} 
                  theme={theme} 
                  isDestructive
                />
              )}
              
              <MenuAction 
                icon={<Trash2 size={20} color="#FF3B30" />} 
                label="Delete" 
                onPress={() => { onDelete?.(); onClose(); }} 
                theme={theme} 
                isDestructive
              />
            </Animated.View>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const MenuAction = ({ icon, label, onPress, theme, isDestructive }: any) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuIconWrapper}>{icon}</View>
    <Text style={[styles.menuItemText, { color: isDestructive ? '#FF3B30' : theme.textPrimary }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  highlightedBubble: {
    position: 'absolute',
    zIndex: 100,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  bubbleTextMe: {
    color: 'white',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  bubbleTextPartner: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  bubbleImage: {
    width: 240,
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
  },
  reactionsBar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 30,
    zIndex: 110,
  },
  emojiBtn: {
    padding: 6,
  },
  emojiText: {
    fontSize: 22,
  },
  emojiBtnMore: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  emojiPlus: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuContainer: {
    position: 'absolute',
    width: 240,
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 110,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuIconWrapper: {
    width: 24,
    marginRight: 12,
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 4,
    opacity: 0.5,
  },
});
