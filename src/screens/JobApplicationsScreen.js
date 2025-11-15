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

const formatDate = (ts) => {
  if (!ts) return '';
  if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
  if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts).toLocaleDateString();
  return '';
};

const JobApplicationsScreen = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'jobApplications'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setApplications(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    }, (error) => console.error('job applications error', error));
    return () => unsub();
  }, [user?.uid]);

  const handleContact = (item) => {
    if (!item.contactEmail) {
      Alert.alert('Missing contact', 'The recruiter did not provide a contact email');
      return;
    }
    Alert.alert('Contact recruiter', `Email ${item.contactEmail} to follow up on this role.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.role}>{item.jobTitle || 'Job title'}</Text>
              <Text style={styles.company}>{item.company || item.jobCompany || 'Company'}</Text>
              <Text style={styles.meta}>Applied {formatDate(item.appliedAt)}</Text>
              <Text style={[styles.status, styles[item.status?.toLowerCase()] || styles.defaultStatus]}>
                {item.status || 'Pending'}
              </Text>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={() => handleContact(item)}>
              <Ionicons name="chatbox-ellipses-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={40} color={colors.mediumGray} />
            <Text style={styles.emptyText}>No applications yet</Text>
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
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  role: { fontSize: 16, fontWeight: '700', color: colors.text },
  company: { color: colors.textLight, marginTop: 4 },
  meta: { fontSize: 12, color: colors.textLight, marginTop: 8 },
  status: { marginTop: 6, fontWeight: '700' },
  pending: { color: colors.warning },
  shortlisted: { color: colors.info },
  hired: { color: colors.success },
  rejected: { color: colors.danger },
  defaultStatus: { color: colors.textLight },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { color: colors.textLight, marginTop: 8 },
});

export default JobApplicationsScreen;
