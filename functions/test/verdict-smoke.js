const assert = require('assert');
const { evaluateScores } = require('../src/moderationUtils');

const highToxicity = {
  TOXICITY: { summaryScore: { value: 0.95 } },
};

const borderline = {
  PROFANITY: { summaryScore: { value: 0.72 } },
};

const clean = {};

const rejected = evaluateScores(highToxicity);
assert.strictEqual(rejected.status, 'rejected');

const needsReview = evaluateScores(borderline);
assert.strictEqual(needsReview.status, 'needs_review');

const approved = evaluateScores(clean);
assert.strictEqual(approved.status, 'approved');

console.log('Moderation thresholds smoke test passed');
