import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../../firebase';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  FOLLOW_STATUS,
  subscribeToIncomingRequests,
  approveFollowRequest,
  rejectFollowRequest,
  unfollowUser,
  followUser,
  subscribeToFollowState,
} from '../utils/followService';
import { validateUsername, findPublicUserByUsername } from '../utils/usernameService';

const DEFAULT_AVATAR = require('../../assets/shahriar-kabir.jpg');

const TABS = {
  REQUESTS_INCOMING: 'incoming',
  FOLLOWERS: 'followers',
  FOLLOWING: 'following',
  REQUESTS_OUTGOING: 'outgoing',
};

const FollowRelationsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(TABS.REQUESTS_INCOMING);
  const [incomingRequests, setIncomingRequests] = useState([]); // pending requests targeting current user
  const [outgoingRequests, setOutgoingRequests] = useState([]); // requests current user sent to private profiles
  const [followers, setFollowers] = useState([]); // accepted followers (people who follow current user)
  const [following, setFollowing] = useState([]); // people current user follows
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [outgoingLoading, setOutgoingLoading] = useState(false);
  const [requestActioningId, setRequestActioningId] = useState(null);
  // Search state
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null); // user doc
  const [searchMessage, setSearchMessage] = useState('');
  const [searchTone, setSearchTone] = useState('muted');
  const [searchFollowState, setSearchFollowState] = useState(null);

  const hydrateRequests = useCallback(async (requests = [], { signal } = {}) => {
    setRequestsLoading(true);
    try {
      const enriched = await Promise.all(
        requests.map(async (request) => {
          if (signal?.aborted) return null;
          try {
            const snap = await getDoc(doc(db, 'users', request.followerId));
            const followerProfile = snap.exists() ? snap.data() : null;
            return { ...request, followerProfile };
          } catch (error) {
            console.warn('Failed to load follower profile', error);
            return { ...request, followerProfile: null };
          }
        })
      );
      if (signal?.aborted) return;
      setIncomingRequests(enriched.filter(Boolean));
    } catch (error) {
      if (!signal?.aborted) console.warn('Failed to hydrate follow requests', error);
    } finally {
      if (!signal?.aborted) setRequestsLoading(false);
    }
  }, []);

  // Incoming requests (others wanting to follow current user)
  useEffect(() => {
    if (!user?.uid) return;
    const controller = new AbortController();
    const unsubscribe = subscribeToIncomingRequests(user.uid, (items) => {
      hydrateRequests(items, { signal: controller.signal });
    });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [user?.uid, hydrateRequests]);

  // Followers (people following current user)
  useEffect(() => {
    if (!user?.uid) return;
    setFollowersLoading(true);
    // Removed orderBy/limit to avoid missing composite index issues blocking updates.
    const followersQuery = query(
      collection(db, 'followRelationships'),
      where('targetUserId', '==', user.uid),
      where('status', '==', FOLLOW_STATUS.ACCEPTED)
    );
    const unsubscribe = onSnapshot(followersQuery, async (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      try {
        const enriched = await Promise.all(
          rows.map(async (row) => {
            try {
              const snapUser = await getDoc(doc(db, 'users', row.followerId));
              return { ...row, followerProfile: snapUser.exists() ? snapUser.data() : null };
            } catch (e) {
              return { ...row, followerProfile: null };
            }
          })
        );
        setFollowers(enriched);
      } finally {
        setFollowersLoading(false);
      }
    }, () => {
      setFollowers([]);
      setFollowersLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Subscribe follow state for current search result
  useEffect(() => {
    if (!user?.uid || !searchResult?.id) {
      setSearchFollowState(null);
      return;
    }
    const unsubscribe = subscribeToFollowState(user.uid, searchResult.id, setSearchFollowState);
    return () => unsubscribe();
  }, [user?.uid, searchResult?.id]);

  const handleSearchChange = (text) => {
    setSearchText(text);
    if (!text) {
      setSearchResult(null);
      setSearchMessage('');
      setSearchTone('muted');
    }
  };

  const performSearch = async () => {
    const raw = searchText.trim().replace(/^@/, '');
    if (!raw) {
      setSearchResult(null);
      setSearchMessage('Enter a username to search.');
      setSearchTone('error');
      return;
    }
    const validation = validateUsername(raw);
    if (!validation.ok) {
      setSearchResult(null);
      setSearchMessage(validation.message);
      setSearchTone('error');
      return;
    }
    setSearching(true);
    setSearchMessage('');
    try {
      const profile = await findPublicUserByUsername(validation.normalized);
      if (!profile) {
        setSearchResult(null);
        setSearchMessage(`No public user found for @${validation.normalized}.`);
        setSearchTone('error');
        return;
      }
      if (profile.id === user?.uid) {
        setSearchResult(null);
        setSearchMessage('This is you.');
        setSearchTone('muted');
        return;
      }
      setSearchResult(profile);
      setSearchMessage('Tap to view profile or follow.');
      setSearchTone('muted');
    } catch (e) {
      console.warn('Username search failed', e);
      setSearchResult(null);
      setSearchMessage('Search unavailable. Try again later.');
      setSearchTone('error');
    } finally {
      setSearching(false);
    }
  };

  const handleSearchFollow = async () => {
    if (!user || !searchResult) return;
    const privacySettings = searchResult.privacySettings || { profilePublic: searchResult.profilePublic !== false };
    try {
      const res = await followUser({
        follower: user,
        targetUser: { uid: searchResult.id, fullName: searchResult.fullName, privacySettings },
      });
      if (res.status === 'requested') {
        Alert.alert('Request sent', 'Awaiting approval.');
      }
    } catch (e) {
      Alert.alert('Follow failed', 'Unable to follow this user.');
    }
  };

  // Following (people current user follows)
  useEffect(() => {
    if (!user?.uid) return;
    setFollowingLoading(true);
    const followingQuery = query(
      collection(db, 'followRelationships'),
      where('followerId', '==', user.uid),
      where('status', '==', FOLLOW_STATUS.ACCEPTED)
    );
    const unsubscribe = onSnapshot(followingQuery, async (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      try {
        const enriched = await Promise.all(
          rows.map(async (row) => {
            try {
              const snapUser = await getDoc(doc(db, 'users', row.targetUserId));
              return { ...row, targetProfile: snapUser.exists() ? snapUser.data() : null };
            } catch (e) {
              return { ...row, targetProfile: null };
            }
          })
        );
        setFollowing(enriched);
      } finally {
        setFollowingLoading(false);
      }
    }, () => {
      setFollowing([]);
      setFollowingLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Outgoing pending requests (user requested to follow others)
  useEffect(() => {
    if (!user?.uid) return;
    setOutgoingLoading(true);
    const outgoingQuery = query(
      collection(db, 'followRelationships'),
      where('followerId', '==', user.uid),
      where('status', '==', FOLLOW_STATUS.PENDING)
    );
    const unsubscribe = onSnapshot(outgoingQuery, async (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      try {
        const enriched = await Promise.all(
          rows.map(async (row) => {
            try {
              const snapUser = await getDoc(doc(db, 'users', row.targetUserId));
              return { ...row, targetProfile: snapUser.exists() ? snapUser.data() : null };
            } catch (e) {
              return { ...row, targetProfile: null };
            }
          })
        );
        setOutgoingRequests(enriched);
      } finally {
        setOutgoingLoading(false);
      }
    }, () => {
      setOutgoingRequests([]);
      setOutgoingLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const handleRequestAction = async (request, action) => {
    if (!user?.uid) return;
    setRequestActioningId(request.id);
    try {
      if (action === 'accept') {
        await approveFollowRequest({ followDocId: request.id, followerId: request.followerId, targetUser: user });
      } else {
        await rejectFollowRequest({ followDocId: request.id, followerId: request.followerId, targetUser: user });
      }
    } catch (error) {
      Alert.alert('Action failed', 'Unable to update request right now.');
    } finally {
      setRequestActioningId(null);
    }
  };

  const handleUnfollow = async (relation) => {
    if (!user?.uid || !relation?.targetUserId) return;
    try {
      await unfollowUser({ follower: user, targetUser: { uid: relation.targetUserId } });
    } catch (e) {
      Alert.alert('Unfollow failed', 'Could not unfollow user.');
    }
  };

  const handleCancelOutgoing = async (relation) => {
    // UnfollowUser handles pending request cancellation
    await handleUnfollow(relation);
  };

  const renderRequestItem = ({ item }) => {
    const follower = item.followerProfile || {};
    const avatarSource = follower.profileImageURL ? { uri: follower.profileImageURL } : DEFAULT_AVATAR;
    const subtitle = follower.username ? `@${follower.username}` : follower.email || 'AcademicConnect member';
    const actioning = requestActioningId === item.id;
    return (
      <View style={styles.requestCard}>
        <TouchableOpacity
          style={styles.requestInfo}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('UserProfile', {
              userId: item.followerId,
              fallback: {
                name: follower.fullName || 'AcademicConnect member',
                username: follower.username || null,
                avatar: follower.profileImageURL || null,
              },
            })
          }
        >
          <Image source={avatarSource} style={styles.requestAvatar} />
          <View>
            <Text style={styles.requestName}>{follower.fullName || 'AcademicConnect member'}</Text>
            <Text style={styles.requestSubtitle}>{subtitle}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.requestButtonsRow}>
          <TouchableOpacity
            style={[styles.requestButton, styles.requestDeclineButton]}
            onPress={() => handleRequestAction(item, 'decline')}
            disabled={actioning}
          >
            {actioning ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.requestButtonText}>Decline</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.requestButton, styles.requestAcceptButton]}
            onPress={() => handleRequestAction(item, 'accept')}
            disabled={actioning}
          >
            {actioning ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.requestButtonText}>Accept</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFollowerItem = ({ item }) => {
    const profile = item.followerProfile || {};
    const avatarSource = profile.profileImageURL ? { uri: profile.profileImageURL } : DEFAULT_AVATAR;
    const subtitle = profile.username ? `@${profile.username}` : profile.email || 'AcademicConnect member';
    return (
      <TouchableOpacity
        style={styles.followerRow}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('UserProfile', {
            userId: item.followerId,
            fallback: {
              name: profile.fullName || 'AcademicConnect member',
              username: profile.username || null,
              avatar: profile.profileImageURL || null,
            },
          })
        }
      >
        <Image source={avatarSource} style={styles.followerAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.followerName}>{profile.fullName || 'AcademicConnect member'}</Text>
          <Text style={styles.followerSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
      </TouchableOpacity>
    );
  };

  const renderFollowingItem = ({ item }) => {
    const profile = item.targetProfile || {};
    const avatarSource = profile.profileImageURL ? { uri: profile.profileImageURL } : DEFAULT_AVATAR;
    const subtitle = profile.username ? `@${profile.username}` : profile.email || 'AcademicConnect member';
    return (
      <View style={styles.followingRow}>
        <TouchableOpacity
          style={styles.followingInfo}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('UserProfile', {
              userId: item.targetUserId,
              fallback: {
                name: profile.fullName || 'AcademicConnect member',
                username: profile.username || null,
                avatar: profile.profileImageURL || null,
              },
            })
          }
        >
          <Image source={avatarSource} style={styles.followerAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.followerName}>{profile.fullName || 'AcademicConnect member'}</Text>
            <Text style={styles.followerSubtitle}>{subtitle}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.unfollowButton}
          onPress={() => handleUnfollow(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={18} color={colors.white} />
          <Text style={styles.unfollowButtonText}>Unfollow</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderOutgoingItem = ({ item }) => {
    const profile = item.targetProfile || {};
    const avatarSource = profile.profileImageURL ? { uri: profile.profileImageURL } : DEFAULT_AVATAR;
    const subtitle = profile.username ? `@${profile.username}` : profile.email || 'AcademicConnect member';
    return (
      <View style={styles.followingRow}>
        <TouchableOpacity
          style={styles.followingInfo}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('UserProfile', {
              userId: item.targetUserId,
              fallback: {
                name: profile.fullName || 'AcademicConnect member',
                username: profile.username || null,
                avatar: profile.profileImageURL || null,
              },
            })
          }
        >
          <Image source={avatarSource} style={styles.followerAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.followerName}>{profile.fullName || 'AcademicConnect member'}</Text>
            <Text style={styles.followerSubtitle}>{subtitle}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.unfollowButton}
          onPress={() => handleCancelOutgoing(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={18} color={colors.white} />
          <Text style={styles.unfollowButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    if (!user?.uid) {
      return <Text style={styles.emptyText}>Sign in to view followers and requests.</Text>;
    }
    if (activeTab === TABS.REQUESTS_INCOMING) {
      if (requestsLoading) return <ActivityIndicator style={{ marginTop: 20 }} size="small" color={colors.primary} />;
      if (!incomingRequests.length) return <Text style={styles.emptyText}>No pending follow requests.</Text>;
      return (
        <FlatList
          data={incomingRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequestItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      );
    }
    if (activeTab === TABS.FOLLOWERS) {
      if (followersLoading) return <ActivityIndicator style={{ marginTop: 20 }} size="small" color={colors.primary} />;
      if (!followers.length) return <Text style={styles.emptyText}>You do not have followers yet.</Text>;
      return (
        <FlatList
          data={followers}
          keyExtractor={(item) => item.id}
          renderItem={renderFollowerItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      );
    }
    if (activeTab === TABS.FOLLOWING) {
      if (followingLoading) return <ActivityIndicator style={{ marginTop: 20 }} size="small" color={colors.primary} />;
      if (!following.length) return <Text style={styles.emptyText}>You are not following anyone yet.</Text>;
      return (
        <FlatList
          data={following}
          keyExtractor={(item) => item.id}
          renderItem={renderFollowingItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      );
    }
    if (activeTab === TABS.REQUESTS_OUTGOING) {
      if (outgoingLoading) return <ActivityIndicator style={{ marginTop: 20 }} size="small" color={colors.primary} />;
      if (!outgoingRequests.length) return <Text style={styles.emptyText}>No outgoing follow requests.</Text>;
      return (
        <FlatList
          data={outgoingRequests}
          keyExtractor={(item) => item.id}
          renderItem={renderOutgoingItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Global user search moved here from Home */}
      <View style={styles.searchCard}>
        <Text style={styles.searchTitle}>Search users</Text>
        <View style={styles.searchRow}>
          <Ionicons name="at" size={18} color={colors.textLight} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Username"
            placeholderTextColor={colors.textLight}
            autoCapitalize="none"
            value={searchText}
            onChangeText={handleSearchChange}
            onSubmitEditing={performSearch}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={performSearch}
            disabled={searching}
            activeOpacity={0.85}
          >
            {searching ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.searchButtonText}>Search</Text>}
          </TouchableOpacity>
        </View>
        {searchResult ? (
          <TouchableOpacity
            style={styles.searchResultRow}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('UserProfile', { userId: searchResult.id, fallback: { name: searchResult.fullName || searchResult.email || `@${searchResult.username}`, avatar: searchResult.profileImageURL } })}
          >
            <Image source={searchResult.profileImageURL ? { uri: searchResult.profileImageURL } : DEFAULT_AVATAR} style={styles.searchResultAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.searchResultName}>{searchResult.fullName || searchResult.email || 'AcademicConnect user'}</Text>
              <Text style={styles.searchResultHandle}>@{searchResult.username}</Text>
            </View>
            {searchFollowState?.status === FOLLOW_STATUS.ACCEPTED ? (
              <Text style={styles.alreadyFollowingText}>Following</Text>
            ) : searchFollowState?.status === FOLLOW_STATUS.PENDING ? (
              <Text style={styles.pendingText}>Requested</Text>
            ) : (
              <TouchableOpacity style={styles.followActionButton} onPress={handleSearchFollow} activeOpacity={0.85}>
                <Ionicons name="person-add" size={18} color={colors.white} />
                <Text style={styles.followActionButtonText}>Follow</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ) : null}
        {searchMessage ? (
          <Text style={[styles.searchFeedback, searchTone === 'error' && styles.searchFeedbackError]}>{searchMessage}</Text>
        ) : null}
      </View>
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === TABS.REQUESTS_INCOMING && styles.tabButtonActive]}
          onPress={() => setActiveTab(TABS.REQUESTS_INCOMING)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabButtonText, activeTab === TABS.REQUESTS_INCOMING && styles.tabButtonTextActive]}>Incoming</Text>
          {incomingRequests.length > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{incomingRequests.length}</Text></View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === TABS.FOLLOWERS && styles.tabButtonActive]}
          onPress={() => setActiveTab(TABS.FOLLOWERS)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabButtonText, activeTab === TABS.FOLLOWERS && styles.tabButtonTextActive]}>Followers</Text>
          {followers.length > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{followers.length}</Text></View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === TABS.FOLLOWING && styles.tabButtonActive]}
          onPress={() => setActiveTab(TABS.FOLLOWING)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabButtonText, activeTab === TABS.FOLLOWING && styles.tabButtonTextActive]}>Following</Text>
          {following.length > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{following.length}</Text></View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === TABS.REQUESTS_OUTGOING && styles.tabButtonActive]}
          onPress={() => setActiveTab(TABS.REQUESTS_OUTGOING)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabButtonText, activeTab === TABS.REQUESTS_OUTGOING && styles.tabButtonTextActive]}>Outgoing</Text>
          {outgoingRequests.length > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{outgoingRequests.length}</Text></View>
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.content}>{renderContent()}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchCard: {
    marginHorizontal: 15,
    marginTop: 10,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
  },
  searchButton: {
    marginLeft: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchButtonText: { color: colors.white, fontWeight: '600' },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  searchResultAvatar: { width: 46, height: 46, borderRadius: 23, marginRight: 12 },
  searchResultName: { fontSize: 15, fontWeight: '600', color: colors.text },
  searchResultHandle: { fontSize: 13, color: colors.primary, marginTop: 2 },
  followActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  followActionButtonText: { color: colors.white, fontSize: 12, fontWeight: '600', marginLeft: 4 },
  alreadyFollowingText: { fontSize: 12, fontWeight: '600', color: colors.success },
  pendingText: { fontSize: 12, fontWeight: '600', color: colors.warning },
  searchFeedback: { marginTop: 8, fontSize: 12, color: colors.textLight },
  searchFeedbackError: { color: colors.danger },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 12,
    padding: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(108,99,255,0.12)',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  tabButtonTextActive: {
    color: colors.primary,
  },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    marginLeft: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    marginTop: 10,
    paddingHorizontal: 15,
  },
  emptyText: {
    marginTop: 30,
    textAlign: 'center',
    color: colors.textLight,
    fontSize: 14,
  },
  requestCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.white,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  requestSubtitle: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 2,
  },
  requestButtonsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  requestButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  requestDeclineButton: {
    backgroundColor: colors.danger,
    marginRight: 10,
  },
  requestAcceptButton: {
    backgroundColor: colors.success,
  },
  requestButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  followerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  followerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  followerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  followerSubtitle: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 2,
  },
  followingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  followingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  unfollowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unfollowButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default FollowRelationsScreen;
