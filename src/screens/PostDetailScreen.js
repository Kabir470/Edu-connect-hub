import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { db } from '../../firebase';
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  increment,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { createNotificationEntry } from '../utils/notificationService';

const PostDetailScreen = ({ route }) => {
  const { post } = route.params;
  const { user } = useAuth();
  const [commentInput, setCommentInput] = useState('');
  const [postData, setPostData] = useState(post);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);

  const postRef = useMemo(() => doc(db, 'posts', post.id), [post.id]);

  useEffect(() => {
    const unsubscribe = onSnapshot(postRef, (snapshot) => {
      if (snapshot.exists()) {
        setPostData({ id: snapshot.id, ...snapshot.data() });
      }
    });
    return unsubscribe;
  }, [postRef]);

  useEffect(() => {
    const commentsRef = collection(postRef, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setComments(items);
      setLoadingComments(false);
    });
    return unsubscribe;
  }, [postRef]);

  const formatRelativeTime = (ts) => {
    if (!ts) return '';
    const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
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

  const likesCount = postData?.likesCount ?? 0;
  const sharesCount = postData?.sharesCount ?? 0;
  const commentsCount = postData?.commentsCount ?? comments.length;
  const userHasLiked = !!(user?.uid && Array.isArray(postData?.likedBy) && postData.likedBy.includes(user.uid));

  const handleToggleLike = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Log in to like posts.');
      return;
    }
    try {
      await updateDoc(postRef, {
        likedBy: userHasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
        likesCount: increment(userHasLiked ? -1 : 1),
      });
      if (!userHasLiked) {
        await createNotificationEntry({
          type: 'like',
          targetUserId: postData?.userId,
          actor: user,
          post: postData,
          meta: { message: 'liked your post' },
        });
      }
    } catch (error) {
      console.error('Failed to like post', error);
      Alert.alert('Error', 'Unable to update like right now.');
    }
  };

  const handleSharePost = async () => {
    try {
      const message = `${postData?.userName || 'Someone'} on AcademicConnect:\n\n${postData?.content || ''}`;
      const result = await Share.share({ message });
      if (result.action === Share.sharedAction) {
        await updateDoc(postRef, { sharesCount: increment(1) });
      }
    } catch (error) {
      console.error('Failed to share post', error);
      Alert.alert('Error', 'Unable to share the post right now.');
    }
  };

  const handleAddComment = async () => {
  const trimmedComment = commentInput.trim();
  if (!trimmedComment) return;
    if (!user) {
      Alert.alert('Sign in required', 'Log in to comment on posts.');
      return;
    }
    try {
      setSubmittingComment(true);
      const authorName = user.fullName || user.email || 'You';
      await addDoc(collection(postRef, 'comments'), {
        content: trimmedComment,
        userId: user.uid,
        userName: authorName,
        userPhotoURL: user.profileImageURL || null,
        createdAt: serverTimestamp(),
      });
      await updateDoc(postRef, { commentsCount: increment(1) });
      await createNotificationEntry({
        type: 'comment',
        targetUserId: postData?.userId,
        actor: user,
        post: postData,
        meta: {
          message: 'commented on your post',
          previewText: trimmedComment,
        },
      });
      setCommentInput('');
    } catch (error) {
      console.error('Failed to add comment', error);
      Alert.alert('Error', 'Unable to add your comment right now.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const renderPostTime = () => {
    if (postData?.createdAt) return formatRelativeTime(postData.createdAt);
    if (postData?.time) return postData.time;
    return '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Post Header */}
          <View style={styles.postHeader}>
            <Image 
              source={postData?.userPhotoURL ? { uri: postData.userPhotoURL } : require('../../assets/shahriar-kabir.jpg')} 
              style={styles.avatar} 
            />
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{postData?.userName || postData?.userEmail || 'User'}</Text>
              <Text style={styles.authorRole}>{postData?.role || ''}</Text>
              <Text style={styles.postTime}>{renderPostTime()}</Text>
            </View>
            <TouchableOpacity>
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.mediumGray} />
            </TouchableOpacity>
          </View>

          {/* Post Content */}
          <View style={styles.contentSection}>
            <Text style={styles.postContent}>{postData?.content}</Text>
            {postData?.image && (
              <Image source={{ uri: postData.image }} style={styles.postImage} />
            )}
          </View>

          {/* Post Stats */}
          <View style={styles.postStats}>
            <Text style={styles.statsText}>{likesCount} likes</Text>
            <View style={styles.statsRight}>
              <Text style={styles.statsText}>{commentsCount} comments</Text>
              <Text style={styles.statsText}> • {sharesCount} shares</Text>
            </View>
          </View>

          {/* Post Actions */}
          <View style={styles.postActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleToggleLike}
            >
              <Ionicons 
                name={userHasLiked ? 'thumbs-up' : 'thumbs-up-outline'} 
                size={24} 
                color={userHasLiked ? colors.primary : colors.mediumGray} 
              />
              <Text style={[styles.actionText, userHasLiked && styles.actionTextActive]}>Like</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chatbubble-outline" size={24} color={colors.mediumGray} />
              <Text style={styles.actionText}>Comment</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleSharePost}>
              <Ionicons name="share-social-outline" size={24} color={colors.mediumGray} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsTitle}>Comments ({commentsCount})</Text>
            {loadingComments ? (
              <Text style={{ color: colors.textLight }}>Loading comments...</Text>
            ) : comments.length === 0 ? (
              <Text style={{ color: colors.textLight }}>No comments yet. Be the first!</Text>
            ) : (
              comments.map((item) => (
                <View key={item.id} style={styles.commentCard}>
                  <Image 
                    source={item.userPhotoURL ? { uri: item.userPhotoURL } : require('../../assets/shahriar-kabir.jpg')} 
                    style={styles.commentAvatar} 
                  />
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{item.userName || 'Anonymous'}</Text>
                      <Text style={styles.commentTime}>{formatRelativeTime(item.createdAt)}</Text>
                    </View>
                    <Text style={styles.commentText}>{item.content}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Add Comment Input */}
        <View style={styles.commentInputContainer}>
          <Image 
            source={user?.profileImageURL ? { uri: user.profileImageURL } : require('../../assets/shahriar-kabir.jpg')} 
            style={styles.commentAvatar} 
          />
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            value={commentInput}
            onChangeText={setCommentInput}
            placeholderTextColor={colors.textLight}
          />
          <TouchableOpacity 
            style={styles.sendButton}
            onPress={handleAddComment}
            disabled={!commentInput.trim() || submittingComment}
          >
            <Ionicons 
              name="send" 
              size={22} 
              color={commentInput.trim() ? colors.primary : colors.textLight} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 15,
    marginBottom: 2,
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
    fontSize: 13,
    color: colors.textLight,
    marginBottom: 2,
  },
  postTime: {
    fontSize: 12,
    color: colors.mediumGray,
  },
  contentSection: {
    backgroundColor: colors.white,
    padding: 15,
    marginBottom: 2,
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 15,
  },
  postImage: {
    width: '100%',
    height: 250,
    borderRadius: 10,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 15,
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
    backgroundColor: colors.white,
    paddingVertical: 12,
    marginBottom: 10,
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
  commentsSection: {
    backgroundColor: colors.white,
    padding: 15,
    marginBottom: 80,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 15,
  },
  commentCard: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    padding: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  commentTime: {
    fontSize: 12,
    color: colors.mediumGray,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  commentActionText: {
    fontSize: 12,
    color: colors.mediumGray,
    marginLeft: 4,
    fontWeight: '500',
  },
  commentInputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.lightGray,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginHorizontal: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PostDetailScreen;
