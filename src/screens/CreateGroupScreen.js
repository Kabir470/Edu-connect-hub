import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { createGroupConversation } from '../utils/chatService';
import { findPublicUserByUsername, normalizeUsername, validateUsername } from '../utils/usernameService';

const DEFAULT_AVATAR = require('../../assets/shahriar-kabir.jpg');

const getAvatarSource = (avatar) => {
  if (!avatar) return DEFAULT_AVATAR;
  if (typeof avatar === 'number') return avatar;
  return { uri: avatar };
};

const MIN_GROUP_NAME = 3;

export default function CreateGroupScreen({ navigation }) {
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [selected, setSelected] = useState([]); // {uid, name, avatar}
  const [creating, setCreating] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState('');

  const canCreate = useMemo(() => {
    return groupName.trim().length >= MIN_GROUP_NAME && selected.length >= 2 && !creating;
  }, [groupName, selected.length, creating]);

  const addMemberByUsername = async () => {
    const raw = usernameInput.trim();
    const v = validateUsername(raw);
    if (!v.ok) {
      setSearchFeedback(v.message);
      return;
    }
    try {
      const profile = await findPublicUserByUsername(raw);
      if (!profile) {
        setSearchFeedback('No user found with that username.');
        return;
      }
      if (profile.id === user?.uid) {
        setSearchFeedback("You're already in the group as creator.");
        return;
      }
      if (selected.find((m) => m.uid === profile.id)) {
        setSearchFeedback('Already added.');
        return;
      }
      setSelected((prev) => [
        ...prev,
        { uid: profile.id, name: profile.fullName || profile.email || profile.username || normalizeUsername(raw), avatar: profile.profileImageURL || null },
      ]);
      setUsernameInput('');
      setSearchFeedback('Added');
      setTimeout(() => setSearchFeedback(''), 800);
    } catch (e) {
      console.warn('Username lookup failed', e);
      setSearchFeedback('Error looking up username.');
    }
  };

  const removeMember = (uid) => setSelected((prev) => prev.filter((m) => m.uid !== uid));

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const members = selected.map((m) => m.uid);
      const conversation = await createGroupConversation({ creator: user, members, name: groupName.trim() });
      Alert.alert('Group created', 'Your group is ready to chat.');
      navigation.replace('Chat', { conversationId: conversation.id, name: conversation.name, avatar: conversation.avatar });
    } catch (e) {
      console.warn('Create group failed', e);
      Alert.alert('Could not create group', e?.message || 'Try again later.');
    } finally {
      setCreating(false);
    }
  };

  const renderMember = ({ item }) => (
    <View style={styles.memberChip}>
      <Image source={getAvatarSource(item.avatar)} style={styles.memberAvatar} />
      <Text style={styles.memberName} numberOfLines={1}>{item.name}</Text>
      <TouchableOpacity onPress={() => removeMember(item.uid)} style={styles.memberRemove}>
        <Ionicons name="close" size={14} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.card}>
          <Text style={styles.title}>Start a new group</Text>
          <Text style={styles.subtitle}>Pick a name and add at least 2 people.</Text>

          <Text style={styles.label}>Group name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. aaa group"
            value={groupName}
            onChangeText={setGroupName}
            maxLength={60}
          />

          <Text style={styles.label}>Add members by username</Text>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="username"
              value={usernameInput}
              onChangeText={setUsernameInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.addButton} onPress={addMemberByUsername}>
              <Ionicons name="person-add" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>
          {!!searchFeedback && <Text style={styles.feedback}>{searchFeedback}</Text>}

          <FlatList
            data={selected}
            keyExtractor={(item) => item.uid}
            renderItem={renderMember}
            horizontal
            contentContainerStyle={{ paddingVertical: 8 }}
            ListEmptyComponent={<Text style={styles.emptyText}>No members added yet.</Text>}
            showsHorizontalScrollIndicator={false}
          />

          <TouchableOpacity
            style={[styles.createButton, canCreate ? styles.createButtonActive : null]}
            onPress={handleCreate}
            disabled={!canCreate}
          >
            <Text style={styles.createText}>{creating ? 'Creating…' : 'Create group'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.white,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textLight, marginTop: 4, marginBottom: 12 },
  label: { fontSize: 13, color: colors.text, marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
    marginBottom: 12,
  },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  addButton: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  feedback: { fontSize: 12, color: colors.textLight, marginBottom: 8 },
  emptyText: { fontSize: 12, color: colors.textLight },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  memberAvatar: { width: 22, height: 22, borderRadius: 11, marginRight: 6 },
  memberName: { color: colors.white, fontSize: 12, maxWidth: 160 },
  memberRemove: { marginLeft: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: 2 },
  createButton: {
    marginTop: 16,
    backgroundColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createButtonActive: { backgroundColor: colors.primary },
  createText: { color: colors.white, fontWeight: '700' },
});
