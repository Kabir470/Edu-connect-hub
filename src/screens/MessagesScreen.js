import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { subscribeToConversations, subscribeToUserProfile } from '../utils/chatService';
import { mergePrivacySettings } from '../constants/privacyDefaults';

const DEFAULT_AVATAR = require('../../assets/shahriar-kabir.jpg');

const formatRelativeTime = (ts) => {
  if (!ts) return 'Just now';
  let date = null;
  if (ts?.seconds) {
    date = new Date(ts.seconds * 1000);
  } else if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date) return 'Just now';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

const getAvatarSource = (avatar) => {
  if (!avatar) return DEFAULT_AVATAR;
  if (typeof avatar === 'number') return avatar;
  return { uri: avatar };
};

const MessagesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [participantProfiles, setParticipantProfiles] = useState({});

  useEffect(() => {
    if (!user?.uid) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }
    setLoadingConversations(true);
    const unsubscribe = subscribeToConversations(
      user.uid,
      (snapshot) => {
        const next = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setConversations(next);
        setLoadingConversations(false);
      },
      (error) => {
        console.warn('Conversation stream error', error);
        setLoadingConversations(false);
      }
    );
    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setParticipantProfiles({});
      return undefined;
    }
    const otherIds = new Set();
    conversations.forEach((conv) => {
      conv.participants?.forEach((participantId) => {
        if (participantId && participantId !== user.uid) {
          otherIds.add(participantId);
        }
      });
    });

    if (!otherIds.size) {
      setParticipantProfiles((prev) => (Object.keys(prev).length ? {} : prev));
      return undefined;
    }

    const unsubscribes = Array.from(otherIds).map((participantId) =>
      subscribeToUserProfile(
        participantId,
        (profile) => {
          if (!profile) return;
          setParticipantProfiles((prev) => {
            const prevProfile = prev[participantId];
            if (
              prevProfile &&
              prevProfile.fullName === profile.fullName &&
              prevProfile.profileImageURL === profile.profileImageURL &&
              prevProfile.role === profile.role
            ) {
              return prev;
            }
            return { ...prev, [participantId]: profile };
          });
        },
        (error) => console.warn('Participant profile stream error', error)
      )
    );
    return () => unsubscribes.forEach((unsub) => unsub && unsub());
  }, [conversations, user?.uid]);

  const decoratedConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return conversations
      .map((conv) => {
        if (conv.type === 'group') {
          const groupProfile = {
            name: conv.name || 'Group',
            avatar: conv.avatar || null,
            role: `${(conv.participants?.length || 0)} members`,
            privacySettings: {},
            presenceStatus: 'offline',
            lastActiveAt: null,
            activityVisible: false,
            activityLabel: null,
          };
          const timestamp = conv.lastMessageAt?.seconds
            ? conv.lastMessageAt.seconds * 1000
            : conv.lastMessageAt instanceof Date
            ? conv.lastMessageAt.getTime()
            : 0;
          return { ...conv, otherId: null, otherProfile: groupProfile, sortTime: timestamp };
        }

        const otherId = conv.participants?.find((p) => p !== user?.uid) || conv.participants?.[0];
        const override = otherId ? participantProfiles[otherId] : null;
        const baseProfile = conv.participantDetails?.[otherId] || {};
        const finalName =
          override?.fullName?.trim() ||
          baseProfile.name ||
          override?.email ||
          baseProfile.email ||
          'AcademicConnect user';
        const privacySettings = mergePrivacySettings(
          override?.privacySettings || baseProfile.privacySettings || {}
        );
        const activityHidden =
          override?.activityStatusHidden ?? baseProfile.activityStatusHidden ?? false;
        const lastActiveAt = override?.lastActiveAt || baseProfile.lastActiveAt || null;
        const rawPresence = override?.presenceStatus || baseProfile.presenceStatus || 'offline';
        const activityVisible = privacySettings.showActivityStatus !== false && !activityHidden;
        const derivedPresence = activityVisible ? rawPresence : 'offline';
        const activityLabel = activityVisible
          ? derivedPresence === 'online'
            ? 'Active now'
            : lastActiveAt
            ? `Active ${formatRelativeTime(lastActiveAt)}`
            : 'Recently active'
          : null;
        const otherProfile = {
          ...baseProfile,
          name: finalName,
          avatar: override?.profileImageURL || baseProfile.avatar || null,
          role: override?.role || baseProfile.role || 'Member',
          privacySettings,
          presenceStatus: derivedPresence,
          lastActiveAt,
          activityVisible,
          activityLabel,
        };
        const timestamp = conv.lastMessageAt?.seconds
          ? conv.lastMessageAt.seconds * 1000
          : conv.lastMessageAt instanceof Date
          ? conv.lastMessageAt.getTime()
          : 0;
        return {
          ...conv,
          otherId,
          otherProfile,
          sortTime: timestamp,
        };
      })
      .filter((conv) => !normalizedQuery || (conv.otherProfile.name || '').toLowerCase().includes(normalizedQuery))
      .sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
  }, [conversations, participantProfiles, searchQuery, user?.uid]);

  const renderConversation = ({ item }) => (
    <TouchableOpacity
      style={styles.conversationCard}
      onPress={() =>
        navigation.navigate('Chat',
          item.type === 'group'
            ? { conversationId: item.id, name: item.otherProfile.name, avatar: item.otherProfile.avatar }
            : {
                conversationId: item.id,
                userId: item.otherId,
                name: item.otherProfile.name,
                avatar: item.otherProfile.avatar,
                privacySettings: item.otherProfile.privacySettings,
              }
        )
      }
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <Image source={getAvatarSource(item.otherProfile.avatar)} style={styles.avatar} />
        {item.type !== 'group' && item.otherProfile.activityVisible && (
          <View
            style={[
              styles.onlineIndicator,
              item.otherProfile.presenceStatus === 'online'
                ? styles.onlineIndicatorActive
                : styles.onlineIndicatorIdle,
            ]}
          />
        )}
      </View>

      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <Text style={styles.name}>{item.otherProfile.name || 'AcademicConnect user'}</Text>
          <Text style={styles.time}>{formatRelativeTime(item.lastMessageAt)}</Text>
        </View>
        {item.type !== 'group' && item.otherProfile.activityLabel && (
          <Text
            style={[
              styles.activityStatus,
              item.otherProfile.presenceStatus === 'online'
                ? styles.activityStatusActive
                : styles.activityStatusIdle,
            ]}
          >
            {item.otherProfile.activityLabel}
          </Text>
        )}
        <View style={styles.conversationFooter}>
          <Text 
            style={[
              styles.lastMessage,
              (item.unreadCounts?.[user?.uid] || 0) > 0 && styles.lastMessageUnread
            ]}
            numberOfLines={1}
          >
            {item.lastMessage || 'Tap to start chatting'}
          </Text>
          {(item.unreadCounts?.[user?.uid] || 0) > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCounts?.[user?.uid] || 0}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={colors.textLight} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textLight}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('CreateGroup')}
        >
          <View style={styles.quickActionIcon}>
            <Ionicons name="people-outline" size={24} color={colors.primary} />
          </View>
          <Text style={styles.quickActionText}>Groups</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => Alert.alert('Start a chat', 'Open a profile and tap Message to begin a conversation.')}
        >
          <View style={styles.quickActionIcon}>
            <Ionicons name="person-add-outline" size={24} color={colors.primary} />
          </View>
          <Text style={styles.quickActionText}>New Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => Alert.alert('Video Call', 'Open a conversation to start a call.')}
        >
          <View style={styles.quickActionIcon}>
            <Ionicons name="videocam-outline" size={24} color={colors.primary} />
          </View>
          <Text style={styles.quickActionText}>Video Call</Text>
        </TouchableOpacity>
      </View>

      {/* Conversations List */}
      <View style={styles.conversationsHeader}>
        <Text style={styles.conversationsTitle}>Messages</Text>
        <Text style={styles.conversationsCount}>
          {decoratedConversations.reduce(
            (acc, conv) => acc + ((conv.unreadCounts?.[user?.uid] || 0) > 0 ? 1 : 0),
            0
          )}{' '}
          unread
        </Text>
      </View>

      <FlatList
        data={decoratedConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loadingConversations ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.emptyStateText}>Loading your conversations…</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={32} color={colors.textLight} />
              <Text style={styles.emptyStateText}>No conversations yet. Start one from a profile.</Text>
            </View>
          )
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateGroup')}
      >
        <Ionicons name="create-outline" size={28} color={colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 15,
    marginTop: 10,
    marginBottom: 15,
    borderRadius: 12,
    paddingHorizontal: 15,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: colors.text,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 15,
    marginBottom: 20,
  },
  quickActionButton: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  conversationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 15,
    marginBottom: 10,
  },
  conversationsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  conversationsCount: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 120,
  },
  conversationCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    marginHorizontal: 15,
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.border,
    borderWidth: 2,
    borderColor: colors.white,
  },
  onlineIndicatorActive: {
    backgroundColor: colors.success,
  },
  onlineIndicatorIdle: {
    backgroundColor: colors.border,
  },
  conversationInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  time: {
    fontSize: 12,
    color: colors.textLight,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityStatus: {
    fontSize: 12,
    marginBottom: 4,
  },
  activityStatusActive: {
    color: colors.success,
  },
  activityStatusIdle: {
    color: colors.textLight,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: colors.textLight,
  },
  lastMessageUnread: {
    fontWeight: '600',
    color: colors.text,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    marginTop: 12,
    color: colors.textLight,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});

export default MessagesScreen;
