import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../../firebase';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { mergePrivacySettings } from '../constants/privacyDefaults';
import {
  followUser,
  subscribeToFollowState,
  unfollowUser,
  FOLLOW_STATUS,
} from '../utils/followService';
import { sanitizeSubRoles } from '../utils/roleUtils';
import SubRolePills from '../components/SubRolePills';

const DEFAULT_AVATAR = require('../../assets/shahriar-kabir.jpg');

const formatRelativeTime = (ts) => {
  if (!ts) return '';
  let date = null;
  if (ts?.seconds) {
    date = new Date(ts.seconds * 1000);
  } else if (ts instanceof Date) {
    date = ts;
  } else {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
    }
  }
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
};

const UserProfileScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { userId, fallback = {} } = route.params || {};
  const [profile, setProfile] = useState({
    name: fallback.name || 'AcademicConnect member',
    username: fallback.username || null,
    role: (fallback.role || 'Member').toUpperCase(),
    subRoles: sanitizeSubRoles(fallback.subRoles || [], fallback.role),
    institution: fallback.institution || 'Not provided',
    bio: fallback.bio || 'No bio shared yet.',
    avatarURL: fallback.avatar || null,
    followers: fallback.followers || 0,
    following: fallback.following || 0,
    postsCount: fallback.posts || 0,
    status: fallback.status || null,
    email: fallback.email || '',
    expertise: fallback.expertise || [],
    privacySettings: mergePrivacySettings(fallback.privacySettings),
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [followState, setFollowState] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoadingProfile(false);
      setLoadingPosts(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile((prev) => ({
            ...prev,
            name: data.fullName || prev.name,
            username: data.username || prev.username,
            role: (data.role || prev.role || 'Member').toUpperCase(),
            subRoles: sanitizeSubRoles(data.subRoles || prev.subRoles || [], data.role || prev.role),
            institution: data.address || prev.institution,
            bio: data.bio || prev.bio,
            avatarURL: data.profileImageURL || prev.avatarURL,
            followers: typeof data.followers === 'number' ? data.followers : prev.followers || 0,
            following: typeof data.following === 'number' ? data.following : prev.following || 0,
            postsCount: data.posts || prev.postsCount || 0,
            status: data.status || prev.status,
            email: data.email || prev.email,
            expertise: Array.isArray(data.expertise) ? data.expertise : prev.expertise,
            privacySettings: mergePrivacySettings(data.privacySettings),
          }));
        }
        setLoadingProfile(false);
      },
      (error) => {
        console.warn('Failed to load member profile', error);
        setLoadingProfile(false);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!user?.uid || !userId || user.uid === userId) {
      setFollowState(null);
      return undefined;
    }
    const unsubscribe = subscribeToFollowState(user.uid, userId, setFollowState);
    return () => unsubscribe();
  }, [user?.uid, userId]);

  useEffect(() => {
    if (!userId) return;
    setLoadingPosts(true);
    const q = query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecentPosts(items);
        setLoadingPosts(false);
      },
      (error) => {
        console.warn('Failed to load recent posts', error);
        setLoadingPosts(false);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  const avatarSource = useMemo(() => {
    if (profile.avatarURL) {
      return { uri: profile.avatarURL };
    }
    if (fallback.avatar) {
      return { uri: fallback.avatar };
    }
    return DEFAULT_AVATAR;
  }, [profile.avatarURL, fallback.avatar]);

  const appliedPrivacy = useMemo(
    () => mergePrivacySettings(profile.privacySettings),
    [profile.privacySettings]
  );
  const isOwnProfile = user?.uid === userId;
  const followStatus = followState?.status || null;
  const isFollowing = followStatus === FOLLOW_STATUS.ACCEPTED;
  const requestPending = followStatus === FOLLOW_STATUS.PENDING;
  const profileLocked = !isOwnProfile && !appliedPrivacy.profilePublic && !isFollowing;
  const messagingAllowed = isOwnProfile ? false : appliedPrivacy.allowMessagesFromAll;

  const handleMessagePress = () => {
    if (!userId) return;
    if (!user) {
      Alert.alert('Please sign in', 'Log in to start a conversation with this member.');
      return;
    }
    if (!messagingAllowed) {
      Alert.alert(
        'Messaging unavailable',
        'This member only accepts messages from approved contacts.'
      );
      return;
    }
    navigation.navigate('Messages', {
      screen: 'Chat',
      params: {
        userId,
        name: profile.name,
        avatar: profile.avatarURL || fallback.avatar || null,
        privacySettings: appliedPrivacy,
      },
    });
  };

  const adjustFollowerCount = (delta) => {
    setProfile((prev) => {
      const next = Math.max(0, (prev.followers || 0) + delta);
      return { ...prev, followers: next };
    });
  };

  const handleFollowToggle = async () => {
    if (!user) {
      Alert.alert('Please sign in', 'Create an account or log in to follow members.');
      return;
    }
    if (user.uid === userId) return;
    if (followBusy) return;

    try {
      setFollowBusy(true);
      if (isFollowing) {
        const res = await unfollowUser({ follower: user, targetUser: { uid: userId } });
        if (res.status === 'unfollowed') {
          adjustFollowerCount(-1);
        }
        if (res.status === 'request-cancelled') {
          Alert.alert('Request canceled', 'Your follow request has been withdrawn.');
        }
      } else if (requestPending) {
        const res = await unfollowUser({ follower: user, targetUser: { uid: userId } });
        if (res.status === 'request-cancelled') {
          Alert.alert('Request canceled', 'Your follow request has been withdrawn.');
        }
      } else {
        const res = await followUser({
          follower: user,
          targetUser: { uid: userId, fullName: profile.name, privacySettings: profile.privacySettings },
        });
        if (res.status === 'followed') {
          adjustFollowerCount(1);
        }
        if (res.status === 'requested') {
          Alert.alert('Follow request sent', 'This member will need to approve your request.');
        }
      }
    } catch (error) {
      console.warn('Failed to toggle follow', error);
      Alert.alert('Something went wrong', 'We could not update your follow status. Please try again.');
    } finally {
      setFollowBusy(false);
    }
  };

  if (!userId) {
    return (
      <SafeAreaView style={styles.centeredState}>
        <Ionicons name="person-circle-outline" size={56} color={colors.mediumGray} />
        <Text style={styles.centeredTitle}>Member unavailable</Text>
        <Text style={styles.centeredBody}>We could not find the profile you were trying to view.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Image source={avatarSource} style={styles.avatar} />
          {loadingProfile ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : (
            <>
              <Text style={styles.name}>{profile.name}</Text>
              {profile.username ? (
                <Text style={styles.usernameHandle}>@{profile.username}</Text>
              ) : null}
              <SubRolePills
                primaryRole={profile.role}
                subRoles={profile.subRoles}
                fallbackLabel={profile.role}
              />
              <Text style={styles.institution}>{profile.institution}</Text>
              {profile.status === 'approved' && (
                <View style={styles.verifiedPill}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.white} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.postsCount || 0}</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.followers || 0}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.following || 0}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
              </View>
            </>
          )}

          {!isOwnProfile && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.primaryButton, !messagingAllowed && styles.primaryButtonDisabled]}
                onPress={handleMessagePress}
                disabled={!messagingAllowed}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.white} />
                <Text style={styles.primaryButtonText}>
                  {messagingAllowed ? 'Message' : 'Messaging off'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  isFollowing && styles.secondaryButtonActive,
                  requestPending && styles.secondaryButtonPending,
                ]}
                onPress={handleFollowToggle}
                disabled={followBusy}
              >
                {followBusy ? (
                  <ActivityIndicator
                    size="small"
                    color={isFollowing ? colors.success : requestPending ? colors.warning : colors.primary}
                  />
                ) : (
                  <Ionicons
                    name={isFollowing ? 'checkmark-circle' : requestPending ? 'time-outline' : 'person-add-outline'}
                    size={18}
                    color={isFollowing ? colors.success : requestPending ? colors.warning : colors.primary}
                  />
                )}
                <Text
                  style={[
                    styles.secondaryButtonText,
                    isFollowing && { color: colors.success },
                    requestPending && { color: colors.warning },
                  ]}
                >
                  {isFollowing ? 'Following' : requestPending ? 'Requested' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!isOwnProfile && (
            <TouchableOpacity
              style={styles.portfolioButton}
              onPress={() => navigation.navigate('Portfolio', { screen: 'PortfolioPreview', params: { userId } })}
            >
              <Ionicons name="folder-outline" size={18} color={colors.primary} />
              <Text style={styles.portfolioButtonText}>View Portfolio</Text>
            </TouchableOpacity>
          )}
        </View>

        {profileLocked ? (
          <View style={styles.section}>
            <View style={styles.lockedHeader}>
              <Ionicons name="lock-closed" size={22} color={colors.primary} />
              <Text style={styles.lockedTitle}>This profile is private</Text>
            </View>
            <Text style={styles.lockedText}>
              {requestPending
                ? 'Your follow request is pending approval. You will be notified once the member accepts.'
                : 'Follow this member to request access or wait for them to make their profile public again.'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.sectionBody}>{profile.bio}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Academic snapshot</Text>
              <View style={styles.infoRow}>
                <Ionicons name="school-outline" size={18} color={colors.primary} />
                <Text style={styles.infoValue}>{profile.institution}</Text>
              </View>
              {profile.email ? (
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={18} color={colors.primary} />
                  <Text style={styles.infoValue}>{profile.email}</Text>
                </View>
              ) : null}
              {profile.expertise?.length ? (
                <View style={[styles.infoRow, { alignItems: 'flex-start' }]}>
                  <Ionicons name="bulb-outline" size={18} color={colors.primary} style={{ marginTop: 4 }} />
                  <View style={styles.chipWrap}>
                    {profile.expertise.map((item) => (
                      <View key={item} style={styles.chip}>
                        <Text style={styles.chipText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent posts</Text>
                {!loadingPosts && (
                  <Text style={styles.sectionMeta}>
                    {recentPosts.length ? `${recentPosts.length} shown` : 'No posts yet'}
                  </Text>
                )}
              </View>
              {loadingPosts ? (
                <ActivityIndicator color={colors.primary} />
              ) : recentPosts.length ? (
                recentPosts.map((post) => (
                  <View key={post.id} style={styles.postCard}>
                    <View style={styles.postHeader}>
                      <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                      <Text style={styles.postTime}>{formatRelativeTime(post.createdAt)}</Text>
                    </View>
                    <Text style={styles.postBody}>{post.content || 'Shared an update'}</Text>
                    {post.image ? (
                      <Image
                        source={typeof post.image === 'string' ? { uri: post.image } : post.image}
                        style={styles.postImage}
                      />
                    ) : null}
                    <View style={styles.postStats}>
                      <Text style={styles.postStatText}>{post.likesCount || 0} likes</Text>
                      <Text style={styles.postStatText}>{post.commentsCount || 0} comments</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.sectionBody}>This member has not posted yet.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  headerCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: colors.primary,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  usernameHandle: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 2,
  },
  role: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 4,
  },
  institution: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  verifiedText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: 6,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 6,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
  },
  portfolioButton: {
    marginTop: 10,
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  portfolioButtonText: {
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginRight: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.border,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginLeft: 8,
  },
  secondaryButtonActive: {
    borderColor: colors.success,
    backgroundColor: colors.success + '15',
  },
  secondaryButtonPending: {
    borderColor: colors.warning,
    backgroundColor: colors.warning + '15',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    borderRadius: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  sectionMeta: {
    fontSize: 13,
    color: colors.textLight,
  },
  sectionBody: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  infoValue: {
    marginLeft: 10,
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 10,
    flex: 1,
  },
  chip: {
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    margin: 4,
  },
  chipText: {
    fontSize: 13,
    color: colors.text,
  },
  postCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  postTime: {
    fontSize: 12,
    color: colors.textLight,
  },
  postBody: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 10,
  },
  postImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  postStatText: {
    fontSize: 12,
    color: colors.textLight,
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  lockedTitle: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  lockedText: {
    fontSize: 14,
    color: colors.textLight,
    lineHeight: 20,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  centeredTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  centeredBody: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 6,
  },
});

export default UserProfileScreen;
