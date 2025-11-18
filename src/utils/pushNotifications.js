import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const getProjectId = () => {
  const easId = Constants?.expoConfig?.extra?.eas?.projectId;
  return easId || Constants?.expoConfig?.projectId || Constants?.manifest?.extra?.eas?.projectId;
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6C63FF',
    sound: 'default',
  });
};

const requestPushPermissions = async () => {
  const existing = await Notifications.getPermissionsAsync();
  if (existing?.status === 'granted') return true;
  const granted = await Notifications.requestPermissionsAsync();
  return granted?.status === 'granted';
};

export const registerPushTokenForUser = async (userId) => {
  if (!userId) return null;
  if (Constants.appOwnership === 'expo') {
    console.warn(
      'Expo Go cannot register remote push notifications in SDK 53+. Build a development client instead: https://docs.expo.dev/develop/development-builds/introduction/'
    );
    return null;
  }
  if (!Constants.isDevice) {
    console.warn('Push notifications require a physical device.');
    return null;
  }
  const permissionGranted = await requestPushPermissions();
  if (!permissionGranted) {
    throw new Error('Push notification permission was not granted.');
  }
  await ensureAndroidChannel();
  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() });
  const token = tokenResponse?.data;
  if (!token) {
    throw new Error('Unable to obtain Expo push token.');
  }
  const userRef = doc(db, 'users', userId);
  await setDoc(
    userRef,
    {
      expoPushTokens: arrayUnion(token),
      pushRegisteredAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return token;
};

export const sendExpoPushNotification = async ({ to, title, body, data }) => {
  if (!to) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        sound: 'default',
        title: title || 'AcademicConnect',
        body: body || 'You have a new notification',
        data: data || {},
      }),
    });
  } catch (error) {
    console.warn('Failed to send Expo push notification', error);
  }
};
