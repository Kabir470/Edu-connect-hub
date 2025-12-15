import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const ManageUsersScreen = () => {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectingFor, setRejectingFor] = useState(null); // selected user item
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q1 = query(collection(db, 'users'), where('verificationStatus', '==', 'pending'));
    const q2 = query(collection(db, 'users'), where('status', '==', 'pending'));

    const upsert = (snap) => {
      const incoming = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPending((prev) => {
        const map = new Map((prev || []).map((u) => [u.id, u]));
        for (const item of incoming) map.set(item.id, item);
        return Array.from(map.values());
      });
      setLoading(false);
    };

    const onErr = (e) => {
      console.error('Pending users subscribe error', e);
      setLoading(false);
    };

    const unsub1 = onSnapshot(q1, upsert, onErr);
    const unsub2 = onSnapshot(q2, upsert, onErr);
    return () => {
      try { unsub1 && unsub1(); } catch (_) {}
      try { unsub2 && unsub2(); } catch (_) {}
    };
  }, []);

  const onApprove = async (item) => {
    try {
      await updateDoc(doc(db, 'users', item.id), {
        verificationStatus: 'verified',
        status: 'approved',
        verifiedAt: serverTimestamp(),
        rejectionReason: null,
      });
      Alert.alert('Approved', `${item.fullName || item.email} has been approved.`);
    } catch (e) {
      console.error('Approve error', e);
      Alert.alert('Error', e.message || 'Failed to approve user');
    }
  };

  const startReject = (item) => {
    setRejectingFor(item);
    setRejectReason('');
  };

  const confirmReject = async () => {
    if (!rejectingFor) return;
    const reason = rejectReason.trim();
    if (!reason) {
      Alert.alert('Reason required', 'Please provide a short message for the applicant.');
      return;
    }
    try {
      setSubmitting(true);
      await updateDoc(doc(db, 'users', rejectingFor.id), {
        verificationStatus: 'rejected',
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: serverTimestamp(),
      });
      setRejectingFor(null);
      setRejectReason('');
      Alert.alert('Rejected', `${rejectingFor.fullName || rejectingFor.email} has been rejected.`);
    } catch (e) {
      console.error('Reject error', e);
      Alert.alert('Error', e.message || 'Failed to reject user');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Image
          source={item.profileImageURL ? { uri: item.profileImageURL } : require('../../assets/shahriar-kabir.jpg')}
          style={styles.avatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.fullName || 'Unnamed'}</Text>
          <Text style={styles.email}>{item.email}</Text>
          <Text style={styles.role}>{(item.role || 'user').toUpperCase()}</Text>
          <Text style={styles.address} numberOfLines={2}>{item.address || '—'}</Text>
        </View>
      </View>

      <View style={styles.nidRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nidLabel}>NID Number</Text>
          <Text style={styles.nidValue}>{item.nidLast4 ? `•••• ${item.nidLast4}` : '—'}</Text>
        </View>
        {item.nidImageURL ? (
          <Image source={{ uri: item.nidImageURL }} style={styles.nidImage} />
        ) : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.success }]} onPress={() => onApprove(item)}>
          <Ionicons name="checkmark" size={18} color={colors.white} />
          <Text style={styles.btnText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.danger }]} onPress={() => startReject(item)}>
          <Ionicons name="close" size={18} color={colors.white} />
          <Text style={styles.btnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={pending}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={loading ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textLight }}>Loading…</Text>
          </View>
        ) : (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textLight }}>No pending applications.</Text>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {/* Reject reason modal */}
      <Modal
        animationType="slide"
        transparent
        visible={!!rejectingFor}
        onRequestClose={() => setRejectingFor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject application</Text>
            <Text style={styles.modalSubtitle}>
              Please provide a brief message explaining why the application is being rejected.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., NID photo is unclear. Please re-upload a clearer image."
              placeholderTextColor={colors.mediumGray}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.mediumGray }]} onPress={() => setRejectingFor(null)} disabled={submitting}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.danger }]} onPress={confirmReject} disabled={submitting}>
                <Text style={styles.modalBtnText}>{submitting ? 'Rejecting…' : 'Reject'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 12 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  email: { fontSize: 13, color: colors.textLight },
  role: { fontSize: 12, color: colors.primary, marginTop: 2 },
  address: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  nidRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  nidLabel: { fontSize: 12, color: colors.textLight },
  nidValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  nidImage: { width: 120, height: 80, borderRadius: 8, marginLeft: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  btnText: { color: colors.white, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.white, borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalSubtitle: { marginTop: 6, color: colors.textLight },
  input: { marginTop: 12, minHeight: 100, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  modalBtnText: { color: colors.white, fontWeight: '700' },
});

export default ManageUsersScreen;
