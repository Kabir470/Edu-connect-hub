import { db } from '../../firebase';
import {
	collection,
	doc,
	query,
	where,
	orderBy,
	onSnapshot,
	addDoc,
	getDoc,
	getDocs,
	limit,
	serverTimestamp,
	updateDoc,
	increment,
} from 'firebase/firestore';
import { mergePrivacySettings } from '../constants/privacyDefaults';

const conversationsCollection = collection(db, 'conversations');
const callSessionsCollection = collection(db, 'callSessions');

const buildParticipantSnapshot = (user = {}) => ({
	uid: user.uid || user.userId || null,
	name: user.fullName || user.name || user.email || 'Member',
	avatar: user.profileImageURL || user.avatar || null,
	role: user.role || 'Member',
	presenceStatus: user.presenceStatus || 'offline',
	lastActiveAt: user.lastActiveAt || null,
	privacySettings: mergePrivacySettings(user.privacySettings || {}),
});

export const fetchUserProfile = async (userId) => {
	if (!userId) return null;
	const snap = await getDoc(doc(db, 'users', userId));
	if (!snap.exists()) return null;
	return { uid: userId, ...snap.data() };
};

export const subscribeToUserProfile = (userId, onData, onError) => {
	if (!userId) return () => {};
	const ref = doc(db, 'users', userId);
	return onSnapshot(
		ref,
		(snap) => {
			if (!snap.exists()) {
				onData?.(null);
				return;
			}
			onData?.({ uid: userId, ...snap.data() });
		},
		onError
	);
};

export const subscribeToConversations = (userId, onData, onError) => {
	if (!userId) return () => {};
	const q = query(
		conversationsCollection,
		where('participants', 'array-contains', userId)
	);
	return onSnapshot(q, onData, onError);
};

export const subscribeToConversationMeta = (conversationId, onData, onError) => {
	if (!conversationId) return () => {};
	const ref = doc(db, 'conversations', conversationId);
	return onSnapshot(ref, onData, onError);
};

export const subscribeToMessages = (conversationId, onData, onError) => {
	if (!conversationId) return () => {};
	const messagesRef = collection(db, 'conversations', conversationId, 'messages');
	const q = query(messagesRef, orderBy('createdAt', 'asc'));
	return onSnapshot(q, onData, onError);
};

export const ensureConversation = async (currentUser, targetProfile = {}) => {
	const targetUid = targetProfile.uid || targetProfile.userId;
	if (!currentUser?.uid || !targetUid) {
		throw new Error('Missing participants for conversation');
	}
	const participantsKey = [currentUser.uid, targetUid].sort().join('_');
	const existingQuery = query(
		conversationsCollection,
		where('participantsKey', '==', participantsKey),
		limit(1)
	);
	const existingSnap = await getDocs(existingQuery);
	if (!existingSnap.empty) {
		const docSnap = existingSnap.docs[0];
		return { id: docSnap.id, ...docSnap.data() };
	}

	const participantDetails = {
		[currentUser.uid]: buildParticipantSnapshot(currentUser),
		[targetUid]: buildParticipantSnapshot({ ...targetProfile, uid: targetUid }),
	};

	const payload = {
		participants: [currentUser.uid, targetUid],
		participantsKey,
		participantDetails,
		createdAt: serverTimestamp(),
		lastMessage: 'Say hello 👋',
		lastMessageType: 'system',
		lastMessageAt: serverTimestamp(),
		lastSenderId: null,
		unreadCounts: {
			[currentUser.uid]: 0,
			[targetUid]: 0,
		},
		typing: {
			[currentUser.uid]: false,
			[targetUid]: false,
		},
	};

	const newDocRef = await addDoc(conversationsCollection, payload);
	return { id: newDocRef.id, ...payload };
};

const normalizeAttachments = (attachments = []) =>
	attachments
		.filter((att) => att && (att.url || att.storagePath))
		.map((att) => ({
			url: att.url || null,
			name: att.name || null,
			size: att.size || null,
			mimeType: att.mimeType || null,
			kind: att.kind || 'file',
			storagePath: att.storagePath || null,
		}));

const buildAttachmentSummary = (attachments = []) => {
	if (!attachments.length) return null;
	const kinds = attachments.map((att) => att.kind || 'file');
	if (kinds.every((kind) => kind === 'image')) {
		return attachments.length > 1 ? 'Sent multiple photos' : 'Sent a photo';
	}
	if (kinds.every((kind) => kind === 'video')) {
		return attachments.length > 1 ? 'Sent multiple videos' : 'Sent a video';
	}
	if (kinds.every((kind) => kind === 'audio')) {
		return attachments.length > 1 ? 'Sent multiple voice messages' : 'Sent a voice message';
	}
	if (kinds.every((kind) => kind === 'file')) {
		return attachments.length > 1 ? 'Sent multiple files' : 'Sent a file';
	}
	return 'Shared attachments';
};

