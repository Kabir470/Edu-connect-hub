import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { db, storage } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { formatRoleLabels } from '../utils/roleUtils';

const DEFAULT_AVATAR = require('../../assets/shahriar-kabir.jpg');

const CreatePostScreen = ({ navigation }) => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null); // local uri
  const [imageType, setImageType] = useState(null); // mime type
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const displayName = user?.fullName?.trim() || user?.email?.split('@')[0] || 'Guest';
  const roleLabel = formatRoleLabels(user?.subRoles, user?.role || 'Public');
  const avatarSource = user?.profileImageURL ? { uri: user.profileImageURL } : DEFAULT_AVATAR;

  const handlePost = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Please write something to post');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'You must be logged in to post');
      return;
    }
    try {
      setSubmitting(true);
      let mediaUrl = null;
      if (image) {
        const response = await fetch(image);
        const blob = await response.blob();
        const ext = imageType?.includes('video') ? 'mp4' : 'jpg';
        const fileName = `${user.uid}_${Date.now()}.${ext}`;
        const storageRef = ref(storage, `posts/${fileName}`);
        await uploadBytes(storageRef, blob, { contentType: imageType || 'application/octet-stream' });
        mediaUrl = await getDownloadURL(storageRef);
      }

  const userName = user?.fullName?.trim() || user.email?.split('@')[0] || 'User';
      await addDoc(collection(db, 'posts'), {
        content: content.trim(),
        image: mediaUrl,
        userId: user.uid,
        userEmail: user.email,
        userName,
        role: user.role || null,
        subRoles: Array.isArray(user.subRoles) ? user.subRoles : [],
        userPhotoURL: user.profileImageURL || null,
  type: 'post',
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        likedBy: [],
        createdAt: serverTimestamp(),
      });
      setContent('');
      setImage(null);
      setImageType(null);
      Alert.alert('Success', 'Post published successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      console.error('Post create error', e);
      Alert.alert('Error', e.message || 'Failed to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddImage = async () => {
    // Ask permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your media library to attach images or videos.');
      return;
    }
    // Launch picker allowing images and videos
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setImage(asset.uri);
      setImageType(asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'));
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User Info */}
        <View style={styles.userInfo}>
          <Image 
            source={avatarSource}
            style={styles.avatar} 
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{displayName}</Text>
            <TouchableOpacity style={styles.visibilityButton}>
              <Ionicons name="globe-outline" size={16} color={colors.textLight} />
              <Text style={styles.visibilityText}>{roleLabel}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Input */}
        <TextInput
          style={styles.contentInput}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.textLight}
          value={content}
          onChangeText={setContent}
          multiline
          autoFocus
        />

        {/* Image Preview */}
        {image && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: image }} style={styles.previewImage} />
            <TouchableOpacity 
              style={styles.removeImageButton}
              onPress={() => setImage(null)}
            >
              <Ionicons name="close-circle" size={30} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* Add Options */}
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>Add to your post</Text>
          
          <TouchableOpacity style={styles.optionButton} onPress={handleAddImage}>
            <View style={[styles.optionIcon, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="images" size={24} color={colors.success} />
            </View>
            <Text style={styles.optionText}>Photo/Video</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton}>
            <View style={[styles.optionIcon, { backgroundColor: colors.info + '20' }]}>
              <Ionicons name="location" size={24} color={colors.info} />
            </View>
            <Text style={styles.optionText}>Location</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton}>
            <View style={[styles.optionIcon, { backgroundColor: colors.warning + '20' }]}>
              <Ionicons name="pricetag" size={24} color={colors.warning} />
            </View>
            <Text style={styles.optionText}>Tag People</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton}>
            <View style={[styles.optionIcon, { backgroundColor: colors.accent + '20' }]}>
              <Ionicons name="happy" size={24} color={colors.accent} />
            </View>
            <Text style={styles.optionText}>Feeling/Activity</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Post Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={[
            styles.postButton, 
            (!content.trim() || submitting) && styles.postButtonDisabled
          ]}
          onPress={handlePost}
          disabled={!content.trim() || submitting}
        >
          <Text style={styles.postButtonText}>{submitting ? 'Posting...' : 'Post'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  userInfo: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  visibilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  visibilityText: {
    fontSize: 13,
    color: colors.textLight,
    marginHorizontal: 4,
  },
  contentInput: {
    padding: 15,
    fontSize: 16,
    color: colors.text,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  imagePreview: {
    margin: 15,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 250,
  },
  removeImageButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  optionsContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 15,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  bottomBar: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  postButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: colors.lightGray,
  },
  postButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreatePostScreen;
