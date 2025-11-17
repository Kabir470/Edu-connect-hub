import React, { useState, useContext } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import AuthContext from '../context/AuthContext';
import { createProject } from '../utils/portfolioService';

const CreateProjectScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!user) return Alert.alert('Auth', 'Login required');
    if (!name.trim()) return Alert.alert('Validation', 'Name required');
    setSubmitting(true);
    try {
      await createProject({
        owner: user,
        name,
        description,
        primaryLanguage: language,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        visibility,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>New Project</Text>
      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TextInput style={[styles.input, styles.multiline]} multiline placeholder="Description" value={description} onChangeText={setDescription} />
      <TextInput style={styles.input} placeholder="Primary Language" value={language} onChangeText={setLanguage} />
      <TextInput style={styles.input} placeholder="Tags (comma separated)" value={tags} onChangeText={setTags} />
      <View style={styles.visibilityRow}>
        <TouchableOpacity onPress={() => setVisibility('public')} style={[styles.visBtn, visibility === 'public' && styles.activeVis]}>
          <Text style={styles.visText}>Public</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setVisibility('private')} style={[styles.visBtn, visibility === 'private' && styles.activeVis]}>
          <Text style={styles.visText}>Private</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity disabled={submitting} style={styles.submitBtn} onPress={handleCreate}>
        <Text style={styles.submitText}>{submitting ? 'Creating...' : 'Create'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  input: { backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  visibilityRow: { flexDirection: 'row', marginBottom: 12 },
  visBtn: { padding: 10, backgroundColor: '#eee', marginRight: 10, borderRadius: 6 },
  activeVis: { backgroundColor: '#0066cc' },
  visText: { color: '#000' },
  submitBtn: { backgroundColor: '#0066cc', padding: 12, borderRadius: 8, marginTop: 4 },
  submitText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});

export default CreateProjectScreen;
