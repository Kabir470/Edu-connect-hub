import React, { useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import AuthContext from '../context/AuthContext';
import { subscribeToCodeSite, buildInlineHtml } from '../utils/portfolioService';
import colors from '../constants/colors';

const PortfolioPreviewScreen = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const routeUserId = route?.params?.userId || null;
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);

  const targetId = routeUserId || user?.uid;
  const isOwn = !!user?.uid && targetId === user.uid;
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    if (!targetId) { setLoading(false); return; }
    const unsub = subscribeToCodeSite(
      targetId,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (!isOwn && d.public === false) {
            setRestricted(true);
            setSite(null);
          } else {
            setRestricted(false);
            setSite(d);
          }
        } else {
          setSite(null);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub && unsub();
  }, [targetId, isOwn]);

  const html = useMemo(() => buildInlineHtml({
    title: site?.title || 'Portfolio',
    html: site?.html || '<h2>No portfolio content yet</h2><p>Create one now.</p>',
    css: site?.css || 'body { font-family: -apple-system, Roboto, Arial; padding:20px; }',
    js: site?.js || '',
  }), [site]);

  if (!user) return <View style={styles.center}><Text>Login required.</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>{site?.title || (isOwn ? 'My Portfolio' : 'Portfolio')}</Text>
        <View style={styles.headerActions}>
          {isOwn && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('PortfolioBuilder')}>
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {!restricted ? (
        <WebView originWhitelist={["*"]} source={{ html }} style={styles.web} />
      ) : (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={28} color={colors.primary} />
          <Text style={{ marginTop: 8, color: colors.text }}>This portfolio is private.</Text>
        </View>
      )}
      {!site && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyText}>No portfolio yet.</Text>
          {isOwn && (
            <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('PortfolioBuilder')}>
              <Text style={styles.createText}>Create Portfolio</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  headerActions: { flexDirection: 'row' },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: colors.primary, borderRadius: 8 },
  actionText: { color: '#fff', fontWeight: '600' },
  web: { flex: 1 },
  emptyOverlay: { position: 'absolute', top: 100, left: 0, right: 0, alignItems: 'center' },
  emptyText: { fontSize: 16, color: colors.textLight, marginBottom: 12 },
  createBtn: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  createText: { color: '#fff', fontWeight: '600' },
});

export default PortfolioPreviewScreen;
