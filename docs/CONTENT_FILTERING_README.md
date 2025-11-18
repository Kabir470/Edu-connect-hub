# Post Filtering & Safety Model

This guide walks through implementing a production-ready post filtering pipeline for DoneWithIt's expert community. The goal is to block adult, vulgar, hateful, or spammy submissions **before** they appear inside the feed while keeping the author experience smooth.

## 1. Requirements Checklist

| Area       | Requirement                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| Coverage   | Text, image, and attachment payloads submitted through `CreatePostScreen`, chat, or consultations.        |
| Latency    | < 1.5 s perceived delay per submission when online; graceful offline queueing.                            |
| Accuracy   | 98%+ recall for adult/vulgar language; < 1% false positives after appeal tooling.                         |
| Audit      | Moderators can view flagged content, reason codes, and decision trail in Firestore.                       |
| Privacy    | No raw user secrets are logged; logs contain hashed IDs and truncated payloads.                           |
| Resilience | Client performs lightweight pre-check, but **final authority** lives in secure backend (Cloud Functions). |

## 2. Architecture Overview

```
Client (React Native)
  ├─ Local profanity dictionary + RegExp filter (synchronous)
  ├─ Optional on-device TF Lite model (NSFW text/image)
  └─ Uploads payload plus metadata → `firestore/posts/pending`

Cloud Functions (Node.js)
  ├─ `validatePostContent` trigger
  │    ├─ Routes text → Perspective API / OpenAI moderation
  │    ├─ Routes images → Google Cloud Vision SafeSearch (or custom)
  │    └─ Combines scores, writes `moderationVerdict`
  └─ `publishPost` HTTPS callable for manual overrides

Firestore Data
  posts/{id}
    status: pending|approved|rejected
    moderationScores: {...}
    moderationLog: [{timestamp, actor, reason, source}]
```

## 3. Client-Side Guardrails

1. **Profanity dictionary**

   - Add a lightweight trie or regex list (e.g., `bad-words` npm or custom JSON).
   - Run it inside `handleSubmitPost` before network calls.
   - Prompt user with inline errors (`"Please remove vulgar terms: ****"`).

2. **On-device ML (optional)**

   - Convert a distilled toxicity model (e.g., Detoxify) to TF Lite.
   - Load via `react-native-tensorflow-lite` or Expo dev client.
   - Use this only for hints; never rely solely on device inference.

3. **Metadata tagging**
   - Include `contentLanguage`, `containsMedia`, `clientVerdict` fields when creating Firestore docs so the backend can adapt thresholds per locale/content type.

## 4. Backend Moderation Pipeline

### 4.1 Firestore Trigger

```js
exports.validatePostContent = functions.firestore
  .document("posts/{postId}")
  .onCreate(async (snap, ctx) => {
    const post = snap.data();
    const textScore = await scoreText(post.body, post.language);
    const mediaScore = post.mediaUrl ? await scoreImage(post.mediaUrl) : null;
    const finalVerdict = combineScores(textScore, mediaScore);

    await snap.ref.update({
      moderationScores: { textScore, mediaScore },
      status: finalVerdict.ok ? "approved" : "rejected",
      moderationLog: admin.firestore.FieldValue.arrayUnion({
        ts: admin.firestore.FieldValue.serverTimestamp(),
        actor: "auto",
        decision: finalVerdict.reason,
      }),
    });
  });
```

### 4.2 Integrations

| Signal                   | Provider                                                  | Notes                                                          |
| ------------------------ | --------------------------------------------------------- | -------------------------------------------------------------- |
| Toxicity / Adult Text    | [Perspective API](https://developers.perspectiveapi.com/) | Free quotas, language-aware.                                   |
| Sexual content in images | Google Cloud Vision SafeSearch or AWS Rekognition         | Accepts GCS/S3 URLs.                                           |
| Custom rule-based        | Cloud Function code                                       | e.g., reject posts containing phone numbers if policy forbids. |

### 4.3 Combining Scores

Implement a scoring matrix:

```
if (textScore.toxicity > 0.8 || textScore.sexualExplicit > 0.5) reject
else if (mediaScore.nsfw > 0.7) reject
else if (textScore.profanity > 0.6) → status = "needs_review"
else approve
```

Store thresholds inside Firestore (`moderationSettings/global`) to tweak without redeploys.

## 5. Appeals & Manual Review

1. When a post is rejected, keep `status = rejected` and show author a CTA: “Appeal decision”.
2. Create `moderationAppeals/{id}` docs referencing postId, authorId, and user comment.
3. Build a small Admin panel (could be `AdminDashboardScreen`) listing `needs_review` or appealed posts with context + quick actions to `approve` or `reject` (writes to Firestore and logs actor).

## 6. Notifications & UX

- Use existing notification service to alert:
  - Author when their post is rejected (include sanitized reason).
  - Moderators when content is auto-flagged and requires manual follow-up.
- In UI, show `status` badges (`Pending review`, `Rejected - contains vulgar language`).

## 7. Testing Strategy

| Layer              | Test                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Unit               | Jest tests for regex/profanity helper, score combiner, and threshold logic.                                               |
| Integration        | Emulate Cloud Functions with Firebase emulator, feed in example payloads (text, base64 images) and assert final statuses. |
| E2E                | Detox / Maestro script creating posts from the app, verifying status transitions and user messaging.                      |
| Regression dataset | Maintain a CSV of real anonymized posts + expected verdict to rerun when thresholds change.                               |

## 8. Deployment Checklist

1. **Secrets**: Store Perspective API key, Vision credentials, etc. in Google Secret Manager and inject via environment variables.
2. **Billing**: Enable billing for Cloud Functions / Vision if required. Set quotas + alerts.
3. **Monitoring**: Export metrics (number of rejections, reason counts, latency) to Cloud Monitoring or BigQuery for analysis.
4. **Rollout**: Start with `needs_review` mode (no auto rejection) to calibrate thresholds, then switch to auto-block once confident.

## 9. Future Enhancements

- Language-specific models (Bangla, Hindi) to reduce false negatives.
- Real-time WebSocket moderation updates so authors see status instantly.
- Community reporting flow (users can flag posts which feeds the same moderation queue).
- Federated learning or differential privacy if you want to adapt on-device models without uploading raw data.

---

By combining lightweight client-side checks with secure backend moderation, you can block adult/vulgar content before it harms the community while preserving auditability, user trust, and compliance.
