import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';

const AdminDashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={26} color={colors.white} />
        <Text style={styles.headerText}>Admin Dashboard</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.welcome}>Welcome, {user?.email}</Text>
        <Text style={styles.sub}>Quick actions</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.tile, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Home', { screen: 'CreatePost' })}>
            <Ionicons name="create-outline" size={24} color={colors.white} />
            <Text style={styles.tileText}>Create Post</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tile, { backgroundColor: colors.info }]}
            onPress={() => navigation.navigate('Jobs', { screen: 'CreateJob' })}>
            <Ionicons name="briefcase-outline" size={24} color={colors.white} />
            <Text style={styles.tileText}>Post Job</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tile, { backgroundColor: colors.accent }]}
            onPress={() => navigation.navigate('AdminManageUsers')}
          >
            <Ionicons name="people-outline" size={24} color={colors.white} />
            <Text style={styles.tileText}>Manage Users</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tile, { backgroundColor: colors.success }]}>
            <Ionicons name="stats-chart-outline" size={24} color={colors.white} />
            <Text style={styles.tileText}>Analytics</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    backgroundColor: colors.darkGray,
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  headerText: { color: colors.white, fontWeight: '700', fontSize: 18 },
  card: {
    margin: 16,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  welcome: { fontSize: 18, fontWeight: '700', color: colors.text },
  sub: { marginTop: 6, color: colors.textLight },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  tile: {
    width: '48%',
    aspectRatio: 1.6,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  tileText: { color: colors.white, fontWeight: '700' },
});

export default AdminDashboardScreen;
