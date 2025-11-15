export const DEFAULT_PRIVACY_SETTINGS = {
  profilePublic: true,
  showActivityStatus: true,
  allowMessagesFromAll: true,
  allowTagging: true,
  searchableByEmail: true,
  loginAlerts: true,
  twoFactorEnabled: false,
  biometricLock: false,
  allowTaggingInComments: true,
  allowMentions: true,
  lastDataExportRequestedAt: null,
  recommendationsClearedAt: null,
};

export const mergePrivacySettings = (settings = {}) => ({
  ...DEFAULT_PRIVACY_SETTINGS,
  ...(settings || {}),
});
