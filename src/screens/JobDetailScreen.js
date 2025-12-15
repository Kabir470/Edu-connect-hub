import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { applyToJob, subscribeToApplicationsForJob, subscribeToJob, subscribeToMyApplicationForJob } from '../utils/jobService';
import { ensureRestrictedAccessOrAlert } from '../utils/featureAccess';

const formatDate = (ts) => {
  if (!ts) return '';
  const date = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
};

const JobDetailScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { jobId } = route.params || {};
  const [saved, setSaved] = useState(false);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [myApplication, setMyApplication] = useState(null);
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToJob(jobId, {
      onData: (doc) => {
        setJob(doc);
        setLoading(false);
      },
      onError: () => {
        setJob(null);
        setLoading(false);
      },
    });
    return () => {
      try { unsub && unsub(); } catch (_) {}
    };
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !user?.uid) {
      setMyApplication(null);
      return;
    }
    const unsub = subscribeToMyApplicationForJob(jobId, user.uid, {
      onData: (doc) => setMyApplication(doc),
      onError: () => setMyApplication(null),
    });
    return () => {
      try { unsub && unsub(); } catch (_) {}
    };
  }, [jobId, user?.uid]);

  const isOwner = !!(user?.uid && job?.createdBy?.uid && user.uid === job.createdBy.uid);

  useEffect(() => {
    if (!jobId || !isOwner) {
      setApplications([]);
      return;
    }
    const unsub = subscribeToApplicationsForJob(jobId, {
      onData: (items) => setApplications(items || []),
      onError: () => setApplications([]),
    });
    return () => {
      try { unsub && unsub(); } catch (_) {}
    };
  }, [jobId, isOwner]);

  const isApplied = !!myApplication;

  const requirementsLines = useMemo(() => {
    const text = (job?.requirements || '').trim();
    if (!text) return [];
    return text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [job?.requirements]);

  const handleApply = async () => {
    if (!user?.uid) {
      Alert.alert('Sign in required', 'Please sign in to apply for this job.');
      return;
    }
    if (!ensureRestrictedAccessOrAlert({ profile: user, Alert, navigation, messageTitle: 'Job applications locked' })) {
      return;
    }
    if (!jobId || !job) return;
    if (isApplied) {
      Alert.alert('Already applied', 'You have already applied for this job.');
      return;
    }

    try {
      setApplying(true);
      await applyToJob({ jobId, job, user });
      Alert.alert('Application submitted', 'Your application has been submitted.');
    } catch (e) {
      if (e?.code === 'already-applied') {
        Alert.alert('Already applied', 'You have already applied for this job.');
        return;
      }
      Alert.alert('Error', e?.message || 'Could not submit application');
    } finally {
      setApplying(false);
    }
  };

  const handleContactApplicant = async (email) => {
    if (!email) {
      Alert.alert('Missing email', 'This applicant has no email on file.');
      return;
    }
    const url = `mailto:${email}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Cannot open email', 'No email app available on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Error', 'Could not open the email app.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading job…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.warning} />
          <Text style={styles.loadingText}>Job not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Job Header */}
        <View style={styles.header}>
          <View style={styles.companyLogo}>
            <Text style={styles.companyInitial}>{(job.company || 'C')[0]}</Text>
          </View>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.companyName}>{job.company}</Text>
          {!!(job?.createdBy?.fullName || job?.createdBy?.username) && (
            <Text style={styles.postedBy}>
              Posted by {job?.createdBy?.fullName || job?.createdBy?.username}
            </Text>
          )}
          
          <View style={styles.jobMetaContainer}>
            <View style={styles.metaItem}>
              <Ionicons name="location" size={18} color={colors.primary} />
              <Text style={styles.metaText}>{job.location}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time" size={18} color={colors.primary} />
              <Text style={styles.metaText}>{job.type}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="cash" size={18} color={colors.primary} />
              <Text style={styles.metaText}>{job.salary}</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={handleApply}
              disabled={applying || isApplied}
            >
              <Text style={styles.applyButtonText}>
                {isApplied ? 'Applied' : applying ? 'Applying…' : 'Apply Now'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={() => setSaved(!saved)}
            >
              <Ionicons 
                name={saved ? "bookmark" : "bookmark-outline"} 
                size={24} 
                color={saved ? colors.primary : colors.text} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Job Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{job.description}</Text>
        </View>

        {!!requirementsLines.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            {requirementsLines.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Applicants</Text>
            {applications.length === 0 ? (
              <Text style={styles.emptyApplicants}>No one has applied yet.</Text>
            ) : (
              applications.map((app) => {
                const name = app.applicantName || app.applicantUsername || (app.applicantEmail ? app.applicantEmail.split('@')[0] : null) || app.userId;
                const subtitle = app.applicantEmail || app.userId;
                return (
                  <View key={app.id} style={styles.applicantRow}>
                    <View style={styles.applicantIcon}>
                      <Ionicons name="person-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.applicantName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.applicantMeta} numberOfLines={1}>{subtitle}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.contactButton}
                      onPress={() => handleContactApplicant(app.applicantEmail)}
                      disabled={!app.applicantEmail}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="mail-outline" size={18} color={app.applicantEmail ? colors.primary : colors.mediumGray} />
                    </TouchableOpacity>
                    <Text style={styles.applicantStatus} numberOfLines={1}>{app.status || 'Pending'}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Posted Info */}
        <View style={styles.footer}>
          <Text style={styles.postedText}>Posted {formatDate(job.createdAt)}</Text>
        </View>
      </ScrollView>

      {/* Fixed Bottom Apply Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.bottomApplyButton}
          onPress={handleApply}
          disabled={applying || isApplied}
        >
          <Ionicons name="paper-plane" size={20} color={colors.white} />
          <Text style={styles.bottomApplyText}>
            {isApplied ? 'Application Submitted' : applying ? 'Submitting…' : 'Apply for this Position'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.white,
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  companyLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  companyInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
  },
  jobTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  companyName: {
    fontSize: 16,
    color: colors.textLight,
    marginBottom: 20,
  },
  postedBy: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: -14,
    marginBottom: 16,
  },
  jobMetaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    margin: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.text,
    marginLeft: 6,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  applyButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 10,
  },
  applyButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    width: 50,
    backgroundColor: colors.lightGray,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: colors.white,
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 15,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textLight,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
    marginRight: 12,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    marginLeft: 10,
  },
  emptyApplicants: {
    color: colors.textLight,
  },
  applicantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  applicantIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `${colors.primary}1A`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  applicantName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  applicantMeta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textLight,
  },
  applicantStatus: {
    marginLeft: 12,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textLight,
  },
  contactButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  footer: {
    backgroundColor: colors.white,
    padding: 20,
    alignItems: 'center',
    marginBottom: 80,
  },
  postedText: {
    fontSize: 13,
    color: colors.textLight,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  bottomApplyButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomApplyText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: colors.textLight,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  backButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
});

export default JobDetailScreen;
