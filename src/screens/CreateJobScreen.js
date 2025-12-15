import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { JOB_CATEGORIES, createJob } from '../utils/jobService';
import { ensureRestrictedAccessOrAlert } from '../utils/featureAccess';

const CreateJobScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('Full-time');
  const [salary, setSalary] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [category, setCategory] = useState(JOB_CATEGORIES[0]);
  const [submitting, setSubmitting] = useState(false);

  const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Internship'];

  const handlePostJob = async () => {
    if (!user?.uid) {
      Alert.alert('Sign in required', 'Please sign in to post a job.');
      return;
    }

    if (!ensureRestrictedAccessOrAlert({ profile: user, Alert, navigation, messageTitle: 'Job posting locked' })) {
      return;
    }

    if (!(['expert', 'teacher', 'admin'].includes(user?.role))) {
      Alert.alert('Not allowed', 'Your account cannot post jobs.');
      return;
    }

    if (!jobTitle.trim() || !company.trim() || !location.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      await createJob({
        title: jobTitle,
        company,
        location,
        type: jobType,
        salary,
        description,
        requirements,
        category,
        createdBy: {
          uid: user.uid,
          role: user.role || 'user',
          fullName: user.fullName || null,
          username: user.username || null,
        },
        contactEmail: user.email || null,
      });

      Alert.alert('Success', 'Job posted successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not post job');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={24} color={colors.info} />
            <Text style={styles.infoBannerText}>
              Post a job opportunity for students, researchers, and academics
            </Text>
          </View>

          {/* Job Title */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Job Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Research Assistant"
              value={jobTitle}
              onChangeText={setJobTitle}
              placeholderTextColor={colors.textLight}
            />
          </View>

          {/* Company */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Company/Institution *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., MIT"
              value={company}
              onChangeText={setCompany}
              placeholderTextColor={colors.textLight}
            />
          </View>

          {/* Location */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Location *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Boston, MA"
              value={location}
              onChangeText={setLocation}
              placeholderTextColor={colors.textLight}
            />
          </View>

          {/* Category */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.jobTypeContainer}>
              {JOB_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.jobTypeButton,
                    category === c && styles.jobTypeButtonActive,
                  ]}
                  onPress={() => setCategory(c)}
                >
                  <Text
                    style={[
                      styles.jobTypeText,
                      category === c && styles.jobTypeTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Job Type */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Job Type *</Text>
            <View style={styles.jobTypeContainer}>
              {jobTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.jobTypeButton,
                    jobType === type && styles.jobTypeButtonActive,
                  ]}
                  onPress={() => setJobType(type)}
                >
                  <Text
                    style={[
                      styles.jobTypeText,
                      jobType === type && styles.jobTypeTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Salary */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Salary Range</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., $50k - $70k"
              value={salary}
              onChangeText={setSalary}
              placeholderTextColor={colors.textLight}
            />
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Job Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the role, responsibilities, and what makes this opportunity unique..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              placeholderTextColor={colors.textLight}
              textAlignVertical="top"
            />
          </View>

          {/* Requirements */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Requirements</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="List required qualifications, skills, education, etc..."
              value={requirements}
              onChangeText={setRequirements}
              multiline
              numberOfLines={4}
              placeholderTextColor={colors.textLight}
              textAlignVertical="top"
            />
          </View>

          {/* Additional Options */}
          <View style={styles.additionalOptions}>
            <Text style={styles.optionsTitle}>Additional Options</Text>
            
            <TouchableOpacity style={styles.optionItem}>
              <View style={[styles.optionIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="school-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.optionText}>Add Required Education Level</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem}>
              <View style={[styles.optionIcon, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="calendar-outline" size={22} color={colors.success} />
              </View>
              <Text style={styles.optionText}>Set Application Deadline</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionItem}>
              <View style={[styles.optionIcon, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="link-outline" size={22} color={colors.warning} />
              </View>
              <Text style={styles.optionText}>Add External Application Link</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={submitting}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.postButton,
            (submitting || !jobTitle.trim() || !company.trim() || !location.trim() || !description.trim()) && styles.postButtonDisabled
          ]}
          onPress={handlePostJob}
          disabled={submitting || !jobTitle.trim() || !company.trim() || !location.trim() || !description.trim()}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="checkmark-circle" size={20} color={colors.white} />
          )}
          <Text style={styles.postButtonText}>{submitting ? 'Posting…' : 'Post Job'}</Text>
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
  content: {
    padding: 15,
    paddingBottom: 100,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info + '15',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
    marginBottom: 20,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    marginLeft: 12,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  jobTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  jobTypeButton: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  jobTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  jobTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  jobTypeTextActive: {
    color: colors.white,
  },
  additionalOptions: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 15,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  postButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    backgroundColor: colors.mediumGray,
  },
  postButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default CreateJobScreen;
