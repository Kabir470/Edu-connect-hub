import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../../firebase';
import { approveFollowRequest, rejectFollowRequest } from '../utils/followService';
import SubRolePills from '../components/SubRolePills';
import { formatRoleLabels } from '../utils/roleUtils';

const ICONS = {
  like: 'heart',
  comment: 'chatbubble',
  share: 'repeat',
  follow: 'person-add',
  'follow-request': 'person-add',
  'follow-request-accepted': 'checkmark-circle',
  'follow-request-declined': 'close-circle',
  mention: 'at',
  system: 'alert-circle',
};

const DEFAULT_AVATAR = require('../../assets/shahriar-kabir.jpg');

const formatRelativeTime = (ts) => {
  if (!ts) return '';
  let date = null;
  if (ts?.seconds) {
    date = new Date(ts.seconds * 1000);
  } else if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
};

const timestampToMillis = (ts) => {
  if (!ts) return 0;
  if (ts?.seconds) {
    const fractional = typeof ts.nanoseconds === 'number' ? ts.nanoseconds / 1_000_000 : 0;
    return ts.seconds * 1000 + fractional;
  }
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const NotificationsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [requestActioningId, setRequestActioningId] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('targetUserId', '==', user.uid),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
        setNotifications(items);
        setLoading(false);
      },
      (error) => {
        console.error('Notifications listener failed', error);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  const unseenCount = useMemo(() => notifications.filter((n) => !n.seen).length, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.seen);
    return notifications;
  }, [filter, notifications]);

  const handleNotificationPress = async (item) => {
    if (item.type === 'follow-request') return;
    if (!item.seen) {
      try {
        await updateDoc(doc(db, 'notifications', item.id), {
          seen: true,
          seenAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn('Failed to mark seen', error);
      }
    }
    if (item.postId) {
      navigation.navigate('Home', {
        screen: 'PostDetail',
        params: {
          post: item.postSnapshot ? { id: item.postId, ...item.postSnapshot } : { id: item.postId },
        },
      });
    } else if (item.navigateTo) {
      navigation.navigate(item.navigateTo.screen, item.navigateTo.params || {});
    }
  };

  const handleMarkAllRead = async () => {
    if (!unseenCount) return;
    try {
      setMarkingAll(true);
      const promises = notifications
        .filter((n) => !n.seen)
        .map((n) =>
          updateDoc(doc(db, 'notifications', n.id), {
            seen: true,
            seenAt: serverTimestamp(),
          })
        );
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to mark all read', error);
    } finally {
      setMarkingAll(false);
    }
  };

  const extractFollowMeta = (item) => {
    const meta = item.typeMeta || item.meta || {};
    return {
      followDocId: meta.followDocId || meta?.follow?.id || null,
      followerId: meta.followerId || item.actorUserId || null,
    };
  };

  const handleFollowRequestAction = async (item, action) => {
    if (!user?.uid) return;
    if (requestActioningId) return;
    if (item?.typeMeta?.resolvedAction) return;
    const { followDocId, followerId } = extractFollowMeta(item);
    if (!followDocId && !followerId) {
      return;
    }
    try {
      setRequestActioningId(item.id);
      const result =
        action === 'accept'
          ? await approveFollowRequest({ followDocId, followerId, targetUser: user })
          : await rejectFollowRequest({ followDocId, followerId, targetUser: user });

      const expectedStatus = action === 'accept' ? 'accepted' : 'rejected';
      const resolvedAction = result?.status === expectedStatus ? action : 'expired';

      if (resolvedAction === 'expired') {
        Alert.alert(
          'Request unavailable',
          'This follow request is no longer pending, so no action was taken.'
        );
      }
      await updateDoc(doc(db, 'notifications', item.id), {
        seen: true,
        seenAt: serverTimestamp(),
        resolvedAt: serverTimestamp(),
        typeMeta: {
          ...(item.typeMeta || {}),
          resolvedAction,
        },
      });
    } catch (error) {
      console.warn('Follow request action failed', error);
      Alert.alert('Unable to update request', 'Please try again in a moment.');
    } finally {
      setRequestActioningId(null);
    }
  };

  const renderNotificationIcon = (type, seen) => {
    const baseName = ICONS[type] || 'notifications';
    const iconName = seen ? `${baseName}-outline` : baseName;
    return (
      <View style={[styles.iconWrap, !seen && styles.iconWrapUnread]}>
        <Ionicons
          name={iconName}
          size={20}
          color={seen ? colors.mediumGray : colors.primary}
        />
      </View>
    );
  };

  const renderNotificationItem = ({ item }) => {
    const actorName = item.actorName || 'Someone';
    const actorRoleLabel = formatRoleLabels(item.actorSubRoles, item.actorRole || '');
    const bodyText = item.body || item.previewText || item.postSnippet || '';
    const avatarSource = item.actorPhotoURL ? { uri: item.actorPhotoURL } : DEFAULT_AVATAR;
    const isFollowRequest = item.type === 'follow-request';
    const actioning = requestActioningId === item.id;
    const resolvedAction = item.typeMeta?.resolvedAction;
    const statusConfig = (() => {
      if (resolvedAction === 'accept') {
        return {
          label: 'Accepted',
          style: styles.requestStatusAccepted,
          icon: 'checkmark-circle',
          color: colors.success,
        };
      }
      if (resolvedAction === 'decline') {
        return {
          label: 'Declined',
          style: styles.requestStatusDeclined,
          icon: 'close-circle',
          color: colors.danger,
        };
      }
      if (resolvedAction === 'expired') {
        return {
          label: 'Expired',
          style: styles.requestStatusExpired,
          icon: 'time-outline',
          color: colors.mediumGray,
        };
      }
      return null;
    })();
    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.seen && styles.notificationCardUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={isFollowRequest && !statusConfig ? 1 : 0.8}
      >
        <Image source={avatarSource} style={styles.avatar} />
        <View style={styles.notificationBody}>
          <Text style={styles.notificationTitle} numberOfLines={2}>
            <Text style={styles.notificationActor}>{actorName} </Text>
            {item.title || item.message || 'interacted with your post'}
          </Text>
          <SubRolePills
            primaryRole={item.actorRole}
            subRoles={item.actorSubRoles}
            fallbackLabel={actorRoleLabel}
            style={styles.notificationRole}
          />
          {bodyText ? (
            <Text style={styles.notificationPreview} numberOfLines={1}>
              {bodyText}
            </Text>
          ) : null}
          <Text style={styles.notificationTime}>{formatRelativeTime(item.createdAt)}</Text>
          {isFollowRequest ? (
            statusConfig ? (
              <View style={[styles.requestStatusPill, statusConfig.style]}>
                <Ionicons
                  name={statusConfig.icon}
                  size={16}
                  color={statusConfig.color}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.requestStatusText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
            ) : (
            <View style={styles.requestActions}>
              <TouchableOpacity
                style={[styles.requestButton, styles.requestDecline]}
                onPress={() => handleFollowRequestAction(item, 'decline')}
                disabled={actioning}
              >
                {actioning ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.requestButtonText}>Decline</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.requestButton, styles.requestAccept]}
                onPress={() => handleFollowRequestAction(item, 'accept')}
                disabled={actioning}
              >
                {actioning ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.requestButtonText}>Accept</Text>
                )}
              </TouchableOpacity>
            </View>
            )
          ) : null}
        </View>
        {renderNotificationIcon(item.type, item.seen)}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-outline" size={48} color={colors.mediumGray} />
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptySubtitle}>
        When people like, comment, or share your posts, you'll see it here.
      </Text>
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="log-in" size={40} color={colors.mediumGray} />
          <Text style={styles.emptyTitle}>Log in to see notifications</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unseenCount ? (
            <Text style={styles.unseenText}>{unseenCount} unread</Text>
          ) : (
            <Text style={styles.unseenText}>You're all caught up</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.markAllButton, (!unseenCount || markingAll) && styles.markAllButtonDisabled]}
          onPress={handleMarkAllRead}
          disabled={!unseenCount || markingAll}
        >
          {markingAll ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.markAllText}>Mark all read</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.segmentControl}>
        {['all', 'unread'].map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.segmentButton, filter === key && styles.segmentButtonActive]}
            onPress={() => setFilter(key)}
          >
            <Text
              style={[styles.segmentText, filter === key && styles.segmentTextActive]}
            >
              {key === 'all' ? 'All' : 'Unread'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  unseenText: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 4,
  },
  requestActions: {
    flexDirection: 'row',
    marginTop: 12,
  },
  requestStatusPill: {
    marginTop: 12,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestStatusAccepted: {
    backgroundColor: 'rgba(46, 204, 113, 0.12)',
  },
  requestStatusDeclined: {
    backgroundColor: 'rgba(231, 76, 60, 0.12)',
  },
  requestStatusExpired: {
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
  },
  requestStatusText: {
    fontWeight: '600',
    fontSize: 14,
  },
  requestButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  requestAccept: {
    backgroundColor: colors.success,
  },
  requestDecline: {
    backgroundColor: colors.danger,
    marginRight: 10,
  },
  requestButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  markAllButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  markAllButtonDisabled: {
    backgroundColor: colors.lightGray,
  },
  markAllText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(108,99,255,0.12)',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  segmentTextActive: {
    color: colors.primary,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 12,
  },
  notificationCardUnread: {
    backgroundColor: '#EEF0FF',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  notificationBody: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    color: colors.text,
  },
  notificationActor: {
    fontWeight: '700',
  },
  notificationRole: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  notificationPreview: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 2,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.mediumGray,
    marginTop: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lightGray,
    marginLeft: 12,
  },
  iconWrapUnread: {
    backgroundColor: 'rgba(108,99,255,0.12)',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 8,
  },
  separator: {
    height: 12,
  },
});

export default NotificationsScreen;
