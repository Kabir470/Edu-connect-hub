import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { subscribeToExperts } from '../utils/consultationService';

const ExpertsScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Computer Science', 'Medicine', 'Engineering', 'Business', 'Law'];
  const [experts, setExperts] = useState([]);

  useEffect(() => {
    const unsub = subscribeToExperts(setExperts, (e) => console.warn('experts sub err', e), {
      category: selectedCategory,
      search: searchQuery,
    });
    return () => unsub && unsub();
  }, [selectedCategory, searchQuery]);

  // Filtering already handled via subscribeToExperts (search + category).
  // Avoid double filtering that caused undefined .toLowerCase() errors when fields missing.
  const filteredExperts = experts;

  const renderExpert = ({ item }) => (
    <TouchableOpacity
      style={styles.expertCard}
      onPress={() => navigation.navigate('ExpertDetail', { expert: item })}
      activeOpacity={0.8}
    >
      <View style={styles.expertHeader}>
        <Image source={item.profileImageURL ? { uri: item.profileImageURL } : require('../../assets/shahriar-kabir.jpg')} style={styles.avatar} />
        {item.consultAvailable && (
          <View style={styles.availableBadge}>
            <View style={styles.availableDot} />
            <Text style={styles.availableText}>Available</Text>
          </View>
        )}
      </View>

      <View style={styles.expertInfo}>
        <Text style={styles.expertName}>{item.fullName || item.name || 'Expert'}</Text>
        <Text style={styles.expertTitle}>{item.title || (item.expertise && item.expertise[0]) || 'Consultant'}</Text>

        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={16} color={colors.warning} />
          <Text style={styles.rating}>{Number(item.rating || 4.8).toFixed(1)}</Text>
          <Text style={styles.reviews}>({item.reviews || 0} reviews)</Text>
        </View>

        <View style={styles.expertiseContainer}>
          {(item.expertise || []).slice(0, 3).map((skill, index) => (
            <View key={index} style={styles.expertiseTag}>
              <Text style={styles.expertiseText}>{skill}</Text>
            </View>
          ))}
        </View>

        <View style={styles.expertFooter}>
          <View style={styles.experienceContainer}>
            <Ionicons name="briefcase-outline" size={16} color={colors.textLight} />
            <Text style={styles.experience}>{item.experience}</Text>
          </View>
          <View style={styles.rateContainer}>
            <Text style={styles.rateLabel}>Rate: </Text>
            <Text style={styles.rate}>${item.hourlyRate}/hr</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[
            styles.bookButton,
            !item.consultAvailable && styles.bookButtonDisabled
          ]}
          disabled={!item.consultAvailable}
          onPress={() => navigation.navigate('ExpertDetail', { expert: item })}
        >
          <Ionicons 
            name="calendar-outline" 
            size={18} 
            color={colors.white} 
          />
          <Text style={styles.bookButtonText}>
            {item.consultAvailable ? 'Book Consultation' : 'Not Available'}
          </Text>
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
          placeholder="Search experts..."
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

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={24} color={colors.info} />
        <Text style={styles.infoBannerText}>
          Connect with experts for personalized consultation
        </Text>
      </View>

      {/* Experts List */}
      <FlatList
        data={filteredExperts}
        renderItem={renderExpert}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
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
    marginBottom: 10,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  categoryTextActive: {
    color: colors.white,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info + '15',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    marginLeft: 10,
  },
  listContent: {
    paddingBottom: 120,
    paddingHorizontal: 7.5,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  expertCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 7.5,
    marginVertical: 8,
    width: '47%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  expertHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 5,
  },
  availableText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '600',
  },
  expertInfo: {
    flex: 1,
  },
  expertName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  expertTitle: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 8,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  rating: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 4,
  },
  reviews: {
    fontSize: 11,
    color: colors.textLight,
    marginLeft: 4,
  },
  expertiseContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 10,
  },
  expertiseTag: {
    backgroundColor: colors.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    margin: 2,
  },
  expertiseText: {
    fontSize: 10,
    color: colors.text,
    fontWeight: '500',
  },
  expertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  experienceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  experience: {
    fontSize: 11,
    color: colors.textLight,
    marginLeft: 4,
  },
  rateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateLabel: {
    fontSize: 11,
    color: colors.textLight,
  },
  rate: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  bookButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: colors.mediumGray,
  },
  bookButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default ExpertsScreen;
