import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import AppTextInput from '../components/AppTextInput';
import AppButton from '../components/AppButton';

const ROLES = [
  { key: 'user', label: 'User', icon: 'person-outline' },
  { key: 'expert', label: 'Expert', icon: 'school-outline' },
  { key: 'teacher', label: 'Teacher', icon: 'easel-outline' },
  { key: 'admin', label: 'Admin', icon: 'shield-checkmark-outline' },
];

const LoginScreen = ({navigation}) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter email and password.');
      return;
    }
    // Simple email check
    const emailRe = /\S+@\S+\.\S+/;
    if (!emailRe.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    try {
      setLoading(true);
      await signIn({ email: email.trim(), password, role });
    } catch (e) {
      setError(e?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    // Navigate to Signup Screen
    navigation.navigate('SignupScreen');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <View style={styles.container}>
          {/* Brand */}
          <View style={styles.brandRow}>
            <View style={styles.brandIconWrap}>
              <Ionicons name="sparkles-outline" size={26} color={colors.white} />
            </View>
            <Text style={styles.brandText}>AcademicConnect</Text>
          </View>

          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          {/* Role Selector */}
          <View style={styles.roleWrap}>
            {ROLES.map((r) => {
              const active = role === r.key;
              return (
                <TouchableOpacity key={r.key} style={[styles.rolePill, active && styles.rolePillActive]} onPress={() => setRole(r.key)} activeOpacity={0.8}>
                  <Ionicons name={r.icon} size={18} color={active ? colors.white : colors.text} style={{ marginRight: 6 }} />
                  <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Inputs */}
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <AppTextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
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
                <TouchableOpacity onPress={() => setSecure((s) => !s)}>
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

          {/* Actions */}
          <AppButton title="Sign In" icon="log-in-outline" onPress={handleLogin} loading={loading} />

          {/* Sign Up Button */}
          <AppButton textStyle={{color: 'black'}} style={{backgroundColor: 'white', marginTop: 15}} title="Sign Up" icon="log-in-outline" onPress={handleSignUp} loading={loading} />


          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>Forgot password?</Text>
          </TouchableOpacity>

          <Text style={styles.tos}>By continuing, you agree to our Terms of Service and Privacy Policy.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  welcome: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.darkGray,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 22,
  },
  roleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rolePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  roleLabel: {
    color: colors.text,
    fontWeight: '600',
  },
  roleLabelActive: {
    color: colors.white,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    color: colors.textLight,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  errorText: {
    color: colors.white,
    fontSize: 13,
  },
  loginBtn: {},
  loginText: {},
  linkRow: {
    alignItems: 'center',
    marginTop: 14,
  },
  linkText: {
    color: colors.info,
    fontWeight: '600',
  },
  tos: {
    textAlign: 'center',
    color: colors.textLight,
    fontSize: 12,
    marginTop: 18,
  },
});

export default LoginScreen;
