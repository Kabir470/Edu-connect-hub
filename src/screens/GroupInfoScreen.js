import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import {
  addMembersToGroup,
  removeMemberFromGroup,
  leaveGroup,
  updateGroupName,
  toggleGroupMute,
  subscribeToConversationMeta,
  fetchUserProfile,
  setAdminStatus,
} from '../utils/chatService';
import { findPublicUserByUsername, normalizeUsername } from '../utils/usernameService';
import { db } from '../../firebase';
import { updateDoc, doc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { uploadChatAttachment } from '../utils/uploadService';

const DEFAULT_AVATAR = require('../../assets/shahriar-kabir.jpg');

const getAvatarSource = (avatar) => (avatar ? { uri: avatar } : DEFAULT_AVATAR);

export default function GroupInfoScreen({ route, navigation }) {
  const { conversationId } = route.params || {};
  const { user } = useAuth();
  const [meta, setMeta] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [usernameToAdd, setUsernameToAdd] = useState('');
  const [memberProfiles, setMemberProfiles] = useState({});
  const isAdmin = useMemo(
    () => !!(meta?.admins || []).includes(user?.uid),
    [meta?.admins, user?.uid]
  );

  useEffect(() => {
    if (!conversationId) return;
    const unsub = subscribeToConversationMeta(
      conversationId,
      (snap) => {
        const data = snap.data();
        if (data?.type !== 'group') return;
        setMeta({ id: snap.id, ...data });
        setNameDraft(data.name || '');
      },
      (e) => console.warn('Group meta error', e)
    );
    return unsub;
  }, [conversationId]);

  useEffect(() => {
    const ids = meta?.participants || [];
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      const next = {};
      for (const uid of ids) {
        try {
          const profile = await fetchUserProfile(uid);
          if (profile) next[uid] = profile;
        } catch (_) {}
      }
      if (!cancelled) setMemberProfiles(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [meta?.participants]);

  const handleRename = async () => {
    if (!isAdmin) return;
    try {
      await updateGroupName({ conversationId, adminId: user.uid, name: nameDraft.trim() });
      Alert.alert('Updated', 'Group name changed.');
    } catch (e) {
      Alert.alert('Rename failed', e?.message || 'Could not rename');
    }
  };

  const handleChangeAvatar = async () => {
    if (!isAdmin) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const uploaded = await uploadChatAttachment({ uri: asset.uri, conversationId, filename: `group-${conversationId}.jpg`, mimeType: 'image/jpeg' });
      await updateDoc(doc(db, 'conversations', conversationId), { avatar: uploaded.downloadURL });
      Alert.alert('Updated', 'Group avatar changed.');
    } catch (e) {
      console.warn('Avatar change failed', e);
      Alert.alert('Avatar change failed', 'Unable to update group avatar.');
    }
  };

  const handleAddMember = async () => {
    const uname = normalizeUsername((usernameToAdd || '').trim());
    if (!uname) return;
    try {
      const profile = await findPublicUserByUsername(uname);
      if (!profile) {
        Alert.alert('Not found', 'No user found with that username.');
        return;
      }
      await addMembersToGroup({ conversationId, adminId: user.uid, memberIds: [profile.id], fetchProfile: fetchUserProfile });
      setUsernameToAdd('');
    } catch (e) {
      Alert.alert('Add failed', e?.message || 'Could not add member');
    }
  };

  const handleRemove = async (memberId) => {
    try {
      await removeMemberFromGroup({ conversationId, requesterId: user.uid, memberId });
    } catch (e) {
      Alert.alert('Remove failed', e?.message || 'Could not remove member');
    }
  };

  const handleLeave = async () => {
    try {
      await leaveGroup({ conversationId, userId: user.uid });
      Alert.alert('Left group', 'You have left the group.');
      navigation.replace('MessagesList');
    } catch (e) {
      Alert.alert('Leave failed', e?.message || 'Could not leave');
    }
  };

  const handleMuteToggle = async () => {
    try {
      const muted = !!meta?.muted?.[user?.uid];
      await toggleGroupMute({ conversationId, userId: user.uid, muted: !muted });
    } catch (e) {
      console.warn('Mute toggle failed', e);
    }
  };

  const members = useMemo(() => meta?.participants || [], [meta?.participants]);

  const renderMember = ({ item: uid }) => {
    const details = meta?.participantDetails?.[uid];
    const profile = memberProfiles[uid];
    const isMemberAdmin = (meta?.admins || []).includes(uid);
    const name = profile?.fullName || details?.name || 'Member';
    const avatar = profile?.profileImageURL || details?.avatar || null;
    const canRemove = isAdmin && uid !== user?.uid;
    const canToggleAdmin = isAdmin && uid !== user?.uid;
    return (
      <View style={styles.memberRow}>
        <Image source={getAvatarSource(avatar)} style={styles.memberAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName}>{name}</Text>
          {isMemberAdmin && <Text style={styles.adminBadge}>Admin</Text>}
        </View>
        {canToggleAdmin && (
          <TouchableOpacity style={styles.memberAdmin} onPress={() =>
            setAdminStatus({ conversationId, requesterId: user.uid, memberId: uid, make: !isMemberAdmin })
              .catch((e) => Alert.alert('Update failed', e?.message || 'Could not change role'))
          }>
            <Ionicons name={isMemberAdmin ? 'shield-outline' : 'shield-half-outline'} size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
        {canRemove && (
          <TouchableOpacity style={styles.memberRemove} onPress={() => handleRemove(uid)}>
            <Ionicons name="remove-circle" size={22} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!meta) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.loadingText}>Loading group…</Text>
      </SafeAreaView>
    );
  }

  const muted = !!meta?.muted?.[user?.uid];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerCard}>
        <TouchableOpacity onPress={isAdmin ? handleChangeAvatar : undefined} activeOpacity={isAdmin ? 0.7 : 1}>
          <Image source={getAvatarSource(meta.avatar)} style={styles.groupAvatar} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TextInput
            style={styles.nameInput}
            value={nameDraft}
            onChangeText={setNameDraft}
            editable={isAdmin}
          />
          {isAdmin && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleRename}>
              <Text style={styles.primaryText}>Save name</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.muteButton} onPress={handleMuteToggle}>
          <Ionicons name={muted ? 'notifications-off' : 'notifications'} size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {isAdmin && (
        <View style={styles.addCard}>
          <Text style={styles.sectionTitle}>Add member</Text>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter username"
              value={usernameToAdd}
              onChangeText={setUsernameToAdd}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleAddMember}>
              <Text style={styles.primaryText}>Add</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.note}>Tip: replace with username search later.</Text>
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginHorizontal: 16 }]}>Members ({members.length})</Text>
      <FlatList
        data={members}
        keyExtractor={(uid) => uid}
        renderItem={renderMember}
        contentContainerStyle={{ padding: 16 }}
      />

      <TouchableOpacity style={[styles.leaveButton]} onPress={handleLeave}>
        <Text style={styles.leaveText}>Leave group</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { color: colors.textLight },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    margin: 16,
    padding: 12,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupAvatar: { width: 60, height: 60, borderRadius: 30, marginRight: 12 },
  nameInput: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  primaryButton: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '700' },
  muteButton: { marginLeft: 8 },
  addCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
    marginRight: 8,
  },
  note: { color: colors.textLight, fontSize: 12, marginTop: 6 },
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: 10, borderRadius: 10, marginBottom: 8 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  memberName: { flex: 1, fontSize: 15, color: colors.text },
  memberRemove: { padding: 6 },
  leaveButton: { backgroundColor: colors.danger, margin: 16, borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  leaveText: { color: colors.white, fontWeight: '700' },
});
