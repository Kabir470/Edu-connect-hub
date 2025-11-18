import { db } from '../../firebase';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { createNotificationEntry } from './notificationService';

const slotRef = (expertId, slotId) => doc(db, 'users', expertId, 'availabilities', slotId);
const expertRef = (expertId) => doc(db, 'users', expertId);
const expertReviewsRef = (expertId, reviewId) => doc(db, 'users', expertId, 'reviews', reviewId);

const slotOpenPayload = () => ({
  status: 'open',
  pendingBy: null,
  pendingName: null,
  pendingConsultationId: null,
  reservedAt: null,
  bookedBy: null,
  bookedAt: null,
});

export const subscribeToExperts = (onData, onError, { category, search } = {}) => {
  const base = query(collection(db, 'users'), where('role', '==', 'expert'), where('status', '==', 'approved'));
  return onSnapshot(
    base,
    (snap) => {
      let list = snap.docs.map((d) => {
        const data = d.data();
        const ratingCount = Number(data.ratingCount || 0);
        const ratingSum = Number(data.ratingSum || 0);
        const computedRating = ratingCount > 0 ? ratingSum / ratingCount : Number(data.rating || 0);
        return {
          id: d.id,
          ...data,
          rating: Number.isFinite(computedRating) ? Number(computedRating) : 0,
          reviews: ratingCount || data.reviews || 0,
        };
      });
      if (category && category !== 'All') {
        list = list.filter((x) => (x.expertiseCategory || x.category) === category || (x.expertise || []).includes(category));
      }
      if (search && search.trim()) {
        const s = search.trim().toLowerCase();
        list = list.filter((x) =>
          (x.fullName || '').toLowerCase().includes(s) ||
          (x.username || '').toLowerCase().includes(s) ||
          (x.bio || '').toLowerCase().includes(s) ||
          (x.expertise || []).some((t) => (t || '').toLowerCase().includes(s))
        );
      }
      onData(list);
    },
    onError
  );
};

export const subscribeToExpertAvailabilities = (expertId, onData, onError) => {
  if (!expertId) return () => {};
  const q = query(collection(db, 'users', expertId, 'availabilities'), orderBy('start', 'asc'));
  return onSnapshot(q, (snap) => {
    const slots = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    onData(slots);
  }, onError);
};

export const requestConsultation = async ({ user, expert, slot, payment }) => {
  if (!user?.uid) throw new Error('Auth required');
  if (!expert?.id) throw new Error('Expert missing');
  if (!slot?.id || !slot?.start) throw new Error('Select a valid slot');
  if (!payment || payment.status !== 'paid') {
    throw new Error('Advance payment confirmation missing');
  }
  const rateSnapshot = Number(slot.rate || expert.hourlyRate || expert.rate || 0);

  const payload = {
    userId: user.uid,
    userName: user.fullName || user.email?.split('@')[0] || 'Member',
    expertId: expert.id,
    expertName: expert.fullName || expert.name || 'Expert',
    expertPhotoURL: expert.profileImageURL || null,
    scheduledFor: slot.start,
    slotId: slot.id,
    status: 'pending',
    hourlyRate: rateSnapshot,
    paymentAmount: payment.amount || rateSnapshot,
    paymentStatus: payment.status,
    paymentGateway: payment.gateway || 'sslcommerz',
    paymentTransactionId: payment.transactionId || null,
    paymentSessionKey: payment.sessionKey || null,
    paymentMeta: payment.meta || null,
    advancePaidAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const consultationRef = doc(collection(db, 'consultations'));
  await runTransaction(db, async (transaction) => {
    const slotSnapshot = await transaction.get(slotRef(expert.id, slot.id));
    if (!slotSnapshot.exists()) throw new Error('This slot is no longer available.');
    const slotData = slotSnapshot.data();
    const slotStatus = slotData?.status || 'open';
    if (slotStatus !== 'open') {
      throw new Error(slotStatus === 'pending' ? 'Another request is already awaiting approval.' : 'This slot has already been booked.');
    }
    transaction.set(consultationRef, payload);
    transaction.update(slotRef(expert.id, slot.id), {
      status: 'pending',
      pendingBy: user.uid,
      pendingName: payload.userName,
      pendingConsultationId: consultationRef.id,
      reservedAt: serverTimestamp(),
    });
  });

  // Notify expert
  try {
    await createNotificationEntry({
      type: 'consultation-request',
      targetUserId: expert.id,
      actor: user,
      meta: { message: `${user.fullName || 'Someone'} requested a consultation`, previewText: 'Tap to review' },
    });
  } catch (_) {}

  return { id: consultationRef.id };
};

export const acceptConsultation = async ({ consultationId, expertId, meetingLink }) => {
  if (!consultationId || !expertId) throw new Error('Missing ids');
  const cref = doc(db, 'consultations', consultationId);
  const clientId = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(cref);
    if (!snapshot.exists()) throw new Error('Request not found');
    const consultation = snapshot.data();
    if (consultation.expertId !== expertId) throw new Error('Permission denied');

    transaction.update(cref, {
      status: 'scheduled',
      meetingLink: meetingLink || consultation.meetingLink || null,
      paymentStatus: consultation.paymentStatus === 'paid' ? 'paid' : 'due',
      paymentUpdatedAt: serverTimestamp(),
      decisionAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (consultation.slotId) {
      const sRef = slotRef(expertId, consultation.slotId);
      transaction.update(sRef, {
        status: 'booked',
        bookedBy: consultation.userId,
        bookedAt: serverTimestamp(),
        pendingBy: null,
        pendingName: null,
        pendingConsultationId: null,
      });
    }
    return consultation.userId;
  });

  if (clientId) {
    try {
      await createNotificationEntry({
        type: 'consultation-accepted',
        targetUserId: clientId,
        meta: { message: 'Your consultation was confirmed', previewText: 'Tap to see meeting details' },
      });
    } catch (_) {}
  }
};

export const declineConsultation = async ({ consultationId, expertId, reason }) => {
  if (!consultationId || !expertId) throw new Error('Missing ids');
  const cref = doc(db, 'consultations', consultationId);
  const payload = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(cref);
    if (!snapshot.exists()) throw new Error('Request not found');
    const consultation = snapshot.data();
    if (consultation.expertId !== expertId) throw new Error('Permission denied');

    transaction.update(cref, {
      status: 'declined',
      cancelReason: reason || 'Declined by expert',
      paymentStatus: 'cancelled',
      updatedAt: serverTimestamp(),
    });

    if (consultation.slotId) {
      const sRef = slotRef(expertId, consultation.slotId);
      transaction.update(sRef, slotOpenPayload());
    }

    return { userId: consultation.userId };
  });

  if (payload?.userId) {
    try {
      await createNotificationEntry({
        type: 'consultation-declined',
        targetUserId: payload.userId,
        meta: { message: 'Expert declined your consultation', previewText: reason || 'Try another slot' },
      });
    } catch (_) {}
  }
};

