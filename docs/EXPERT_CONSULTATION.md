# Expert Consultation Feature Guide

This document explains how the current expert marketplace works across profile data, booking flows, account creation, settings, and client-to-expert collaboration. It reflects the logic implemented in:

- `src/utils/consultationService.js`
- `src/screens/ExpertsScreen.js`
- `src/screens/ExpertDetailScreen.js`
- `src/screens/ScheduledConsultationsScreen.js`
- `src/context/AuthContext.js`

## Data Model Snapshot

### `users` collection

- `role`: `'user' | 'expert' | 'admin'`. Experts are shown only when `role === 'expert'` **and** `status === 'approved'`.
- `fullName`, `username`, `bio`, `experience`, `expertise` (array), `hourlyRate`, `consultAvailable`, `profileImageURL`, `rating`, `reviews` drive the UI on `ExpertsScreen` and `ExpertDetailScreen`.
- KYC fields captured during signup (`nidLast4`, `nidHash`, `nidImageURL`) plus profile metadata maintained in `AuthContext`.

### `users/{expertId}/availabilities`

Each document represents one time slot the expert published:

- `start`: Firestore timestamp.
- `status`: `'open' | 'pending' | 'booked' | 'blocked'` (defaults to `open`).
- `pendingBy`, `pendingName`, `pendingConsultationId`: auto-filled when a client requests the slot.
- `bookedBy`, `bookedAt`: filled when the expert confirms.
- Additional helper fields (e.g., `reservedAt`) keep the UI in sync.

Slots are consumed inside `ExpertDetailScreen` and locked via Firestore transactions in `consultationService.requestConsultation`.

### `consultations` collection

Common fields per booking record:

- `userId`, `userName`: client metadata.
- `expertId`, `expertName`, `expertPhotoURL`.
- `slotId`, `scheduledFor` (timestamp).
- `status`: `'pending' | 'scheduled' | 'declined' | 'cancelled-by-client' | 'cancelled-by-expert' | 'completed'`.
- `meetingLink`, `cancelReason`, `createdAt`, `updatedAt`, `decisionAt`.

The service wraps every state change (accept, decline, cancel, complete, share link) in Firestore transactions to keep `consultations` and the related slot document consistent.

## 1. Expert Profile Mechanism

1. **Data source** – `subscribeToExperts` (in `consultationService`) queries `users` where `role === 'expert'` and `status === 'approved'` so only vetted profiles are exposed publicly.
2. **Filtering** – Search is handled server-side:
   - Category filter matches `expertiseCategory`, `category`, or any tag in `expertise`.
   - Text search spans `fullName`, `username`, `bio`, and each `expertise` tag.
3. **Presentation** – `ExpertsScreen` renders two-column cards showing:
   - Avatar (with fallback), availability badge (`consultAvailable`), rating, review count.
   - Top 3 expertise tags, experience string, hourly rate.
   - Primary CTA that opens `ExpertDetailScreen` and is disabled when `consultAvailable` is false.
4. **Profile depth** – `ExpertDetailScreen` expands on the card with biography text, expertise chips, hourly fee banner, and live availability feed. Slot pills automatically display their real-time state (open, pending, booked) so clients cannot overbook.

## 2. Booking Flow for Regular Users

1. **Discovery** – Clients browse/search categories on `ExpertsScreen`, then inspect details and time slots on `ExpertDetailScreen`.
2. **Slot reservation** – `requestConsultation` runs a transaction that:
   - Verifies the slot is still `open`.
   - Creates a `consultations` document in `pending` state.
   - Locks the slot by setting `status = 'pending'` and storing `pendingBy`, preventing race conditions.
3. **Notifications** – Every request emits a `consultation-request` notification via `createNotificationEntry`, so experts see the badge immediately.
4. **Client dashboard** – `ScheduledConsultationsScreen` (first section) lists upcoming sessions with:
   - Human-readable status chips and cancel-reasons.
   - Ability to cancel while `pending`/`scheduled` (slot reopens automatically on the backend).
   - Join button that opens `Linking.openURL` when a meeting link is available, otherwise surfaces “Waiting” state.

## 3. Expert Account Signup & Approval

