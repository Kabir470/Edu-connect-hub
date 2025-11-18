import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import colors from '../constants/colors';
import {
  subscribeToExpertAvailabilities,
  subscribeToExpertReviews,
  requestConsultation,
} from '../utils/consultationService';
import { useAuth } from '../context/AuthContext';
import { createSslCommerzSession, waitForSslPaymentConfirmation } from '../utils/paymentService';

const ExpertDetailScreen = ({ route, navigation }) => {
  const { expert } = route.params;
  const { user } = useAuth();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [booking, setBooking] = useState(false);
  const [paymentStatusText, setPaymentStatusText] = useState('');
  const [recentReviews, setRecentReviews] = useState([]);
  const expertiseSummary = Array.isArray(expert.expertise) && expert.expertise.length
    ? expert.expertise.join(', ')
    : 'multiple disciplines';

  useEffect(() => {
    const unsubSlots = subscribeToExpertAvailabilities(
      expert.id,
      (list) => setSlots(list),
      (e) => console.warn('avail err', e)
    );
    const unsubReviews = subscribeToExpertReviews(
      expert.id,
      (list) => setRecentReviews(list || []),
      (err) => console.warn('review subscribe err', err)
    );
    return () => {
      unsubSlots && unsubSlots();
      unsubReviews && unsubReviews();
    };
  }, [expert?.id]);

  const toReadable = (ts) => {
    if (!ts) return '';
    const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleString();
  };

  const formatReviewDate = (ts) => {
    if (!ts) return '';
    if (typeof ts?.toDate === 'function') {
      return ts.toDate().toLocaleDateString();
    }
    const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString();
  };

  const handleBookConsultation = async () => {
    if (!selectedTimeSlot) {
      Alert.alert('Select a slot', 'Please choose a time before booking.');
      return;
    }
    if (!user) {
      Alert.alert('Login required', 'Sign in to confirm your consultation.');
      return;
    }
    setBooking(true);
    setPaymentStatusText('Redirecting to payment gateway...');
    try {
      const amountDue = Number(selectedTimeSlot.rate || expert.hourlyRate || expert.rate || 0);
      const session = await createSslCommerzSession({ amount: amountDue, user, expert, slot: selectedTimeSlot });
      await WebBrowser.openBrowserAsync(session.gatewayUrl, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });

      setPaymentStatusText('Confirming payment with SSLCommerz...');
      const confirmation = await waitForSslPaymentConfirmation({ sessionKey: session.sessionKey });
      const paymentPayload = {
        ...confirmation,
        amount: confirmation.amount || amountDue,
        sessionKey: confirmation.sessionKey || session.sessionKey,
        transactionId: confirmation.transactionId || session.transactionId,
      };

      setPaymentStatusText('Submitting consultation request...');
      await requestConsultation({ user, expert, slot: selectedTimeSlot, payment: paymentPayload });
      setPaymentStatusText('');
      Alert.alert('Booking requested', 'Payment received. Await expert confirmation.');
      navigation.navigate('Profile', { screen: 'ScheduledConsultations' });
    } catch (e) {
      console.error('consult booking failed', e);
      Alert.alert('Booking failed', e.message || 'Advance payment was not completed.');
    } finally {
      setBooking(false);
      setPaymentStatusText('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Expert Profile Header */}
        <View style={styles.header}>
          <Image source={expert.profileImageURL ? { uri: expert.profileImageURL } : require('../../assets/shahriar-kabir.jpg')} style={styles.avatar} />
          <Text style={styles.name}>{expert.fullName || expert.name}</Text>
          <Text style={styles.title}>{expert.title || (expert.expertise && expert.expertise[0]) || 'Consultant'}</Text>
          
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={20} color={colors.warning} />
            <Text style={styles.rating}>{Number(expert.rating || 4.8).toFixed(1)}</Text>
            <Text style={styles.reviews}>({expert.reviews || 0} reviews)</Text>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{expert.experience || '—'}</Text>
              <Text style={styles.statLabel}>Experience</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>${expert.hourlyRate || 100}/hr</Text>
              <Text style={styles.statLabel}>Hourly Rate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{expert.reviews}</Text>
              <Text style={styles.statLabel}>Consultations</Text>
            </View>
          </View>

          {expert.consultAvailable && (
            <View style={styles.availableBadge}>
              <View style={styles.availableDot} />
              <Text style={styles.availableText}>Available Now</Text>
            </View>
          )}
        </View>

        {/* Expertise */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expertise</Text>
          <View style={styles.expertiseContainer}>
            {(expert.expertise || []).map((skill, index) => (
              <View key={index} style={styles.expertiseTag}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.expertiseText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.aboutText}>
            {expert.name} is a highly experienced professional with {expert.experience} of expertise in {expertiseSummary}. 
            They have helped numerous students and professionals achieve their academic and career goals through personalized consultation sessions.
          </Text>
        </View>

        {/* Available Time Slots */}
        {expert.consultAvailable && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Time Slots</Text>
            <View style={styles.timeSlotsContainer}>
              {slots.map((slot) => {
                const slotState = slot.status || (slot.booked ? 'booked' : 'open');
                const disabled = slotState !== 'open';
                const selected = selectedTimeSlot?.id === slot.id && !disabled;
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.timeSlot,
                      disabled && styles.timeSlotDisabled,
                      selected && styles.timeSlotSelected,
                    ]}
                    onPress={() => !disabled && setSelectedTimeSlot(slot)}
                    disabled={disabled}
                  >
                    <Text
                      style={[
                        styles.timeSlotText,
                        disabled && styles.timeSlotTextDisabled,
                        selected && styles.timeSlotTextSelected,
                      ]}
                    >
                      {toReadable(slot.start)}
                    </Text>
                    {slotState !== 'open' && (
                      <Text style={styles.slotBadge}>
                        {slotState === 'pending' ? 'Awaiting approval' : slotState === 'booked' ? 'Booked' : slotState}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
              {slots.length === 0 && (
                <Text style={{ color: colors.textLight }}>No published time slots.</Text>
              )}
            </View>
          </View>
        )}

        {/* Reviews */}
        <View style={styles.section}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>Reviews ({recentReviews.length || expert.reviews || 0})</Text>
            {recentReviews.length > 0 && (
              <TouchableOpacity onPress={() => Alert.alert('Coming soon', 'Full review list will be available in a future update.')}> 
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {recentReviews.length === 0 ? (
            <Text style={styles.noReviewText}>No reviews yet. Be the first after your session!</Text>
          ) : (
            recentReviews.slice(0, 3).map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatarPlaceholder}>
                    <Ionicons name="person" size={18} color={colors.white} />
                  </View>
                  <View style={styles.reviewInfo}>
                    <Text style={styles.reviewAuthor}>{review.reviewerName || 'Client'}</Text>
                    <View style={styles.reviewRating}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={`${review.id}-star-${star}`}
                          name={star <= (review.rating || 0) ? 'star' : 'star-outline'}
                          size={14}
                          color={colors.warning}
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewDate}>{formatReviewDate(review.reviewedAt)}</Text>
                </View>
                {!!review.review && <Text style={styles.reviewComment}>{review.review}</Text>}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Fixed Bottom Bar */}
      {expert.consultAvailable && (
        <View style={styles.bottomBar}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Consultation Fee</Text>
            <Text style={styles.price}>${expert.hourlyRate || 100}/hour</Text>
            {!!paymentStatusText && <Text style={styles.paymentStatusText}>{paymentStatusText}</Text>}
          </View>
          <TouchableOpacity 
            style={styles.bookButton}
            onPress={handleBookConsultation}
            disabled={!selectedTimeSlot || booking}
          >
            <Ionicons name="calendar" size={20} color={colors.white} />
            <Text style={styles.bookButtonText}>{booking ? 'Booking...' : 'Book Now'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.white,
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    color: colors.textLight,
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 6,
  },
  reviews: {
    fontSize: 14,
    color: colors.textLight,
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 15,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textLight,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  availableDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 8,
  },
  availableText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.white,
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 15,
  },
  expertiseContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  expertiseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    margin: 4,
  },
  expertiseText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 6,
    fontWeight: '500',
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textLight,
  },
  timeSlotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  timeSlot: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    margin: 6,
    minWidth: '45%',
  },
  timeSlotSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeSlotDisabled: {
    backgroundColor: colors.lightGray,
    borderColor: colors.lightGray,
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  timeSlotTextSelected: {
    color: colors.white,
  },
  timeSlotTextDisabled: {
    color: colors.mediumGray,
  },
  slotBadge: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textLight,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  reviewCard: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  reviewHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  reviewAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewInfo: {
    flex: 1,
  },
  reviewAuthor: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewDate: {
    fontSize: 12,
    color: colors.textLight,
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textLight,
  },
  noReviewText: {
    color: colors.textLight,
    fontStyle: 'italic',
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  priceContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  paymentStatusText: {
    fontSize: 12,
    color: colors.info,
    marginTop: 4,
  },
  bookButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  bookButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ExpertDetailScreen;
