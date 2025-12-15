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
import SUB_ROLE_OPTIONS, { MAX_SUB_ROLES } from '../constants/subRoleOptions';
import { sanitizeSubRoles, toggleSubRole, sentenceCase } from '../utils/roleUtils';
import * as Crypto from 'expo-crypto';

const FALLBACK_AVATAR = require('../../assets/shahriar-kabir.jpg');

const EditProfileScreen = () => {
  const { user, signOut, refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    fullName: '',
    username: '',
    bio: '',
    address: '',
    website: '',
    phone: '',
    location: '',
    profileImageURL: null,
    nidImageURL: null,
    subRoles: [],
  });
  const [nidNumber, setNidNumber] = useState('');
  const [usernameMessage, setUsernameMessage] = useState('Choose a unique handle so others can @mention you.');
  const [usernameTone, setUsernameTone] = useState('muted');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [initialUsername, setInitialUsername] = useState('');
  const primaryRole = user?.role || 'user';
  const primaryRoleLabel = sentenceCase(primaryRole || 'Member');
  const secondaryRoleLabel = MAX_SUB_ROLES > 1 ? 'roles' : 'role';

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const normalizedUsername = data.username || '';
          const sanitizedSecondary = sanitizeSubRoles(data.subRoles || [], primaryRole);
          setProfile((prev) => ({
            ...prev,
            fullName: data.fullName || '',
            username: normalizedUsername,
            bio: data.bio || '',
            address: data.address || '',
            website: data.website || '',
            phone: data.phone || '',
            location: data.location || '',
            profileImageURL: data.profileImageURL || null,
            nidImageURL: data.nidImageURL || null,
            subRoles: sanitizedSecondary,
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
  }, [user?.uid, primaryRole]);

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

  const handleChangeNidPhoto = async () => {
    if (!user?.uid) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Enable photo permissions to upload your NID image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const fileRef = ref(storage, `users/${user.uid}/nid-front-${Date.now()}.jpg`);
      await uploadBytes(fileRef, blob, { contentType: asset.mimeType || 'image/jpeg' });
      const downloadURL = await getDownloadURL(fileRef);
      setProfile((prev) => ({ ...prev, nidImageURL: downloadURL }));
    } catch (error) {
      console.error('NID upload failed', error);
      Alert.alert('Error', 'Unable to upload your NID image right now.');
    }
  };

  const handleToggleRole = (roleId) => {
    setProfile((prev) => {
      const next = toggleSubRole(roleId, prev.subRoles, primaryRole);
      if (next.length === prev.subRoles.length && !prev.subRoles.includes(roleId)) {
        Alert.alert('Limit reached', `You can pick only ${MAX_SUB_ROLES} secondary ${secondaryRoleLabel}.`);
      }
      return { ...prev, subRoles: next };
    });
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
      const sanitizedRoles = sanitizeSubRoles(profile.subRoles, primaryRole);
      const trimmedNid = nidNumber.trim();
      const nextNidHash = trimmedNid
        ? await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, trimmedNid)
        : null;
      const nextNidLast4 = trimmedNid ? trimmedNid.slice(-4) : null;
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: profile.fullName.trim(),
        username: normalizedUsername,
        usernameLower: normalizedUsername,
        bio: profile.bio.trim(),
        address: profile.address.trim(),
        website: profile.website.trim(),
        phone: profile.phone.trim(),
        location: profile.location.trim(),
        profileImageURL: profile.profileImageURL || null,
        nidImageURL: profile.nidImageURL || null,
        ...(trimmedNid ? { nidHash: nextNidHash, nidLast4: nextNidLast4 } : {}),
        subRoles: sanitizedRoles,
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
          { label: 'Address', key: 'address', placeholder: 'House, Road, City' },
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>NID Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your NID number"
            placeholderTextColor={colors.textLight}
            value={nidNumber}
            keyboardType="number-pad"
            onChangeText={setNidNumber}
          />
          <Text style={styles.primaryRoleHint}>For privacy, we store only a hash and last 4 digits.</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>NID Photo (front)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image
              source={profile.nidImageURL ? { uri: profile.nidImageURL } : FALLBACK_AVATAR}
              style={{ width: 88, height: 60, borderRadius: 10 }}
            />
            <TouchableOpacity style={styles.changePhotoButton} onPress={handleChangeNidPhoto}>
              <Ionicons name="image" size={20} color={colors.white} />
              <Text style={styles.changePhotoText}>Upload NID</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Primary role</Text>
          <View style={styles.fixedRolePill}>
            <Text style={styles.fixedRoleText}>{primaryRoleLabel}</Text>
          </View>
          <Text style={styles.primaryRoleHint}>Selected during sign up and managed by the admin team.</Text>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.rolesHeader}>
            <Text style={styles.label}>Secondary role</Text>
            <Text style={styles.roleCount}>{profile.subRoles.length}/{MAX_SUB_ROLES}</Text>
          </View>
          <Text style={styles.rolesHelper}>
            {MAX_SUB_ROLES === 1
              ? 'Pick one optional role to further describe what you do.'
              : `Pick up to ${MAX_SUB_ROLES} optional roles to further describe what you do.`}
          </Text>
          <View style={styles.rolesGrid}>
            {SUB_ROLE_OPTIONS.map((option) => {
              const selected = profile.subRoles.includes(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.rolePill, selected && styles.rolePillSelected]}
                  onPress={() => handleToggleRole(option.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.rolePillText, selected && styles.rolePillTextSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
  fixedRolePill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  fixedRoleText: {
    color: colors.white,
    fontWeight: '600',
  },
  primaryRoleHint: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textLight,
  },
  rolesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  roleCount: {
    fontSize: 12,
    color: colors.textLight,
  },
  rolesHelper: {
    fontSize: 13,
    color: colors.textLight,
    marginBottom: 8,
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rolePill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: colors.white,
  },
  rolePillSelected: {
    backgroundColor: colors.primary + '12',
    borderColor: colors.primary,
  },
  rolePillText: {
    color: colors.text,
    fontWeight: '500',
  },
  rolePillTextSelected: {
    color: colors.primary,
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
