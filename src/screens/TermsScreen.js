import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing AcademicConnect you agree to comply with these terms and our community guidelines.',
  },
  {
    title: '2. User Responsibilities',
    body: 'You are responsible for any content you post. Do not share confidential information or infringe on others’ rights.',
  },
  {
    title: '3. Data Usage',
    body: 'We store your posts, job applications, and consultation data so that core features work across devices.',
  },
  {
    title: '4. Termination',
    body: 'We may suspend accounts that violate policies. You can delete your account anytime from Privacy & Security.',
  },
];

const TermsScreen = () => (
  <SafeAreaView style={styles.container}>
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      {sections.map((section) => (
        <Text key={section.title} style={styles.title}>
          {section.title}
          {'\n'}
          <Text style={styles.body}>{section.body}</Text>
        </Text>
      ))}
      <Text style={[styles.body, { marginTop: 20 }]}>Last updated: {new Date().toLocaleDateString()}</Text>
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  body: { fontSize: 14, color: colors.textLight, fontWeight: '400' },
});

export default TermsScreen;
