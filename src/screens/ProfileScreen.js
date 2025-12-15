import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Switch,
  Alert,
  Share,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../../firebase';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { FOLLOW_STATUS, subscribeToIncomingRequests } from '../utils/followService';
import SubRolePills from '../components/SubRolePills';
import { sanitizeSubRoles } from '../utils/roleUtils';
import { getVerificationGate } from '../utils/featureAccess';

const DEFAULT_AVATAR = require('../../assets/shahriar-kabir.jpg');
const LANGUAGE_OPTIONS = ['English', 'Bangla', 'Spanish'];
const PREFERENCES_STORAGE_KEY = 'profile.preferences';

const ProfileScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [profileData, setProfileData] = useState({ subRoles: [] });
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [followersPreview, setFollowersPreview] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [language, setLanguage] = useState(LANGUAGE_OPTIONS[0]);
  const [savingPreference, setSavingPreference] = useState(false);
  const [requestActioningId, setRequestActioningId] = useState(null);
  const [preferencesSnapshot, setPreferencesSnapshot] = useState({});

  const verificationGate = useMemo(() => getVerificationGate(user || {}), [user]);
  const hideCompletionUI =
    verificationGate?.completion?.isComplete && verificationGate?.verificationStatus === 'verified';

  const navigateTo = (route) => {
    if (!navigation || !route) return;
    try {
      navigation.navigate(route);
    } catch (e) {
      console.warn('Navigation failed for route', route, e);
    }
  };

  const applyPreferenceState = (prefs = {}) => {
    const next = {
      notificationsEnabled,
      darkModeEnabled,
      language,
      ...prefs,
    };
    if (typeof next.notificationsEnabled === 'boolean') {
      setNotificationsEnabled(next.notificationsEnabled);
    }
    if (typeof next.darkModeEnabled === 'boolean') {
      setDarkModeEnabled(next.darkModeEnabled);
    }
    if (typeof next.language === 'string') {
      setLanguage(next.language);
    }
    setPreferencesSnapshot(next);
  };

  const persistPreferences = async (newPrefs) => {
    setSavingPreference(true);
    try {
      const updatedPrefs = {
        notificationsEnabled,
        darkModeEnabled,
        language,
        ...preferencesSnapshot,
        ...newPrefs,
      };
      setPreferencesSnapshot(updatedPrefs);
      await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updatedPrefs));
      await updateDoc(doc(db, 'users', user.uid), { preferences: updatedPrefs });
      applyPreferenceState(updatedPrefs);
    } catch (error) {
      console.warn('Failed to save preferences', error);
    } finally {
      setSavingPreference(false);
    }
  };

  const openLanguageModal = () => {
    setLanguageModalVisible(true);
  };

  const closeLanguageModal = () => {
    setLanguageModalVisible(false);
  };

  const handleLanguageSelect = async (lang) => {
    closeLanguageModal();
    await persistPreferences({ language: lang });
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out my profile on AcademicConnect: ${profileData.name} - ${profileData.email}`,
      });
    } catch (error) {
      console.warn('Failed to share profile', error);
    }
  };

  const handleRequestVerification = async () => {
    if (!user?.uid) return;
    if (!verificationGate.completion.isComplete) {
      const missingLabels = verificationGate.completion.missing.map((m) => m.label).join(', ');
      Alert.alert('Profile incomplete', `Please complete: ${missingLabels}`);
      navigation.navigate('EditProfile');
      return;
    }
    if (verificationGate.verificationStatus === 'pending') {
      navigation.navigate('Pending');
      return;
    }
    if (verificationGate.verificationStatus === 'verified') {
      Alert.alert('Verified', 'Your profile is already verified.');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        verificationStatus: 'pending',
        status: 'pending',
        rejectionReason: null,
        verificationRequestedAt: new Date().toISOString(),
      });
      Alert.alert('Request sent', 'Your verification request has been sent to the admin team.');
      navigation.navigate('Pending');
    } catch (error) {
      console.warn('Failed to request verification', error);
      Alert.alert('Error', 'Could not send verification request.');
    }
  };

  const handleRequestAction = async (request, action) => {
    setRequestActioningId(request.id);
    try {
      // TODO: Implement accept/decline request
      console.log(`Request ${action}ed:`, request);
    } catch (error) {
      console.warn(`Failed to ${action} request`, error);
    } finally {
      setRequestActioningId(null);
    }
  };

  const hydrateRequests = useCallback(
    async (requests = [], { signal } = {}) => {
      setRequestsLoading(true);
      try {
        const enriched = await Promise.all(
          requests.map(async (request) => {
            if (signal?.aborted) return null;
            try {
              const snap = await getDoc(doc(db, 'users', request.followerId));
              const followerProfile = snap.exists() ? snap.data() : null;
              return { ...request, followerProfile };
            } catch (error) {
              console.warn('Failed to load follower profile', error);
              return { ...request, followerProfile: null };
            }
          })
        );
        if (signal?.aborted) return;
        setIncomingRequests(enriched.filter(Boolean));
      } catch (error) {
        if (!signal?.aborted) {
          console.warn('Failed to hydrate follow requests', error);
        }
      } finally {
        if (!signal?.aborted) {
          setRequestsLoading(false);
        }
      }
    },
    []
  );

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
    if (!user?.uid) return undefined;
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        setProfileData({
          name: d.fullName || 'Unnamed',
          email: d.email || user.email,
          role: (d.role || user.role || 'user').toUpperCase(),
          subRoles: sanitizeSubRoles(d.subRoles || [], d.role || user.role),
          institution: d.address || '—',
          avatar: d.profileImageURL ? { uri: d.profileImageURL } : DEFAULT_AVATAR,
          bio: d.bio || 'No bio provided.',
          followers: d.followers || 0,
          following: d.following || 0,
          posts: d.posts || 0,
          status: d.status,
        });
        if (d.preferences) {
          applyPreferenceState(d.preferences);
        }
      },
      (error) => console.warn('Failed to load profile', error)
    );
    return () => unsubscribe();
  }, [user?.uid, user?.email, user?.role]);

  useEffect(() => {
    if (!user?.uid) {
      setIncomingRequests([]);
      setRequestsLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const unsubscribe = subscribeToIncomingRequests(user.uid, (items = []) => {
      hydrateRequests(items, { signal: controller.signal });
    });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [user?.uid, hydrateRequests]);

  useEffect(() => {
    if (!user?.uid) {
      setFollowersPreview([]);
      setFollowersLoading(false);
      return undefined;
    }
    let cancelled = false;
    setFollowersLoading(true);
    const followersQuery = query(
      collection(db, 'followRelationships'),
      where('targetUserId', '==', user.uid),
      where('status', '==', FOLLOW_STATUS.ACCEPTED),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubscribe = onSnapshot(
      followersQuery,
      async (snap) => {
        setFollowersLoading(true);
        const relationships = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        try {
          const enriched = await Promise.all(
            relationships.map(async (rel) => {
              try {
                const followerSnap = await getDoc(doc(db, 'users', rel.followerId));
                const followerProfile = followerSnap.exists() ? followerSnap.data() : null;
                return { ...rel, followerProfile };
              } catch (error) {
                console.warn('Failed to load follower profile', error);
                return { ...rel, followerProfile: null };
              }
            })
          );
          if (!cancelled) {
            setFollowersPreview(enriched);
          }
        } finally {
          if (!cancelled) {
            setFollowersLoading(false);
          }
        }
      },
      () => {
        if (!cancelled) {
          setFollowersPreview([]);
          setFollowersLoading(false);
        }
      }
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user?.uid]);

  const menuSections = useMemo(() => {
    const sections = [
      {
        title: 'Account',
        items: [
          { icon: 'person-outline', label: 'Portfolio', color: colors.primary, onPress: () => navigation.navigate('Portfolio', { screen: 'PortfolioPreview' }) },
          { icon: 'document-text-outline', label: 'My CV/Resume', color: colors.secondary, onPress: () => navigateTo('Resume') },
          { icon: 'school-outline', label: 'Education & Experience', color: colors.accent, onPress: () => navigateTo('EducationExperience') },
          { icon: 'shield-checkmark-outline', label: 'Privacy & Security', color: colors.info, onPress: () => navigateTo('PrivacySecurity') },
          { icon: 'people-outline', label: 'Followers & Requests', color: colors.primary, onPress: () => navigateTo('FollowRelations') },
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

    if (user?.role === 'expert') {
      sections[1] = {
        ...sections[1],
        items: [
          { icon: 'time-outline', label: 'Availability Manager', color: colors.info, onPress: () => navigateTo('AvailabilityManager') },
          ...sections[1].items,
        ],
      };
    }

    return sections;
  }, [user?.role, notificationsEnabled, darkModeEnabled, language]);

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
            <Image source={profileData?.avatar || DEFAULT_AVATAR} style={styles.avatar} />
            <TouchableOpacity style={styles.editAvatarButton}>
              <Ionicons name="camera" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{profileData?.name || 'Loading...'}</Text>
          <SubRolePills
            primaryRole={profileData?.role}
            subRoles={profileData?.subRoles}
            fallbackLabel={profileData?.role}
          />
          <Text style={styles.institution}>{profileData?.institution || ''}</Text>
          <Text style={styles.email}>{profileData?.email || ''}</Text>

          <View style={styles.verificationCard}>
            {hideCompletionUI ? null : (
              <>
                <View style={styles.verificationRow}>
                  <Text style={styles.verificationLabel}>Profile completion</Text>
                  <Text style={styles.verificationValue}>{verificationGate.completion.percent}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${verificationGate.completion.percent}%` }]} />
                </View>
              </>
            )}
            <View style={[styles.verificationRow, { marginTop: 10 }]}>
              <Text style={styles.verificationLabel}>Verification</Text>
              <Text
                style={[
                  styles.verificationValue,
                  verificationGate.verificationStatus === 'verified' && { color: colors.success },
                  verificationGate.verificationStatus === 'pending' && { color: colors.warning },
                  verificationGate.verificationStatus === 'rejected' && { color: colors.danger },
                ]}
              >
                {verificationGate.verificationStatus.toUpperCase()}
              </Text>
            </View>

            {verificationGate.verificationStatus === 'verified' ? null : verificationGate.verificationStatus === 'pending' ? (
              <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('Pending')}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text style={styles.secondaryActionText}>View verification status</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryAction} onPress={handleRequestVerification}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.white} />
                <Text style={styles.primaryActionText}>Request verification</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.primaryActions}>
            <TouchableOpacity style={styles.editButton} onPress={() => navigateTo('EditProfile')}>
              <Ionicons name="create-outline" size={18} color={colors.white} />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

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
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Portfolio', { screen: 'PortfolioPreview' })}>
              <Ionicons name="create-outline" size={20} color={colors.white} />
              <Text style={styles.primaryButtonText}>Portfolio</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleShareProfile}>
              <Ionicons name="share-social-outline" size={20} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Share Profile</Text>
            </TouchableOpacity>
            {user?.role === 'expert' && (
              <TouchableOpacity
                style={[styles.secondaryButton, styles.fullWidthButton]}
                onPress={() => navigateTo('AvailabilityManager')}
              >
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Manage Availability</Text>
              </TouchableOpacity>
            )}
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
  verificationCard: {
    marginTop: 14,
    width: '90%',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verificationLabel: {
    fontSize: 13,
    color: colors.textLight,
    fontWeight: '600',
  },
  verificationValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.lightGray,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  primaryAction: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: colors.white,
    fontWeight: '700',
  },
  secondaryAction: {
    marginTop: 12,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  secondaryActionText: {
    color: colors.primary,
    fontWeight: '700',
  },
  primaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingHorizontal: 24,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  editButtonText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: 6,
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
    flexWrap: 'wrap',
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
  fullWidthButton: {
    flexBasis: '100%',
    marginLeft: 0,
    marginRight: 0,
    marginTop: 12,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionMeta: {
    fontSize: 13,
    color: colors.textLight,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    marginLeft: 5,
  },
  requestsLoadingWrap: {
    paddingVertical: 12,
  },
  requestCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.white,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  requestSubtitle: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 2,
  },
  requestButtonsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  requestButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  requestDeclineButton: {
    backgroundColor: colors.danger,
    marginRight: 10,
  },
  requestAcceptButton: {
    backgroundColor: colors.success,
  },
  requestButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  emptyRequestText: {
    fontSize: 14,
    color: colors.textLight,
  },
  followerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  followerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  followerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  followerSubtitle: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 2,
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
