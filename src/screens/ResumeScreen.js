import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const ResumeScreen = () => {
  const { user } = useAuth();
  const [resumeSummary, setResumeSummary] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [achievements, setAchievements] = useState([]);
  const [achievementInput, setAchievementInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setResumeSummary(data.resumeSummary || '');
          setResumeUrl(data.resumeUrl || '');
          setAchievements(data.resumeHighlights || []);
        }
      } catch (error) {
        console.warn('Failed to load resume info', error);
      }
    };
    load();
  }, [user?.uid]);

  const handleSave = async () => {
    if (!user?.uid) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, 'users', user.uid), {
        resumeSummary: resumeSummary.trim(),
        resumeUrl: resumeUrl.trim(),
        resumeHighlights: achievements,
        updatedAt: new Date().toISOString(),
      });
      Alert.alert('Saved', 'Your resume profile has been updated.');
    } catch (error) {
      console.error('Resume save failed', error);
      Alert.alert('Error', 'Unable to save resume info.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAchievement = () => {
    const trimmed = achievementInput.trim();
    if (!trimmed) return;
    setAchievements((prev) => [trimmed, ...prev]);
    setAchievementInput('');
  };

  const handleRemoveAchievement = (item) => {
    setAchievements((prev) => prev.filter((ach) => ach !== item));
  };

  const openResumeLink = () => {
    if (!resumeUrl) return;
    Linking.openURL(resumeUrl).catch(() =>
      Alert.alert('Unable to open', 'Check that your resume link is valid (starts with https://)')
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ListHeaderComponent={
          <>
            <Text style={styles.sectionTitle}>Summary</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              placeholder="Highlight your strongest skills and experience"
              placeholderTextColor={colors.textLight}
              value={resumeSummary}
              onChangeText={setResumeSummary}
            />

            <Text style={styles.sectionTitle}>Resume Link</Text>
            <View style={styles.rowInput}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="https://drive.google.com/your-resume"
                placeholderTextColor={colors.textLight}
                autoCapitalize="none"
                value={resumeUrl}
                onChangeText={setResumeUrl}
              />
              <TouchableOpacity style={styles.openButton} onPress={openResumeLink}>
                <Ionicons name="open-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Highlights</Text>
            <View style={styles.rowInput}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Add certification, award, or key accomplishment"
                placeholderTextColor={colors.textLight}
                value={achievementInput}
                onChangeText={setAchievementInput}
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddAchievement}>
                <Ionicons name="add" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
          </>
        }
        data={achievements}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={({ item }) => (
          <View style={styles.achievementItem}>
            <Text style={styles.achievementText}>{item}</Text>
            <TouchableOpacity onPress={() => handleRemoveAchievement(item)}>
              <Ionicons name="close" size={18} color={colors.mediumGray} />
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Resume'}</Text>
          </TouchableOpacity>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>Add highlights to make your resume stand out.</Text>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    marginBottom: 10,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  rowInput: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  openButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: colors.white,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  achievementText: { flex: 1, color: colors.text, marginRight: 12 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  emptyText: { textAlign: 'center', color: colors.textLight, marginTop: 12 },
});

export default ResumeScreen;
