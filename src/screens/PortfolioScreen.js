import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { subscribeToUserProjects, togglePinProject } from '../utils/portfolioService';
import AuthContext from '../context/AuthContext';

const PortfolioScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserProjects(
      user.uid,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.pinned === a.pinned ? 0 : b.pinned ? 1 : -1));
        setProjects(list);
        setLoading(false);
      },
      (err) => {
        console.warn('portfolio subscribe error', err);
        setLoading(false);
      }
    );
    return () => unsub && unsub();
  }, [user]);

  const pinned = projects.filter((p) => p.pinned);
  const others = projects.filter((p) => !p.pinned);

  const renderProject = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ProjectDetail', { project: item })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.name}</Text>
        <TouchableOpacity
          onPress={() => togglePinProject({ projectId: item.id, ownerId: user.uid, pinned: !item.pinned })}
        >
          <Text style={styles.pin}>{item.pinned ? 'Unpin' : 'Pin'}</Text>
        </TouchableOpacity>
      </View>
      {!!item.description && <Text style={styles.desc}>{item.description}</Text>}
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{item.primaryLanguage}</Text>
        <Text style={styles.meta}>{item.visibility}</Text>
        <Text style={styles.meta}>⭐ {item.starsCount || 0}</Text>
      </View>
    </TouchableOpacity>
  );

  if (!user) return <View style={styles.center}><Text>Login required.</Text></View>;
  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <FlatList
      data={[{ header: true, id: 'header' }, ...pinned, ...others]}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        if (item.header) {
          return (
            <View style={styles.headerBlock}>
              <Text style={styles.sectionTitle}>Pinned</Text>
              {pinned.length === 0 && <Text style={styles.empty}>No pinned projects</Text>}
              <Text style={styles.sectionTitle}>All Projects</Text>
              {projects.length === 0 && <Text style={styles.empty}>No projects yet</Text>}
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => navigation.navigate('CreateProject')}
              >
                <Text style={styles.createText}>New Project</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, { marginTop: 8, backgroundColor: '#333' }]}
                onPress={() => navigation.navigate('PortfolioBuilder')}
              >
                <Text style={styles.createText}>Code Portfolio Builder</Text>
              </TouchableOpacity>
            </View>
          );
        }
        return renderProject({ item });
      }}
    />
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBlock: { padding: 16, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  empty: { fontSize: 14, color: '#666' },
  createBtn: { marginTop: 12, padding: 10, backgroundColor: '#0066cc', borderRadius: 6, width: 140 },
  createText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 6, padding: 12, borderRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600' },
  pin: { fontSize: 12, color: '#0066cc' },
  desc: { marginTop: 6, fontSize: 13, color: '#333' },
  metaRow: { flexDirection: 'row', marginTop: 8 },
  meta: { fontSize: 11, marginRight: 10, color: '#555' },
});

export default PortfolioScreen;
