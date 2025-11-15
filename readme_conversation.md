# Messaging Feature Implementation

This document captures how the in-app conversations, real-time chat, and call logging flows were implemented so you can reason about the feature, extend it, or debug it quickly.

## High-level flow

1. **Conversation discovery** – `MessagesScreen` subscribes to `/conversations` documents where the authenticated user appears in the `participants` array. Each snapshot is decorated with the other participant’s profile data, sorted by `lastMessageAt`, and rendered in the inbox list with unread counters.
2. **Thread creation** – When a user opens a profile and taps _Message_, `ChatScreen` receives the target user context. If a `conversationId` isn’t passed in, the screen calls `ensureConversation` to either reuse an existing thread (matched by `participantsKey`) or create a fresh document with starter metadata (participant snapshots, unread counters, typing map, default last message).
3. **Real-time messaging** – Once `conversationId` is known:
   - `subscribeToMessages` streams the `/conversations/{id}/messages` collection ordered by `createdAt` and updates UI state in real time.
   - `subscribeToConversationMeta` watches the parent document to read typing flags, participant details, and unread counts so the header + “typing…” indicator stay fresh and messages are marked read automatically via `markConversationRead`.
4. **Sending a message** – `handleSend` sanitizes user input, calls `sendMessage`, and clears the composer. Behind the scenes `sendMessage` adds a message doc (text + optional attachments placeholder) and updates the parent conversation summary (`lastMessage`, `lastMessageAt`, unread bumps for the receiver, etc.). Typing status is toggled off after send.
5. **Typing indicators** – `handleInputChange` notifies Firestore via `updateTypingStatus` whenever the composer has text. A debounce timer ensures the flag drops back to `false` roughly 1.5s after the user stops typing.
6. **Call experience** – Audio/video buttons in the chat header invoke `handleStartCall`, which logs a row in `/callSessions`, opens a lightweight in-app modal, and simulates connection progress. When the user ends the call, `finalizeCallSession` stores duration metadata and `logCallMessage` inserts a special `type: 'call-log'` message so the history shows the call summary inline.

## Key files

| File                            | Responsibility                                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/chatService.js`      | Encapsulates every Firestore interaction (conversation lookup/creation, message & metadata subscriptions, unread + typing updates, call session logging). This keeps network logic outside the UI layer. |
| `src/screens/MessagesScreen.js` | Inbox UI. Subscribes to conversations, applies search filtering, renders unread badges, and navigates to `ChatScreen` with the correct `conversationId` + participant info.                              |
| `src/screens/ChatScreen.js`     | Full conversation view. Handles lazy thread creation, live message feed, typing indicators, send button state, attachment placeholder, call controls, and the simulated call modal.                      |

## Firestore data model

```
conversations (collection)
  - participants: string[]          // user IDs
  - participantsKey: string         // deterministic key for quick lookup
  - participantDetails: { [uid]: { uid, name, avatar, role } }
  - lastMessage / lastMessageType / lastMessageAt / lastSenderId
  - unreadCounts: { [uid]: number }
  - typing: { [uid]: boolean }

conversations/{conversationId}/messages (subcollection)
  - text | attachments | type ('text' | 'media' | 'call-log')
  - senderId / receiverId
  - status
  - createdAt (serverTimestamp)

callSessions (collection)
  - conversationId / callerId / calleeId
  - callType ('audio' | 'video')
  - status ('ringing' | 'connected' | 'ended')
  - startedAt / endedAt / durationSeconds
```

## User experience details

- **Empty + loading states** – Both inbox and chat surfaces display friendly loading spinners and “start chatting” hints when there’s no data yet.
- **Auth awareness** – `ChatScreen` checks `useAuth`; if the user isn’t signed in, it shows a login-required state rather than attempting Firestore access.
- **Default avatar fallback** – Whenever a participant lacks a profile photo, the UI falls back to the bundled `shahriar-kabir.jpg` asset so layouts remain consistent.
- **Call history bubbles** – Messages coming from `logCallMessage` carry `type: 'call-log'` and render with a distinct treatment (icon + summary + duration) to distinguish them from plain text chats.

## Extensibility hints

- **Attachments** – `sendMessage` already accepts an `attachments` array and toggles `type` to `media`. Wire the attach button to upload to storage and pass metadata here to enable quick file sharing.
- **Push notifications** – The chat service cleanly separates server writes; you can hook Cloud Functions to the `messages` collection to trigger FCM notifications when `receiverId` matches a logged-out device.
- **Presence** – The typing map can be expanded to broader presence info (last seen, active device) by adding fields on the conversation doc or listening to Realtime Database if you prefer low-latency heartbeats.
- **Call provider integration** – Replace the simulated modal with a real VoIP SDK (Agora, Twilio, WebRTC) by reusing the `initiateCallSession` metadata but launching the provider UI instead of the current placeholder.

## Verification steps

1. Start Metro:
   ```powershell
   npm start
   ```
2. Launch the Expo app on a simulator or device, log in with two test users, and open the Messages tab.
3. Send messages between the accounts; you should see messages stream instantly, unread counters update, and the typing indicator light up while the other user is composing.
4. Tap the call icons to open the simulated call modal; ending the call drops a call-log bubble into the thread and updates the conversation preview text.

That’s the full picture of how messaging works today. Use this as a reference whenever you need to tweak UI, expand Firestore rules, or integrate richer communication features.
