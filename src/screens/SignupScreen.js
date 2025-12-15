import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import AppTextInput from '../components/AppTextInput';
import AppButton from '../components/AppButton';
import { checkUsernameAvailable, validateUsername } from '../utils/usernameService';

const SignUpScreen = ({navigation}) => {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError('');

    if (!fullName.trim()) return setError('Please enter your full name.');
    if (!email.trim() || !password) return setError('Please fill all fields.');

    const emailRe = /\S+@\S+\.\S+/;
    if (!emailRe.test(email.trim())) return setError('Invalid email format.');

    if (password.length < 6) return setError('Password must be at least 6 characters.');

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.ok) {
      return setError(usernameCheck.message);
    }

    const usernameAvailable = await checkUsernameAvailable(usernameCheck.normalized);
    if (!usernameAvailable) {
      return setError('That username is already taken.');
    }

    try {
      setLoading(true);
      await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        username: usernameCheck.normalized,
      });

      Alert.alert(
        'Account created',
        'Now complete your profile (address, profile photo, NID) and request verification to unlock posting, messaging, job applications, and consultations.'
      );
    } catch (e) {
      setError(e?.message || 'Signup failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      style={{ flex: 1 }}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Brand */}
          <View style={styles.brandRow}>
            <View style={styles.brandIconWrap}>
              <Ionicons name="sparkles-outline" size={26} color={colors.white} />
            </View>
            <Text style={styles.brandText}>AcademicConnect</Text>
          </View>

          <Text style={styles.welcome}>Create account</Text>
          <Text style={styles.subtitle}>Join the community</Text>

          {/* Inputs */}
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <AppTextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="John Doe"
              leftIcon={<Ionicons name="person-outline" size={20} color={colors.textLight} />}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <AppTextInput
              value={username}
              onChangeText={setUsername}
              placeholder="academic_handle"
              autoCapitalize="none"
              leftIcon={<Ionicons name="at-outline" size={20} color={colors.textLight} />}
            />
            <Text style={styles.helperText}>3-20 characters, letters/numbers/underscores only.</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <AppTextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<Ionicons name="mail-outline" size={20} color={colors.textLight} />}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <AppTextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={secure}
              leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.textLight} />}
              rightIcon={
                <TouchableOpacity onPress={() => setSecure(s => !s)}>
                  <Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textLight} />
                </TouchableOpacity>
              }
            />
          </View>


          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.white} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <AppButton title="Sign Up" icon="person-add-outline" onPress={handleSignUp} loading={loading} />

          <Text style={styles.tos}>
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  brandIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginRight: 10, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3
  },
  brandText: { fontSize: 22, fontWeight: '700', color: colors.text },
  welcome: { fontSize: 28, fontWeight: '800', color: colors.darkGray },
  subtitle: { fontSize: 14, color: colors.textLight, marginBottom: 22 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, color: colors.textLight, marginBottom: 8 },
  helperText: { marginTop: 6, fontSize: 12, color: colors.textLight },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.danger,
    padding: 10, borderRadius: 10, gap: 8, marginTop: 6, marginBottom: 4
  },
  errorText: { color: colors.white, fontSize: 13 },
  tos: { textAlign: 'center', color: colors.textLight, fontSize: 12, marginTop: 14 }
});

export default SignUpScreen;
