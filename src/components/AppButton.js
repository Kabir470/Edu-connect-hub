import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';

const AppButton = ({ title, onPress, icon, loading, disabled, style, textStyle }) => {
  const isDisabled = disabled || loading;
  const indicatorColor = textStyle?.color || colors.white;
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.btn, isDisabled && styles.btnDisabled, style]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={indicatorColor} style={{ marginRight: 8 }} /> : null}
          <Text style={[styles.text, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  text: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});

export default AppButton;
