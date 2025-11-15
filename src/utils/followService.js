import {
  collection,
  doc,
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
  const targetIsPrivate = targetUser?.privacySettings?.profilePublic === false;
  const nextStatus = targetIsPrivate ? FOLLOW_STATUS.PENDING : FOLLOW_STATUS.ACCEPTED;

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
  const q = query(
    collection(db, FOLLOW_COLLECTION),
    where('targetUserId', '==', targetUserId),
    where('status', '==', FOLLOW_STATUS.PENDING),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      callback(items);
    },
    () => callback([])
  );
};

export const getFollowDocId = buildFollowDocId;
