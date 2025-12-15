import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  ensureConversation,
  finalizeCallSession,
  initiateCallSession,
  logCallMessage,
  markConversationRead,
  sendMessage,
  subscribeToConversationMeta,
  subscribeToMessages,
  subscribeToUserProfile,
  updateTypingStatus,
} from '../utils/chatService';
import { mergePrivacySettings } from '../constants/privacyDefaults';
import { uploadChatAttachment } from '../utils/uploadService';
import { Audio } from 'expo-av';
import SubRolePills from '../components/SubRolePills';
import { formatRoleLabels, sanitizeSubRoles } from '../utils/roleUtils';
import { ensureRestrictedAccessOrAlert } from '../utils/featureAccess';

const DEFAULT_AVATAR = require('../../assets/shahriar-kabir.jpg');

const formatMessageTime = (ts) => {
  if (!ts) return '';
  if (ts?.seconds) {
    const date = new Date(ts.seconds * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (ts instanceof Date) {
    return ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return ts;
};

const formatRelativeActivity = (ts) => {
  if (!ts) return null;
  let date = null;
  if (ts?.seconds) {
    date = new Date(ts.seconds * 1000);
  } else if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
    }
  }
  if (!date) return null;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

const getAvatarSource = (avatar) => {
  if (!avatar) return DEFAULT_AVATAR;
  if (typeof avatar === 'number') return avatar;
  return { uri: avatar };
};

const ChatScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const {
    conversationId: initialConversationId = null,
    userId: initialTargetId = null,
    name: initialName = 'AcademicConnect user',
    avatar: initialAvatar = null,
    privacySettings: initialPrivacySettings = null,
    role: initialRole = 'Member',
    subRoles: initialSubRoles = [],
  } = route.params || {};

  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [targetProfile, setTargetProfile] = useState({
    uid: initialTargetId,
    name: initialName,
    avatar: initialAvatar,
    privacySettings: mergePrivacySettings(initialPrivacySettings || {}),
    presenceStatus: 'offline',
    lastActiveAt: null,
    activityStatusHidden: false,
    role: initialRole,
    subRoles: sanitizeSubRoles(initialSubRoles, initialRole),
  });
  const [otherTyping, setOtherTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [callModalVisible, setCallModalVisible] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const callStartRef = useRef(null);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [recording, setRecording] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null); // { uri, durationMillis }
  const [playingId, setPlayingId] = useState(null);
  const soundRef = useRef(null);

  useEffect(() => {
    if (!targetProfile?.uid) return undefined;
    const unsubscribe = subscribeToUserProfile(
      targetProfile.uid,
      (profile) => {
        if (!profile) return;
        setTargetProfile((prev) => ({
          ...prev,
          uid: profile.uid,
          name: profile.fullName || prev.name || 'AcademicConnect user',
          avatar: profile.profileImageURL || prev.avatar || null,
          privacySettings: mergePrivacySettings(profile.privacySettings),
          presenceStatus: profile.presenceStatus || prev.presenceStatus || 'offline',
          lastActiveAt: profile.lastActiveAt || prev.lastActiveAt || null,
          activityStatusHidden:
            profile.activityStatusHidden ?? prev.activityStatusHidden ?? false,
          role: profile.role || prev.role || 'Member',
          subRoles: sanitizeSubRoles(profile.subRoles || prev.subRoles || [], profile.role || prev.role),
        }));
      },
      (error) => console.warn('Failed to stream user profile', error)
    );
    return unsubscribe;
  }, [targetProfile?.uid]);

  useEffect(() => {
    if (conversationId || !user?.uid || !targetProfile?.uid) return;
    const privacy = mergePrivacySettings(targetProfile.privacySettings);
    if (targetProfile.uid !== user.uid && !privacy.allowMessagesFromAll) {
      return;
    }
    ensureConversation(user, targetProfile)
      .then((conversation) => setConversationId(conversation.id))
      .catch((error) => console.warn('Conversation init failed', error));
  }, [conversationId, targetProfile?.uid, targetProfile?.privacySettings, user]);

  useEffect(() => {
    if (!conversationId) return;
    setLoadingMessages(true);
    const unsubscribe = subscribeToMessages(
      conversationId,
      (snapshot) => {
        const next = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setMessages(next);
        setLoadingMessages(false);
      },
      (error) => {
        console.warn('Messages stream error', error);
        setLoadingMessages(false);
      }
    );
    return unsubscribe;
  }, [conversationId]);

  const [isGroup, setIsGroup] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    const unsubscribe = subscribeToConversationMeta(
      conversationId,
      (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        if (data.type === 'group') {
          setIsGroup(true);
          setOtherTyping(false);
          setTargetProfile((prev) => ({
            ...prev,
            uid: null,
            name: data.name || 'Group',
            avatar: data.avatar || null,
            role: 'Group',
            subRoles: [],
          }));
          if ((data.unreadCounts?.[user?.uid] || 0) > 0) {
            markConversationRead(conversationId, user.uid).catch((error) => console.warn('Mark read failed', error));
          }
          return;
        }
        setIsGroup(false);
        const otherId = data.participants?.find((id) => id !== user?.uid);
        if (otherId) {
          setOtherTyping(Boolean(data.typing?.[otherId]));
          const details = data.participantDetails?.[otherId];
          if (details) {
            setTargetProfile((prev) => ({
              ...prev,
              uid: otherId,
              name: details.name || prev.name,
              avatar: details.avatar || prev.avatar,
              role: details.role || prev.role || 'Member',
              subRoles: sanitizeSubRoles(details.subRoles || prev.subRoles || [], details.role || prev.role),
            }));
          }
          if ((data.unreadCounts?.[user?.uid] || 0) > 0) {
            markConversationRead(conversationId, user.uid).catch((error) =>
              console.warn('Mark read failed', error)
            );
          }
        }
      },
      (error) => console.warn('Conversation meta error', error)
    );
    return unsubscribe;
  }, [conversationId, user?.uid]);

  useEffect(() => () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, []);

  const messagingAllowed = useMemo(() => {
    if (!targetProfile?.uid || targetProfile.uid === user?.uid) return true;
    const privacy = mergePrivacySettings(targetProfile.privacySettings);
    return privacy.allowMessagesFromAll;
  }, [targetProfile?.privacySettings, targetProfile?.uid, user?.uid]);

  const activityVisible =
    targetProfile?.privacySettings?.showActivityStatus !== false &&
    !targetProfile?.activityStatusHidden;
  const presenceStatus = targetProfile?.presenceStatus || 'offline';
  const headerRoleLabel = useMemo(
    () => formatRoleLabels(targetProfile?.subRoles, targetProfile?.role || 'Member'),
    [targetProfile?.subRoles, targetProfile?.role]
  );
  const headerStatusText = otherTyping
    ? 'Typing…'
    : !activityVisible
    ? 'Active status hidden'
    : presenceStatus === 'online'
    ? 'Active now'
    : targetProfile?.lastActiveAt
    ? `Active ${formatRelativeActivity(targetProfile.lastActiveAt)}`
    : 'Recently active';

  const handleAttachmentAction = () => {
    Alert.alert('Add attachment', 'Choose what to share', [
      { text: 'Photo or video', onPress: handlePickMedia },
      { text: 'Document', onPress: handlePickDocument },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const addAttachment = (file) => {
    setPendingAttachments((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...file,
      },
    ]);
  };

  const handlePickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const kind = asset.type === 'video' ? 'video' : 'image';
      addAttachment({
        uri: asset.uri,
        name: asset.fileName || `${kind}-${Date.now()}`,
        size: asset.fileSize || 0,
        mimeType: asset.mimeType || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
        kind,
      });
    } catch (error) {
      Alert.alert('Media picker error', 'Could not access your library.');
      console.warn('Media picker failed', error);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      addAttachment({
        uri: file.uri,
        name: file.name || `file-${Date.now()}`,
        size: file.size || 0,
        mimeType: file.mimeType || 'application/octet-stream',
        kind: 'file',
      });
    } catch (error) {
      Alert.alert('Document picker error', 'Could not select that file.');
      console.warn('Document picker failed', error);
    }
  };

  const removeAttachment = (attachmentId) => {
    setPendingAttachments((prev) => prev.filter((file) => file.id !== attachmentId));
  };

  const uploadPendingAttachments = async () => {
    if (!pendingAttachments.length) return [];
    const uploaded = [];
    for (const file of pendingAttachments) {
      const { downloadURL, storagePath, contentType } = await uploadChatAttachment({
        uri: file.uri,
        conversationId,
        filename: file.name,
        mimeType: file.mimeType,
      });
      uploaded.push({
        ...file,
        url: downloadURL,
        storagePath,
        mimeType: contentType || file.mimeType,
      });
    }
    return uploaded;
  };

  const handleOpenAttachment = async (attachment) => {
    if (!attachment?.url) return;
    try {
      await Linking.openURL(attachment.url);
    } catch (error) {
      Alert.alert('Unable to open', 'Install a viewer for this file type and try again.');
      console.warn('Attachment open failed', error);
    }
  };

  const handleInputChange = (value) => {
    setMessageText(value);
    if (!conversationId || !user?.uid) return;
    updateTypingStatus(conversationId, user.uid, Boolean(value.trim()));
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(conversationId, user.uid, false);
    }, 1500);
  };

  const startRecording = async () => {
    if (recording) return;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone permission', 'Enable microphone access to record voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setAudioPreview(null);
    } catch (error) {
      Alert.alert('Recording failed', 'Could not start audio recording.');
      console.warn('startRecording error', error);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();
      setAudioPreview({ uri, durationMillis: status.durationMillis || 0 });
    } catch (error) {
      Alert.alert('Stop failed', 'Could not finalize recording.');
      console.warn('stopRecording error', error);
    } finally {
      setRecording(null);
    }
  };

  const cancelAudioPreview = () => setAudioPreview(null);

  const playAudio = async (attachment) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setPlayingId(null);
      }
      if (!attachment?.url) return;
      const { sound } = await Audio.Sound.createAsync({ uri: attachment.url }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingId(attachment.url);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setPlayingId(null);
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
    } catch (error) {
      Alert.alert('Playback error', 'Could not play this audio message.');
      console.warn('playAudio error', error);
    }
  };

  const toggleAudioPlayback = async (attachment) => {
    if (playingId === attachment.url && soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
        setPlayingId(null);
      } else {
        await soundRef.current.playAsync();
        setPlayingId(attachment.url);
      }
      return;
    }
    playAudio(attachment);
  };

  const handleSend = async () => {
    if (!ensureRestrictedAccessOrAlert({ profile: user, Alert, navigation, messageTitle: 'Messaging locked' })) {
      return;
    }
    if (!messagingAllowed) {
      Alert.alert('Messaging unavailable', 'This member has disabled new messages.');
      return;
    }
    if (
      (!messageText.trim() && !pendingAttachments.length && !audioPreview) ||
      !conversationId ||
      !user?.uid
    ) {
      return;
    }
    setSending(true);
    setUploadingAttachments(Boolean(pendingAttachments.length));
    try {
      const uploaded = pendingAttachments.length ? await uploadPendingAttachments() : [];
      if (audioPreview) {
        const audioUpload = await uploadChatAttachment({
          uri: audioPreview.uri,
          conversationId,
          filename: `voice-${Date.now()}.m4a`,
          mimeType: 'audio/m4a',
        });
        uploaded.push({
          url: audioUpload.downloadURL,
          storagePath: audioUpload.storagePath,
          mimeType: 'audio/m4a',
          kind: 'audio',
          name: 'Voice message',
          durationMillis: audioPreview.durationMillis,
        });
      }
      await sendMessage({
        conversationId,
        text: messageText,
        sender: user,
        receiverId: isGroup ? null : targetProfile.uid,
        attachments: uploaded,
      });
      setMessageText('');
      setPendingAttachments([]);
      setAudioPreview(null);
      updateTypingStatus(conversationId, user.uid, false);
    } catch (error) {
      Alert.alert('Message failed', 'Unable to send your message right now.');
      console.warn('Send message error', error);
    } finally {
      setSending(false);
      setUploadingAttachments(false);
    }
  };

  const handleStartCall = async (callType) => {
    if (!ensureRestrictedAccessOrAlert({ profile: user, Alert, navigation, messageTitle: 'Calling locked' })) {
      return;
    }
    if (!conversationId || !user?.uid || !targetProfile?.uid) {
      Alert.alert('Call unavailable', 'Conversation is not ready yet.');
      return;
    }
    try {
      const session = await initiateCallSession({
        conversationId,
        callerId: user.uid,
        calleeId: targetProfile.uid,
        callType,
      });
      callStartRef.current = Date.now();
      setActiveCall({ ...session, callType });
      setCallModalVisible(true);
      setTimeout(() => {
        setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : prev));
      }, 1800);
    } catch (error) {
      Alert.alert('Call failed', 'Unable to start the call.');
      console.warn('Call start error', error);
    }
  };

  const endActiveCall = async () => {
    if (!activeCall) return;
    const durationSeconds = callStartRef.current
      ? Math.max(1, Math.round((Date.now() - callStartRef.current) / 1000))
      : 0;
    try {
      await finalizeCallSession({
        callId: activeCall.id,
        status: 'ended',
        durationSeconds,
      });
      await logCallMessage({
        conversationId,
        callerId: user.uid,
        calleeId: targetProfile.uid,
        callType: activeCall.callType,
        status: 'completed',
        durationSeconds,
      });
    } catch (error) {
      console.warn('Call finalize error', error);
    } finally {
      setActiveCall(null);
      setCallModalVisible(false);
    }
  };

  const renderCallLog = (item) => (
    <View style={styles.callLogContainer}>
      <Ionicons
        name={item.callType === 'video' ? 'videocam' : 'call'}
        size={20}
        color={colors.primary}
        style={{ marginRight: 10 }}
      />
      <View>
        <Text style={styles.callLogTitle}>
          {item.callType === 'video' ? 'Video call' : 'Audio call'} · {item.status === 'missed' ? 'missed' : 'completed'}
        </Text>
        {item.durationSeconds ? (
          <Text style={styles.callLogSubtitle}>{Math.max(item.durationSeconds, 1)} seconds</Text>
        ) : null}
      </View>
    </View>
  );

  const renderAttachmentPreview = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.attachmentsPreview}
      contentContainerStyle={styles.attachmentsPreviewContent}
    >
      {pendingAttachments.map((file) => (
        <View key={file.id} style={styles.attachmentPreviewItem}>
          <TouchableOpacity
            style={styles.attachmentRemoveButton}
            onPress={() => removeAttachment(file.id)}
          >
            <Ionicons name="close" size={16} color={colors.white} />
          </TouchableOpacity>
          {file.kind === 'image' ? (
            <Image source={{ uri: file.uri }} style={styles.attachmentPreviewImage} />
          ) : (
            <View style={styles.attachmentPreviewIcon}>
              <Ionicons
                name={file.kind === 'video' ? 'videocam' : 'document-text'}
                size={20}
                color={colors.white}
              />
            </View>
          )}
          <Text style={styles.attachmentPreviewLabel} numberOfLines={1}>
            {file.name}
          </Text>
        </View>
      ))}
    </ScrollView>
  );

  const renderAttachmentNode = (attachment) => {
    if (attachment.kind === 'image' && attachment.url) {
      return (
        <TouchableOpacity
          key={attachment.url}
          activeOpacity={0.85}
          onPress={() => handleOpenAttachment(attachment)}
        >
          <Image source={{ uri: attachment.url }} style={styles.messageImage} />
        </TouchableOpacity>
      );
    }
    if (attachment.kind === 'audio') {
      const isPlaying = playingId === attachment.url;
      const durationSec = attachment.durationMillis ? Math.round(attachment.durationMillis / 1000) : null;
      return (
        <TouchableOpacity
          key={attachment.url}
          style={styles.audioMessageTile}
          onPress={() => toggleAudioPlayback(attachment)}
          activeOpacity={0.8}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={colors.primary} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.audioMessageLabel}>{attachment.name || 'Voice message'}</Text>
            {durationSec ? <Text style={styles.audioMessageMeta}>{durationSec}s</Text> : null}
          </View>
        </TouchableOpacity>
      );
    }
    const iconName = attachment.kind === 'video' ? 'videocam' : 'document-text';
    const accent = attachment.kind === 'video' ? colors.info : colors.accent;
    return (
      <TouchableOpacity
        key={attachment.url || attachment.name}
        style={styles.messageFileTile}
        onPress={() => handleOpenAttachment(attachment)}
        activeOpacity={0.8}
      >
        <Ionicons name={iconName} size={18} color={accent} style={{ marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.messageFileName} numberOfLines={1}>
            {attachment.name || 'Attachment'}
          </Text>
          <Text style={styles.messageFileMeta}>{attachment.mimeType || 'Tap to open'}</Text>
        </View>
        <Ionicons name="download" size={16} color={colors.textLight} />
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }) => {
    if (item.type === 'call-log') {
      return renderCallLog(item);
    }
    const isMe = item.senderId === user?.uid;
    return (
      <View style={[styles.messageContainer, isMe && styles.messageContainerMe]}>
        {!isMe && (
          <Image source={getAvatarSource(targetProfile?.avatar)} style={styles.messageAvatar} />
        )}
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}>
          {Array.isArray(item.attachments) && item.attachments.length > 0 && (
            <View style={styles.messageAttachmentGroup}>
              {item.attachments.map((attachment) => renderAttachmentNode(attachment))}
            </View>
          )}
          {item.text ? (
            <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.text}</Text>
          ) : null}
          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
            {formatMessageTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => (
    <View style={styles.typingIndicator}>
      <View style={styles.typingDot} />
      <View style={styles.typingDot} />
      <View style={styles.typingDot} />
      <Text style={styles.typingText}>Typing…</Text>
    </View>
  );

  const renderCallModal = () => (
    <Modal transparent visible={callModalVisible} animationType="fade" onRequestClose={endActiveCall}>
      <View style={styles.callOverlay}>
        <View style={styles.callCard}>
          <Ionicons
            name={activeCall?.callType === 'video' ? 'videocam' : 'call'}
            size={40}
            color={colors.white}
            style={styles.callIcon}
          />
          <Text style={styles.callTitle}>{targetProfile?.name}</Text>
          <Text style={styles.callStatusText}>{activeCall?.status === 'connected' ? 'Connected' : 'Calling…'}</Text>
          <TouchableOpacity style={styles.callActionButton} onPress={endActiveCall}>
            <Ionicons name="call" size={20} color={colors.white} style={{ marginRight: 6 }} />
            <Text style={styles.callActionText}>End call</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.centeredState}>
        <Ionicons name="chatbubbles-outline" size={40} color={colors.textLight} />
        <Text style={styles.centeredTitle}>Log in required</Text>
        <Text style={styles.centeredBody}>Sign in to start messaging other members.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Image source={getAvatarSource(targetProfile?.avatar)} style={styles.headerAvatar} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{targetProfile?.name}</Text>
            {!isGroup && (
              <SubRolePills
                primaryRole={targetProfile?.role}
                subRoles={targetProfile?.subRoles}
                fallbackLabel={headerRoleLabel}
                style={styles.headerRoles}
              />
            )}
            <Text
              style={[
                styles.headerStatus,
                (!isGroup && (otherTyping || (activityVisible && presenceStatus === 'online'))) &&
                  styles.headerStatusActive,
              ]}
            >
              {isGroup ? 'Group chat' : headerStatusText}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {isGroup ? (
              <TouchableOpacity style={styles.headerActionButton} onPress={() => navigation.navigate('GroupInfo', { conversationId })}>
                <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={styles.headerActionButton} onPress={() => handleStartCall('audio')}>
                  <Ionicons name="call-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerActionButton} onPress={() => handleStartCall('video')}>
                  <Ionicons name="videocam-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {!messagingAllowed && (
          <View style={styles.privacyBanner}>
            <Ionicons name="lock-closed" size={18} color={colors.warning} />
            <Text style={styles.privacyBannerText}>
              This member no longer accepts new messages, so you can read history but not reply.
            </Text>
          </View>
        )}

        {loadingMessages ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading messages…</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={otherTyping ? renderTypingIndicator : null}
          />
        )}

        {pendingAttachments.length > 0 && renderAttachmentPreview()}

        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handleAttachmentAction}
            disabled={uploadingAttachments || sending}
          >
            <Ionicons
              name="add-circle-outline"
              size={28}
              color={uploadingAttachments ? colors.border : colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.recordButton}
            onPress={recording ? stopRecording : startRecording}
            disabled={sending || uploadingAttachments}
          >
            <Ionicons name={recording ? 'mic' : 'mic-outline'} size={24} color={recording ? colors.danger : colors.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a message…"
            placeholderTextColor={colors.textLight}
            value={messageText}
            onChangeText={handleInputChange}
            multiline
            editable={messagingAllowed}
            selectTextOnFocus={messagingAllowed}
          />
          {audioPreview && (
            <View style={styles.audioPreviewChip}>
              <Ionicons name="mic" size={16} color={colors.white} />
              <Text style={styles.audioPreviewText}>{Math.max(1, Math.round((audioPreview.durationMillis || 0) / 1000))}s</Text>
              <TouchableOpacity onPress={cancelAudioPreview} style={styles.audioPreviewRemove}>
                <Ionicons name="close" size={14} color={colors.white} />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (messageText.trim() || pendingAttachments.length || audioPreview) &&
                messagingAllowed &&
                !recording &&
                styles.sendButtonActive,
            ]}
            onPress={handleSend}
            disabled={
              !messagingAllowed ||
              (!messageText.trim() && !pendingAttachments.length && !audioPreview) ||
              sending ||
              uploadingAttachments ||
              recording
            }
          >
            {sending || uploadingAttachments ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons
                name="send"
                size={22}
                color={messageText.trim() || pendingAttachments.length || audioPreview ? colors.white : colors.textLight}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {callModalVisible && renderCallModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
  },
  privacyBannerText: {
    marginLeft: 10,
    color: colors.text,
    flex: 1,
    fontSize: 13,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  headerRoles: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  headerStatus: {
    fontSize: 12,
    color: colors.textLight,
  },
  headerStatusActive: {
    color: colors.success,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerActionButton: {
    marginLeft: 15,
  },
  messagesList: {
    padding: 15,
  },
  attachmentsPreview: {
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingLeft: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  attachmentsPreviewContent: {
    paddingRight: 15,
  },
  attachmentPreviewItem: {
    width: 90,
    marginRight: 12,
    borderRadius: 14,
    backgroundColor: colors.primary + '10',
    padding: 8,
    position: 'relative',
  },
  attachmentPreviewImage: {
    width: '100%',
    height: 60,
    borderRadius: 10,
    marginBottom: 6,
  },
  attachmentPreviewIcon: {
    width: '100%',
    height: 60,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentPreviewLabel: {
    fontSize: 11,
    color: colors.text,
  },
  attachmentRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-end',
  },
  messageContainerMe: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 18,
  },
  messageAttachmentGroup: {
    marginBottom: 8,
    gap: 8,
  },
  messageBubbleThem: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
  },
  messageBubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    marginBottom: 4,
  },
  messageTextMe: {
    color: colors.white,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textLight,
  },
  messageTimeMe: {
    color: '#FFFFFFCC',
  },
  messageImage: {
    width: 210,
    height: 160,
    borderRadius: 16,
  },
  messageFileTile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 8,
    backgroundColor: colors.white,
  },
  audioMessageTile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.white,
    marginBottom: 4,
  },
  audioMessageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  audioMessageMeta: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  messageFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  messageFileMeta: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attachButton: {
    marginRight: 10,
  },
  recordButton: {
    marginRight: 10,
  },
  audioPreviewChip: {
    position: 'absolute',
    left: 70,
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  audioPreviewText: {
    color: colors.white,
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  audioPreviewRemove: {
    marginLeft: 8,
    backgroundColor: colors.danger,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.lightGray,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 110,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textLight,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    marginBottom: 10,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textLight,
    marginHorizontal: 2,
  },
  typingText: {
    marginLeft: 8,
    color: colors.textLight,
    fontSize: 13,
  },
  callLogContainer: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 8,
    backgroundColor: colors.white,
  },
  callLogTitle: {
    fontWeight: '600',
    color: colors.text,
  },
  callLogSubtitle: {
    fontSize: 12,
    color: colors.textLight,
  },
  callOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callCard: {
    width: '78%',
    backgroundColor: colors.primary,
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  callIcon: {
    marginBottom: 16,
  },
  callTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
  },
  callStatusText: {
    color: colors.white,
    marginTop: 4,
    opacity: 0.8,
  },
  callActionButton: {
    marginTop: 20,
    backgroundColor: colors.danger,
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  callActionText: {
    color: colors.white,
    fontWeight: '600',
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  centeredTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  centeredBody: {
    marginTop: 6,
    color: colors.textLight,
  },
});

export default ChatScreen;
