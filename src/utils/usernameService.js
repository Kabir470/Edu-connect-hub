import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { mergePrivacySettings } from '../constants/privacyDefaults';

const USERNAME_REGEX = /^[a-z0-9_]+$/i;
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;

export const normalizeUsername = (value = '') =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();

export const validateUsername = (value = '') => {
  const normalized = normalizeUsername(value);
  if (!normalized) {
    return { ok: false, message: 'Username is required.' };
  }
  if (normalized.length < MIN_LENGTH) {
    return { ok: false, message: `Username must be at least ${MIN_LENGTH} characters.` };
  }
  if (normalized.length > MAX_LENGTH) {
    return { ok: false, message: `Username must be ${MAX_LENGTH} characters or fewer.` };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return { ok: false, message: 'Use letters, numbers, or underscores only.' };
  }
  return { ok: true, normalized };
};

export const checkUsernameAvailable = async (username, excludeUserId) => {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('usernameLower', '==', normalized), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return true;
  return snap.docs[0].id === excludeUserId;
};

export const findUserByUsername = async (username) => {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('usernameLower', '==', normalized), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  const data = docSnap.data();
  return { id: docSnap.id, ...data, privacySettings: mergePrivacySettings(data.privacySettings) };
};

export const findPublicUserByUsername = async (username) => {
  const profile = await findUserByUsername(username);
  if (!profile) return null;
  const privacy = mergePrivacySettings(profile.privacySettings);
  return {
    ...profile,
    privacySettings: privacy,
    profilePublic: privacy.profilePublic !== false,
  };
};
