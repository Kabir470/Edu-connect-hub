import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  acceptConsultation,
  declineConsultation,
  cancelConsultation,
  updateMeetingLink,
  completeConsultation,
  markPaymentStatus,
  submitConsultationReview,
} from '../utils/consultationService';

const formatDateTime = (ts) => {
  if (!ts) return '';
  const date = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const ScheduledConsultationsScreen = () => {
  const { user } = useAuth();
  const [asClient, setAsClient] = useState([]);
  const [asExpert, setAsExpert] = useState([]);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkMode, setLinkMode] = useState('accept');
  const [activeConsultation, setActiveConsultation] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentLoadingId, setPaymentLoadingId] = useState(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const sortBySchedule = (list) =>
    [...list].sort((a, b) => {
      const aTime = a?.scheduledFor?.seconds || 0;
      const bTime = b?.scheduledFor?.seconds || 0;
      return aTime - bTime;
    });

  useEffect(() => {
    if (!user?.uid) return;
    const qClient = query(collection(db, 'consultations'), where('userId', '==', user.uid));
    const qExpert = query(collection(db, 'consultations'), where('expertId', '==', user.uid));
    const unsubClient = onSnapshot(qClient, (snapshot) => {
      setAsClient(sortBySchedule(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))));
    }, (error) => console.error('consultations client error', error));
    const unsubExpert = onSnapshot(qExpert, (snapshot) => {
      setAsExpert(sortBySchedule(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))));
    }, (error) => console.error('consultations expert error', error));
    return () => { unsubClient(); unsubExpert(); };
  }, [user?.uid]);

  const handleJoin = (item) => {
    if (!item?.meetingLink) {
      Alert.alert('Link unavailable', 'The expert has not shared a conferencing link yet.');
      return;
    }
    Linking.openURL(item.meetingLink).catch(() => {
      Alert.alert('Unable to open link', 'Copy and paste the URL into your browser.');
    });
  };

  const confirmCancel = (item, role = 'user') => {
    Alert.alert('Cancel consultation?', role === 'user' ? 'This will release the slot for someone else.' : 'The client will be notified.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel session',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelConsultation({ consultationId: item.id, actorId: user.uid, role });
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleComplete = async (item) => {
    try {
      await completeConsultation({ consultationId: item.id, expertId: user.uid });
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const openLinkModal = (item, mode = 'accept') => {
    setActiveConsultation(item);
    setLinkMode(mode);
    setLinkValue(item?.meetingLink || '');
    setLinkModalVisible(true);
  };

  const closeLinkModal = () => {
    setLinkModalVisible(false);
    setActiveConsultation(null);
    setLinkValue('');
  };

  const handleLinkSubmit = async () => {
    if (!activeConsultation) return;
    setActionLoading(true);
    try {
      if (linkMode === 'accept') {
        await acceptConsultation({ consultationId: activeConsultation.id, expertId: user.uid, meetingLink: linkValue.trim() || null });
      } else {
        await updateMeetingLink({ consultationId: activeConsultation.id, expertId: user.uid, meetingLink: linkValue.trim() || null });
      }
      closeLinkModal();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaymentUpdate = async (item, role, status) => {
    if (!item?.id || !user?.uid) return;
    const key = `${item.id}-${role}-${status}`;
    setPaymentLoadingId(key);
    try {
      await markPaymentStatus({ consultationId: item.id, actorId: user.uid, role, status });
    } catch (e) {
      Alert.alert('Payment update failed', e.message);
    } finally {
      setPaymentLoadingId(null);
    }
  };

  const readablePaymentStatus = (status) => {
    const normalized = (status || 'pending').toLowerCase();
    switch (normalized) {
      case 'due':
        return 'Payment due';
      case 'paid':
        return 'Paid';
      case 'cancelled':
      case 'cancelled-by-client':
      case 'cancelled-by-expert':
        return 'Cancelled';
      case 'pending':
        return 'Awaiting approval';
      default:
        return normalized.replace(/-/g, ' ');
    }
  };

  const openReviewModal = (item) => {
    setReviewTarget(item);
    setReviewRating(item?.reviewRating || 5);
    setReviewText(item?.reviewComment || '');
    setReviewModalVisible(true);
  };

  const closeReviewModal = () => {
    setReviewModalVisible(false);
    setReviewTarget(null);
    setReviewRating(5);
    setReviewText('');
  };

  const handleReviewSubmit = async () => {
    if (!reviewTarget || !user?.uid) return;
    setReviewLoading(true);
    try {
      await submitConsultationReview({
        consultationId: reviewTarget.id,
        userId: user.uid,
        rating: reviewRating,
        review: reviewText.trim(),
      });
      closeReviewModal();
    } catch (e) {
      Alert.alert('Review failed', e.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDecline = (item) => {
    Alert.alert('Decline request?', 'The slot will be made available to others.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          try {
            await declineConsultation({ consultationId: item.id, expertId: user.uid });
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const readableStatus = (status) => (status ? status.replace(/-/g, ' ') : 'pending');

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.sectionTitle}>My Consultations</Text>
      <FlatList
        data={asClient}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const normalizedStatus = (item.status || 'pending').toLowerCase();
          const canJoin = normalizedStatus === 'scheduled' && !!item.meetingLink;
          const canCancel = ['pending', 'scheduled'].includes(normalizedStatus);
          const canMarkPaid = normalizedStatus === 'scheduled' && item.paymentStatus !== 'paid';
          const canReview = normalizedStatus === 'completed' && !item.reviewRating;
          const paymentBusy = paymentLoadingId === `${item.id}-user-paid`;
          return (
            <View style={styles.card}>
              <Ionicons name="calendar-outline" size={32} color={colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.expert}>{item.expertName || 'Expert session'}</Text>
                <Text style={styles.meta}>{formatDateTime(item.scheduledFor)}</Text>
                <Text style={[styles.status, styles[normalizedStatus] || styles.pending]}>
                  {readableStatus(item.status)}
                </Text>
                <Text style={styles.paymentText}>Payment: {readablePaymentStatus(item.paymentStatus)}</Text>
                {item.cancelReason && (
                  <Text style={styles.reasonText}>{item.cancelReason}</Text>
                )}
                <View style={styles.actionRow}>
                  {canCancel && (
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => confirmCancel(item, 'user')}>
                      <Ionicons name="close-circle" size={16} color={colors.danger} />
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                  {canMarkPaid && (
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => handlePaymentUpdate(item, 'user', 'paid')}
                      disabled={paymentBusy}
                    >
                      <Ionicons name="card-outline" size={16} color={colors.primary} />
                      <Text style={styles.secondaryButtonText}>{paymentBusy ? 'Updating…' : 'Mark Paid'}</Text>
                    </TouchableOpacity>
                  )}
                  {canReview && (
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => openReviewModal(item)}>
                      <Ionicons name="star-outline" size={16} color={colors.warning} />
                      <Text style={styles.secondaryButtonText}>Review</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.joinButton, !canJoin && styles.joinButtonDisabled]}
                    onPress={() => (canJoin ? handleJoin(item) : Alert.alert('Awaiting link', 'Check back once the expert confirms.'))}
                    disabled={!canJoin}
                  >
                    <Ionicons name="play" size={18} color={colors.white} />
                    <Text style={styles.joinText}>{canJoin ? 'Join' : 'Waiting'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={42} color={colors.mediumGray} />
            <Text style={styles.emptyText}>You have no upcoming consultations.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 14 }}
      />

      <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Requests For Me</Text>
      <FlatList
        data={asExpert}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const normalizedStatus = (item.status || 'pending').toLowerCase();
          const canAccept = normalizedStatus === 'pending';
          const canShareLink = normalizedStatus === 'scheduled';
          const canComplete = normalizedStatus === 'scheduled';
          const canCancelExpert = ['pending', 'scheduled'].includes(normalizedStatus);
          const canMarkPaidExpert = normalizedStatus === 'scheduled' && item.paymentStatus !== 'paid';
          const paymentBusy = paymentLoadingId === `${item.id}-expert-paid`;
          return (
            <View style={styles.card}>
              <Ionicons name="person-outline" size={28} color={colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.expert}>{item.userName || 'Client'}</Text>
                <Text style={styles.meta}>{formatDateTime(item.scheduledFor)}</Text>
                <Text style={[styles.status, styles[normalizedStatus] || styles.pending]}>
                  {readableStatus(item.status)}
                </Text>
                <Text style={styles.paymentText}>Payment: {readablePaymentStatus(item.paymentStatus)}</Text>
                {item.cancelReason && (
                  <Text style={styles.reasonText}>{item.cancelReason}</Text>
                )}
                <View style={styles.actionRow}>
                  {canAccept ? (
                    <>
                      <TouchableOpacity style={[styles.secondaryButton, styles.primaryAction]} onPress={() => openLinkModal(item, 'accept')}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.white} />
                        <Text style={[styles.secondaryButtonText, { color: colors.white }]}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.secondaryButton} onPress={() => handleDecline(item)}>
                        <Ionicons name="close-circle" size={16} color={colors.danger} />
                        <Text style={styles.secondaryButtonText}>Decline</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      {canShareLink && (
                        <TouchableOpacity style={styles.secondaryButton} onPress={() => openLinkModal(item, 'share')}>
                          <Ionicons name="link" size={16} color={colors.primary} />
                          <Text style={styles.secondaryButtonText}>Share link</Text>
                        </TouchableOpacity>
                      )}
                      {canMarkPaidExpert && (
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => handlePaymentUpdate(item, 'expert', 'paid')}
                          disabled={paymentBusy}
                        >
                          <Ionicons name="card-outline" size={16} color={colors.primary} />
                          <Text style={styles.secondaryButtonText}>{paymentBusy ? 'Updating…' : 'Mark paid'}</Text>
                        </TouchableOpacity>
                      )}
                      {canComplete && (
                        <TouchableOpacity style={styles.secondaryButton} onPress={() => handleComplete(item)}>
                          <Ionicons name="checkmark-done" size={16} color={colors.success} />
                          <Text style={styles.secondaryButtonText}>Mark done</Text>
                        </TouchableOpacity>
                      )}
                      {canCancelExpert && (
                        <TouchableOpacity style={styles.secondaryButton} onPress={() => confirmCancel(item, 'expert')}>
                          <Ionicons name="close-circle" size={16} color={colors.danger} />
                          <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.joinButton, (!item.meetingLink || normalizedStatus !== 'scheduled') && styles.joinButtonDisabled]}
                        onPress={() => (item.meetingLink && normalizedStatus === 'scheduled' ? handleJoin(item) : Alert.alert('Waiting for confirmation', 'Share a link once ready.'))}
                        disabled={!item.meetingLink || normalizedStatus !== 'scheduled'}
                      >
                        <Ionicons name="play" size={18} color={colors.white} />
                        <Text style={styles.joinText}>Join</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={42} color={colors.mediumGray} />
            <Text style={styles.emptyText}>No new requests for you.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 30 }}
      />

      <Modal transparent visible={linkModalVisible} animationType="fade" onRequestClose={closeLinkModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {linkMode === 'accept' ? 'Confirm consultation & share link' : 'Share meeting link'}
            </Text>
            <Text style={styles.modalSubtitle}>
              You can paste a Google Meet, Zoom, or Teams URL. Leave empty if you plan to share it later.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="https://meet.google.com/xyz"
              autoCapitalize="none"
              autoCorrect={false}
              value={linkValue}
              onChangeText={setLinkValue}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.secondaryButton, { marginRight: 8 }]} onPress={closeLinkModal} disabled={actionLoading}>
                <Text style={styles.secondaryButtonText}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, styles.primaryAction]} onPress={handleLinkSubmit} disabled={actionLoading}>
                <Text style={[styles.secondaryButtonText, { color: colors.white }]}>
                  {actionLoading ? 'Saving...' : linkMode === 'accept' ? 'Confirm' : 'Share'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={reviewModalVisible} animationType="fade" onRequestClose={closeReviewModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Share your review</Text>
            <Text style={styles.modalSubtitle}>Rate the session and leave optional feedback for future clients.</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <TouchableOpacity key={value} style={styles.starButton} onPress={() => setReviewRating(value)}>
                  <Ionicons
                    name={value <= reviewRating ? 'star' : 'star-outline'}
                    size={28}
                    color={value <= reviewRating ? colors.warning : colors.mediumGray}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              placeholder="How did it go?"
              multiline
              numberOfLines={4}
              value={reviewText}
              onChangeText={setReviewText}
              editable={!reviewLoading}
            />
            <Text style={styles.modalHint}>Reviews become visible to the expert after submission.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.secondaryButton, { marginRight: 8 }]} onPress={closeReviewModal} disabled={reviewLoading}>
                <Text style={styles.secondaryButtonText}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.primaryAction]}
                onPress={handleReviewSubmit}
                disabled={reviewLoading}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.white }]}>
                  {reviewLoading ? 'Submitting…' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginTop: 6,
    marginRight: 10,
  },
  joinButtonDisabled: { backgroundColor: colors.mediumGray },
  joinText: { color: colors.white, fontWeight: '600', marginLeft: 6 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  smallBtnText: { color: '#fff', fontWeight: '600', marginLeft: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { color: colors.textLight, marginTop: 10, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.lightGray,
    marginRight: 10,
    marginTop: 6,
  },
  primaryAction: { backgroundColor: colors.primary },
  secondaryButtonText: { marginLeft: 6, fontWeight: '600', color: colors.text },
  reasonText: { marginTop: 4, color: colors.textLight, fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: colors.textLight, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  modalTextarea: { minHeight: 100, textAlignVertical: 'top', marginTop: 12 },
  modalHint: { marginTop: 6, fontSize: 12, color: colors.textLight },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  starRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 12 },
  starButton: { marginHorizontal: 4, padding: 4 },
});

export default ScheduledConsultationsScreen;
