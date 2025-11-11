import React, { useState } from 'react';
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
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { db } from '../../firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

const PostDetailScreen = ({ route, navigation }) => {
  const { post } = route.params;
  const [comment, setComment] = useState('');
  const [liked, setLiked] = useState(false);
  const [shares, setShares] = useState(post.shares || 0);
  const [comments, setComments] = useState([
    {
      id: '1',
      author: 'Shopnil Karmakar',
      avatar: require('../../assets/shopnil-karmakar.jpg'),
      content: 'Great insights! Thanks for sharing.',
      time: '1h ago',
      likes: 5,
    },
    {
      id: '2',
      author: 'Mahim',
      avatar: require('../../assets/mahim.jpg'),
      content: 'I have been working on something similar. Would love to discuss!',
      time: '3h ago',
      likes: 3,
    },
  ]);

  const handleAddComment = () => {
    if (comment.trim()) {
      const newComment = {
        id: String(comments.length + 1),
        author: 'You',
        avatar: require('../../assets/shahriar-kabir.jpg'),
        content: comment,
        time: 'Just now',
        likes: 0,
      };
      setComments([...comments, newComment]);
      setComment('');
    }
  };

  const handleShare = async () => {
    try {
      let shareOptions = {
        message: post.content,
      };

      // If there's an image, share its URL as well.
      // On iOS, the URL can be passed directly. On Android, it's better to include it in the message.
      if (post.image) {
        if (Platform.OS === 'ios') {
          shareOptions.url = post.image;
        } else {
          shareOptions.message = `${post.content}\n\nImage: ${post.image}`;
        }
      }

      const result = await Share.share(shareOptions);

      if (result.action === Share.sharedAction) {
        setShares((prev) => prev + 1);
        if (post.id) {
          try {
            const ref = doc(db, 'posts', post.id);
            await updateDoc(ref, { shares: increment(1) });
          } catch (err) {
            console.log('Failed to update share count in Firestore:', err);
          }
        }
        if (result.activityType) {
          // Shared with activity type of result.activityType
          console.log('Post shared with activity type:', result.activityType);
        } else {
          // Shared
          console.log('Post shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        // Dismissed
        console.log('Share action was dismissed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share the post. Please try again.');
      console.error('Error sharing post:', error.message);
    }
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
            <Image source={post.avatar} style={styles.avatar} />
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{post.author}</Text>
              <Text style={styles.authorRole}>{post.role}</Text>
              <Text style={styles.postTime}>{post.time}</Text>
            </View>
            <TouchableOpacity>
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.mediumGray} />
            </TouchableOpacity>
          </View>

          {/* Post Content */}
          <View style={styles.contentSection}>
            <Text style={styles.postContent}>{post.content}</Text>
            {post.image && (
              <Image source={{ uri: post.image }} style={styles.postImage} />
            )}
          </View>

          {/* Post Stats */}
          <View style={styles.postStats}>
            <Text style={styles.statsText}>{liked ? post.likes + 1 : post.likes} likes</Text>
            <View style={styles.statsRight}>
              <Text style={styles.statsText}>{comments.length} comments</Text>
              <Text style={styles.statsText}> • {shares} shares</Text>
            </View>
          </View>

          {/* Post Actions */}
          <View style={styles.postActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setLiked(!liked)}
            >
              <Ionicons 
                name={liked ? "heart" : "heart-outline"} 
                size={24} 
                color={liked ? colors.danger : colors.mediumGray} 
              />
              <Text style={[styles.actionText, liked && styles.actionTextActive]}>Like</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chatbubble-outline" size={24} color={colors.mediumGray} />
              <Text style={styles.actionText}>Comment</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={24} color={colors.mediumGray} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>
            {comments.map((item) => (
              <View key={item.id} style={styles.commentCard}>
                <Image source={item.avatar} style={styles.commentAvatar} />
                <View style={styles.commentContent}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{item.author}</Text>
                    <Text style={styles.commentTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.commentText}>{item.content}</Text>
                  <View style={styles.commentActions}>
                    <TouchableOpacity style={styles.commentActionButton}>
                      <Ionicons name="heart-outline" size={16} color={colors.mediumGray} />
                      <Text style={styles.commentActionText}>{item.likes}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.commentActionButton}>
                      <Text style={styles.commentActionText}>Reply</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Add Comment Input */}
        <View style={styles.commentInputContainer}>
          <Image 
            source={require('../../assets/shahriar-kabir.jpg')} 
            style={styles.commentAvatar} 
          />
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            value={comment}
            onChangeText={setComment}
            placeholderTextColor={colors.textLight}
          />
          <TouchableOpacity 
            style={styles.sendButton}
            onPress={handleAddComment}
            disabled={!comment.trim()}
          >
            <Ionicons 
              name="send" 
              size={22} 
              color={comment.trim() ? colors.primary : colors.textLight} 
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
    color: colors.danger,
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
