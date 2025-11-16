import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { createNotificationEntry } from './notificationService';

const FOLLOW_COLLECTION = 'followRelationships';
const USERS_COLLECTION = 'users';

export const FOLLOW_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
};

const buildFollowDocId = (followerId, targetUserId) => `${followerId}_${targetUserId}`;

const ensureValidIds = (followerId, targetUserId) => {
  if (!followerId || !targetUserId) {
    throw new Error('Both followerId and targetUserId are required.');
  }
  if (followerId === targetUserId) {
    throw new Error('Users cannot follow themselves.');
  }
};

export const subscribeToFollowState = (followerId, targetUserId, callback) => {
  if (!followerId || !targetUserId || typeof callback !== 'function') {
    return () => {};
  }
  const followRef = doc(db, FOLLOW_COLLECTION, buildFollowDocId(followerId, targetUserId));
  return onSnapshot(
    followRef,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      const data = snap.data() || {};
      callback({
        ...data,
        status: data.status || FOLLOW_STATUS.ACCEPTED,
      });
    },
    () => callback(null)
  );
};

export const followUser = async ({ follower, targetUser }) => {
  if (!follower?.uid || !targetUser?.uid) {
    throw new Error('Follower and target user are required.');
  }
  ensureValidIds(follower.uid, targetUser.uid);

  const followDocId = buildFollowDocId(follower.uid, targetUser.uid);
  const followRef = doc(db, FOLLOW_COLLECTION, followDocId);
  const followerRef = doc(db, USERS_COLLECTION, follower.uid);
  const targetRef = doc(db, USERS_COLLECTION, targetUser.uid);

  // Always fetch latest target user privacy settings to avoid relying on caller.
  let targetPrivacy = targetUser.privacySettings || {};
  try {
    const snap = await getDoc(targetRef);
    if (snap.exists()) {
      const data = snap.data() || {};
      targetPrivacy = { ...(data.privacySettings || targetPrivacy) };
      // propagate fullName for notification consistency
      targetUser.fullName = data.fullName || targetUser.fullName;
    }
  } catch (e) {
    // Silent fallback; we'll treat missing as requiring approval.
  }

  const targetIsPublic = targetPrivacy.profilePublic !== false; // default public
  // Only auto-approve when explicit true; missing or false requires approval.
  const autoApprove = targetIsPublic && targetPrivacy.autoApproveFollowers === true;
  const nextStatus = autoApprove ? FOLLOW_STATUS.ACCEPTED : FOLLOW_STATUS.PENDING;

  const result = await runTransaction(db, async (transaction) => {
    const followSnap = await transaction.get(followRef);
    if (followSnap.exists()) {
      const existing = followSnap.data();
      if (existing.status === FOLLOW_STATUS.PENDING) {
        return 'pending';
      }
      return 'already-following';
    }
    transaction.set(followRef, {
      followerId: follower.uid,
      targetUserId: targetUser.uid,
      status: nextStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (nextStatus === FOLLOW_STATUS.ACCEPTED) {
      transaction.update(followerRef, { following: increment(1) });
      transaction.update(targetRef, { followers: increment(1) });
    }
    return nextStatus === FOLLOW_STATUS.ACCEPTED ? 'followed' : 'requested';
  });

  if (result === 'followed') {
    await createNotificationEntry({
      type: 'follow',
      targetUserId: targetUser.uid,
      actor: follower,
      meta: {
        message: `${follower.fullName || 'Someone'} started following you.`,
      },
    });
  } else if (result === 'requested') {
    await createNotificationEntry({
      type: 'follow-request',
      targetUserId: targetUser.uid,
      actor: follower,
      meta: {
        message: `${follower.fullName || 'Someone'} requested to follow you`,
        typeMeta: {
          followDocId,
          followerId: follower.uid,
          targetUserId: targetUser.uid,
        },
      },
    });
  }

  return { status: result };
};

export const unfollowUser = async ({ follower, targetUser }) => {
  if (!follower?.uid || !targetUser?.uid) {
    throw new Error('Follower and target user are required.');
  }
  ensureValidIds(follower.uid, targetUser.uid);

  const followDocId = buildFollowDocId(follower.uid, targetUser.uid);
  const followRef = doc(db, FOLLOW_COLLECTION, followDocId);
  const followerRef = doc(db, USERS_COLLECTION, follower.uid);
  const targetRef = doc(db, USERS_COLLECTION, targetUser.uid);

  const result = await runTransaction(db, async (transaction) => {
    const followSnap = await transaction.get(followRef);
    if (!followSnap.exists()) {
      return 'not-following';
    }
    const followData = followSnap.data() || {};
    transaction.delete(followRef);
    if ((followData.status || FOLLOW_STATUS.ACCEPTED) === FOLLOW_STATUS.ACCEPTED) {
      transaction.update(followerRef, { following: increment(-1) });
      transaction.update(targetRef, { followers: increment(-1) });
      return 'unfollowed';
    }
    return 'request-cancelled';
  });

  return { status: result };
};

export const approveFollowRequest = async ({ followDocId, followerId, targetUser }) => {
  if (!targetUser?.uid) {
    throw new Error('Target user is required.');
  }
  if (!followDocId && !followerId) {
    throw new Error('Follow doc id or follower id required.');
  }
  const docId = followDocId || buildFollowDocId(followerId, targetUser.uid);
  const followRef = doc(db, FOLLOW_COLLECTION, docId);
  let resolvedFollowerId = followerId;

  const result = await runTransaction(db, async (transaction) => {
    const followSnap = await transaction.get(followRef);
    if (!followSnap.exists()) return 'missing';
    const current = followSnap.data();
    resolvedFollowerId = current.followerId;
    if (current.targetUserId !== targetUser.uid) return 'forbidden';
    if ((current.status || FOLLOW_STATUS.ACCEPTED) === FOLLOW_STATUS.ACCEPTED) {
      return 'already-accepted';
    }
    transaction.update(followRef, {
      status: FOLLOW_STATUS.ACCEPTED,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(db, USERS_COLLECTION, current.followerId), { following: increment(1) });
    transaction.update(doc(db, USERS_COLLECTION, current.targetUserId), { followers: increment(1) });
    return 'accepted';
  });

  if (result === 'accepted') {
    await createNotificationEntry({
      type: 'follow-request-accepted',
      targetUserId: resolvedFollowerId,
      actor: targetUser,
      meta: {
        message: `${targetUser.fullName || 'Someone'} accepted your follow request.`,
        typeMeta: { followDocId: docId },
      },
    });
  }

  return { status: result };
};

export const rejectFollowRequest = async ({ followDocId, followerId, targetUser }) => {
  if (!targetUser?.uid) {
    throw new Error('Target user is required.');
  }
  if (!followDocId && !followerId) {
    throw new Error('Follow doc id or follower id required.');
  }
  const docId = followDocId || buildFollowDocId(followerId, targetUser.uid);
  const followRef = doc(db, FOLLOW_COLLECTION, docId);
  let resolvedFollowerId = followerId;

  const result = await runTransaction(db, async (transaction) => {
    const followSnap = await transaction.get(followRef);
    if (!followSnap.exists()) return 'missing';
    const current = followSnap.data();
    resolvedFollowerId = current.followerId;
    if (current.targetUserId !== targetUser.uid) return 'forbidden';
    transaction.delete(followRef);
    return 'rejected';
  });

  if (result === 'rejected') {
    await createNotificationEntry({
      type: 'follow-request-declined',
      targetUserId: resolvedFollowerId,
      actor: targetUser,
      meta: {
        message: `${targetUser.fullName || 'Someone'} declined your follow request.`,
        typeMeta: { followDocId: docId },
      },
    });
  }

  return { status: result };
};

export const subscribeToIncomingRequests = (targetUserId, callback) => {
  if (!targetUserId || typeof callback !== 'function') return () => {};
  // Removed orderBy to avoid composite index requirement that may prevent listener firing.
  const q = query(
    collection(db, FOLLOW_COLLECTION),
    where('targetUserId', '==', targetUserId),
    where('status', '==', FOLLOW_STATUS.PENDING)
  );
  return onSnapshot(
    q,
    (snap) => {
      // Sort client-side by createdAt desc if available.
      const items = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => {
          const aTs = a.createdAt?.seconds || 0;
          const bTs = b.createdAt?.seconds || 0;
          return bTs - aTs;
        });
      callback(items);
    },
    (error) => {
      console.warn('Incoming requests listener error', error?.code || error?.message || error);
      callback([]);
    }
  );
};

export const getFollowDocId = buildFollowDocId;
