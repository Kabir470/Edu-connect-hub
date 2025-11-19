import { useEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

// Simple semver compare helper: returns 1 if a>b, -1 if a<b, 0 if equal
const compareVersions = (a = '', b = '') => {
  const pa = a.split('.').map((s) => parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => parseInt(s, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
};

/*
  useAppUpdateCheck
  - Handles EAS OTA updates (expo-updates) with a user prompt before download
  - After download shows a restart prompt
  - Optionally checks a remote JSON for native updates if `extra.updateCheckUrl` is set in `app.json`.

  Remote JSON format (example):
  {
    "android": { "version": "1.2.3", "url": "https://play.google.com/store/apps/details?id=com.example" },
    "ios": { "version": "1.2.3", "url": "https://apps.apple.com/app/id123456789" }
  }
*/
const useAppUpdateCheck = () => {
  const {
    isUpdateAvailable,
    isUpdatePending,
    fetchUpdateAsync,
    reloadAsync,
    checkError,
  } = Updates.useUpdates();

  useEffect(() => {
    if (checkError) {
      console.error('Error checking for updates:', checkError);
    }
  }, [checkError]);

  // When an OTA update is available, ask user whether to download now.
  useEffect(() => {
    if (!isUpdateAvailable) return;
    Alert.alert(
      'Update Available',
      'A new app update is available. Do you want to download it now? You can restart after the download to apply it.',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            try {
              await fetchUpdateAsync();
            } catch (err) {
              console.error('Error fetching OTA update:', err);
              Alert.alert('Update failed', 'Unable to download update. Please try again later.');
            }
          },
        },
      ]
    );
  }, [isUpdateAvailable, fetchUpdateAsync]);

  // When an OTA update has been downloaded and is pending, prompt to restart
  useEffect(() => {
    if (!isUpdatePending) return;
    Alert.alert(
      'Update Ready',
      'A downloaded update is ready. Restart now to apply the update.',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Restart',
          onPress: async () => {
            try {
              await reloadAsync();
            } catch (err) {
              console.error('Error reloading app after update:', err);
            }
          },
        },
      ]
    );
  }, [isUpdatePending, reloadAsync]);

  // Optional: check a remote endpoint (configured via app.json extra.updateCheckUrl)
  useEffect(() => {
    const updateConfigUrl = Constants.manifest?.extra?.updateCheckUrl || Constants.expoConfig?.extra?.updateCheckUrl;
    if (!updateConfigUrl) return;

    const checkNativeUpdate = async () => {
      try {
        const res = await fetch(updateConfigUrl, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const platformKey = Platform.OS === 'android' ? 'android' : 'ios';
        const remote = json?.[platformKey];
        if (!remote || !remote.version) return;

        const localVersion = Constants.manifest?.version || Constants.expoConfig?.version || '0.0.0';
        if (compareVersions(remote.version, localVersion) === 1) {
          const message = remote.note || 'A new version of the app is available. Please update to continue.';
          const buttons = [];
          if (!remote.mandatory) {
            buttons.push({ text: 'Later', style: 'cancel' });
          }
          buttons.push({
            text: 'Update',
            onPress: () => {
              if (remote.url) {
                Linking.openURL(remote.url).catch((e) => console.warn('Failed to open update URL', e));
              }
            },
          });

          // If mandatory is true, make the alert non-cancelable to force interaction
          Alert.alert('Update Available', message, buttons, { cancelable: !remote.mandatory });
        }
      } catch (err) {
        console.warn('Native update check failed:', err);
      }
    };
    checkNativeUpdate();
  }, []);
};

export default useAppUpdateCheck;
