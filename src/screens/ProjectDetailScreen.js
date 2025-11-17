import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import AuthContext from '../context/AuthContext';
import { updateProject, deleteProject, togglePinProject } from '../utils/portfolioService';

const ProjectDetailScreen = ({ route, navigation }) => {
  const { user } = useContext(AuthContext);
  const { project } = route.params;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [language, setLanguage] = useState(project.primaryLanguage);
  const [tags, setTags] = useState((project.tags || []).join(', '));
  const [visibility, setVisibility] = useState(project.visibility);
  const [saving, setSaving] = useState(false);

  const canEdit = user && user.uid === project.ownerId;

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await updateProject({
        projectId: project.id,
        ownerId: user.uid,
        patch: {
          name: name.trim(),
          description: description.trim(),
          primaryLanguage: language.trim() || 'Other',
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          visibility,
        },
      });
      Alert.alert('Saved', 'Project updated');
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert('Delete', 'Delete this project?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProject({ projectId: project.id, ownerId: user.uid });
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {editing ? (
        <>
          <Text style={styles.title}>Edit Project</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
          <TextInput style={[styles.input, styles.multiline]} multiline value={description} onChangeText={setDescription} />
          <TextInput style={styles.input} value={language} onChangeText={setLanguage} />
          <TextInput style={styles.input} value={tags} onChangeText={setTags} />
          <View style={styles.visibilityRow}>
            <TouchableOpacity onPress={() => setVisibility('public')} style={[styles.visBtn, visibility === 'public' && styles.activeVis]}>
              <Text style={styles.visText}>Public</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setVisibility('private')} style={[styles.visBtn, visibility === 'private' && styles.activeVis]}>
              <Text style={styles.visText}>Private</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity disabled={saving} style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{project.name}</Text>
            {canEdit && (
              <TouchableOpacity onPress={() => togglePinProject({ projectId: project.id, ownerId: user.uid, pinned: !project.pinned })}>
                <Text style={styles.pinText}>{project.pinned ? 'Unpin' : 'Pin'}</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!project.description && <Text style={styles.desc}>{project.description}</Text>}
          <Text style={styles.meta}>Language: {project.primaryLanguage}</Text>
          <Text style={styles.meta}>Visibility: {project.visibility}</Text>
          <Text style={styles.meta}>Tags: {(project.tags || []).join(', ') || 'None'}</Text>
          <Text style={styles.meta}>Stars: {project.starsCount || 0}</Text>
          {canEdit && (
            <>
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  input: { backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  visibilityRow: { flexDirection: 'row', marginBottom: 12 },
  visBtn: { padding: 10, backgroundColor: '#eee', marginRight: 10, borderRadius: 6 },
  activeVis: { backgroundColor: '#0066cc' },
  visText: { color: '#000' },
  saveBtn: { backgroundColor: '#0066cc', padding: 12, borderRadius: 8, marginTop: 4 },
  saveText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  cancelBtn: { padding: 12, borderRadius: 8, marginTop: 8, backgroundColor: '#999' },
  cancelText: { color: '#fff', textAlign: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pinText: { color: '#0066cc' },
  desc: { marginBottom: 10, fontSize: 14, color: '#333' },
  meta: { fontSize: 13, marginBottom: 4, color: '#444' },
  editBtn: { backgroundColor: '#0066cc', padding: 10, borderRadius: 6, marginTop: 12 },
  editText: { color: '#fff', textAlign: 'center' },
  deleteBtn: { backgroundColor: '#cc0000', padding: 10, borderRadius: 6, marginTop: 8 },
  deleteText: { color: '#fff', textAlign: 'center' },
});

export default ProjectDetailScreen;
