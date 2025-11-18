import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToUserProjects, togglePinProject } from '../utils/portfolioService';
import AuthContext from '../context/AuthContext';
import colors from '../constants/colors';

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

  const renderProject = ({ item }) => (
    <TouchableOpacity
      style={styles.projectCard}
      onPress={() => navigation.navigate('ProjectDetail', { project: item })}
    >
      <View style={styles.projectHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.projectName}>{item.name}</Text>
          {!!item.description && <Text style={styles.projectDesc}>{item.description}</Text>}
        </View>
        <TouchableOpacity
          style={styles.pinBadge}
          onPress={() => togglePinProject({ projectId: item.id, ownerId: user.uid, pinned: !item.pinned })}
        >
          <Ionicons
            name={item.pinned ? 'star' : 'star-outline'}
            size={16}
            color={item.pinned ? colors.warning : colors.text}
          />
          <Text style={[styles.pinText, item.pinned && { color: colors.warning }]}> {item.pinned ? 'Pinned' : 'Pin'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.metaRow}>
        {!!item.primaryLanguage && <Text style={styles.metaPill}>{item.primaryLanguage}</Text>}
        {!!item.visibility && <Text style={styles.metaPill}>{item.visibility}</Text>}
        <Text style={styles.metaPill}>⭐ {item.starsCount || 0}</Text>
      </View>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <View style={styles.center}> 
        <Text style={styles.emptyText}>Please sign in to view your portfolio.</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={renderProject}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <View style={styles.headerWrapper}>
            <View style={styles.heroCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Your work at a glance</Text>
                <Text style={styles.heroTitle}>{user.fullName || 'Portfolio'}</Text>
                <Text style={styles.heroSubtitle}>
                  Showcase curated projects, pin the highlights, and share code-ready case studies.
                </Text>
              </View>
              <View>
                <TouchableOpacity
                  style={styles.ctaButton}
                  onPress={() => navigation.navigate('CreateProject')}
                >
                  <Ionicons name="add" size={18} color={colors.white} />
                  <Text style={styles.ctaText}>New Project</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ctaButton, styles.secondaryCta]}
                  onPress={() => navigation.navigate('PortfolioBuilder')}
                >
                  <Ionicons name="code-slash" size={18} color={colors.primary} />
                  <Text style={[styles.ctaText, { color: colors.primary }]}>Portfolio Builder</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Pinned</Text>
              <Text style={styles.sectionCaption}>{pinned.length} highlighted projects</Text>
            </View>

            {pinned.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pinnedScroller}
              >
                {pinned.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={styles.pinnedCard}
                    onPress={() => navigation.navigate('ProjectDetail', { project })}
                  >
                    <Text style={styles.pinnedName}>{project.name}</Text>
                    <Text numberOfLines={2} style={styles.pinnedDesc}>
                      {project.description || 'No description provided'}
                    </Text>
                    <View style={styles.pinnedMetaRow}>
                      {!!project.primaryLanguage && <Text style={styles.metaPill}>{project.primaryLanguage}</Text>}
                      <Text style={styles.metaPill}>⭐ {project.starsCount || 0}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="star-outline" size={24} color={colors.mediumGray} />
                <Text style={styles.emptyText}>Pin your best work to feature it here.</Text>
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>All Projects</Text>
              <Text style={styles.sectionCaption}>{projects.length} total</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Ionicons name="folder-open" size={46} color={colors.mediumGray} />
            <Text style={styles.emptyTitle}>No projects published yet</Text>
            <Text style={styles.emptySubtitle}>Start a new case study to populate your portfolio.</Text>
            <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('CreateProject')}>
              <Ionicons name="add" size={18} color={colors.white} />
              <Text style={styles.ctaText}>Create your first project</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  headerWrapper: { paddingHorizontal: 16, paddingTop: 16 },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroLabel: { color: colors.textLight, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 4 },
  heroSubtitle: { color: colors.textLight, marginTop: 6, lineHeight: 18 },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  ctaText: { color: colors.white, fontWeight: '600', marginLeft: 6 },
  secondaryCta: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  sectionHeaderRow: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sectionCaption: { color: colors.textLight, fontSize: 13 },
  pinnedScroller: { paddingBottom: 6 },
  pinnedCard: {
    width: 220,
    marginRight: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    shadowColor: colors.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pinnedName: { fontSize: 16, fontWeight: '600', color: colors.text },
  pinnedDesc: { color: colors.textLight, fontSize: 13, marginTop: 6 },
  pinnedMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  emptyCard: {
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: colors.textLight, textAlign: 'center', marginTop: 8 },
  projectCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  projectHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  projectName: { fontSize: 17, fontWeight: '700', color: colors.text },
  projectDesc: { color: colors.textLight, marginTop: 6 },
  pinBadge: { flexDirection: 'row', alignItems: 'center' },
  pinText: { fontWeight: '600', color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metaPill: {
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.lightGray,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12, color: colors.text },
  emptySubtitle: { color: colors.textLight, marginTop: 4, marginBottom: 12, textAlign: 'center' },
});

export default PortfolioScreen;
