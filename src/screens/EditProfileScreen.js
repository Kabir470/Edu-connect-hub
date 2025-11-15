import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { checkUsernameAvailable, normalizeUsername, validateUsername } from '../utils/usernameService';

const FALLBACK_AVATAR = require('../../assets/shahriar-kabir.jpg');

const EditProfileScreen = () => {
  const { user, signOut, refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    fullName: '',
    username: '',
    bio: '',
    institution: '',
    website: '',
    phone: '',
    location: '',
    profileImageURL: null,
  });
  const [usernameMessage, setUsernameMessage] = useState('Choose a unique handle so others can @mention you.');
  const [usernameTone, setUsernameTone] = useState('muted');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [initialUsername, setInitialUsername] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const normalizedUsername = data.username || '';
          setProfile((prev) => ({
            ...prev,
            fullName: data.fullName || '',
            username: normalizedUsername,
            bio: data.bio || '',
            institution: data.address || '',
            website: data.website || '',
            phone: data.phone || '',
            location: data.location || '',
            profileImageURL: data.profileImageURL || null,
          }));
          setInitialUsername(normalizeUsername(normalizedUsername || ''));
        }
      } catch (error) {
        console.warn('Failed to load profile data', error);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [user?.uid]);

  const updateUsernameHelper = (message, tone = 'muted') => {
    setUsernameMessage(message);
    setUsernameTone(tone);
  };

  const handleUsernameBlur = async () => {
    if (!profile.username?.trim()) {
      updateUsernameHelper('Username is required.', 'error');
      return;
    }
    const validation = validateUsername(profile.username);
    if (!validation.ok) {
      updateUsernameHelper(validation.message, 'error');
      return;
    }
    const normalized = validation.normalized;
    if (normalized === initialUsername) {
      updateUsernameHelper('This is your current username.', 'muted');
      return;
    }
    try {
      setCheckingUsername(true);
      const available = await checkUsernameAvailable(normalized, user?.uid);
      if (available) {
        updateUsernameHelper('Great choice! This username is available.', 'success');
      } else {
        updateUsernameHelper('That username is already in use.', 'error');
      }
    } catch (error) {
      console.warn('Username lookup failed', error);
      updateUsernameHelper('Unable to check availability right now.', 'error');
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleChangePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Enable photo permissions to update your avatar.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const fileRef = ref(storage, `users/${user.uid}/profile-${Date.now()}.jpg`);
      await uploadBytes(fileRef, blob, { contentType: asset.mimeType || 'image/jpeg' });
      const downloadURL = await getDownloadURL(fileRef);
      setProfile((prev) => ({ ...prev, profileImageURL: downloadURL }));
    } catch (error) {
      console.error('Avatar update failed', error);
      Alert.alert('Error', 'Unable to update your profile photo right now.');
    }
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    try {
      setSaving(true);
      const validation = validateUsername(profile.username);
      if (!validation.ok) {
        Alert.alert('Invalid username', validation.message);
        setSaving(false);
        return;
      }
      const normalizedUsername = validation.normalized;
      if (normalizedUsername !== initialUsername) {
        const available = await checkUsernameAvailable(normalizedUsername, user.uid);
        if (!available) {
          setSaving(false);
          Alert.alert('Username taken', 'Please pick another username.');
          updateUsernameHelper('That username is already in use.', 'error');
          return;
        }
      }
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: profile.fullName.trim(),
        username: normalizedUsername,
        usernameLower: normalizedUsername,
        bio: profile.bio.trim(),
        address: profile.institution.trim(),
        website: profile.website.trim(),
        phone: profile.phone.trim(),
        location: profile.location.trim(),
        profileImageURL: profile.profileImageURL || null,
        updatedAt: new Date().toISOString(),
      });
      await refreshUserProfile();
      setInitialUsername(normalizedUsername);
      updateUsernameHelper('Profile updated successfully.', 'success');
      Alert.alert('Profile updated', 'Your profile was saved successfully.');
    } catch (error) {
      console.error('Failed to save profile', error);
      Alert.alert('Error', 'Unable to update your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="sync" size={28} color={colors.primary} />
        <Text style={{ marginTop: 8, color: colors.textLight }}>Loading profile…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <Image
            source={profile.profileImageURL ? { uri: profile.profileImageURL } : FALLBACK_AVATAR}
            style={styles.avatar}
          />
          <TouchableOpacity style={styles.changePhotoButton} onPress={handleChangePhoto}>
            <Ionicons name="camera" size={20} color={colors.white} />
            <Text style={styles.changePhotoText}>Change photo</Text>
          </TouchableOpacity>
        </View>

        {[
          { label: 'Full Name', key: 'fullName', placeholder: 'Your full name' },
          { label: 'Username', key: 'username', placeholder: 'unique_handle', autoCapitalize: 'none', onBlur: handleUsernameBlur },
          { label: 'Institution / Workplace', key: 'institution', placeholder: 'Where you study or work' },
          { label: 'Location', key: 'location', placeholder: 'City, Country' },
          { label: 'Website / Portfolio', key: 'website', placeholder: 'https://example.com' },
          { label: 'Phone', key: 'phone', placeholder: '+1 555 0100' },
        ].map((field) => (
          <View key={field.key} style={styles.inputGroup}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              style={styles.input}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textLight}
              value={profile[field.key]}
              autoCapitalize={field.autoCapitalize}
              onBlur={field.onBlur}
              onChangeText={(text) => {
                if (field.key === 'username') {
                  updateUsernameHelper('Tap Save to lock in your handle.', 'muted');
                }
                setProfile((prev) => ({ ...prev, [field.key]: text }));
              }}
            />
            {field.key === 'username' && (
              <Text
                style={[
                  styles.usernameHelper,
                  usernameTone === 'error' && styles.usernameHelperError,
                  usernameTone === 'success' && styles.usernameHelperSuccess,
                ]}
              >
                {checkingUsername ? 'Checking availability…' : usernameMessage}
              </Text>
            )}
          </View>
        ))}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell people about yourself"
            placeholderTextColor={colors.textLight}
            multiline
            value={profile.bio}
            onChangeText={(text) => setProfile((prev) => ({ ...prev, bio: text }))}
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutLink} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: colors.primary },
  changePhotoButton: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  changePhotoText: { color: colors.white, fontWeight: '600', marginLeft: 8 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  textArea: { height: 110, textAlignVertical: 'top' },
  usernameHelper: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textLight,
  },
  usernameHelperError: {
    color: colors.danger,
  },
  usernameHelperSuccess: {
    color: colors.success,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  signOutLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  signOutText: { marginLeft: 6, color: colors.danger, fontWeight: '600' },
});

export default EditProfileScreen;
