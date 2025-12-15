export const REQUIRED_VERIFICATION_FIELDS = [
  { key: 'address', label: 'Address' },
  { key: 'profileImageURL', label: 'Profile photo' },
  { key: 'nidHash', label: 'NID number' },
  { key: 'nidImageURL', label: 'NID photo' },
];

export const computeProfileCompletion = (profile = {}) => {
  const missing = [];

  for (const field of REQUIRED_VERIFICATION_FIELDS) {
    const value = profile?.[field.key];
    const ok = typeof value === 'string' ? value.trim().length > 0 : !!value;
    if (!ok) missing.push(field);
  }

  const total = REQUIRED_VERIFICATION_FIELDS.length;
  const completed = total - missing.length;
  const percent = total === 0 ? 100 : Math.round((completed / total) * 100);

  return {
    percent,
    isComplete: missing.length === 0,
    missing,
    completed,
    total,
  };
};

export const deriveVerificationStatus = (profile = {}) => {
  const explicit = (profile?.verificationStatus || profile?.verification?.status || '').toLowerCase();
  if (explicit) return explicit;

  // Backward compatibility with older schema.
  const legacy = (profile?.status || '').toLowerCase();
  if (legacy === 'approved') return 'verified';
  if (legacy === 'pending') return 'pending';
  if (legacy === 'rejected') return 'rejected';

  return 'unverified';
};
