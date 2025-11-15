import React, { useEffect, useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { mergePrivacySettings, DEFAULT_PRIVACY_SETTINGS } from '../constants/privacyDefaults';

const ToggleRow = ({ icon, label, value, onChange, description }) => (
  <View style={styles.preferenceRow}>
    <View style={styles.preferenceInfo}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={styles.preferenceLabel}>{label}</Text>
        {description ? <Text style={styles.preferenceDescription}>{description}</Text> : null}
      </View>
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.lightGray, true: colors.primary + '50' }}
      thumbColor={value ? colors.primary : colors.mediumGray}
    />
  </View>
);

const ActionRow = ({ icon, label, description, status, tint = colors.primary, onPress }) => (
  <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.85}>
    <Ionicons name={icon} size={22} color={tint} />
    <View style={{ marginLeft: 12, flex: 1 }}>
      <Text style={[styles.preferenceLabel, { color: tint }]}>{label}</Text>
      {description ? <Text style={styles.preferenceDescription}>{description}</Text> : null}
      {status ? <Text style={styles.actionStatus}>{status}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
  </TouchableOpacity>
);

const formatRelativeTime = (isoString) => {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const PrivacySecurityScreen = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_PRIVACY_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setSettings((prev) => mergePrivacySettings({ ...prev, ...data.privacySettings }));
        }
      } catch (error) {
        console.warn('Failed to load privacy settings', error);
      }
    };
    load();
  }, [user?.uid]);

  const persist = async (partial) => {
    if (!user?.uid) return;
    const updated = mergePrivacySettings({ ...settings, ...partial });
    setSettings(updated);
    try {
      setSaving(true);
      await updateDoc(doc(db, 'users', user.uid), {
        privacySettings: updated,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to save privacy settings', error);
      Alert.alert('Error', 'Unable to apply this change right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key, value) => {
    if (key === 'twoFactorEnabled' && value) {
      Alert.alert('Two-factor enabled', 'Use the authenticator app to complete sign-in going forward.');
    }
    if (key === 'biometricLock' && value) {
      Alert.alert('Biometric lock', 'Your device passcode or biometrics will be requested when reopening the app.');
    }
    persist({ [key]: value });
  };

  const handleDownloadData = () => {
    persist({ lastDataExportRequestedAt: new Date().toISOString() });
    Alert.alert(
      'Export requested',
      'We are preparing an archive of your data. You will receive an email when it is ready to download.'
    );
  };

  const handleResetRecommendations = () => {
    persist({ recommendationsClearedAt: new Date().toISOString() });
    Alert.alert('Cleared', 'Your recommendations will reset. Expect fresher suggestions within 24 hours.');
  };

  const handleManageDevices = () => {
    Alert.alert(
      'Manage devices',
      'No suspicious devices found. To sign out of other devices, open Settings → Security on the web.'
    );
  };

  const handleDeactivate = () => {
    Alert.alert('Deactivate account', 'Email support@academicconnect.app to permanently deactivate your profile.');
  };

  const privacyControls = useMemo(
    () => [
      {
        key: 'profilePublic',
        icon: 'eye-outline',
        label: settings.profilePublic ? 'Public profile' : 'Private profile',
        description: settings.profilePublic
          ? 'Anyone can view your posts and bio'
          : 'Only approved followers can view your profile',
      },
      {
        key: 'showActivityStatus',
        icon: 'pulse-outline',
        label: 'Show activity status',
        description: 'Let connections see when you were last active',
      },
      {
        key: 'allowMessagesFromAll',
        icon: 'chatbubble-ellipses-outline',
        label: 'Allow messages from everyone',
        description: 'If off, only people you follow can message you',
      },
      {
        key: 'allowTagging',
        icon: 'at-outline',
        label: 'Allow tags & mentions',
        description: 'Control whether others can tag you in posts or comments',
      },
      {
        key: 'searchableByEmail',
        icon: 'search-outline',
        label: 'Appear in search results',
        description: 'Allow people with your email to find you',
      },
    ],
    [settings]
  );

  const securityControls = useMemo(
    () => [
      {
        key: 'twoFactorEnabled',
        icon: 'shield-checkmark-outline',
        label: 'Two-factor authentication',
        description: 'Require a code from your authenticator app at sign-in',
      },
      {
        key: 'loginAlerts',
        icon: 'notifications-outline',
        label: 'Login alerts',
        description: 'Send a push notification when a new device signs in',
      },
      {
        key: 'biometricLock',
        icon: 'finger-print-outline',
        label: 'Biometric app lock',
        description: 'Ask for Face ID / Touch ID when reopening the app',
      },
    ],
    [settings]
  );

  const actionRows = useMemo(
    () => [
      {
        key: 'download',
        icon: 'download-outline',
        label: 'Download my data',
        description: 'Receive a copy of everything you have shared',
        status: settings.lastDataExportRequestedAt
          ? `Requested ${formatRelativeTime(settings.lastDataExportRequestedAt)}`
          : 'Never requested',
        onPress: handleDownloadData,
        tint: colors.primary,
      },
      {
        key: 'recommendations',
        icon: 'refresh-outline',
        label: 'Reset recommendations',
        description: 'Clear your interactions to retrain suggestions',
        status: settings.recommendationsClearedAt
          ? `Cleared ${formatRelativeTime(settings.recommendationsClearedAt)}`
          : null,
        onPress: handleResetRecommendations,
        tint: colors.info,
      },
      {
        key: 'devices',
        icon: 'laptop-outline',
        label: 'Review connected devices',
        description: 'See where you are signed in and log out remotely',
        onPress: handleManageDevices,
        tint: colors.accent,
      },
      {
        key: 'deactivate',
        icon: 'power-outline',
        label: 'Deactivate account',
        description: 'Temporarily disable your profile and hide your content',
        onPress: handleDeactivate,
        tint: colors.danger,
      },
    ],
    [handleDeactivate, handleDownloadData, handleManageDevices, handleResetRecommendations, settings.lastDataExportRequestedAt, settings.recommendationsClearedAt]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Privacy Controls</Text>
        {privacyControls.map((control) => (
          <ToggleRow
            key={control.key}
            icon={control.icon}
            label={control.label}
            description={control.description}
            value={Boolean(settings[control.key])}
            onChange={(value) => handleToggle(control.key, value)}
          />
        ))}

        <Text style={styles.title}>Security Controls</Text>
        {securityControls.map((control) => (
          <ToggleRow
            key={control.key}
            icon={control.icon}
            label={control.label}
            description={control.description}
            value={Boolean(settings[control.key])}
            onChange={(value) => handleToggle(control.key, value)}
          />
        ))}

        <Text style={styles.title}>Security Tools</Text>
        {actionRows.map(({ key, ...props }) => (
          <ActionRow key={key} {...props} />
        ))}

        {saving && <Text style={styles.savingText}>Saving changes…</Text>}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 16 },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  preferenceInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  preferenceLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  preferenceDescription: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  sectionDivider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  actionRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionStatus: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  savingText: { textAlign: 'center', color: colors.textLight, marginTop: 8 },
});

export default PrivacySecurityScreen;
