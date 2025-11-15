import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

const formatDateTime = (ts) => {
  if (!ts) return '';
  const date = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const ScheduledConsultationsScreen = () => {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'consultations'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setConsultations(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    }, (error) => console.error('consultations error', error));
    return () => unsub();
  }, [user?.uid]);

  const handleJoin = (item) => {
    if (!item.meetingLink) {
      Alert.alert('Link unavailable', 'The expert has not shared a conferencing link yet.');
      return;
    }
    Alert.alert('Join consultation', `Open this link in your browser: ${item.meetingLink}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={consultations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Ionicons name="calendar-outline" size={32} color={colors.primary} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.expert}>{item.expertName || 'Expert session'}</Text>
              <Text style={styles.meta}>{formatDateTime(item.scheduledFor)}</Text>
              <Text style={[styles.status, styles[item.status?.toLowerCase()] || styles.pending]}>
                {item.status || 'Scheduled'}
              </Text>
            </View>
            <TouchableOpacity style={styles.joinButton} onPress={() => handleJoin(item)}>
              <Ionicons name="play" size={18} color={colors.white} />
              <Text style={styles.joinText}>Join</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={42} color={colors.mediumGray} />
            <Text style={styles.emptyText}>You have no upcoming consultations.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 30 }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  expert: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  status: { marginTop: 6, fontWeight: '600' },
  scheduled: { color: colors.info },
  completed: { color: colors.success },
  cancelled: { color: colors.danger },
  pending: { color: colors.warning },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  joinText: { color: colors.white, fontWeight: '600', marginLeft: 6 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { color: colors.textLight, marginTop: 10, textAlign: 'center' },
});

export default ScheduledConsultationsScreen;
