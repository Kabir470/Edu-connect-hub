import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db, storage } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import * as Crypto from 'expo-crypto';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { uid, email, role, name }
  const [bootstrapped, setBootstrapped] = useState(false);

  // ✅ Sign Up
  const signUp = async ({ email, password, fullName, role, address, nidNumber, profileImageUri, nidImageUri }) => {
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

    await setDoc(doc(db, 'users', uid), {
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
    });

    const userData = { uid, email, role, fullName, status: 'pending' };
    setUser(userData);
    await AsyncStorage.setItem('auth:user', JSON.stringify(userData));
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
    const userData = {
      uid,
      email: res.user.email,
      role: userDocData?.role || role || 'user',
      fullName: userDocData?.fullName || '',
      status: userDocData?.status || 'pending',
      profileImageURL: userDocData?.profileImageURL || null,
    };
    setUser(userData);
    await AsyncStorage.setItem('auth:user', JSON.stringify(userData));
  };

  // ✅ Logout
  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    await AsyncStorage.removeItem('auth:user');
  };

  // ✅ Bootstrap from AsyncStorage
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem('auth:user');
      if (raw) setUser(JSON.parse(raw));
      setBootstrapped(true);
    })();
  }, []);

  const value = useMemo(() => ({
    user, bootstrapped, signIn, signUp, signOut
  }), [user, bootstrapped]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
