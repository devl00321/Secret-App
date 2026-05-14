import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { 
  ArrowUp, 
  ArrowUpLeft, 
  ArrowUpRight, 
  ArrowLeft, 
  ArrowRight, 
  Navigation2,
  X,
  Mic,
  MicOff,
  Map as MapIcon,
  RotateCw,
  MapPin
} from 'lucide-react-native';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NavigationOverlayProps {
  steps: any[] | null;
  distance: number | null;
  eta: number | null;
  onClose: () => void;
  partnerName: string;
  onRecenter: () => void;
  onCenterPartner: () => void;
  isVoiceEnabled: boolean;
  onToggleVoice: () => void;
}

export const NavigationOverlay = ({ 
  steps, 
  distance, 
  eta, 
  onClose, 
  partnerName,
  onRecenter,
  onCenterPartner,
  isVoiceEnabled,
  onToggleVoice
}: NavigationOverlayProps) => {
  const theme = useTheme();
  
  const currentStep = steps && steps.length > 0 ? steps[0] : null;
  
  const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
  };

  const getStepIcon = (instruction: string) => {
    const text = instruction.toLowerCase();
    if (text.includes('left')) return <ArrowLeft size={38} color="white" />;
    if (text.includes('right')) return <ArrowRight size={38} color="white" />;
    if (text.includes('slight left')) return <ArrowUpLeft size={38} color="white" />;
    if (text.includes('slight right')) return <ArrowUpRight size={38} color="white" />;
    return <ArrowUp size={38} color="white" />;
  };

  const formatEta = (minutes: number | null) => {
    if (minutes === null) return '--:--';
    const now = new Date();
    const arrival = new Date(now.getTime() + minutes * 60000);
    return arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Top Instruction Card */}
      <View style={styles.topContainer}>
        <View style={[styles.instructionCard, { backgroundColor: theme.primary }]}>
          <View style={styles.instructionMain}>
            <View style={styles.maneuverContainer}>
              {currentStep ? getStepIcon(currentStep.html_instructions) : <Navigation2 size={38} color="white" />}
              <Text style={styles.distanceText}>
                {currentStep?.distance?.text || '---'}
              </Text>
            </View>
            
            <View style={styles.instructionTextContainer}>
              <Text style={styles.instructionText} numberOfLines={2}>
                {currentStep ? stripHtml(currentStep.html_instructions) : `Navigating to ${partnerName}`}
              </Text>
              <View style={[styles.roadBadge, { backgroundColor: theme.surface }]}>
                <Text style={[styles.roadBadgeText, { color: theme.primary }]}>LUVV</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.micButton, !isVoiceEnabled && { backgroundColor: '#FF3B30' }]} 
              onPress={onToggleVoice}
            >
              {isVoiceEnabled ? <Mic size={24} color="white" /> : <MicOff size={24} color="white" />}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Middle Floating Buttons */}
      <View style={styles.middleLeftControls}>
        <TouchableOpacity 
          style={[styles.floatingActionBtn, { backgroundColor: theme.surface }]}
          onPress={onRecenter}
        >
          <RotateCw size={22} color={theme.primary} />
          <Text style={[styles.floatingActionText, { color: theme.text }]}>Re-centre</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.floatingActionBtn, { backgroundColor: theme.surface, marginTop: 12 }]}
          onPress={onCenterPartner}
        >
          <MapPin size={22} color={theme.secondary || '#FF6B6B'} />
          <Text style={[styles.floatingActionText, { color: theme.text }]}>{partnerName}</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Stats Card */}
      <View style={styles.bottomContainer}>
        <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.statsLeft}>
            <TouchableOpacity style={[styles.routeOverviewBtn, { backgroundColor: theme.border + '30' }]}>
              <MapIcon size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsCenter}>
            <View style={styles.etaRow}>
              <Text style={[styles.etaValue, { color: theme.primary }]}>{eta ? Math.round(eta) : '--'}</Text>
              <Text style={[styles.etaUnit, { color: theme.primary }]}> min</Text>
              <Text style={[styles.arrivalTime, { color: theme.textLight }]}> • {formatEta(eta)}</Text>
            </View>
            <Text style={[styles.totalDistance, { color: theme.textLight }]}>
              {distance ? (distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`) : '--'}
            </Text>
          </View>

          <View style={styles.statsRight}>
            <TouchableOpacity 
              style={[styles.exitButton, { backgroundColor: theme.border + '50' }]} 
              onPress={onClose}
            >
              <Text style={[styles.exitButtonText, { color: '#FF3B30' }]}>Exit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingBottom: 110,
    zIndex: 1000,
  },
  topContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
  },
  instructionCard: {
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  instructionMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  maneuverContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  distanceText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  instructionTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  instructionText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  roadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  roadBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  middleLeftControls: {
    position: 'absolute',
    bottom: 200,
    left: 20,
  },
  floatingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  floatingActionText: {
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
  },
  bottomContainer: {
    paddingHorizontal: 20,
  },
  statsCard: {
    borderRadius: 24,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  statsLeft: {
    width: 50,
    alignItems: 'center',
  },
  routeOverviewBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsCenter: {
    flex: 1,
    alignItems: 'center',
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  etaValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  etaUnit: {
    fontSize: 14,
    fontWeight: '700',
  },
  arrivalTime: {
    fontSize: 18,
    fontWeight: '600',
  },
  totalDistance: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  statsRight: {
    width: 80,
    alignItems: 'center',
  },
  exitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  exitButtonText: {
    fontWeight: '900',
    fontSize: 15,
  },
});
