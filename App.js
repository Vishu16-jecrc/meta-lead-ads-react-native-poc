import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  SafeAreaView,
  StatusBar,
  Animated,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import io from 'socket.io-client';

// Default backend URL (uses our live Cloudflare tunnel so it works seamlessly on phones & simulators)
const DEFAULT_SERVER_URL = 'https://pee-segment-save-gore.trycloudflare.com';

export default function App() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [tempUrl, setTempUrl] = useState(DEFAULT_SERVER_URL);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [leads, setLeads] = useState([]);
  const [lastReceivedId, setLastReceivedId] = useState(null);

  const socketRef = useRef(null);

  useEffect(() => {
    // Initial fetch of existing leads via REST API as a robust fallback
    fetch(`${serverUrl}/api/leads`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.leads)) {
          setLeads(data.leads);
        }
      })
      .catch((err) => console.log('Initial fetch error:', err.message));

    // Initialize clean, persistent WebSocket connection
    const socket = io(serverUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⚡ Connected to backend socket:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from backend socket');
      setIsConnected(false);
    });

    // Hydrate existing leads over socket
    socket.on('initial_leads', (initialLeads) => {
      if (Array.isArray(initialLeads) && initialLeads.length > 0) {
        setLeads(initialLeads);
      }
    });

    // Listen for live incoming Meta leads!
    socket.on('new_lead', (newLead) => {
      console.log('🔥 Live lead received in React Native:', newLead);
      setLastReceivedId(newLead.id);
      setLeads((prevLeads) => {
        const exists = prevLeads.some((item) => item.id === newLead.id);
        if (exists) return prevLeads;
        return [newLead, ...prevLeads];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl]);

  const handleSaveUrl = () => {
    let formatted = tempUrl.trim();
    if (formatted.endsWith('/')) {
      formatted = formatted.slice(0, -1);
    }
    setServerUrl(formatted);
    setIsConfigOpen(false);
  };

  const renderLeadCard = ({ item, index }) => {
    const isLatest = item.id === lastReceivedId || index === 0;

    return (
      <View style={[styles.card, isLatest && styles.cardHighlight]}>
        <View style={styles.cardHeader}>
          <View style={styles.nameContainer}>
            <Text style={styles.leadName}>{item.fullName || 'Anonymous Lead'}</Text>
            {isLatest && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>LIVE NEW</Text>
              </View>
            )}
          </View>
          <Text style={styles.timeText}>
            {item.createdTime ? new Date(item.createdTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
          </Text>
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>📧 Email:</Text>
          <Text style={styles.fieldValue}>{item.email || 'N/A'}</Text>
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>📱 Phone:</Text>
          <Text style={styles.fieldValue}>{item.phoneNumber || 'N/A'}</Text>
        </View>

        {item.fields && Object.keys(item.fields).length > 0 && (
          <View style={styles.customFieldsContainer}>
            {Object.entries(item.fields)
              .filter(([key]) => !['full_name', 'name', 'email', 'phone_number', 'phone'].includes(key))
              .map(([key, val]) => (
                <View key={key} style={styles.tag}>
                  <Text style={styles.tagText}>{key}: {String(val)}</Text>
                </View>
              ))}
          </View>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.sourceTag}>
            <Text style={styles.sourceText}>Meta Lead Ads</Text>
          </View>
          <Text style={styles.idText}>ID: {item.id ? String(item.id).slice(-8) : 'N/A'}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Meta Lead Stream</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isConnected ? styles.dotGreen : styles.dotRed]} />
            <Text style={styles.statusText}>
              {isConnected ? 'Real-Time Connected' : 'Reconnecting...'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.configButton} onPress={() => setIsConfigOpen(true)}>
          <Text style={styles.configButtonText}>⚙️ Server</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Stats Bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          Total Leads: <Text style={styles.statsCount}>{leads.length}</Text>
        </Text>
        <Text style={styles.statsSub}>Real-Time WebSocket Sync</Text>
      </View>

      {/* Main Leads List */}
      {leads.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyTitle}>Listening for incoming Meta leads...</Text>
          <Text style={styles.emptyDesc}>
            Submit a lead in Meta's Lead Ads Testing Tool to see it appear here instantly without refreshing.
          </Text>
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item, index) => item.id || String(index)}
          renderItem={renderLeadCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Backend URL Configuration Modal */}
      <Modal visible={isConfigOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Backend Server Configuration</Text>
            <Text style={styles.modalDesc}>
              Enter your backend server URL (e.g. your ngrok tunnel URL or local machine IP:3000):
            </Text>
            <TextInput
              style={styles.input}
              value={tempUrl}
              onChangeText={setTempUrl}
              placeholder="http://192.168.1.X:3000"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setIsConfigOpen(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleSaveUrl}
              >
                <Text style={[styles.modalBtnText, { color: '#ffffff' }]}>Save & Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: -0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotGreen: {
    backgroundColor: '#22c55e',
  },
  dotRed: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  configButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  configButtonText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  statsText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  statsCount: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  statsSub: {
    color: '#64748b',
    fontSize: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHighlight: {
    borderColor: '#38bdf8',
    backgroundColor: '#172554',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  leadName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginRight: 8,
  },
  newBadge: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '800',
  },
  timeText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#94a3b8',
    width: 75,
  },
  fieldValue: {
    fontSize: 14,
    color: '#f1f5f9',
    fontWeight: '500',
    flex: 1,
  },
  customFieldsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    color: '#e2e8f0',
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  sourceTag: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sourceText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  idText: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  emptyIcon: {
    fontSize: 54,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    color: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelBtn: {
    backgroundColor: '#334155',
  },
  saveBtn: {
    backgroundColor: '#0284c7',
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
  },
});
