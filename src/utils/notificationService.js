import { addDoc, collection, serverTimestamp, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { sanitizeSubRoles } from './roleUtils';

const buildActorName = (actor) => {
  if (!actor) return 'Someone';
  if (actor.fullName?.trim()) return actor.fullName.trim();
  if (actor.email) return actor.email.split('@')[0];
  return 'Someone';
};

const buildPostSnapshot = (post) => {
  if (!post) return null;
  return {
    id: post.id || null,
    content: post.content || '',
    userId: post.userId || null,
    userName: post.userName || '',
    image: post.image || null,
    role: post.role || null,
    subRoles: Array.isArray(post.subRoles) ? post.subRoles : [],
  };
};

export const createNotificationEntry = async ({
  type,
  targetUserId,
  actor,
  post,
  meta = {},
}) => {
  try {
    if (!targetUserId || !actor?.uid) return;
    if (targetUserId === actor.uid) return; // Don't notify yourself
    const actorName = buildActorName(actor);
    const docRef = await addDoc(collection(db, 'notifications'), {
      type,
      targetUserId,
      actorUserId: actor.uid,
      actorName,
      actorPhotoURL: actor.profileImageURL || null,
      actorRole: actor.role || null,
      actorSubRoles: sanitizeSubRoles(actor.subRoles || [], actor.role || null),
      postId: post?.id || null,
      postSnapshot: buildPostSnapshot(post),
      message: meta.message || null,
      previewText: meta.previewText || null,
      typeMeta: meta.typeMeta || null,
      seen: false,
      createdAt: serverTimestamp(),
    });
    void docRef;
  } catch (error) {
    console.warn('Failed to create notification entry', error);
  }
};

export const subscribeToUnseenNotifications = (userId, onCount, onError) => {
  if (!userId) return () => {};
  const q = query(
    collection(db, 'notifications'),
    where('targetUserId', '==', userId),
    where('seen', '==', false)
  );
  return onSnapshot(
    q,
    (snap) => {
      onCount?.(snap.size);
    },
    onError
  );
};
