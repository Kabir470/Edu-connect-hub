const ATTRIBUTE_IDS = [
  'TOXICITY',
  'SEVERE_TOXICITY',
  'PROFANITY',
  'SEXUALLY_EXPLICIT',
  'IDENTITY_ATTACK',
  'THREAT',
];

const REQUESTED_ATTRIBUTES = ATTRIBUTE_IDS.reduce((acc, key) => {
  acc[key] = {};
  return acc;
}, {});

const BLOCK_THRESHOLDS = {
  TOXICITY: 0.9,
  SEVERE_TOXICITY: 0.7,
  PROFANITY: 0.85,
  SEXUALLY_EXPLICIT: 0.6,
  IDENTITY_ATTACK: 0.65,
  THREAT: 0.7,
};

const REVIEW_THRESHOLDS = {
  TOXICITY: 0.65,
  SEVERE_TOXICITY: 0.5,
  PROFANITY: 0.7,
  SEXUALLY_EXPLICIT: 0.45,
  IDENTITY_ATTACK: 0.5,
  THREAT: 0.5,
};

const roundScore = (value) => Math.round((value || 0) * 1000) / 1000;

const normalizeScores = (rawScores = {}) => {
  return ATTRIBUTE_IDS.reduce((acc, key) => {
    const scoreValue = rawScores[key]?.summaryScore?.value ?? 0;
    acc[key] = roundScore(scoreValue);
    return acc;
  }, {});
};

const evaluateScores = (rawScores = {}) => {
  const scores = normalizeScores(rawScores);
  const blockedAttributes = [];
  const reviewAttributes = [];

  ATTRIBUTE_IDS.forEach((attribute) => {
    const value = scores[attribute];
    if (value >= BLOCK_THRESHOLDS[attribute]) {
      blockedAttributes.push(attribute);
    } else if (value >= REVIEW_THRESHOLDS[attribute]) {
      reviewAttributes.push(attribute);
    }
  });

  if (blockedAttributes.length) {
    return { status: 'rejected', severity: 'high', blockedAttributes, scores };
  }

  if (reviewAttributes.length) {
    return { status: 'needs_review', severity: 'medium', blockedAttributes: reviewAttributes, scores };
  }

  return { status: 'approved', severity: 'low', blockedAttributes: [], scores };
};

module.exports = {
  ATTRIBUTE_IDS,
  REQUESTED_ATTRIBUTES,
  evaluateScores,
  normalizeScores,
};
