import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../../firebase';
import { collection, deleteDoc, doc, onSnapshot, query } from 'firebase/firestore';

const timestampToMillis = (ts) => {
  if (!ts) return 0;
  if (ts?.seconds) return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1_000_000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const SavedPostsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [savedPosts, setSavedPosts] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const savedRef = query(collection(db, 'users', user.uid, 'savedPosts'));
    const unsub = onSnapshot(savedRef, (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
      setSavedPosts(items);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleOpenPost = (item) => {
    if (!item.postSnapshot) {
      Alert.alert('Post unavailable', 'The original post may have been removed.');
      return;
    }
    navigation.navigate('Home', {
      screen: 'PostDetail',
      params: { post: { id: item.postSnapshot.id || item.postId, ...item.postSnapshot } },
    });
  };

  const handleUnsave = async (item) => {
    if (!user?.uid) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'savedPosts', item.id));
    } catch (error) {
      console.error('Failed to remove saved post', error);
      Alert.alert('Error', 'Unable to remove this post right now.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={savedPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleOpenPost(item)}>
            <Image
              source={item.postSnapshot?.image ? { uri: item.postSnapshot.image } : require('../../assets/shahriar-kabir.jpg')}
              style={styles.thumbnail}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>
                {item.postSnapshot?.content || 'Untitled post'}
              </Text>
              <Text style={styles.metaText}>
                Saved from {item.postSnapshot?.userName || 'Unknown author'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleUnsave(item)} style={styles.unsaveButton}>
              <Ionicons name="bookmark" size={20} color={colors.primary} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ionicons name="bookmark-outline" size={42} color={colors.mediumGray} />
            <Text style={styles.emptyTitle}>No saved posts yet</Text>
            <Text style={styles.emptySubtitle}>Save posts to revisit them later.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbnail: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  metaText: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  unsaveButton: { padding: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyTitle: { marginTop: 12, fontWeight: '600', color: colors.text },
  emptySubtitle: { color: colors.textLight },
});

export default SavedPostsScreen;
