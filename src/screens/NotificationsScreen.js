import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../../firebase';

const ICONS = {
  like: 'heart',
  comment: 'chatbubble',
  share: 'repeat',
  follow: 'person-add',
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
    const bodyText = item.body || item.previewText || item.postSnippet || '';
    const avatarSource = item.actorPhotoURL ? { uri: item.actorPhotoURL } : DEFAULT_AVATAR;
    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.seen && styles.notificationCardUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
      >
        <Image source={avatarSource} style={styles.avatar} />
        <View style={styles.notificationBody}>
          <Text style={styles.notificationTitle} numberOfLines={2}>
            <Text style={styles.notificationActor}>{actorName} </Text>
            {item.title || item.message || 'interacted with your post'}
          </Text>
          {bodyText ? (
            <Text style={styles.notificationPreview} numberOfLines={1}>
              {bodyText}
            </Text>
          ) : null}
          <Text style={styles.notificationTime}>{formatRelativeTime(item.createdAt)}</Text>
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
