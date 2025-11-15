import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, Linking, TouchableOpacity, FlatList } from 'react-native';
import colors from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';

const FAQ = [
  { question: 'How do I verify my account?', answer: 'Upload a valid ID and wait for our team to review it. We typically approve within 24 hours.' },
  { question: 'How can I reset my password?', answer: 'Go to the login screen, tap “Forgot password?”, and follow the email instructions.' },
  { question: 'Why can’t I post?', answer: 'New accounts must be approved before posting. Check your verification status on your profile.' },
];

const HelpCenterScreen = () => (
  <SafeAreaView style={styles.container}>
    <FlatList
      data={FAQ}
      keyExtractor={(item, index) => `${item.question}-${index}`}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.question}>{item.question}</Text>
          <Text style={styles.answer}>{item.answer}</Text>
        </View>
      )}
      ListHeaderComponent={
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.title}>Need help?</Text>
          <Text style={styles.subtitle}>We’re here for you 24/7</Text>
          <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('mailto:support@academicconnect.app')}>
            <Ionicons name="mail-outline" size={22} color={colors.primary} />
            <Text style={styles.contactText}>support@academicconnect.app</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('https://academicconnect.app/help')}>
            <Ionicons name="globe-outline" size={22} color={colors.primary} />
            <Text style={styles.contactText}>Help Center Portal</Text>
          </TouchableOpacity>
        </View>
      }
      contentContainerStyle={{ paddingBottom: 30 }}
    />
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.textLight, marginTop: 4 },
  contactRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  contactText: { marginLeft: 8, color: colors.primary },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  question: { fontWeight: '700', color: colors.text, marginBottom: 6 },
  answer: { color: colors.textLight },
});

export default HelpCenterScreen;
