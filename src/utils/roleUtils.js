import SUB_ROLE_OPTIONS, { MAX_SUB_ROLES } from '../constants/subRoleOptions';

const ROLE_LABEL_LOOKUP = SUB_ROLE_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option.label;
  return acc;
}, {});

export const sanitizeSubRoles = (raw = [], primaryRole = null) => {
  if (!Array.isArray(raw)) return [];
  const next = [];
  const seen = new Set();
  const blocked = new Set();
  if (typeof primaryRole === 'string') {
    blocked.add(primaryRole.trim().toLowerCase());
  }
  raw.forEach((value) => {
    if (typeof value !== 'string') return;
    const normalized = value.trim().toLowerCase();
    if (!normalized || !ROLE_LABEL_LOOKUP[normalized] || seen.has(normalized) || blocked.has(normalized)) return;
    if (next.length >= MAX_SUB_ROLES) return;
    seen.add(normalized);
    next.push(normalized);
  });
  return next;
};

export const getRoleLabels = (subRoles = [], primaryRole = null) =>
  sanitizeSubRoles(subRoles, primaryRole)
    .map((id) => ROLE_LABEL_LOOKUP[id])
    .filter(Boolean);

export const formatRoleLabels = (subRoles = [], fallbackRole = '') => {
  const orderedLabels = [];
  const primaryLabel = sentenceCase(fallbackRole);
  if (primaryLabel) {
    orderedLabels.push(primaryLabel);
  }
  const secondaryLabels = getRoleLabels(subRoles, fallbackRole);
  secondaryLabels.forEach((label) => {
    if (!orderedLabels.includes(label)) {
      orderedLabels.push(label);
    }
  });
  return orderedLabels.join(' · ');
};

export const sentenceCase = (value = '') => {
  const str = `${value}`.trim();
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const isRoleSelected = (roleId, selected = [], primaryRole = null) => sanitizeSubRoles(selected, primaryRole).includes(roleId);

export const toggleSubRole = (roleId, selected = [], primaryRole = null) => {
  if (typeof roleId !== 'string' || !ROLE_LABEL_LOOKUP[roleId]) return sanitizeSubRoles(selected, primaryRole);
  if (primaryRole && roleId === primaryRole) return sanitizeSubRoles(selected, primaryRole);
  const cleaned = sanitizeSubRoles(selected, primaryRole);
  if (cleaned.includes(roleId)) {
    return cleaned.filter((id) => id !== roleId);
  }
  if (cleaned.length >= MAX_SUB_ROLES) {
    return cleaned;
  }
  return [...cleaned, roleId];
};

export const getRoleOptionLabel = (roleId) => ROLE_LABEL_LOOKUP[roleId] || null;

export { MAX_SUB_ROLES };
