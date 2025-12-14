import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase';

const ADMIN_CONTROLS_REF = doc(db, 'admin', 'controls');

const toTimestamp = (value) => {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value === 'number') return Timestamp.fromMillis(value);
  return null;
};

export const subscribeToAdminControls = (callback) => {
  return onSnapshot(ADMIN_CONTROLS_REF, (snap) => callback(snap.exists() ? snap.data() : null));
};

export const upsertAdminControls = async (payload) => {
  await setDoc(
    ADMIN_CONTROLS_REF,
    {
      updatedAt: serverTimestamp(),
      ...payload,
    },
    { merge: true }
  );
};

export const setFeedLockWindow = async ({ lockedUntil, reason, actor }) => {
  await upsertAdminControls({
    feedLockedUntil: lockedUntil ? toTimestamp(lockedUntil) : null,
    feedLockReason: lockedUntil ? reason || 'Temporarily disabled by admin' : null,
    feedLockedBy: lockedUntil ? actor || null : null,
  });
};

export const approvePost = async ({ postId, actor }) => {
  const postRef = doc(db, 'posts', postId);
  const now = Timestamp.now();
  await updateDoc(postRef, {
    status: 'approved',
    moderation: {
      status: 'approved',
      severity: 'low',
      blockedAttributes: [],
      updatedAt: serverTimestamp(),
      reviewedBy: actor || 'admin',
      reviewedAt: serverTimestamp(),
    },
    moderationLog: arrayUnion({
      ts: now,
      actor: actor || 'admin',
      status: 'approved',
      note: 'Approved by admin dashboard',
    }),
  });
};

export const rejectPost = async ({ postId, actor, reason, blockedAttributes = [] }) => {
  const postRef = doc(db, 'posts', postId);
  const now = Timestamp.now();
  await updateDoc(postRef, {
    status: 'rejected',
    moderation: {
      status: 'rejected',
      severity: 'high',
      blockedAttributes,
      updatedAt: serverTimestamp(),
      reviewedBy: actor || 'admin',
      reviewedAt: serverTimestamp(),
      rejectionReason: reason || null,
    },
    moderationLog: arrayUnion({
      ts: now,
      actor: actor || 'admin',
      status: 'rejected',
      reason: reason || 'Rejected by admin dashboard',
      blockedAttributes,
    }),
  });
};

export const deletePostAsAdmin = async (postId) => {
  await deleteDoc(doc(db, 'posts', postId));
};

const buildSuspensionPayload = ({ durationMs, reason, actor }) => {
  if (!durationMs || durationMs <= 0) {
    throw new Error('Suspension duration must be greater than zero');
  }
  const activeUntil = Timestamp.fromMillis(Date.now() + durationMs);
  const base = {
    reason: reason || 'Temporarily suspended by admin',
    actor: actor || 'admin',
    activeUntil,
  };
  return {
    live: {
      ...base,
      createdAt: serverTimestamp(),
    },
    history: {
      ...base,
      durationMs,
      createdAt: Timestamp.now(),
    },
  };
};

export const suspendUserPosting = async ({ userId, durationMs, reason, actor }) => {
  if (!userId) throw new Error('User id is required');
  const { live, history } = buildSuspensionPayload({ durationMs, reason, actor });
  await updateDoc(doc(db, 'users', userId), {
    postSuspension: live,
    suspensionHistory: arrayUnion({
      ...history,
      userId,
    }),
  });
};

export const clearUserSuspension = async (userId) => {
  if (!userId) throw new Error('User id is required');
  await updateDoc(doc(db, 'users', userId), {
    postSuspension: null,
  });
};

export const lookupUserByIdentifier = async (identifier) => {
  if (!identifier) return null;
  const trimmed = identifier.trim();
  const directDoc = await getDoc(doc(db, 'users', trimmed));
  if (directDoc.exists()) return { id: directDoc.id, ...directDoc.data() };

  const lower = trimmed.toLowerCase();
  const emailTargets = Array.from(new Set([trimmed, lower]));
  for (const target of emailTargets) {
    const emailQuery = query(collection(db, 'users'), where('email', '==', target));
    const emailSnap = await getDocs(emailQuery);
    if (!emailSnap.empty) {
      const match = emailSnap.docs[0];
      return { id: match.id, ...match.data() };
    }
  }

  const usernameQuery = query(collection(db, 'users'), where('usernameLower', '==', lower));
  const usernameSnap = await getDocs(usernameQuery);
  if (!usernameSnap.empty) {
    const match = usernameSnap.docs[0];
    return { id: match.id, ...match.data() };
  }

  return null;
};