export const cancelConsultation = async ({ consultationId, actorId, role = 'user', reason }) => {
  if (!consultationId || !actorId) throw new Error('Missing ids');
  const cref = doc(db, 'consultations', consultationId);
  const result = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(cref);
    if (!snapshot.exists()) throw new Error('Consultation missing');
    const consultation = snapshot.data();
    if (role === 'user' && consultation.userId !== actorId) throw new Error('Not allowed');
    if (role === 'expert' && consultation.expertId !== actorId) throw new Error('Not allowed');

    const status = role === 'user' ? 'cancelled-by-client' : 'cancelled-by-expert';
    transaction.update(cref, {
      status,
      cancelReason: reason || (role === 'user' ? 'Cancelled by client' : 'Cancelled by expert'),
      paymentStatus: status,
      updatedAt: serverTimestamp(),
    });

    if (consultation.slotId) {
      const sRef = slotRef(consultation.expertId, consultation.slotId);
      transaction.update(sRef, slotOpenPayload());
    }

    return { userId: consultation.userId, expertId: consultation.expertId };
  });

  const targetUserId = role === 'user' ? result?.expertId : result?.userId;
  if (targetUserId) {
    try {
      await createNotificationEntry({
        type: 'consultation-cancelled',
        targetUserId,
        meta: { message: 'Consultation was cancelled', previewText: reason || 'Slot reopened' },
      });
    } catch (_) {}
  }
};

export const completeConsultation = async ({ consultationId, expertId }) => {
  if (!consultationId || !expertId) throw new Error('Missing ids');
  const cref = doc(db, 'consultations', consultationId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(cref);
    if (!snapshot.exists()) throw new Error('Consultation missing');
    const consultation = snapshot.data();
    if (consultation.expertId !== expertId) throw new Error('Permission denied');

    transaction.update(cref, { status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp() });

    if (consultation.slotId) {
      const sRef = slotRef(expertId, consultation.slotId);
      transaction.update(sRef, slotOpenPayload());
    }
  });
};

export const updateMeetingLink = async ({ consultationId, expertId, meetingLink }) => {
  if (!consultationId || !expertId) throw new Error('Missing ids');
  const cref = doc(db, 'consultations', consultationId);
  const userId = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(cref);
    if (!snapshot.exists()) throw new Error('Consultation missing');
    const consultation = snapshot.data();
    if (consultation.expertId !== expertId) throw new Error('Permission denied');
    transaction.update(cref, { meetingLink: meetingLink || null, updatedAt: serverTimestamp() });
    return consultation.userId;
  });

  if (userId) {
    try {
      await createNotificationEntry({
        type: 'consultation-link',
        targetUserId: userId,
        meta: { message: 'Expert shared a meeting link', previewText: 'Tap to open' },
      });
    } catch (_) {}
  }
};

