import React, { useEffect, useState, useContext, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Switch, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import AuthContext from '../context/AuthContext';
import { subscribeToCodeSite, saveCodeSite, buildInlineHtml } from '../utils/portfolioService';

const PortfolioBuilderScreen = () => {
  const { user } = useContext(AuthContext);
  const [title, setTitle] = useState('My Portfolio');
  const [html, setHtml] = useState('<h1>Hello 👋</h1>');
  const [css, setCss] = useState('body { font-family: -apple-system, Roboto, Arial; padding: 16px; }');
  const [js, setJs] = useState("console.log('Portfolio loaded')");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToCodeSite(
      user.uid,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setTitle(d.title || 'My Portfolio');
          setHtml(d.html || '');
          setCss(d.css || '');
          setJs(d.js || '');
          setIsPublic(!!d.public);
        }
        setLoading(false);
      },
      (e) => {
        console.warn('code site sub error', e);
        setLoading(false);
      }
    );
    return () => unsub && unsub();
  }, [user?.uid]);

  const composed = useMemo(() => buildInlineHtml({ title, html, css, js }), [title, html, css, js]);

  const onSave = async () => {
    if (!user?.uid) return Alert.alert('Auth', 'Login required');
    setSaving(true);
    try {
      await saveCodeSite({ ownerId: user.uid, title, html, css, js, isPublic });
      Alert.alert('Saved', 'Your portfolio has been saved.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <View style={styles.center}><Text>Login required.</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.editorPane} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} />

        <View style={styles.switchRow}>
          <Text style={styles.label}>Public</Text>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </View>

        <Text style={styles.label}>HTML</Text>
        <TextInput
          style={[styles.input, styles.code]}
          multiline
          value={html}
          onChangeText={setHtml}
          placeholder="<!doctype html>..."
        />

        <Text style={styles.label}>CSS</Text>
        <TextInput
          style={[styles.input, styles.code]}
          multiline
          value={css}
          onChangeText={setCss}
          placeholder="body { }"
        />

        <Text style={styles.label}>JavaScript</Text>
        <TextInput
          style={[styles.input, styles.code]}
          multiline
          value={js}
          onChangeText={setJs}
          placeholder="console.log('hello');"
        />

        <TouchableOpacity disabled={saving} style={styles.saveBtn} onPress={onSave}>
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Portfolio'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.previewPane}>
        <Text style={styles.previewHeader}>Live Preview</Text>
        <WebView originWhitelist={["*"]} source={{ html: composed }} style={{ flex: 1 }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  editorPane: { flex: 1, backgroundColor: '#fafafa', padding: 12 },
  label: { fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 6, padding: 10, marginBottom: 12 },
  code: { minHeight: 120, fontFamily: 'monospace', textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  saveBtn: { backgroundColor: '#0066cc', padding: 12, borderRadius: 8, marginBottom: 8 },
  saveText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  previewPane: { height: 300, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#ddd', backgroundColor: '#fff' },
  previewHeader: { padding: 8, fontWeight: '600' },
});

export default PortfolioBuilderScreen;