1. **Signup flow** – `AuthContext.signUp` collects email/password plus expert metadata (full name, role, address, optional username) and uploads profile/NID images to Storage.
2. **Identity capture** – The app stores the last 4 digits of the NID and a SHA-256 hash for auditing (`nidLast4`, `nidHash`).
3. **Verification gating** – Newly created experts default to `status: 'pending'`. Admins must flip the document to `status: 'approved'` (and optionally `consultAvailable: true`) before the profile appears in search results.
4. **Cached session** – After signup the expert is logged in, but the UI respects the `status` flag (e.g., they cannot appear on `ExpertsScreen` until approved).

## 4. Expert Settings, Availability, and Session Management

1. **Availability publishing** – Experts (or an admin tool) create documents inside `users/{expertId}/availabilities`. Each slot can include custom metadata (duration, location) if needed. The mobile UI reads them live via `subscribeToExpertAvailabilities`.
2. **Consultation inbox** – `ScheduledConsultationsScreen` second section (“Requests For Me”) provides experts with actionable cards:
   - Accept → opens a modal to optionally paste a Meet/Zoom link. Confirms via `acceptConsultation`, flips slot to `booked`, and notifies the client.
   - Decline → runs `declineConsultation`, reopens the slot, and notifies the client with the optional reason.
   - Share link later → `updateMeetingLink` lets experts send or update the URL at any time.
   - Cancel/Mark done → `cancelConsultation` releases the slot, while `completeConsultation` finalizes and frees the slot for reuse.
3. **Status hygiene** – All backend helpers ensure slot + consultation status remain in sync even under concurrent edits (thanks to Firestore transactions).
4. **Future hooks** – You can extend this area with payout settings, per-category pricing, or calendar sync by enriching the same user and slot documents.

## 5. Client ↔ Expert Collaboration Features

- **Dual-sided dashboard** – Both roles share `ScheduledConsultationsScreen`, but each sees role-specific controls (cancel vs. accept/share/complete).
- **Meeting links** – Experts can share, change, or omit links. Clients attempting to join without a link receive clear guidance.
- **Notifications & badges** – Every major transition (request, accept, decline, cancel, link shared) sends a targeted notification entry consumed elsewhere in the app, enabling unread badges on the profile tab.
- **Status transparency** – Clients see `cancelReason` text if an expert declines or cancels, making the experience feel trustworthy.
- **Safety rails** – The UI disables booking buttons when slots are pending/booked, and the service prevents overbooking even if two users tap simultaneously.

## 6. Additional Features & Extensibility Ideas

| Area                 | Current Behavior                                                                                    | Suggested Next Steps                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Availability tooling | Create slots via Firestore console or upcoming admin UI. Slots auto-reset when sessions end/cancel. | Build an in-app “Availability Manager” so experts can add/edit slots directly.      |
| Payments             | Not yet implemented; hourly rate used for display only.                                             | Integrate Stripe/PayPal, store invoices alongside consultations.                    |
| Reminders            | Notifications fire on status changes only.                                                          | Layer push/email reminders (e.g., 1 hour before session) by reading `scheduledFor`. |
| Ratings & reviews    | Hard-coded sample reviews in `ExpertDetailScreen`.                                                  | Store real reviews per consultation, aggregate into `rating`/`reviews`.             |
| Admin oversight      | Approval handled by editing user docs manually.                                                     | Build `AdminDashboardScreen` actions to approve experts, monitor disputes.          |

## File Map

- `src/utils/consultationService.js` – Source of truth for expert discovery, booking transactions, slot locking, status transitions, and notifications.
- `src/screens/ExpertsScreen.js` – Discovery grid with search + category filters.
- `src/screens/ExpertDetailScreen.js` – Profile deep-dive plus live availability picker.
- `src/screens/ScheduledConsultationsScreen.js` – Unified inbox for both clients and experts (accept, decline, link, cancel, complete, join).
- `src/context/AuthContext.js` – Handles signup/login, stores expert metadata, and caches the authenticated user.

Use this guide whenever you need to onboard new developers, document QA scenarios, or plan further enhancements to the expert marketplace.
