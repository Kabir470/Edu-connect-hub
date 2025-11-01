import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut 
} from 'firebase/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { uid, email, role, name }
  const [bootstrapped, setBootstrapped] = useState(false);

  // ✅ Sign Up
  const signUp = async ({ email, password }) => {
    // Just create auth user
    const res = await createUserWithEmailAndPassword(auth, email, password);
    // No Firestore write
    return res.user; // you can return uid/email to caller
  };

  // ✅ Login
  const signIn = async ({ email, password, role }) => {
    const res = await signInWithEmailAndPassword(auth, email, password);
    const userData = { uid: res.user.uid, email: res.user.email, role };
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
