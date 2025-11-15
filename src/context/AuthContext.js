import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db, storage } from '../../firebase';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import * as Crypto from 'expo-crypto';
import { DEFAULT_PRIVACY_SETTINGS, mergePrivacySettings } from '../constants/privacyDefaults';
import { normalizeUsername } from '../utils/usernameService';

const AUTH_CACHE_KEY = 'auth:user';

const AuthContext = createContext(null);

const buildSessionUser = (firebaseUser, profileDoc = {}, fallbackUser = null) => {
  const baseUid = firebaseUser?.uid || fallbackUser?.uid || profileDoc.uid;
  const baseEmail = firebaseUser?.email || profileDoc.email || fallbackUser?.email || '';
  return {
    uid: baseUid,
    email: baseEmail,
    role: profileDoc.role || fallbackUser?.role || 'user',
    fullName: profileDoc.fullName || fallbackUser?.fullName || '',
    username: profileDoc.username || fallbackUser?.username || null,
    status: profileDoc.status || fallbackUser?.status || 'pending',
    profileImageURL: profileDoc.profileImageURL ?? fallbackUser?.profileImageURL ?? null,
    address: profileDoc.address || fallbackUser?.address || '',
    bio: profileDoc.bio || fallbackUser?.bio || '',
    phone: profileDoc.phone || fallbackUser?.phone || '',
    website: profileDoc.website || fallbackUser?.website || '',
    location: profileDoc.location || fallbackUser?.location || '',
    privacySettings: mergePrivacySettings(profileDoc.privacySettings || fallbackUser?.privacySettings),
  };
};

const USER_FIELDS = ['uid', 'email', 'role', 'fullName', 'username', 'status', 'profileImageURL', 'address', 'bio', 'phone', 'website', 'location'];

const isSameUserShape = (prev, next) => {
  if (prev === next) return true;
  if (!prev || !next) return false;
  const fieldsMatch = USER_FIELDS.every((field) => prev[field] === next[field]);
  const privacyMatch = JSON.stringify(prev.privacySettings || DEFAULT_PRIVACY_SETTINGS) === JSON.stringify(next.privacySettings || DEFAULT_PRIVACY_SETTINGS);
  return fieldsMatch && privacyMatch;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { uid, email, role, name }
  const [bootstrapped, setBootstrapped] = useState(false);

  const persistUser = async (nextUser) => {
    setUser(nextUser);
    if (nextUser) {
      await AsyncStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(nextUser));
    } else {
      await AsyncStorage.removeItem(AUTH_CACHE_KEY);
    }
  };

  // ✅ Sign Up
  const signUp = async ({ email, password, fullName, role, address, nidNumber, profileImageUri, nidImageUri, username }) => {
    // Create auth account
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const uid = res.user.uid;

    // Upload images if provided
    const uploadIfNeeded = async (uri, path, contentType='image/jpeg') => {
      if (!uri) return null;
      const response = await fetch(uri);
      const blob = await response.blob();
      const r = ref(storage, path);
      await uploadBytes(r, blob, { contentType });
      return await getDownloadURL(r);
    };

    const profileImageURL = await uploadIfNeeded(profileImageUri, `users/${uid}/profile.jpg`);
    const nidImageURL = await uploadIfNeeded(nidImageUri, `users/${uid}/nid-front.jpg`);

  // Compute safe identifier parts
  const nidLast4 = nidNumber ? nidNumber.slice(-4) : null;
  const nidHash = nidNumber ? await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nidNumber) : null;

    const normalizedUsername = username ? normalizeUsername(username) : null;

    const profileDoc = {
      uid,
      email,
      fullName: fullName || '',
      role: role || 'user',
      address: address || '',
  nidLast4,
  nidHash: nidHash,
      profileImageURL: profileImageURL || null,
      nidImageURL: nidImageURL || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      verifiedAt: null,
      username: normalizedUsername,
      usernameLower: normalizedUsername,
    };

    await setDoc(doc(db, 'users', uid), profileDoc);

    const userData = buildSessionUser(res.user, profileDoc);
    await persistUser(userData);
    return userData;
  };

  // ✅ Login
  const signIn = async ({ email, password, role }) => {
    const res = await signInWithEmailAndPassword(auth, email, password);
    const uid = res.user.uid;
    // Fetch user doc
    let userDocData = null;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) userDocData = snap.data();
    } catch (e) {
      console.warn('Failed to load user profile', e);
    }
    const userData = buildSessionUser(res.user, userDocData || { role, email });
    await persistUser(userData);
  };

  // ✅ Logout
  const signOut = async () => {
    await firebaseSignOut(auth);
    await persistUser(null);
  };

  // ✅ Bootstrap from AsyncStorage
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(AUTH_CACHE_KEY);
      if (raw) setUser(JSON.parse(raw));
      setBootstrapped(true);
    })();
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists()) return;
      setUser((prev) => {
        const base = auth.currentUser || prev || { uid: user.uid, email: user.email };
        const nextUser = buildSessionUser(base, snap.data(), prev);
        if (isSameUserShape(prev, nextUser)) {
          return prev;
        }
        AsyncStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(nextUser)).catch((error) =>
          console.warn('Failed to cache refreshed user', error)
        );
        return nextUser;
      });
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const userRef = doc(db, 'users', user.uid);
    const presenceEnabled = user?.privacySettings?.showActivityStatus !== false;

    const pushPresence = async (status) => {
      try {
        await updateDoc(userRef, {
          presenceStatus: presenceEnabled ? status : 'offline',
          lastActiveAt: serverTimestamp(),
          activityStatusHidden: !presenceEnabled,
        });
      } catch (error) {
        console.warn('Failed to update presence', error);
      }
    };

    pushPresence('online');

    const handleAppStateChange = (nextState) => {
      if (!presenceEnabled) return;
      if (nextState === 'active') {
        pushPresence('online');
      } else if (nextState === 'background' || nextState === 'inactive') {
        pushPresence('offline');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      pushPresence('offline');
    };
  }, [user?.uid, user?.privacySettings?.showActivityStatus]);

  const refreshUserProfile = async () => {
    try {
      const uid = auth.currentUser?.uid || user?.uid;
      if (!uid) return null;
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) return null;
      const updatedUser = buildSessionUser(auth.currentUser || { uid, email: user?.email }, snap.data(), user);
      await persistUser(updatedUser);
      return updatedUser;
    } catch (error) {
      console.warn('Failed to refresh user profile', error);
      return null;
    }
  };

  const value = useMemo(() => ({
    user,
    bootstrapped,
    signIn,
    signUp,
    signOut,
    refreshUserProfile,
  }), [user, bootstrapped]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
