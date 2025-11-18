# Moderation Cloud Functions

This directory hosts the Firebase Cloud Functions that power the AI-driven post moderation flow for AcademicConnect. The current deployment focuses on the `moderatePostOnCreate` trigger, which keeps user-generated posts safe by sending their content to Google Perspective before they appear in the feed.

## What the function does

- Listens to Firestore `posts/{postId}` `onCreate` events in `us-central1`.
- Skips items whose `status` is already something other than `pending` (so manual overrides stay intact).
- Calls the Perspective API with the post's text (`post.content`) and optional `post.language`.
- Applies the score thresholds defined in `src/moderationUtils.js` to classify each post as `approved`, `rejected`, or `needs_review`.
- Writes the moderation status back to the post document, along with a structured `moderation` object and a `moderationLog` entry so the UI or tooling can show an audit trail.
- Falls back to `needs_review` if Perspective is unavailable or returns an error, ensuring moderators are alerted without silently dropping content.

## Prerequisites

| Tool                        | Minimum version | Notes                                                   |
| --------------------------- | --------------- | ------------------------------------------------------- |
| Node.js                     | 20.x LTS        | Required by the deployed runtime and ESLint toolchain   |
| npm                         | 9+              | Bundled with Node 20                                    |
| Firebase CLI                | 13.0.0+         | Install via `npm install -g firebase-tools`             |
| Google Cloud project access | n/a             | Needed to enable the Perspective API and manage secrets |

## Local setup

1. Install dependencies inside `functions/`:
   ```bash
   npm install
   ```
2. Make sure the folder is initialized as a Firebase project directory (`firebase init` was already run for this repo).
3. Point the CLI at the correct project (alias already saved as `educonnecthub-7454e`):
   ```bash
   firebase use educonnecthub-7454e
   ```
4. Keep local secrets out of version control. The CLI may create a `.env.<project>` helper file when you enter secret values interactively—treat it like `.env` and do not commit it.

## Managing secrets

Perspective requires an API key. Store it as a Firebase Functions Secret so it never lives in source control:

```bash
firebase functions:secrets:set PERSPECTIVE_API_KEY
```

Supply the key value when prompted. The deployed function will read it via `process.env.PERSPECTIVE_API_KEY` at runtime, so no additional code changes are required per environment.

## Linting and quality gates

A lightweight ESLint setup runs automatically before every deploy:

```bash
npm run lint
```

The config lives in `.eslintrc.js` and is tuned for the Cloud Functions runtime (CommonJS, Node 20). Fix any violations before deploying to avoid CLI failures.

## Deployment workflow

1. Ensure Google APIs are enabled (the first deploy already enabled Eventarc, Artifact Registry, and Cloud Build).
2. Deploy only the functions when you make moderation changes:
   ```bash
   firebase deploy --only functions
   ```
3. The CLI packages the code, pushes it to Artifact Registry, creates/updates the Eventarc trigger, and rolls out the containerized function. Watch for warnings about outdated dependencies—`firebase-functions` should be bumped to the recommended major version before the next breaking change window.

## Firestore contract

The function expects each post document to contain:

- `content` _(string)_: the text to analyze. Empty values are allowed but will immediately mark the post for manual review.
- `language` _(optional string, default `en`)_: ISO language code passed to Perspective.
- `status` _(optional string)_: treated as `pending` unless otherwise set.

It writes/updates the following fields:

- `status`: `approved`, `rejected`, or `needs_review`.
- `moderation`: `{ status, severity, blockedAttributes, updatedAt }`.
- `moderationLog`: array of append-only entries `{ ts, actor, status, severity, blockedAttributes }`.

Client code can key off any of these fields to hide rejected posts, badge pending ones, or surface review queues.

## Failure handling

- Perspective outages or quota errors fall back to `needs_review` so nothing silently bypasses moderation.
- Errors are logged via `console.error` and surfaced in Cloud Logging.
- Firestore writes use `merge: true` to preserve unrelated fields authored by the client.

## Next steps

- Upgrade `firebase-functions` to the latest major release when convenient (CLI currently warns about 6.x).
- Extend the same moderation pipeline to comments, messages, or uploads if required.
- Add scheduled backfills or retries if pending posts accumulate due to transient API errors.
