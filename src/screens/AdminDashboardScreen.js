import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  approvePost,
  rejectPost,
  deletePostAsAdmin,
  setFeedLockWindow,
  subscribeToAdminControls,
  lookupUserByIdentifier,
  suspendUserPosting,
  clearUserSuspension,
} from '../utils/adminService';

const DEFAULT_AVATAR = require('../../assets/shahriar-kabir.jpg');

const FEED_DURATION_OPTIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '6 hours', minutes: 360 },
  { label: '24 hours', minutes: 1440 },
  { label: 'Custom', minutes: null },
];

const SUSPEND_PRESETS = [
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 1440 },
  { label: '7 days', minutes: 10080 },
];

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const formatRelativeTime = (value) => {
  const ms = toMillis(value);
  if (!ms) return 'Unknown';
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(ms).toLocaleDateString();
};

const formatCountdown = (seconds) => {
  if (!seconds || seconds <= 0) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

const formatDateTime = (value) => {
  const ms = toMillis(value);
  if (!ms) return 'Unknown';
  return new Date(ms).toLocaleString();
};

const AdminDashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const actorLabel = user?.fullName || user?.email || user?.uid || 'admin';
  const [pendingPosts, setPendingPosts] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [controls, setControls] = useState(null);
  const [feedModalVisible, setFeedModalVisible] = useState(false);
  const [feedSelection, setFeedSelection] = useState(FEED_DURATION_OPTIONS[1].minutes);
  const [feedCustomMinutes, setFeedCustomMinutes] = useState('');
  const [feedReason, setFeedReason] = useState('');
  const [feedRemainingSeconds, setFeedRemainingSeconds] = useState(0);
  const [feedSaving, setFeedSaving] = useState(false);
  const [rejectState, setRejectState] = useState({ visible: false, post: null, reason: '' });
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [previewPost, setPreviewPost] = useState(null);
  const [lookupValue, setLookupValue] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [moderatedUser, setModeratedUser] = useState(null);
  const [suspendModal, setSuspendModal] = useState({
    visible: false,
    target: null,
    durationMs: 0,
    presetLabel: '',
    reason: '',
    customMinutes: '',
  });
  const [suspending, setSuspending] = useState(false);
  const [postDeleteId, setPostDeleteId] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('status', 'in', ['pending', 'needs_review']));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        next.sort((a, b) => (toMillis(a?.createdAt) || 0) - (toMillis(b?.createdAt) || 0));
        setPendingPosts(next);
        setPendingLoading(false);
      },
      (error) => {
        console.error('Pending posts subscribe error', error);
        setPendingLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToAdminControls(setControls);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const feedLockDeadline = useMemo(
    () => (controls?.feedLockedUntil ? toMillis(controls.feedLockedUntil) : null),
    [controls?.feedLockedUntil]
  );

  useEffect(() => {
    if (!feedLockDeadline) {
      setFeedRemainingSeconds(0);
      return;
    }
    const update = () => {
      const diff = feedLockDeadline - Date.now();
      setFeedRemainingSeconds(diff > 0 ? Math.ceil(diff / 1000) : 0);
    };
    update();
    const intervalId = setInterval(update, 1000);
    return () => clearInterval(intervalId);
  }, [feedLockDeadline]);

  const feedLockActive = feedRemainingSeconds > 0;
  const feedStatusCopy = feedLockActive
    ? `Paused for ${formatCountdown(feedRemainingSeconds)}`
    : 'Live for everyone';
  const feedLockedByLabel = controls?.feedLockedBy || 'admin';
  const feedReasonCopy = controls?.feedLockReason || 'Temporarily disabled by admin';
  const feedLockedUntilLabel = feedLockDeadline ? formatDateTime(feedLockDeadline) : null;

  const handleApprove = async (post) => {
    try {
      await approvePost({ postId: post.id, actor: actorLabel });
      Alert.alert('Post approved', 'The post will now appear in the community feed.');
    } catch (error) {
      Alert.alert('Approve failed', error?.message || 'Unable to approve this post right now.');
    }
  };

  const closeRejectModal = () => setRejectState({ visible: false, post: null, reason: '' });

  const handleRejectConfirm = async () => {
    if (!rejectState.post) return;
    const reason = rejectState.reason.trim();
    if (!reason) {
      Alert.alert('Reason required', 'Add a short note so the author knows what to fix.');
      return;
    }
    try {
      setRejectSubmitting(true);
      await rejectPost({ postId: rejectState.post.id, actor: actorLabel, reason });
      Alert.alert('Post rejected', 'The author has been notified.');
      closeRejectModal();
    } catch (error) {
      Alert.alert('Reject failed', error?.message || 'Unable to reject this post right now.');
    } finally {
      setRejectSubmitting(false);
    }
  };

  const confirmDeletePost = (postId) => {
    Alert.alert('Delete post', 'This removes the post for everyone. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePostAsAdmin(postId);
            Alert.alert('Deleted', 'Post removed successfully.');
          } catch (error) {
            Alert.alert('Delete failed', error?.message || 'Unable to delete this post.');
          }
        },
      },
    ]);
  };

  const handleFeedLockConfirm = async () => {
    const minutes = feedSelection === null ? Number(feedCustomMinutes) : feedSelection;
    if (!minutes || Number.isNaN(minutes) || minutes <= 0) {
      Alert.alert('Invalid duration', 'Please enter a positive number of minutes.');
      return;
    }
    setFeedSaving(true);
    try {
      await setFeedLockWindow({
        lockedUntil: Date.now() + minutes * 60 * 1000,
        reason: feedReason.trim() || undefined,
        actor: actorLabel,
      });
      setFeedModalVisible(false);
      setFeedCustomMinutes('');
      setFeedReason('');
    } catch (error) {
      Alert.alert('Update failed', error?.message || 'Unable to update feed status.');
    } finally {
      setFeedSaving(false);
    }
  };

  const handleUnlockFeed = async () => {
    setFeedSaving(true);
    try {
      await setFeedLockWindow({ lockedUntil: null, reason: null, actor: actorLabel });
    } catch (error) {
      Alert.alert('Unlock failed', error?.message || 'Unable to unlock the feed right now.');
    } finally {
      setFeedSaving(false);
    }
  };

  const handleLookupUser = async () => {
    const trimmed = lookupValue.trim();
    if (!trimmed) {
      Alert.alert('Enter a value', 'Provide an email, username, or UID to search.');
      return;
    }
    setLookupLoading(true);
    try {
      const result = await lookupUserByIdentifier(trimmed);
      if (!result) {
        Alert.alert('Not found', 'No matching user record.');
      }
      setModeratedUser(result || null);
    } catch (error) {
      Alert.alert('Lookup failed', error?.message || 'Unable to find user right now.');
    } finally {
      setLookupLoading(false);
    }
  };

  const openSuspendModal = (minutes, label) => {
    if (!moderatedUser) return;
    setSuspendModal({
      visible: true,
      target: moderatedUser,
      durationMs: minutes ? minutes * 60 * 1000 : 0,
      presetLabel: label,
      reason: '',
      customMinutes: '',
    });
  };

  const closeSuspendModal = () =>
    setSuspendModal({ visible: false, target: null, durationMs: 0, presetLabel: '', reason: '', customMinutes: '' });

  const handleSuspendConfirm = async () => {
    if (!suspendModal.target?.id) return;
    const baseMinutes = suspendModal.durationMs ? suspendModal.durationMs / 60000 : Number(suspendModal.customMinutes);
    if (!baseMinutes || Number.isNaN(baseMinutes) || baseMinutes <= 0) {
      Alert.alert('Invalid duration', 'Enter how long the suspension should last.');
      return;
    }
    const durationMs = baseMinutes * 60 * 1000;
    setSuspending(true);
    try {
      await suspendUserPosting({
        userId: suspendModal.target.id,
        durationMs,
        reason: suspendModal.reason.trim(),
        actor: actorLabel,
      });
      setModeratedUser((prev) =>
        prev && prev.id === suspendModal.target.id
          ? {
              ...prev,
              postSuspension: {
                reason: suspendModal.reason.trim() || 'Temporarily suspended by admin',
                actor: actorLabel,
                activeUntil: Date.now() + durationMs,
              },
            }
          : prev
      );
      closeSuspendModal();
      Alert.alert('Suspension applied', 'User posting access has been paused.');
    } catch (error) {
      Alert.alert('Suspension failed', error?.message || 'Unable to suspend this user right now.');
    } finally {
      setSuspending(false);
    }
  };

  const handleLiftSuspension = async () => {
    if (!moderatedUser?.id) return;
    try {
      await clearUserSuspension(moderatedUser.id);
      setModeratedUser((prev) => (prev ? { ...prev, postSuspension: null } : prev));
      Alert.alert('Suspension cleared', 'User can post again.');
    } catch (error) {
      Alert.alert('Action failed', error?.message || 'Unable to clear suspension.');
    }
  };

  const handleDeletePostById = () => {
    const trimmed = postDeleteId.trim();
    if (!trimmed) {
      Alert.alert('Enter a post ID', 'Paste the post ID you want to remove.');
      return;
    }
    confirmDeletePost(trimmed);
    setPostDeleteId('');
  };

  const renderPendingCard = (post) => {
    const avatarSource = post.userPhotoURL ? { uri: post.userPhotoURL } : DEFAULT_AVATAR;
    const statusLabel = post.status === 'pending' ? 'Pending' : 'Needs review';
    const statusStyle = post.status === 'pending' ? styles.statusPending : styles.statusNeedsReview;
    return (
      <View key={post.id} style={styles.postCard}>
        <View style={styles.postHeader}>
          <Image source={avatarSource} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.postAuthor}>{post.userName || 'Member'}</Text>
            <Text style={styles.postMeta}>{post.userEmail || 'No email'}</Text>
            <Text style={styles.postMeta}>Submitted {formatRelativeTime(post.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, statusStyle]}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>
        {post.content ? (
          <TouchableOpacity onPress={() => setPreviewPost(post)} activeOpacity={0.85}>
            <Text style={styles.postContent} numberOfLines={5}>
              {post.content}
            </Text>
            {post.content.length > 220 ? <Text style={styles.expandHint}>Tap to read full post</Text> : null}
          </TouchableOpacity>
        ) : null}
        {post.image ? (
          <TouchableOpacity onPress={() => setPreviewPost(post)} activeOpacity={0.85}>
            <Image source={{ uri: post.image }} style={styles.postImage} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.actionBtn, styles.successButton]} onPress={() => handleApprove(post)}>
            <Ionicons name="checkmark-circle" size={18} color={colors.white} />
            <Text style={styles.actionBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.warningButton]} onPress={() => setRejectState({ visible: true, post, reason: '' })}>
            <Ionicons name="close-circle" size={18} color={colors.white} />
            <Text style={styles.actionBtnText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.dangerButton]} onPress={() => confirmDeletePost(post.id)}>
            <Ionicons name="trash" size={18} color={colors.white} />
            <Text style={styles.actionBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderUserModeration = () => {
    if (!moderatedUser) {
      return <Text style={styles.emptyText}>Search for a user to unlock advanced controls.</Text>;
    }
    const avatarSource = moderatedUser.profileImageURL ? { uri: moderatedUser.profileImageURL } : DEFAULT_AVATAR;
    const suspensionUntil = moderatedUser.postSuspension?.activeUntil
      ? toMillis(moderatedUser.postSuspension.activeUntil)
      : null;
    const suspensionActive = suspensionUntil && suspensionUntil > Date.now();
    const suspensionCountdown = suspensionActive
      ? formatCountdown(Math.ceil((suspensionUntil - Date.now()) / 1000))
      : null;

    return (
      <View style={styles.userCard}>
        <View style={styles.userRow}>
          <Image source={avatarSource} style={styles.userAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{moderatedUser.fullName || moderatedUser.email}</Text>
            <Text style={styles.userMeta}>{moderatedUser.email}</Text>
            <Text style={styles.userMeta}>
              {(moderatedUser.role || 'user').toUpperCase()} • {moderatedUser.status || 'pending'}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.suspensionBanner,
            suspensionActive ? styles.suspensionActive : styles.suspensionInactive,
          ]}
        >
          <Ionicons
            name={suspensionActive ? 'alert-circle' : 'checkmark-circle'}
            size={20}
            color={colors.white}
            style={{ marginRight: 10 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.suspensionText}>
              {suspensionActive ? `Posting suspended (${suspensionCountdown})` : 'No active suspension'}
            </Text>
            {suspensionActive ? (
              <Text style={styles.suspensionSubText}>
                Reason: {moderatedUser.postSuspension?.reason || 'Policy violation'}
              </Text>
            ) : (
              <Text style={styles.suspensionSubText}>User can publish new posts.</Text>
            )}
          </View>
        </View>
        <Text style={styles.sectionSubCopy}>Suspend posting for:</Text>
        <View style={styles.suspendActionsRow}>
          {SUSPEND_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.label}
              style={styles.pillButton}
              onPress={() => openSuspendModal(preset.minutes, preset.label)}
            >
              <Text style={styles.pillButtonText}>{preset.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.pillButton} onPress={() => openSuspendModal(null, 'Custom')}>
            <Text style={styles.pillButtonText}>Custom</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.primaryButton, styles.userButton, !suspensionActive && styles.disabledButton]}
          onPress={handleLiftSuspension}
          disabled={!suspensionActive}
        >
          <Text style={styles.primaryButtonText}>Lift suspension</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFeedModal = () => (
    <Modal
      transparent
      animationType="fade"
      visible={feedModalVisible}
      onRequestClose={() => setFeedModalVisible(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Pause posting</Text>
          <Text style={styles.modalSubtitle}>Choose how long the community feed should be locked.</Text>
          <View style={styles.durationChips}>
            {FEED_DURATION_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.label}
                style={[styles.optionChip, feedSelection === option.minutes && styles.optionChipActive]}
                onPress={() => setFeedSelection(option.minutes)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    feedSelection === option.minutes && styles.optionChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {feedSelection === null ? (
            <TextInput
              style={styles.input}
              placeholder="Custom duration (minutes)"
              placeholderTextColor={colors.textLight}
              keyboardType="numeric"
              value={feedCustomMinutes}
              onChangeText={setFeedCustomMinutes}
            />
          ) : null}
          <TextInput
            style={[styles.input, { minHeight: 60 }]}
            placeholder="Reason (optional)"
            placeholderTextColor={colors.textLight}
            value={feedReason}
            onChangeText={setFeedReason}
            multiline
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalButton} onPress={() => setFeedModalVisible(false)} disabled={feedSaving}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={handleFeedLockConfirm}
              disabled={feedSaving}
            >
              <Text style={styles.modalButtonText}>{feedSaving ? 'Saving…' : 'Confirm'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderRejectModal = () => (
    <Modal transparent animationType="fade" visible={rejectState.visible} onRequestClose={closeRejectModal}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Reject post</Text>
          <Text style={styles.modalSubtitle}>Leave a short explanation for the author.</Text>
          <TextInput
            style={[styles.input, { minHeight: 120 }]}
            placeholder="Reason" 
            placeholderTextColor={colors.textLight}
            multiline
            value={rejectState.reason}
            onChangeText={(text) => setRejectState((prev) => ({ ...prev, reason: text }))}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalButton} onPress={closeRejectModal} disabled={rejectSubmitting}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={handleRejectConfirm}
              disabled={rejectSubmitting}
            >
              <Text style={styles.modalButtonText}>{rejectSubmitting ? 'Rejecting…' : 'Reject'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderPreviewModal = () => (
    <Modal transparent animationType="slide" visible={!!previewPost} onRequestClose={() => setPreviewPost(null)}>
      <View style={styles.previewBackdrop}>
        <View style={styles.previewCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.previewTitle}>{previewPost?.userName || 'Member'}</Text>
            <Text style={styles.previewMeta}>{previewPost?.userEmail}</Text>
            <Text style={styles.previewMeta}>Posted {formatDateTime(previewPost?.createdAt)}</Text>
            {previewPost?.content ? <Text style={styles.previewContent}>{previewPost.content}</Text> : null}
            {previewPost?.image ? (
              <Image source={{ uri: previewPost.image }} style={styles.previewImage} />
            ) : null}
          </ScrollView>
          <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={() => setPreviewPost(null)}>
            <Text style={styles.modalButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderSuspendModal = () => (
    <Modal transparent animationType="fade" visible={suspendModal.visible} onRequestClose={closeSuspendModal}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Suspend posting</Text>
          <Text style={styles.modalSubtitle}>
            {suspendModal.presetLabel || 'Custom duration'} for {suspendModal.target?.fullName || 'user'}
          </Text>
          {suspendModal.presetLabel === 'Custom' ? (
            <TextInput
              style={styles.input}
              placeholder="Duration in minutes"
              placeholderTextColor={colors.textLight}
              keyboardType="numeric"
              value={suspendModal.customMinutes}
              onChangeText={(text) => setSuspendModal((prev) => ({ ...prev, customMinutes: text }))}
            />
          ) : null}
          <TextInput
            style={[styles.input, { minHeight: 80 }]}
            placeholder="Reason"
            placeholderTextColor={colors.textLight}
            multiline
            value={suspendModal.reason}
            onChangeText={(text) => setSuspendModal((prev) => ({ ...prev, reason: text }))}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalButton} onPress={closeSuspendModal} disabled={suspending}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={handleSuspendConfirm}
              disabled={suspending}
            >
              <Text style={styles.modalButtonText}>{suspending ? 'Applying…' : 'Confirm'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Feed controls</Text>
            <View style={[styles.chip, feedLockActive ? styles.chipDanger : styles.chipSuccess]}>
              <Text style={styles.chipText}>{feedLockActive ? 'Paused' : 'Live'}</Text>
            </View>
          </View>
          <Text style={styles.sectionCopy}>{feedStatusCopy}</Text>
          {feedLockActive && (
            <Text style={styles.sectionSubCopy}>
              Until {feedLockedUntilLabel} • {feedReasonCopy} • by {feedLockedByLabel}
            </Text>
          )}
          {feedLockActive ? (
            <View style={styles.feedActionsRow}>
              <TouchableOpacity
                style={[styles.primaryButton, styles.rowButton, styles.dangerBackground]}
                onPress={handleUnlockFeed}
                disabled={feedSaving}
              >
                {feedSaving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Unlock feed</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.outlineButton, styles.rowButton]}
                onPress={() => setFeedModalVisible(true)}
                disabled={feedSaving}
              >
                <Text style={styles.outlineButtonText}>Extend lock</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={() => setFeedModalVisible(true)}>
              <Text style={styles.primaryButtonText}>Pause new posts</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Awaiting review</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingPosts.length}</Text>
            </View>
          </View>
          <Text style={styles.sectionCopy}>Approve or reject content flagged by automated moderation.</Text>
          {pendingLoading ? (
            <View style={styles.emptyWrapper}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.emptyText}>Loading queue…</Text>
            </View>
          ) : pendingPosts.length === 0 ? (
            <Text style={styles.emptyText}>Everything is clear. No posts are waiting.</Text>
          ) : (
            pendingPosts.map(renderPendingCard)
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>User moderation</Text>
            <Ionicons name="people-circle" size={24} color={colors.primary} />
          </View>
          <Text style={styles.sectionCopy}>Suspend accounts, lift bans, or remove problematic posts.</Text>
          <View style={styles.lookupRow}>
            <TextInput
              style={styles.lookupInput}
              placeholder="Email, username, or UID"
              placeholderTextColor={colors.textLight}
              value={lookupValue}
              onChangeText={setLookupValue}
            />
            <TouchableOpacity style={styles.lookupButton} onPress={handleLookupUser} disabled={lookupLoading}>
              {lookupLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.lookupButtonText}>Lookup</Text>
              )}
            </TouchableOpacity>
          </View>
          {renderUserModeration()}
          <Text style={[styles.sectionSubCopy, { marginTop: 12 }]}>Delete a post by ID</Text>
          <View style={styles.deleteRow}>
            <TextInput
              style={styles.deleteInput}
              placeholder="Post ID"
              placeholderTextColor={colors.textLight}
              value={postDeleteId}
              onChangeText={setPostDeleteId}
              autoCapitalize="none"
            />
            <TouchableOpacity style={[styles.actionBtn, styles.dangerButton]} onPress={handleDeletePostById}>
              <Ionicons name="trash" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
          {navigation && (
            <TouchableOpacity
              style={styles.manageUsersButton}
              onPress={() => navigation.navigate('AdminManageUsers')}
              activeOpacity={0.85}
            >
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={styles.manageUsersButtonText}>Review onboarding applications</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      {renderFeedModal()}
      {renderRejectModal()}
      {renderPreviewModal()}
      {renderSuspendModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sectionCopy: { color: colors.textLight, marginBottom: 6 },
  sectionSubCopy: { color: colors.mediumGray, fontSize: 13 },
  chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  chipText: { color: colors.white, fontWeight: '700' },
  chipSuccess: { backgroundColor: colors.success },
  chipDanger: { backgroundColor: colors.danger },
  primaryButton: {
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontWeight: '700' },
  dangerBackground: { backgroundColor: colors.danger },
  outlineButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    flex: 1,
  },
  outlineButtonText: { color: colors.text, fontWeight: '600' },
  rowButton: { flex: 1, marginTop: 0 },
  feedActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  badge: {
    minWidth: 30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  badgeText: { fontWeight: '700', color: colors.text },
  emptyWrapper: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { color: colors.textLight, marginTop: 6, textAlign: 'center' },
  postCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, marginRight: 12 },
  postAuthor: { fontSize: 15, fontWeight: '700', color: colors.text },
  postMeta: { fontSize: 12, color: colors.textLight },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  statusPending: { backgroundColor: colors.info },
  statusNeedsReview: { backgroundColor: colors.warning },
  postContent: { color: colors.text, fontSize: 14, lineHeight: 20 },
  expandHint: { color: colors.primary, fontSize: 12, marginTop: 4 },
  postImage: { width: '100%', height: 180, borderRadius: 12, marginTop: 10 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnText: { color: colors.white, fontWeight: '600' },
  successButton: { backgroundColor: colors.success },
  warningButton: { backgroundColor: colors.warning },
  dangerButton: { backgroundColor: colors.danger },
  lookupRow: { flexDirection: 'row', marginTop: 8, marginBottom: 12, gap: 10 },
  lookupInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  lookupButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  lookupButtonText: { color: colors.white, fontWeight: '700' },
  userCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  userAvatar: { width: 54, height: 54, borderRadius: 27, marginRight: 12 },
  userName: { fontSize: 16, fontWeight: '700', color: colors.text },
  userMeta: { fontSize: 13, color: colors.textLight },
  suspensionBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 12 },
  suspensionActive: { backgroundColor: colors.danger },
  suspensionInactive: { backgroundColor: colors.success },
  suspensionText: { color: colors.white, fontWeight: '700' },
  suspensionSubText: { color: colors.white, marginTop: 2, fontSize: 12 },
  suspendActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pillButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillButtonText: { color: colors.text, fontWeight: '600' },
  userButton: { marginTop: 12 },
  disabledButton: { opacity: 0.5 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  deleteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  manageUsersButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  manageUsersButtonText: { color: colors.primary, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalSubtitle: { color: colors.textLight, marginTop: 6 },
  durationChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionChipActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  optionChipText: { color: colors.text, fontWeight: '600' },
  optionChipTextActive: { color: colors.primary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    marginTop: 12,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  modalButtonPrimary: { backgroundColor: colors.primary },
  modalButtonText: { color: colors.white, fontWeight: '700' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  previewCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, maxHeight: '80%' },
  previewTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  previewMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  previewContent: { marginTop: 12, fontSize: 15, color: colors.text, lineHeight: 22 },
  previewImage: { width: '100%', height: 220, borderRadius: 12, marginTop: 12 },
});

export default AdminDashboardScreen;
