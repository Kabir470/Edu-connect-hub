import { computeProfileCompletion, deriveVerificationStatus } from './profileCompletion';

export const getVerificationGate = (profile = {}) => {
  const completion = computeProfileCompletion(profile);
  const verificationStatus = deriveVerificationStatus(profile);

  const isVerified = verificationStatus === 'verified';
  const canUseRestrictedFeatures = completion.isComplete && isVerified;

  let reason = '';
  if (!completion.isComplete) {
    const missingLabels = completion.missing.map((m) => m.label).join(', ');
    reason = `Complete your profile to unlock features. Missing: ${missingLabels}`;
  } else if (verificationStatus === 'pending') {
    reason = 'Your verification request is pending admin review.';
  } else if (verificationStatus === 'rejected') {
    reason = 'Your verification was rejected. Update your info and request again.';
  } else if (!isVerified) {
    reason = 'Request verification to unlock posting, messaging, jobs, and consultations.';
  }

  return {
    canUseRestrictedFeatures,
    verificationStatus,
    completion,
    reason,
  };
};

export const ensureRestrictedAccessOrAlert = ({
  profile,
  Alert,
  navigation,
  messageTitle = 'Complete your profile',
} = {}) => {
  const gate = getVerificationGate(profile);
  if (gate.canUseRestrictedFeatures) return true;

  const body = gate.reason || 'Please complete your profile and get verified to use this feature.';
  try {
    Alert.alert(messageTitle, body, [
      {
        text: 'Go to profile',
        onPress: () => {
          try {
            navigation?.navigate?.('Profile', { screen: 'EditProfile' });
          } catch (_) {}
        },
      },
      { text: 'OK' },
    ]);
  } catch (_) {}

  return false;
};