export const sendMessage = async ({
	conversationId,
	text,
	sender,
	receiverId,
	attachments = [],
	type = 'text',
}) => {
	if (!conversationId || !sender?.uid) return;
	const messagesRef = collection(db, 'conversations', conversationId, 'messages');
	const sanitized = text?.trim() || '';
	const normalizedAttachments = normalizeAttachments(attachments);
	const payload = {
		text: sanitized.length ? sanitized : null,
		attachments: normalizedAttachments,
		senderId: sender.uid,
		senderName: sender.fullName || sender.email || 'Member',
		receiverId: receiverId || null,
		type: attachments.length ? normalizedAttachments[0]?.kind || 'media' : type,
		status: 'sent',
		createdAt: serverTimestamp(),
	};
	await addDoc(messagesRef, payload);

	const conversationRef = doc(db, 'conversations', conversationId);
	const attachmentSummary = buildAttachmentSummary(normalizedAttachments);
	const updates = {
		lastMessage:
			payload.text || attachmentSummary || (attachments.length ? 'Shared an attachment' : 'Message'),
		lastMessageType: payload.type,
		lastMessageAt: serverTimestamp(),
		lastSenderId: sender.uid,
		[`unreadCounts.${sender.uid}`]: 0,
	};
	if (receiverId) {
		updates[`unreadCounts.${receiverId}`] = increment(1);
		await updateDoc(conversationRef, updates);
		return;
	}
	// Group or broadcast: increment unread for all participants except sender
	try {
		const snap = await getDoc(conversationRef);
		const participants = snap.exists() ? snap.data()?.participants || [] : [];
		const batchUpdates = { ...updates };
		participants
			.filter((uid) => uid && uid !== sender.uid)
			.forEach((uid) => {
				batchUpdates[`unreadCounts.${uid}`] = increment(1);
			});
		await updateDoc(conversationRef, batchUpdates);
	} catch (e) {
		// fallback to minimal update
		await updateDoc(conversationRef, updates);
	}
};

export const markConversationRead = async (conversationId, userId) => {
	if (!conversationId || !userId) return;
	await updateDoc(doc(db, 'conversations', conversationId), {
		[`unreadCounts.${userId}`]: 0,
	});
};

export const updateTypingStatus = async (conversationId, userId, isTyping) => {
	if (!conversationId || !userId) return;
	await updateDoc(doc(db, 'conversations', conversationId), {
		[`typing.${userId}`]: isTyping,
	});
};

export const initiateCallSession = async ({ conversationId, callerId, calleeId, callType = 'audio' }) => {
	if (!conversationId || !callerId || !calleeId) return null;
	const payload = {
		conversationId,
		callerId,
		calleeId,
		callType,
		status: 'ringing',
		startedAt: serverTimestamp(),
	};
	const docRef = await addDoc(callSessionsCollection, payload);
	return { id: docRef.id, ...payload };
};

export const finalizeCallSession = async ({ callId, status = 'ended', durationSeconds = 0 }) => {
	if (!callId) return;
	await updateDoc(doc(db, 'callSessions', callId), {
		status,
		durationSeconds,
		endedAt: serverTimestamp(),
	});
};

export const logCallMessage = async ({
	conversationId,
	callerId,
	calleeId,
	callType,
	status,
	durationSeconds = 0,
}) => {
	if (!conversationId) return;
	const messagesRef = collection(db, 'conversations', conversationId, 'messages');
	await addDoc(messagesRef, {
		type: 'call-log',
		callType,
		callerId,
		calleeId,
		status,
		durationSeconds,
		createdAt: serverTimestamp(),
	});

	const summary = `${callType === 'video' ? 'Video' : 'Audio'} call · ${
		status === 'missed' ? 'missed' : `${Math.max(durationSeconds, 1)}s`
	}`;
	await updateDoc(doc(db, 'conversations', conversationId), {
		lastMessage: summary,
		lastMessageType: 'call-log',
		lastMessageAt: serverTimestamp(),
		lastSenderId: callerId || null,
	});
};

export const createGroupConversation = async ({ creator, members = [], name, avatar = null }) => {
	if (!creator?.uid || !Array.isArray(members)) throw new Error('Missing creator or members');
	const uniqueMembers = Array.from(new Set([creator.uid, ...members.filter(Boolean)]));
	if (uniqueMembers.length < 3) throw new Error('A group needs at least 3 members');
	const participantDetails = Object.fromEntries(
		uniqueMembers.map((uid) => [uid, buildParticipantSnapshot(uid === creator.uid ? creator : { uid })])
	);
	const payload = {
		type: 'group',
		name: name?.trim() || 'New group',
		avatar: avatar || null,
		participants: uniqueMembers,
		participantDetails,
		admins: [creator.uid],
		createdBy: creator.uid,
		createdAt: serverTimestamp(),
		lastMessage: `${creator.fullName || 'Someone'} created the group` ,
		lastMessageType: 'system',
		lastMessageAt: serverTimestamp(),
		lastSenderId: creator.uid,
		unreadCounts: uniqueMembers.reduce((acc, uid) => ({ ...acc, [uid]: 0 }), {}),
		typing: uniqueMembers.reduce((acc, uid) => ({ ...acc, [uid]: false }), {}),
	};
	const ref = await addDoc(conversationsCollection, payload);
	return { id: ref.id, ...payload };
};
