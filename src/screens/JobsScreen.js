import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { subscribeToJobs } from '../utils/jobService';

const formatRelativeTime = (ts) => {
  if (!ts) return '';
  const date = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};

const JobsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const categories = ['All', 'Research', 'Teaching', 'Industry', 'Internship'];

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    const unsub = subscribeToJobs({
      onData: (items) => {
        setJobs(items || []);
        setLoading(false);
      },
      onError: (error) => {
        setLoadError(error);
        setJobs([]);
        setLoading(false);
      },
    });
    return () => {
      try { unsub && unsub(); } catch (_) {}
    };
  }, []);

  const filteredJobs = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    return (jobs || []).filter((job) => {
      const title = (job?.title || '').toLowerCase();
      const company = (job?.company || '').toLowerCase();
      const matchesSearch = !q || title.includes(q) || company.includes(q);

      const jobCategory = job?.category || '';
      const matchesCategory = selectedCategory === 'All' || jobCategory === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [jobs, searchQuery, selectedCategory]);

  const renderJob = ({ item }) => (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
      activeOpacity={0.8}
    >
      <View style={styles.jobHeader}>
        <View style={styles.companyLogo}>
          <Text style={styles.companyInitial}>{(item.company || 'C')[0]}</Text>
        </View>
        <View style={styles.jobInfo}>
          <Text style={styles.jobTitle}>{item.title}</Text>
          <Text style={styles.companyName}>{item.company}</Text>
          {!!(item?.createdBy?.fullName || item?.createdBy?.username) && (
            <Text style={styles.postedBy} numberOfLines={1}>
              Posted by {item?.createdBy?.fullName || item?.createdBy?.username}
            </Text>
          )}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={colors.textLight} />
            <Text style={styles.location}>{item.location}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.bookmarkButton}>
          <Ionicons name="bookmark-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.jobDetails}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.type}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.salary}</Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.jobFooter}>
        <Text style={styles.posted}>{formatRelativeTime(item.createdAt) || ''}</Text>
        <TouchableOpacity
          style={styles.applyButton}
          onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
        >
          <Text style={styles.applyButtonText}>Apply Now</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={colors.textLight} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs, companies..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textLight}
        />
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="options-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryButton,
                selectedCategory === item && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === item && styles.categoryTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Jobs List */}
      <FlatList
        data={filteredJobs}
        renderItem={renderJob}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View style={styles.headerSection}>
            <Text style={styles.resultsText}>
              {filteredJobs.length} jobs found
            </Text>
            {(['expert', 'teacher', 'admin'].includes(user?.role)) && (
              <TouchableOpacity 
                style={styles.postJobButton}
                onPress={() => navigation.navigate('CreateJob')}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.white} />
                <Text style={styles.postJobText}>Post Job</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={() => {
          if (loading) {
            return (
              <View style={styles.emptyState}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.emptyText}>Loading jobs…</Text>
              </View>
            );
          }

          if (loadError) {
            return (
              <View style={styles.emptyState}>
                <Ionicons name="alert-circle-outline" size={36} color={colors.warning} />
                <Text style={styles.emptyText}>Could not load jobs</Text>
              </View>
            );
          }

          return (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={40} color={colors.mediumGray} />
              <Text style={styles.emptyText}>No jobs posted yet</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 15,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 15,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: colors.text,
  },
  filterButton: {
    padding: 8,
  },
  categoriesContainer: {
    marginBottom: 15,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 15,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  categoryTextActive: {
    color: colors.white,
  },
  listContent: {
    paddingBottom: 120,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 15,
    marginBottom: 10,
  },
  resultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  postJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postJobText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  jobCard: {
    backgroundColor: colors.white,
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 12,
    padding: 15,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  companyLogo: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  companyInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  companyName: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 4,
  },
  postedBy: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    fontSize: 13,
    color: colors.textLight,
    marginLeft: 4,
  },
  bookmarkButton: {
    padding: 5,
  },
  jobDetails: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: colors.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textLight,
    marginBottom: 12,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  posted: {
    fontSize: 13,
    color: colors.mediumGray,
  },
  applyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 10,
    color: colors.textLight,
  },
});

export default JobsScreen;
