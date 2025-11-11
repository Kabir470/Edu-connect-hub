import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { db } from '../../firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPosts(items);
      setLoading(false);
    }, (e) => {
      console.error('Feed subscribe error', e);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const [likedPosts, setLikedPosts] = useState({});

  const handleLike = (postId) => {
    setLikedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
    
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          likes: likedPosts[postId] ? post.likes - 1 : post.likes + 1
        };
      }
      return post;
    }));
  };

  const renderPost = ({ item }) => (
    <TouchableOpacity 
      style={styles.postCard}
      onPress={() => navigation.navigate('PostDetail', { post: item })}
      activeOpacity={0.9}
    >
      {/* Post Header */}
      <View style={styles.postHeader}>
        <Image source={item.userPhotoURL ? { uri: item.userPhotoURL } : require('../../assets/shahriar-kabir.jpg')} style={styles.avatar} />
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{item.userName || item.userEmail || 'User'}</Text>
          <Text style={styles.authorRole}>{item.role || ''}</Text>
          <Text style={styles.postTime}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={24} color={colors.mediumGray} />
      </View>

      {/* Post Content */}
      <Text style={styles.postContent}>{item.content}</Text>

      {/* Post Image */}
      {item.image && (
        <Image 
          source={typeof item.image === 'string' ? { uri: item.image } : item.image} 
          style={styles.postImage} 
        />
      )}

      {/* Post Actions (optional, minimal for now) */}
    </TouchableOpacity>
  );

  const formatRelativeTime = (ts) => {
    if (!ts || !ts.seconds) return '';
    const date = new Date(ts.seconds * 1000);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={loading ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textLight }}>Loading posts...</Text>
          </View>
        ) : (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textLight }}>No posts yet. Be the first to post!</Text>
          </View>
        )}
        ListHeaderComponent={() => (
          (user) ? (
            <TouchableOpacity 
              style={styles.createPostButton}
              onPress={() => navigation.navigate('CreatePost')}
            >
              <Image 
                source={user.profileImageURL ? { uri: user.profileImageURL } : require('../../assets/shahriar-kabir.jpg')} 
                style={styles.smallAvatar} 
              />
              <Text style={styles.createPostText}>Share your thoughts...</Text>
              <Ionicons name="images-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          ) : null
        )}
      />
    </SafeAreaView>
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
  createPostButton: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginHorizontal: 15,
    marginVertical: 10,
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
    fontSize: 13,
    color: colors.textLight,
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
    color: colors.danger,
  },
});

export default HomeScreen;
