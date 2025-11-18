const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

const { evaluateScores, REQUESTED_ATTRIBUTES } = require('./src/moderationUtils');

admin.initializeApp();

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 20,
  secrets: ['PERSPECTIVE_API_KEY'],
});

const PERSPECTIVE_ENDPOINT = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

const getPerspectiveKey = () => {
  return process.env.PERSPECTIVE_API_KEY || null;
};

const buildRequestBody = (text, language = 'en') => ({
  comment: { text },
  languages: [language],
  requestedAttributes: REQUESTED_ATTRIBUTES,
  doNotStore: true,
});

const fetchWithFallback = (...args) => {
  if (typeof fetch === 'function') {
    return fetch(...args);
  }
  return import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));
};

const callPerspective = async (text, language = 'en') => {
  const apiKey = getPerspectiveKey();
  if (!apiKey) {
    throw new Error('Perspective API key not configured. Set PERSPECTIVE_API_KEY env or functions config.');
  }
  if (!text?.trim()) {
    return { attributeScores: {}, languages: [language] };
  }
  const body = buildRequestBody(text, language);
  const response = await fetchWithFallback(`${PERSPECTIVE_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Perspective API error: ${response.status} ${errText}`);
  }
  return response.json();
};

const writeModerationResult = async (ref, result) => {
  const updatedAt = admin.firestore.FieldValue.serverTimestamp();
  const logTimestamp = admin.firestore.Timestamp.now();
  const { status, severity, blockedAttributes } = result;
  return ref.set(
    {
      status,
      moderation: {
        status,
        severity,
        blockedAttributes,
        updatedAt,
      },
      moderationLog: admin.firestore.FieldValue.arrayUnion({
        ts: logTimestamp,
        actor: 'auto:perspective',
        status,
        severity,
        blockedAttributes,
      }),
    },
    { merge: true }
  );
};

exports.moderatePostOnCreate = onDocumentCreated('posts/{postId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const post = snapshot.data();
  if (!post) return;
  if (post.status && post.status !== 'pending') return;

  try {
    const perspectiveResponse = await callPerspective(post.content || '', post.language || 'en');
    const moderationResult = evaluateScores(perspectiveResponse.attributeScores || {});
    await writeModerationResult(snapshot.ref, moderationResult);
  } catch (error) {
    console.error('Moderation pipeline failed', error);
    await writeModerationResult(snapshot.ref, {
      status: 'needs_review',
      severity: 'medium',
      blockedAttributes: ['pipeline_error'],
    });
  }
});