export const createAvailabilitySlot = async ({ expertId, start, durationMinutes = 30, location, notes, virtualLink }) => {
  if (!expertId) throw new Error('Expert ID missing');
  if (!start) throw new Error('Select a start time');
  const startDate = start instanceof Date ? start : new Date(start);
  if (Number.isNaN(startDate.getTime())) throw new Error('Invalid start time');
  const durationMs = Number(durationMinutes) * 60000 || 1800000;
  const endDate = new Date(startDate.getTime() + durationMs);
  const ref = doc(collection(db, 'users', expertId, 'availabilities'));
  await setDoc(ref, {
    start: startDate,
    end: endDate,
    durationMinutes: Number(durationMinutes) || 30,
    status: 'open',
    location: location || null,
    notes: notes || null,
    virtualLink: virtualLink || null,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
};

export const deleteAvailabilitySlot = async ({ expertId, slotId }) => {
  if (!expertId || !slotId) throw new Error('Slot information missing');
  await runTransaction(db, async (transaction) => {
    const ref = slotRef(expertId, slotId);
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('Slot not found');
    const data = snap.data();
    if (data.status && data.status !== 'open') {
      throw new Error('Only open slots can be removed');
    }
    transaction.delete(ref);
  });
};

export const toggleConsultAvailability = async ({ expertId, enabled }) => {
  if (!expertId) throw new Error('Missing expert id');
  await setDoc(expertRef(expertId), { consultAvailable: !!enabled }, { merge: true });
};

export const markPaymentStatus = async ({ consultationId, actorId, role = 'user', status }) => {
  if (!consultationId || !actorId) throw new Error('Missing ids');
  if (!status) throw new Error('Provide payment status');
  const cref = doc(db, 'consultations', consultationId);
  const counterpart = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(cref);
    if (!snapshot.exists()) throw new Error('Consultation missing');
    const data = snapshot.data();
    if (role === 'user' && data.userId !== actorId) throw new Error('Not allowed');
    if (role === 'expert' && data.expertId !== actorId) throw new Error('Not allowed');

    transaction.update(cref, {
      paymentStatus: status,
      paymentUpdatedAt: serverTimestamp(),
    });

    return role === 'user' ? data.expertId : data.userId;
  });

  if (counterpart) {
    try {
      await createNotificationEntry({
        type: 'consultation-payment',
        targetUserId: counterpart,
        meta: { message: `Payment status updated to ${status}`, previewText: 'Open consultation card for details' },
      });
    } catch (_) {}
  }
};

export const submitConsultationReview = async ({ consultationId, userId, rating, review }) => {
  if (!consultationId || !userId) throw new Error('Missing ids');
  const numericRating = Number(rating);
  if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new Error('Rating should be between 1 and 5');
  }

  const cref = doc(db, 'consultations', consultationId);
  const { expertId, reviewPayload } = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(cref);
    if (!snapshot.exists()) throw new Error('Consultation missing');
    const data = snapshot.data();
    if (data.userId !== userId) throw new Error('Only the client can review');
    if (data.status !== 'completed') throw new Error('Finish the consultation before reviewing');
    if (data.reviewRating) throw new Error('Review already submitted');

    const eRef = expertRef(data.expertId);
    const expertSnapshot = await transaction.get(eRef);
    const expertData = expertSnapshot.exists() ? expertSnapshot.data() : {};
    const ratingCount = Number(expertData.ratingCount || 0) + 1;
    const ratingSum = Number(expertData.ratingSum || 0) + numericRating;
    const ratingAverage = ratingCount > 0 ? ratingSum / ratingCount : numericRating;

    transaction.update(cref, {
      reviewRating: numericRating,
      reviewComment: review || null,
      reviewedAt: serverTimestamp(),
    });

    transaction.update(eRef, {
      ratingCount,
      ratingSum,
      ratingAverage,
    });

    return {
      expertId: data.expertId,
      reviewPayload: {
        rating: numericRating,
        review: review || '',
        reviewerName: data.userName || 'Client',
        reviewedAt: new Date(),
      },
    };
  });

  if (expertId) {
    await setDoc(
      expertReviewsRef(expertId, consultationId),
      {
        rating: reviewPayload.rating,
        review: reviewPayload.review,
        reviewerName: reviewPayload.reviewerName,
        reviewedAt: serverTimestamp(),
        consultationId,
      },
      { merge: true }
    );
  }
};

export const subscribeToExpertReviews = (expertId, onData, onError) => {
  if (!expertId) return () => {};
  const reviewsQuery = query(collection(db, 'users', expertId, 'reviews'), orderBy('reviewedAt', 'desc'));
  return onSnapshot(
    reviewsQuery,
    (snap) => {
      const list = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      onData(list);
    },
    onError
  );
};
