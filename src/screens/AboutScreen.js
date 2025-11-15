import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, Image } from 'react-native';
import colors from '../constants/colors';

const AboutScreen = () => (
  <SafeAreaView style={styles.container}>
    <View style={styles.card}>
      <Image source={require('../../assets/shahriar-kabir.jpg')} style={styles.logo} />
      <Text style={styles.title}>AcademicConnect</Text>
      <Text style={styles.subtitle}>Connecting students, educators, and experts worldwide.</Text>
      <Text style={styles.body}>
        Version 1.0.0{"\n"}
        Built with Expo · React Native{"\n"}
        © {new Date().getFullYear()} AcademicConnect Labs
      </Text>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, justifyContent: 'center' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  logo: { width: 72, height: 72, borderRadius: 36, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.textLight, textAlign: 'center', marginTop: 6 },
  body: { textAlign: 'center', color: colors.textLight, marginTop: 12, lineHeight: 20 },
});

export default AboutScreen;
