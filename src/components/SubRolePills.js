import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';
import { getRoleLabels, sentenceCase } from '../utils/roleUtils';

const SubRolePills = ({
  primaryRole = '',
  subRoles = [],
  fallbackLabel = '',
  style,
  pillStyle,
  textStyle,
}) => {
  const secondaryLabels = getRoleLabels(subRoles, primaryRole);
  const items = [];
  if (primaryRole) {
    items.push({ key: `primary-${primaryRole}`, label: sentenceCase(primaryRole), variant: 'primary' });
  }
  secondaryLabels.forEach((label, index) => {
    items.push({ key: `secondary-${label}-${index}`, label, variant: 'secondary' });
  });
  if (!items.length && fallbackLabel) {
    items.push({ key: 'fallback', label: sentenceCase(fallbackLabel), variant: 'primary' });
  }
  if (!items.length) return null;

  return (
    <View style={[styles.container, style]}>
      {items.map((item) => {
        const isPrimary = item.variant === 'primary';
        const accentColor = isPrimary ? colors.primary : colors.secondary;
        const tint = `${accentColor}1A`;
        return (
          <View
            key={item.key}
            style={[
              styles.pill,
              styles.outlinedPill,
              { borderColor: accentColor, backgroundColor: tint },
              pillStyle,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: accentColor },
                textStyle,
              ]}
            >
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  pill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  outlinedPill: {
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SubRolePills;
