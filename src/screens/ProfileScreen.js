import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Share,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFERENCES_STORAGE_KEY = 'profile:preferences';
const LANGUAGE_OPTIONS = ['English (US)', 'English (UK)', 'Bangla', 'Hindi', 'Spanish'];

const ProfileScreen = ({ navigation }) => {
  const { signOut, user } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [language, setLanguage] = useState(LANGUAGE_OPTIONS[0]);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);

  const [profileData, setProfileData] = useState(null);

  const applyPreferenceState = (prefs = {}) => {
    if (typeof prefs.notificationsEnabled === 'boolean') setNotificationsEnabled(prefs.notificationsEnabled);
    if (typeof prefs.darkModeEnabled === 'boolean') setDarkModeEnabled(prefs.darkModeEnabled);
    if (typeof prefs.language === 'string') setLanguage(prefs.language);
  };

  const persistPreferences = async (partial = {}) => {
    const next = {
      notificationsEnabled,
      darkModeEnabled,
      language,
      ...partial,
    };
    applyPreferenceState(next);
    try {
      setSavingPreference(true);
      await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), { preferences: next });
      }
    } catch (error) {
      console.warn('Failed to save preferences', error);
    } finally {
      setSavingPreference(false);
    }
  };

  const handleShareProfile = async () => {
    try {
      const shareLink = `https://academicconnect.app/u/${user?.uid}`;
      await Share.share({
        message: `${profileData?.name || 'My'} AcademicConnect profile\n${shareLink}`,
      });
    } catch (error) {
      console.warn('Share profile failed', error);
    }
  };

  const navigateTo = (route) => navigation.navigate(route);

  const openLanguageModal = () => setLanguageModalVisible(true);
  const closeLanguageModal = () => setLanguageModalVisible(false);
  const handleLanguageSelect = (value) => {
    closeLanguageModal();
    persistPreferences({ language: value });
  };

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
        if (raw) applyPreferenceState(JSON.parse(raw));
      } catch (e) {
        console.warn('Failed to load cached preferences', e);
      }
    })();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setProfileData({
            name: d.fullName || 'Unnamed',
            email: d.email || user.email,
            role: (d.role || user.role || 'user').toUpperCase(),
            institution: d.address || '—',
            avatar: d.profileImageURL ? { uri: d.profileImageURL } : require('../../assets/shahriar-kabir.jpg'),
            bio: d.bio || 'No bio provided.',
            followers: d.followers || 0,
            following: d.following || 0,
            posts: d.posts || 0,
            status: d.status,
          });
          if (d.preferences) {
            applyPreferenceState(d.preferences);
          }
        }
      } catch (e) {
        console.warn('Failed to load profile', e);
      }
    };
    load();
  }, [user]);

  const menuSections = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Edit Profile', color: colors.primary, onPress: () => navigateTo('EditProfile') },
        { icon: 'document-text-outline', label: 'My CV/Resume', color: colors.secondary, onPress: () => navigateTo('Resume') },
        { icon: 'school-outline', label: 'Education & Experience', color: colors.accent, onPress: () => navigateTo('EducationExperience') },
        { icon: 'shield-checkmark-outline', label: 'Privacy & Security', color: colors.info, onPress: () => navigateTo('PrivacySecurity') },
      ],
    },
    {
      title: 'Content',
      items: [
        { icon: 'bookmark-outline', label: 'Saved Posts', color: colors.warning, onPress: () => navigateTo('SavedPosts') },
        { icon: 'briefcase-outline', label: 'My Job Applications', color: colors.success, onPress: () => navigateTo('JobApplications') },
        { icon: 'calendar-outline', label: 'Scheduled Consultations', color: colors.danger, onPress: () => navigateTo('ScheduledConsultations') },
      ],
    },
    {
      title: 'Settings',
      items: [
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          toggle: true,
          value: notificationsEnabled,
          onToggle: (value) => persistPreferences({ notificationsEnabled: value }),
        },
        {
          icon: 'moon-outline',
          label: 'Dark Mode',
          toggle: true,
          value: darkModeEnabled,
          onToggle: (value) => persistPreferences({ darkModeEnabled: value }),
        },
        {
          icon: 'language-outline',
          label: 'Language',
          color: colors.primary,
          onPress: openLanguageModal,
          valueText: language,
        },
      ],
    },
  ];

  const renderLanguageModal = () => (
    <Modal transparent visible={languageModalVisible} animationType="fade" onRequestClose={closeLanguageModal}>
      <View style={styles.languageOverlay}>
        <View style={styles.languageCard}>
          <Text style={styles.languageTitle}>Select language</Text>
          {LANGUAGE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.languageOption}
              onPress={() => handleLanguageSelect(option)}
            >
              <Text style={styles.languageOptionText}>{option}</Text>
              {language === option && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.languageCancel} onPress={closeLanguageModal}>
            <Text style={styles.languageCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Image source={(profileData?.avatar) || require('../../assets/shahriar-kabir.jpg')} style={styles.avatar} />
            <TouchableOpacity style={styles.editAvatarButton}>
              <Ionicons name="camera" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{profileData?.name || 'Loading...'}</Text>
          <Text style={styles.role}>{profileData?.role || ''}</Text>
          <Text style={styles.institution}>{profileData?.institution || ''}</Text>
          <Text style={styles.email}>{profileData?.email || ''}</Text>
          {profileData?.status === 'pending' && (
            <Text style={{ color: colors.warning, marginTop: 4 }}>Pending verification</Text>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profileData?.posts || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profileData?.followers || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profileData?.following || 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          {/* Bio */}
          <View style={styles.bioContainer}>
            <Text style={styles.bio}>{profileData?.bio || 'No bio provided.'}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigateTo('EditProfile')}>
              <Ionicons name="create-outline" size={20} color={colors.white} />
              <Text style={styles.primaryButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleShareProfile}>
              <Ionicons name="share-social-outline" size={20} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Share Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Sections */}
        {menuSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={[
                    styles.menuItem,
                    itemIndex < section.items.length - 1 && styles.menuItemBorder,
                  ]}
                  activeOpacity={item.onPress ? 0.8 : 1}
                  onPress={item.onPress}
                  disabled={!item.onPress && !item.toggle}
                >
                  <View style={styles.menuItemLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: (item.color || colors.primary) + '20' }]}>
                      <Ionicons name={item.icon} size={22} color={item.color || colors.primary} />
                    </View>
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                  </View>
                  {item.toggle ? (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{ false: colors.lightGray, true: colors.primary + '50' }}
                      thumbColor={item.value ? colors.primary : colors.mediumGray}
                    />
                  ) : (
                    <View style={styles.menuItemRight}>
                      {item.valueText ? (
                        <Text style={styles.menuValue}>{item.valueText}</Text>
                      ) : null}
                      <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {section.title === 'Settings' && savingPreference && (
              <Text style={styles.preferenceStatus}>Saving preferences…</Text>
            )}
          </View>
        ))}

        {/* Help & Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help & Support</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} onPress={() => navigation.navigate('HelpCenter')}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.info + '20' }]}>
                  <Ionicons name="help-circle-outline" size={22} color={colors.info} />
                </View>
                <Text style={styles.menuItemLabel}>Help Center</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} onPress={() => navigation.navigate('Terms')}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name="document-text-outline" size={22} color={colors.warning} />
                </View>
                <Text style={styles.menuItemLabel}>Terms & Conditions</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('About')}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="information-circle-outline" size={22} color={colors.success} />
                </View>
                <Text style={styles.menuItemLabel}>About</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
    {renderLanguageModal()}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    backgroundColor: colors.white,
    paddingTop: 20,
    paddingBottom: 25,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: colors.primary,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  role: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  institution: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    color: colors.mediumGray,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textLight,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.lightGray,
  },
  bioContainer: {
    paddingHorizontal: 30,
    marginBottom: 15,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    marginLeft: 5,
  },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuItemLabel: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuValue: {
    color: colors.textLight,
    marginRight: 8,
    fontSize: 13,
  },
  preferenceStatus: {
    marginTop: 8,
    marginLeft: 5,
    color: colors.textLight,
    fontSize: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 15,
    marginTop: 10,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.danger,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.danger,
    marginLeft: 8,
  },
  version: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 30,
  },
  languageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  languageCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  languageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  languageOptionText: {
    fontSize: 15,
    color: colors.text,
  },
  languageCancel: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  languageCancelText: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default ProfileScreen;
