import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToExpertAvailabilities,
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  toggleConsultAvailability,
} from '../utils/consultationService';

const statusColors = {
  open: colors.success,
  pending: colors.warning,
  booked: colors.primary,
  blocked: colors.textLight,
};

const AvailabilityManagerScreen = () => {
  const { user } = useAuth();
  const [slots, setSlots] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [newDate, setNewDate] = useState(() => {
    const date = new Date();
    date.setHours(date.getHours() + 2);
    return date;
  });
  const [duration, setDuration] = useState('30');
  const [location, setLocation] = useState('');
  const [virtualLink, setVirtualLink] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slotRemoving, setSlotRemoving] = useState(null);
  const [availabilityEnabled, setAvailabilityEnabled] = useState(Boolean(user?.consultAvailable ?? true));

  useEffect(() => {
    setAvailabilityEnabled(Boolean(user?.consultAvailable ?? true));
  }, [user?.consultAvailable]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsub = subscribeToExpertAvailabilities(
      user.uid,
      (list) => setSlots(list),
      (err) => console.warn('availability subscribe', err)
    );
    return () => unsub && unsub();
  }, [user?.uid]);

  const formattedDate = useMemo(() => newDate.toLocaleString(), [newDate]);

  const closeModal = () => {
    setModalVisible(false);
    setShowPicker(false);
    setDuration('30');
    setLocation('');
    setVirtualLink('');
    setNotes('');
  };

  const handleCreateSlot = async () => {
    if (!user?.uid) return;
    setSubmitting(true);
    try {
      await createAvailabilitySlot({
        expertId: user.uid,
        start: newDate,
        durationMinutes: Number(duration) || 30,
        location: location.trim() || null,
        notes: notes.trim() || null,
        virtualLink: virtualLink.trim() || null,
      });
      closeModal();
    } catch (e) {
      Alert.alert('Unable to add slot', e.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveSlot = async (slotId) => {
    if (!user?.uid || !slotId) return;
    setSlotRemoving(slotId);
    try {
      await deleteAvailabilitySlot({ expertId: user.uid, slotId });
    } catch (e) {
      Alert.alert('Cannot remove slot', e.message || 'Only open slots can be removed.');
    } finally {
      setSlotRemoving(null);
    }
  };

  const handleToggleAvailability = async (value) => {
    if (!user?.uid) return;
    setAvailabilityEnabled(value);
    try {
      await toggleConsultAvailability({ expertId: user.uid, enabled: value });
    } catch (e) {
      setAvailabilityEnabled(!value);
      Alert.alert('Unable to update', e.message || 'Please try again.');
    }
  };

  const renderSlot = ({ item }) => {
    const status = (item.status || 'open').toLowerCase();
    const color = statusColors[status] || colors.text;
    const canRemove = status === 'open';
    return (
      <View style={styles.slotCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.slotDate}>{item.start?.toDate ? item.start.toDate().toLocaleString() : new Date(item.start).toLocaleString()}</Text>
          <Text style={styles.slotMeta}>Duration: {item.durationMinutes || 30} mins</Text>
          {item.location ? <Text style={styles.slotMeta}>Location: {item.location}</Text> : null}
          {item.virtualLink ? <Text style={styles.slotMeta}>Meeting link: {item.virtualLink}</Text> : null}
          {item.notes ? <Text style={styles.slotMeta}>Notes: {item.notes}</Text> : null}
        </View>
        <View style={styles.statusPill(color)}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
        {canRemove && (
          <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveSlot(item.id)} disabled={slotRemoving === item.id}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={36} color={colors.textLight} />
      <Text style={styles.emptyText}>No availability slots yet</Text>
      <Text style={styles.emptySub}>Publish time slots so students can book you.</Text>
    </View>
  );

  if (user?.role !== 'expert') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed" size={36} color={colors.textLight} />
          <Text style={styles.emptyText}>Experts only</Text>
          <Text style={styles.emptySub}>Switch to your expert account to manage availability.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Availability Manager</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={22} color={colors.white} />
          <Text style={styles.addButtonText}>Add slot</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.switchRow}>
        <View>
          <Text style={styles.switchLabel}>Accepting new consultations</Text>
          <Text style={styles.switchSub}>Toggle to appear in search instantly.</Text>
        </View>
        <Switch value={availabilityEnabled} onValueChange={handleToggleAvailability} thumbColor={availabilityEnabled ? colors.primary : colors.mediumGray} />
      </View>

      <FlatList
        data={slots}
        keyExtractor={(item) => item.id}
        renderItem={renderSlot}
        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        ListEmptyComponent={<EmptyState />}
      />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Publish new slot</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowPicker(true)}>
              <Ionicons name="calendar" size={18} color={colors.primary} />
              <Text style={styles.pickerText}>{formattedDate}</Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker
                value={newDate}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(_, date) => {
                  setShowPicker(Platform.OS === 'ios');
                  if (date) setNewDate(date);
                }}
              />
            )}

            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="Duration (minutes)"
              placeholderTextColor={colors.mediumGray}
              value={duration}
              onChangeText={setDuration}
            />
            <TextInput
              style={styles.input}
              placeholder="Physical location (optional)"
              placeholderTextColor={colors.mediumGray}
              value={location}
              onChangeText={setLocation}
            />
            <TextInput
              style={styles.input}
              placeholder="Default meeting link (optional)"
              placeholderTextColor={colors.mediumGray}
              value={virtualLink}
              onChangeText={setVirtualLink}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Notes for the client"
              placeholderTextColor={colors.mediumGray}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.mediumGray }]} onPress={closeModal} disabled={submitting}>
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleCreateSlot} disabled={submitting}>
              <Text style={styles.modalBtnText}>{submitting ? 'Saving…' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 6 },
  addButtonText: { color: colors.white, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.white, padding: 14, borderRadius: 12, marginBottom: 16 },
  switchLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  switchSub: { fontSize: 12, color: colors.textLight },
  slotCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: 14, borderRadius: 12, marginBottom: 12, gap: 10 },
  slotDate: { fontSize: 15, fontWeight: '700', color: colors.text },
  slotMeta: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  statusPill: (color) => ({ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: color + '20' }),
  statusText: { color: colors.text, textTransform: 'capitalize', fontWeight: '600' },
  removeBtn: { marginLeft: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptySub: { marginTop: 6, color: colors.textLight, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: colors.white, borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 },
  pickerButton: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  pickerText: { color: colors.text, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, marginBottom: 10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  modalBtnText: { color: colors.white, fontWeight: '700' },
});

export default AvailabilityManagerScreen;
