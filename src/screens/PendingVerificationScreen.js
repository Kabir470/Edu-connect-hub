import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import AppTextInput from '../components/AppTextInput';
import * as Crypto from 'expo-crypto';
import { deriveVerificationStatus } from '../utils/profileCompletion';

const PendingVerificationScreen = () => {
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState(deriveVerificationStatus(user) || 'unverified');
  const [rejectionReason, setRejectionReason] = useState('');
  const [resubmitting, setResubmitting] = useState(false);
  const [address, setAddress] = useState(user?.address || '');
  const [nidNumber, setNidNumber] = useState('');
  const [profileImageUri, setProfileImageUri] = useState(null);
  const [nidImageUri, setNidImageUri] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStatus(deriveVerificationStatus(data));
        setRejectionReason(data.rejectionReason || '');
        setAddress(data.address || '');
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const handleResubmit = async () => {
    if (!user?.uid) return;
    if (!address.trim() || !nidNumber.trim()) {
      return;
    }
    try {
      setResubmitting(true);
      // Only update minimal fields; full image re-upload flow could be added here
      const nidHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nidNumber.trim());
      await updateDoc(doc(db, 'users', user.uid), {
        address: address.trim(),
        nidLast4: nidNumber.slice(-4),
        nidHash,
        verificationStatus: 'pending',
        status: 'pending',
        rejectionReason: null,
        resubmittedAt: new Date().toISOString(),
      });
      setStatus('pending');
    } catch (e) {
      console.error('Resubmit error', e);
    } finally {
      setResubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {status === 'rejected' ? (
        <View style={styles.card}>
          <Ionicons name="close-circle-outline" size={42} color={colors.danger} />
          <Text style={styles.title}>Verification rejected</Text>
          <Text style={styles.desc}>
            {rejectionReason ? rejectionReason : 'Your application was not approved. You may sign out and try again later.'}
          </Text>
          <View style={{ width: '100%', marginTop: 12 }}>
            <Text style={styles.formLabel}>Update Address</Text>
            <AppTextInput value={address} onChangeText={setAddress} placeholder="House, Road, City" />
            <Text style={styles.formLabel}>NID Number</Text>
            <AppTextInput value={nidNumber} onChangeText={setNidNumber} placeholder="Enter your NID number" keyboardType="number-pad" />
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, marginTop: 10 }]}
              onPress={handleResubmit}
              disabled={resubmitting}
            >
              <Text style={styles.buttonText}>{resubmitting ? 'Resubmitting…' : 'Resubmit'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.button, { backgroundColor: colors.danger }]} onPress={signOut}>
            <Text style={styles.buttonText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Ionicons name="shield-checkmark-outline" size={42} color={colors.primary} />
          <Text style={styles.title}>{status === 'pending' ? 'Verification in progress' : 'Not verified yet'}</Text>
          <Text style={styles.desc}>
            {status === 'pending'
              ? 'Thanks for submitting your details. An admin will review your verification request soon.'
              : 'Complete your profile and request verification from your Profile screen to unlock full access.'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={signOut}>
            <Text style={styles.buttonText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 24, alignItems: 'center', gap: 12, width: '100%' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 4 },
  desc: { textAlign: 'center', color: colors.textLight },
  button: { marginTop: 8, backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  buttonText: { color: colors.white, fontWeight: '700' },
  formLabel: { fontSize: 12, color: colors.textLight, marginTop: 8 },
  inputBox: { backgroundColor: colors.background, borderRadius: 8, padding: 10, marginTop: 4, borderWidth: 1, borderColor: colors.border },
  inputText: { fontSize: 13, color: colors.text },
});

export default PendingVerificationScreen;
