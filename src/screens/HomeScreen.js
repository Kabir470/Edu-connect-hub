import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Alert,
  Share,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { followUser, unfollowUser, FOLLOW_STATUS, subscribeToFollowState } from '../utils/followService';
import { db } from '../../firebase';
import { createNotificationEntry } from '../utils/notificationService';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  addDoc,
  serverTimestamp,
  deleteDoc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import SubRolePills from '../components/SubRolePills';
import { formatRoleLabels } from '../utils/roleUtils';
// Removed user search from Home; feature moved to Followers & Requests screen.

const COMPOSE_CARD_HEIGHT = 110;
const SHARE_BASE_URL = 'https://academicconnect.app/posts';
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
    if (!isNaN(parsed.getTime())) {
      date = parsed;
    }
  }
  if (!date || isNaN(date.getTime())) return '';
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

const buildShareLink = (postId) => `${SHARE_BASE_URL}/${postId}`;

const buildSharedSnapshot = (postItem) => ({
  id: postItem.id,
  userId: postItem.userId,
  userName: postItem.userName || postItem.userEmail || 'User',
  userPhotoURL: postItem.userPhotoURL || null,
  role: postItem.role || '',
  subRoles: Array.isArray(postItem.subRoles) ? postItem.subRoles : [],
  content: postItem.content || '',
  image: postItem.image || null,
  createdAt: postItem.createdAt || null,
});

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedFilter, setFeedFilter] = useState('all');
  const [shareComposerVisible, setShareComposerVisible] = useState(false);
  const [shareComposerPost, setShareComposerPost] = useState(null);
  const [shareComposerNote, setShareComposerNote] = useState('');
  const [shareSaving, setShareSaving] = useState(false);
  const [hiddenPostIds, setHiddenPostIds] = useState(new Set());
  const [optionsPost, setOptionsPost] = useState(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [authorFollowState, setAuthorFollowState] = useState(null);
  // User search states removed (migrated to FollowRelationsScreen)
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPosts(items);
        setLoading(false);
      },
      (e) => {
        console.error('Feed subscribe error', e);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user && feedFilter === 'mine') {
      setFeedFilter('all');
    }
  }, [user, feedFilter]);

  // Username search handlers removed.

  const filteredPosts = useMemo(() => {
    let base = posts.filter((p) => !hiddenPostIds.has(p.id));
    if (feedFilter === 'mine') {
      if (!user?.uid) return [];
      base = base.filter((post) => post.userId === user.uid);
    }
    return base;
  }, [feedFilter, posts, user?.uid, hiddenPostIds]);

  useEffect(() => {
    if (!user?.uid || !optionsPost?.userId || user.uid === optionsPost.userId) {
      setAuthorFollowState(null);
      return;
    }
    const unsubscribe = subscribeToFollowState(user.uid, optionsPost.userId, setAuthorFollowState);
    return () => unsubscribe();
  }, [user?.uid, optionsPost?.userId]);

  const recordSharedPost = useCallback(
    async (originalPost, note = '') => {
      if (!user) return;
      try {
        const userDisplayName = user.fullName || user.email?.split('@')[0] || 'You';
        await addDoc(collection(db, 'posts'), {
          type: 'share',
          userId: user.uid,
          userEmail: user.email,
          userName: userDisplayName,
          role: user.role || null,
          subRoles: Array.isArray(user.subRoles) ? user.subRoles : [],
          userPhotoURL: user.profileImageURL || null,
          content: note,
          sharedPostId: originalPost.id,
          sharedPostSnapshot: buildSharedSnapshot(originalPost),
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
          likedBy: [],
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error('Failed to record share post', error);
      }
    },
    [user]
  );

  const openShareComposer = (postItem) => {
    setShareComposerPost(postItem);
    setShareComposerNote('');
    setShareComposerVisible(true);
  };

  const closeShareComposer = () => {
    setShareComposerVisible(false);
    setShareComposerPost(null);
    setShareComposerNote('');
    setShareSaving(false);
  };

  const handleCancelShareToFeed = () => closeShareComposer();

  const handleConfirmShareToFeed = async () => {
    if (!shareComposerPost || !user) {
      closeShareComposer();
      return;
    }
    try {
      setShareSaving(true);
      const note = shareComposerNote.trim();
      await recordSharedPost(shareComposerPost, note);
      await createNotificationEntry({
        type: 'share',
        targetUserId: shareComposerPost.userId,
        actor: user,
        post: shareComposerPost,
        meta: {
          message: 'shared your post',
          previewText: note || shareComposerPost.content || '',
        },
      });
      Alert.alert('Shared to feed', 'Your share is now visible in your feed.');
      closeShareComposer();
    } catch (error) {
      console.error('Share to feed failed', error);
      Alert.alert('Error', 'Could not add this share to your feed.');
      setShareSaving(false);
    }
  };

  const handleToggleLike = async (postItem) => {
    if (!user) {
      Alert.alert('Sign in required', 'Log in to like posts.');
      return;
    }
    try {
      const postRef = doc(db, 'posts', postItem.id);
      const alreadyLiked = Array.isArray(postItem.likedBy) && postItem.likedBy.includes(user.uid);
      await updateDoc(postRef, {
        likedBy: alreadyLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
        likesCount: increment(alreadyLiked ? -1 : 1),
      });
      if (!alreadyLiked) {
        await createNotificationEntry({
          type: 'like',
          targetUserId: postItem.userId,
          actor: user,
          post: postItem,
          meta: { message: 'liked your post' },
        });
      }
    } catch (error) {
      console.error('Failed to toggle like', error);
      Alert.alert('Error', 'Unable to update like right now.');
    }
  };

  const handleSharePost = async (postItem) => {
    if (!user) {
      Alert.alert('Sign in required', 'Log in to share posts.');
      return;
    }
    try {
      const shareLink = buildShareLink(postItem.id);
      const shareMessage = `${postItem.userName || 'Someone'} on AcademicConnect:\n\n${postItem.content || ''}\n\nRead more: ${shareLink}`;
      const result = await Share.share({ message: shareMessage });
      if (result.action === Share.sharedAction) {
        await updateDoc(doc(db, 'posts', postItem.id), {
          sharesCount: increment(1),
        });
        openShareComposer(postItem);
      }
    } catch (error) {
      console.error('Share failed', error);
      Alert.alert('Error', 'Unable to share the post right now.');
    }
  };

  // Post options handlers
  const handleOpenOptions = (postItem) => {
    setOptionsPost(postItem);
    setOptionsVisible(true);
  };

  const closeOptions = () => {
    setOptionsVisible(false);
    setOptionsPost(null);
  };

  const handleCopyText = async () => {
    if (!optionsPost) return;
    try {
      await Clipboard.setStringAsync(optionsPost.content || '');
      Alert.alert('Copied', 'Post text copied to clipboard.');
    } catch (e) {
      Alert.alert('Copy failed', 'Unable to copy text right now.');
    }
    closeOptions();
  };

  const handleSavePost = async () => {
    if (!user?.uid || !optionsPost) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'savedPosts', optionsPost.id), {
        postId: optionsPost.id,
        postSnapshot: buildSharedSnapshot(optionsPost),
        createdAt: serverTimestamp(),
      });
      // Track saver on the post document for later cascade delete
      try {
        await updateDoc(doc(db, 'posts', optionsPost.id), {
          savedBy: arrayUnion(user.uid),
        });
      } catch (_) {
        // ignore if post disappeared or update fails
      }
      Alert.alert('Saved', 'Post added to Saved Posts.');
    } catch (e) {
      Alert.alert('Save failed', 'Unable to save this post.');
    }
    closeOptions();
  };

  const handleDeletePost = async () => {
    if (!user?.uid || !optionsPost) return;
    if (user.uid !== optionsPost.userId) {
      Alert.alert('Action not allowed', 'You can only delete your own posts.');
      return;
    }
    Alert.alert('Delete post', 'This will permanently remove the post everywhere including saved copies. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          let savedBy = [];
          try {
            const snap = await getDoc(doc(db, 'posts', optionsPost.id));
            if (snap.exists()) {
              const data = snap.data();
              if (Array.isArray(data.savedBy)) savedBy = data.savedBy;
            }
          } catch (_) {}
          try {
            // Delete post document first (content no longer accessible)
            await deleteDoc(doc(db, 'posts', optionsPost.id));
            setPosts((prev) => prev.filter((p) => p.id !== optionsPost.id));
            // Remove saved references for all users who saved it
            await Promise.all(
              savedBy.map((uid) => deleteDoc(doc(db, 'users', uid, 'savedPosts', optionsPost.id)).catch(() => null))
            );
            // Best effort remove for deleter if not in savedBy
            if (!savedBy.includes(user.uid)) {
              try { await deleteDoc(doc(db, 'users', user.uid, 'savedPosts', optionsPost.id)); } catch (_) {}
            }
          } catch (e) {
            Alert.alert('Delete failed', 'Could not delete the post.');
          }
          closeOptions();
        },
      },
    ]);
  };

  const handleHidePost = () => {
    if (!optionsPost) return;
    setHiddenPostIds((prev) => new Set([...prev, optionsPost.id]));
    closeOptions();
  };

  const handleReportPost = () => {
    Alert.alert('Reported', 'Thank you. Our team will review this post.');
    closeOptions();
  };

  const handleFollowAuthor = async () => {
    if (!user || !optionsPost || user.uid === optionsPost.userId) return;
    try {
      const res = await followUser({
        follower: user,
        targetUser: { uid: optionsPost.userId, fullName: optionsPost.userName },
      });
      if (res.status === 'requested') Alert.alert('Request sent', 'Awaiting approval.');
    } catch (e) {
      Alert.alert('Follow failed', 'Unable to follow author.');
    }
    closeOptions();
  };

  const handleUnfollowAuthor = async () => {
    if (!user || !optionsPost) return;
    try {
      await unfollowUser({ follower: user, targetUser: { uid: optionsPost.userId } });
      Alert.alert('Updated', 'You no longer follow this author.');
    } catch (e) {
      Alert.alert('Unfollow failed', 'Unable to unfollow.');
    }
    closeOptions();
  };

  const handleShareLinkFromOptions = () => {
    if (!optionsPost) return;
    handleSharePost(optionsPost);
    closeOptions();
  };

  const openUserProfile = useCallback(
    (targetUserId, fallback = {}) => {
      if (!targetUserId) return;
      if (user?.uid === targetUserId) {
        navigation.navigate('Profile');
        return;
      }
      navigation.navigate('UserProfile', {
        userId: targetUserId,
        fallback,
      });
    },
    [navigation, user?.uid]
  );

  const renderPost = ({ item }) => {
    const likesCount = item.likesCount ?? 0;
    const commentsCount = item.commentsCount ?? 0;
    const sharesCount = item.sharesCount ?? 0;
    const userHasLiked = !!(user?.uid && Array.isArray(item.likedBy) && item.likedBy.includes(user.uid));
    const isShare = item.type === 'share';
    const sharedSnapshot = item.sharedPostSnapshot;
    const isCurrentUserPost = !!(user?.uid && user.uid === item.userId);
    const authorName = isCurrentUserPost
      ? user.fullName?.trim() || user.email?.split('@')[0] || 'You'
      : item.userName || item.userEmail || 'User';
    const primaryRoleValue = isCurrentUserPost ? user?.role : item.role;
    const authorSubRoles = isCurrentUserPost
      ? (Array.isArray(user?.subRoles) ? user.subRoles : [])
      : (Array.isArray(item.subRoles) ? item.subRoles : []);
    const roleLabel = formatRoleLabels(
      authorSubRoles,
      isCurrentUserPost ? user?.role || 'Member' : item.role || 'Member'
    );
    const authorAvatarURL = isCurrentUserPost ? user.profileImageURL || null : item.userPhotoURL || null;
    const authorAvatarSource = authorAvatarURL ? { uri: authorAvatarURL } : DEFAULT_AVATAR;
    const originalAuthor = sharedSnapshot?.userName || 'original post';
    const sharedSubRoles = Array.isArray(sharedSnapshot?.subRoles) ? sharedSnapshot.subRoles : [];
    const originalRoleLabel = formatRoleLabels(sharedSubRoles, sharedSnapshot?.role || '');
    const shareSubtitle = isShare ? `Shared from ${originalAuthor}` : null;

    const renderPrimaryContent = () => (
      <>
        {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}
        {item.image && (
          <Image 
            source={typeof item.image === 'string' ? { uri: item.image } : item.image} 
            style={styles.postImage} 
          />
        )}
      </>
    );

    const renderSharedSection = () => {
      if (!sharedSnapshot) {
        return <Text style={styles.sharedUnavailable}>Original post is no longer available.</Text>;
      }
      return (
        <View style={styles.sharedPostCard}>
          <TouchableOpacity
            style={styles.sharedHeaderRow}
            activeOpacity={sharedSnapshot?.userId ? 0.85 : 1}
            onPress={() =>
              sharedSnapshot?.userId &&
              openUserProfile(sharedSnapshot.userId, {
                name: sharedSnapshot.userName || 'User',
                avatar: sharedSnapshot.userPhotoURL,
                role: sharedSnapshot?.role || 'Member',
                subRoles: sharedSubRoles,
              })
            }
          >
            <Image
              source={sharedSnapshot.userPhotoURL ? { uri: sharedSnapshot.userPhotoURL } : DEFAULT_AVATAR}
              style={styles.sharedAvatar}
            />
            <View style={styles.sharedMeta}>
              <Text style={styles.sharedAuthor}>{sharedSnapshot.userName || 'User'}</Text>
              <SubRolePills
                primaryRole={sharedSnapshot?.role}
                subRoles={sharedSubRoles}
                fallbackLabel={originalRoleLabel}
                style={styles.sharedRole}
              />
              <Text style={styles.sharedTime}>{formatRelativeTime(sharedSnapshot.createdAt)}</Text>
            </View>
          </TouchableOpacity>
          {sharedSnapshot.content ? (
            <Text style={styles.sharedContent}>{sharedSnapshot.content}</Text>
          ) : null}
          {sharedSnapshot.image && (
            <Image
              source={typeof sharedSnapshot.image === 'string' ? { uri: sharedSnapshot.image } : sharedSnapshot.image}
              style={styles.sharedImage}
            />
          )}
        </View>
      );
    };

    return (
      <TouchableOpacity 
        style={styles.postCard}
        onPress={() => navigation.navigate('PostDetail', { post: item })}
        activeOpacity={0.9}
      >
        {/* Post Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity
            onPress={() =>
              openUserProfile(item.userId, {
                name: authorName,
                avatar: authorAvatarURL,
                role: primaryRoleValue || 'Member',
                subRoles: authorSubRoles,
              })
            }
            activeOpacity={0.85}
          >
            <Image source={authorAvatarSource} style={styles.avatar} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.authorInfo}
            onPress={() =>
              openUserProfile(item.userId, {
                name: authorName,
                avatar: authorAvatarURL,
                role: primaryRoleValue || 'Member',
                subRoles: authorSubRoles,
              })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.authorName}>
              {isShare ? `${authorName} shared ${originalAuthor}'s post` : authorName}
            </Text>
            <SubRolePills
              primaryRole={primaryRoleValue}
              subRoles={authorSubRoles}
              fallbackLabel={roleLabel}
              style={styles.authorRole}
            />
            {shareSubtitle ? (
              <Text style={styles.authorShareNote}>{shareSubtitle}</Text>
            ) : null}
            <Text style={styles.postTime}>{formatRelativeTime(item.createdAt)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleOpenOptions(item)} activeOpacity={0.7}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.mediumGray} />
          </TouchableOpacity>
        </View>

        {/* Post Content */}
        {isShare ? (
          <>
            {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}
            {renderSharedSection()}
          </>
        ) : (
          renderPrimaryContent()
        )}

        {/* Post Stats */}
        <View style={styles.postStats}>
          <Text style={styles.statsText}>{likesCount} likes</Text>
          <View style={styles.statsRight}>
            <Text style={styles.statsText}>{commentsCount} comments</Text>
            <Text style={styles.statsText}> ΓÇó {sharesCount} shares</Text>
          </View>
        </View>

        {/* Post Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleToggleLike(item)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={userHasLiked ? 'thumbs-up' : 'thumbs-up-outline'}
              size={22}
              color={userHasLiked ? colors.primary : colors.mediumGray}
            />
            <Text style={[styles.actionText, userHasLiked && styles.actionTextActive]}>Like</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('PostDetail', { post: item })}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={22} color={colors.mediumGray} />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSharePost(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="share-social-outline" size={22} color={colors.mediumGray} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const formatRelativeTime = (ts) => {
    if (!ts) return '';
    let date = null;
    if (ts?.seconds) {
      date = new Date(ts.seconds * 1000);
    } else if (ts instanceof Date) {
      date = ts;
    } else if (typeof ts === 'string' || typeof ts === 'number') {
      const parsed = new Date(ts);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
    if (!date || isNaN(date.getTime())) return '';
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

  const composeHeight = scrollY.interpolate({
    inputRange: [0, COMPOSE_CARD_HEIGHT],
    outputRange: [COMPOSE_CARD_HEIGHT, 0],
    extrapolate: 'clamp',
  });

  const composeOpacity = scrollY.interpolate({
    inputRange: [0, COMPOSE_CARD_HEIGHT * 0.5, COMPOSE_CARD_HEIGHT],
    outputRange: [1, 0.7, 0],
    extrapolate: 'clamp',
  });

  const composeTranslateY = scrollY.interpolate({
    inputRange: [0, COMPOSE_CARD_HEIGHT],
    outputRange: [0, -20],
    extrapolate: 'clamp',
  });

  const toggleMarginTop = user
    ? scrollY.interpolate({
        inputRange: [0, COMPOSE_CARD_HEIGHT],
        outputRange: [6, 0],
        extrapolate: 'clamp',
      })
    : 6;

  const renderHeader = () => {
    const ToggleWrapper = user ? Animated.View : View;
    return (
      <View style={styles.toggleHeader}>
        <ToggleWrapper
          style={[
            styles.feedToggle,
            { marginTop: user ? toggleMarginTop : 6 },
          ]}
        >
        <TouchableOpacity
          style={[styles.feedToggleButton, feedFilter === 'all' && styles.feedToggleButtonActive]}
          onPress={() => setFeedFilter('all')}
          activeOpacity={0.8}
        >
          <Text style={[styles.feedToggleText, feedFilter === 'all' && styles.feedToggleTextActive]}>Community feed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.feedToggleButton,
            feedFilter === 'mine' && styles.feedToggleButtonActive,
            !user && styles.feedToggleButtonDisabled,
          ]}
          onPress={() => user && setFeedFilter('mine')}
          activeOpacity={user ? 0.8 : 1}
        >
          <Text
            style={[
              styles.feedToggleText,
              feedFilter === 'mine' && styles.feedToggleTextActive,
              !user && styles.feedToggleTextDisabled,
            ]}
          >
            {user ? 'My feed' : 'Log in for my feed'}
          </Text>
        </TouchableOpacity>
        </ToggleWrapper>

        {feedFilter === 'mine' && !user && (
          <Text style={styles.feedToggleTip}>Sign in to see posts you've shared.</Text>
        )}

        {/* Username search removed from Home. */}
      </View>
    );
  };

  const renderShareComposerModal = () => (
    <Modal
      animationType="slide"
      transparent
      visible={shareComposerVisible}
      onRequestClose={handleCancelShareToFeed}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.shareModalWrapper}
      >
        <TouchableOpacity
          style={styles.shareModalBackdrop}
          activeOpacity={1}
          onPress={handleCancelShareToFeed}
        />
        <View style={styles.shareModalCard}>
          <Text style={styles.shareModalTitle}>Share to your feed</Text>
          <Text style={styles.shareModalSubtitle}>
            Add a short note (optional) before reposting.
          </Text>
          {shareComposerPost ? (
            <View style={styles.sharePreviewCard}>
              <Text style={styles.sharePreviewAuthor}>
                {shareComposerPost.userName || shareComposerPost.userEmail || 'User'}
              </Text>
              <Text style={styles.sharePreviewContent} numberOfLines={2}>
                {shareComposerPost.content || 'Shared post'}
              </Text>
            </View>
          ) : null}
          <TextInput
            style={styles.shareModalInput}
            placeholder="Say something about this..."
            placeholderTextColor={colors.textLight}
            value={shareComposerNote}
            onChangeText={setShareComposerNote}
            multiline
          />
          <View style={styles.shareModalActions}>
            <TouchableOpacity
              style={[styles.shareModalButton, styles.shareModalCancel]}
              onPress={handleCancelShareToFeed}
              disabled={shareSaving}
            >
              <Text style={styles.shareModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.shareModalButton, styles.shareModalConfirm, shareSaving && styles.shareModalButtonDisabled]}
              onPress={handleConfirmShareToFeed}
              disabled={shareSaving}
            >
              <Text style={styles.shareModalConfirmText}>
                {shareSaving ? 'SharingΓÇª' : 'Share'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderPostOptionsModal = () => {
    if (!optionsVisible || !optionsPost) return null;
    const isOwn = user?.uid === optionsPost.userId;
    const followingStatus = authorFollowState?.status || null;
    return (
      <Modal transparent animationType="fade" visible={optionsVisible} onRequestClose={closeOptions}>
        <View style={styles.optionsOverlay}>
          <View style={styles.optionsCard}>
            <Text style={styles.optionsTitle}>Post options</Text>
            <View style={styles.optionsList}>
              {isOwn ? (
                <>
                  <TouchableOpacity style={styles.optionRow} onPress={handleCopyText} activeOpacity={0.85}>
                    <Ionicons name="copy" size={20} color={colors.primary} style={styles.optionIcon} />
                    <Text style={styles.optionLabel}>Copy text</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionRow} onPress={handleShareLinkFromOptions} activeOpacity={0.85}>
                    <Ionicons name="share-social-outline" size={20} color={colors.primary} style={styles.optionIcon} />
                    <Text style={styles.optionLabel}>Share link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionRow} onPress={handleSavePost} activeOpacity={0.85}>
                    <Ionicons name="bookmark-outline" size={20} color={colors.primary} style={styles.optionIcon} />
                    <Text style={styles.optionLabel}>Save post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionRow} onPress={handleDeletePost} activeOpacity={0.85}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} style={styles.optionIcon} />
                    <Text style={[styles.optionLabel, { color: colors.danger }]}>Delete post</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {followingStatus === FOLLOW_STATUS.ACCEPTED ? (
                    <TouchableOpacity style={styles.optionRow} onPress={handleUnfollowAuthor} activeOpacity={0.85}>
                      <Ionicons name="person-remove" size={20} color={colors.danger} style={styles.optionIcon} />
                      <Text style={[styles.optionLabel, { color: colors.danger }]}>Unfollow author</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.optionRow} onPress={handleFollowAuthor} activeOpacity={0.85}>
                      <Ionicons name="person-add" size={20} color={colors.primary} style={styles.optionIcon} />
                      <Text style={styles.optionLabel}>{followingStatus === FOLLOW_STATUS.PENDING ? 'Request pending' : 'Follow author'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.optionRow} onPress={() => openUserProfile(optionsPost.userId, { name: optionsPost.userName, avatar: optionsPost.userPhotoURL })} activeOpacity={0.85}>
                    <Ionicons name="person-circle-outline" size={20} color={colors.primary} style={styles.optionIcon} />
                    <Text style={styles.optionLabel}>View profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionRow} onPress={handleSavePost} activeOpacity={0.85}>
                    <Ionicons name="bookmark-outline" size={20} color={colors.primary} style={styles.optionIcon} />
                    <Text style={styles.optionLabel}>Save post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionRow} onPress={handleShareLinkFromOptions} activeOpacity={0.85}>
                    <Ionicons name="share-social-outline" size={20} color={colors.primary} style={styles.optionIcon} />
                    <Text style={styles.optionLabel}>Share link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionRow} onPress={handleCopyText} activeOpacity={0.85}>
                    <Ionicons name="copy" size={20} color={colors.primary} style={styles.optionIcon} />
                    <Text style={styles.optionLabel}>Copy text</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionRow} onPress={handleHidePost} activeOpacity={0.85}>
                    <Ionicons name="eye-off-outline" size={20} color={colors.mediumGray} style={styles.optionIcon} />
                    <Text style={styles.optionLabel}>Hide post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionRow} onPress={handleReportPost} activeOpacity={0.85}>
                    <Ionicons name="flag-outline" size={20} color={colors.danger} style={styles.optionIcon} />
                    <Text style={[styles.optionLabel, { color: colors.danger }]}>Report post</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.optionRow} onPress={closeOptions} activeOpacity={0.85}>
                <Ionicons name="close-circle-outline" size={20} color={colors.textLight} style={styles.optionIcon} />
                <Text style={styles.optionLabel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <>
    <SafeAreaView style={styles.container} edges={['top']}>
      {user && (
        <Animated.View style={[styles.composeWrapper, { height: composeHeight }]}
        >
          <Animated.View
            style={{
              flex: 1,
              opacity: composeOpacity,
              transform: [{ translateY: composeTranslateY }],
            }}
          >
            <TouchableOpacity 
              style={styles.createPostButton}
              onPress={() => navigation.navigate('CreatePost')}
              activeOpacity={0.9}
            >
              <Image
                source={user.profileImageURL ? { uri: user.profileImageURL } : DEFAULT_AVATAR}
                style={styles.smallAvatar}
              />
              <Text style={styles.createPostText}>Share your thoughts...</Text>
              <Ionicons name="images-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      <Animated.FlatList
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        ListEmptyComponent={loading ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textLight }}>Loading posts...</Text>
          </View>
        ) : (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textLight, textAlign: 'center' }}>
              {feedFilter === 'mine'
                ? (user
                    ? "You haven't shared anything yet. Tap 'Share your thoughts...' to start."
                    : 'Log in to view your personal feed.')
                : 'No posts yet. Be the first to post!'}
            </Text>
          </View>
        )}
        ListHeaderComponent={renderHeader}
      />
    </SafeAreaView>
    {renderShareComposerModal()}
    {renderPostOptionsModal()}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: 120,
  },
  composeWrapper: {
    overflow: 'hidden',
    marginBottom: 0,
    backgroundColor: colors.background,
    paddingTop: 0,
    paddingBottom: 0,
    zIndex: 30,
  },
  toggleHeader: {
    backgroundColor: colors.background,
    paddingBottom: 6,
    paddingTop: 0,
    zIndex: 20,
    elevation: 3,
  },
  createPostButton: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginHorizontal: 15,
    marginTop: 0,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  createPostText: {
    flex: 1,
    fontSize: 16,
    color: colors.textLight,
  },
  feedToggle: {
    marginHorizontal: 15,
    backgroundColor: colors.white,
    borderRadius: 12,
    flexDirection: 'row',
    padding: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  feedToggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  feedToggleButtonActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  feedToggleButtonDisabled: {
    opacity: 0.6,
  },
  feedToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  feedToggleTextActive: {
    color: colors.primary,
  },
  feedToggleTextDisabled: {
    color: colors.mediumGray,
  },
  feedToggleTip: {
    marginTop: 6,
    marginHorizontal: 18,
    color: colors.mediumGray,
    fontSize: 13,
    textAlign: 'center',
  },
  usernameSearchCard: {
    marginHorizontal: 15,
    marginTop: 14,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  usernameSearchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  usernameSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  usernameSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
  },
  usernameSearchButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  usernameSearchButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  usernameSearchFeedback: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textLight,
  },
  usernameSearchFeedbackError: {
    color: colors.danger,
  },
  usernameResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  usernameResultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  usernameResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  usernameResultHandle: {
    fontSize: 13,
    color: colors.primary,
    marginVertical: 2,
  },
  usernameResultBio: {
    fontSize: 12,
    color: colors.textLight,
  },
  postCard: {
    backgroundColor: colors.white,
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 12,
    padding: 15,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  authorRole: {
    marginTop: 2,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  authorShareNote: {
    fontSize: 12,
    color: colors.mediumGray,
    marginBottom: 2,
  },
  postTime: {
    fontSize: 12,
    color: colors.mediumGray,
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    marginBottom: 12,
  },
  sharedPostCard: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.lightGray,
    marginBottom: 12,
  },
  sharedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sharedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  sharedMeta: {
    flex: 1,
  },
  sharedAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sharedTime: {
    fontSize: 12,
    color: colors.mediumGray,
    marginTop: 2,
  },
  sharedRole: {
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  sharedContent: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  sharedImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 4,
  },
  sharedUnavailable: {
    fontSize: 14,
    color: colors.mediumGray,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  statsRight: {
    flexDirection: 'row',
  },
  statsText: {
    fontSize: 13,
    color: colors.textLight,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
  },
  actionText: {
    fontSize: 14,
    color: colors.mediumGray,
    marginLeft: 6,
    fontWeight: '500',
  },
  actionTextActive: {
    color: colors.primary,
  },
  shareModalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  shareModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  shareModalCard: {
    backgroundColor: colors.white,
    padding: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 10,
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  shareModalSubtitle: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 12,
  },
  sharePreviewCard: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  sharePreviewAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  sharePreviewContent: {
    fontSize: 13,
    color: colors.textLight,
  },
  shareModalInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  shareModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  shareModalButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginLeft: 8,
  },
  shareModalCancel: {
    backgroundColor: colors.lightGray,
  },
  shareModalConfirm: {
    backgroundColor: colors.primary,
  },
  shareModalButtonDisabled: {
    opacity: 0.6,
  },
  shareModalCancelText: {
    color: colors.text,
    fontWeight: '600',
  },
  shareModalConfirmText: {
    color: colors.white,
    fontWeight: '600',
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  optionsCard: {
    backgroundColor: colors.white,
    padding: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 12,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  optionsList: {},
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  optionIcon: { marginRight: 14 },
  optionLabel: { fontSize: 15, color: colors.text, fontWeight: '500' },
});

export default HomeScreen;
