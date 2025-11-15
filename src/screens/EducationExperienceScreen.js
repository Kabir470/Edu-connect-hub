import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const EntryForm = ({ title, form, setForm, onSubmit }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {[
      { label: 'Institution / Company', key: 'institution', placeholder: 'University of...' },
      { label: 'Program / Role', key: 'role', placeholder: 'BSc Computer Science / Product Manager' },
      { label: 'Start Year', key: 'start', placeholder: '2019', keyboardType: 'numeric' },
      { label: 'End Year (or Present)', key: 'end', placeholder: '2023 / Present' },
    ].map((field) => (
      <View key={field.key} style={styles.inputGroup}>
        <Text style={styles.label}>{field.label}</Text>
        <TextInput
          style={styles.input}
          placeholder={field.placeholder}
          placeholderTextColor={colors.textLight}
          value={form[field.key]}
          keyboardType={field.keyboardType}
          onChangeText={(text) => setForm((prev) => ({ ...prev, [field.key]: text }))}
        />
      </View>
    ))}
    <TouchableOpacity style={styles.addButton} onPress={onSubmit}>
      <Ionicons name="add" size={18} color={colors.white} />
      <Text style={styles.addButtonText}>Add</Text>
    </TouchableOpacity>
  </View>
);

const EntryList = ({ title, data, onRemove }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {data.length === 0 ? (
      <Text style={styles.emptyText}>No records yet.</Text>
    ) : (
      data.map((item, index) => (
        <View key={`${title}-${index}`} style={styles.entryItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.entryTitle}>{item.role}</Text>
            <Text style={styles.entrySubtitle}>{item.institution}</Text>
            <Text style={styles.entrySubtitle}>
              {item.start} - {item.end || 'Present'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onRemove(index)}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      ))
    )}
  </View>
);

const EducationExperienceScreen = () => {
  const { user } = useAuth();
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [educationForm, setEducationForm] = useState({ institution: '', role: '', start: '', end: '' });
  const [experienceForm, setExperienceForm] = useState({ institution: '', role: '', start: '', end: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setEducation(data.educationHistory || []);
          setExperience(data.experienceHistory || []);
        }
      } catch (error) {
        console.warn('Failed to load history', error);
      }
    };
    load();
  }, [user?.uid]);

  const persistData = async (updatedEducation, updatedExperience) => {
    if (!user?.uid) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, 'users', user.uid), {
        educationHistory: updatedEducation,
        experienceHistory: updatedExperience,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to save history', error);
      Alert.alert('Error', 'Unable to save your timeline right now.');
    } finally {
      setSaving(false);
    }
  };

  const addEducation = () => {
    if (!educationForm.institution.trim() || !educationForm.role.trim()) return;
    const updated = [educationForm, ...education];
    setEducation(updated);
    setEducationForm({ institution: '', role: '', start: '', end: '' });
    persistData(updated, experience);
  };

  const addExperience = () => {
    if (!experienceForm.institution.trim() || !experienceForm.role.trim()) return;
    const updated = [experienceForm, ...experience];
    setExperience(updated);
    setExperienceForm({ institution: '', role: '', start: '', end: '' });
    persistData(education, updated);
  };

  const removeEducation = (index) => {
    const updated = education.filter((_, idx) => idx !== index);
    setEducation(updated);
    persistData(updated, experience);
  };

  const removeExperience = (index) => {
    const updated = experience.filter((_, idx) => idx !== index);
    setExperience(updated);
    persistData(education, updated);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <EntryForm title="Add Education" form={educationForm} setForm={setEducationForm} onSubmit={addEducation} />
        <EntryList title="Education" data={education} onRemove={removeEducation} />

        <EntryForm title="Add Experience" form={experienceForm} setForm={setExperienceForm} onSubmit={addExperience} />
        <EntryList title="Experience" data={experience} onRemove={removeExperience} />

        {saving && <Text style={styles.savingText}>Saving changes…</Text>}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  inputGroup: { marginBottom: 10 },
  label: { fontSize: 13, color: colors.textLight, marginBottom: 4 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  addButtonText: { color: colors.white, marginLeft: 6, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: colors.textLight },
  entryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryTitle: { fontWeight: '700', color: colors.text },
  entrySubtitle: { color: colors.textLight, fontSize: 13 },
  savingText: { textAlign: 'center', color: colors.textLight },
});

export default EducationExperienceScreen;
