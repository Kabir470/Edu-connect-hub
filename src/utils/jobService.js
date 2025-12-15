import { db } from '../../firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

export const JOB_CATEGORIES = ['Research', 'Teaching', 'Industry', 'Internship'];

export const buildJobApplicationId = (jobId, userId) => `${jobId}_${userId}`;

export const subscribeToJobs = ({ onData, onError, limitCount = 100 } = {}) => {
  const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'), limit(limitCount));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData && onData(items);
    },
    (error) => {
      onError && onError(error);
    }
  );
};

export const subscribeToJob = (jobId, { onData, onError } = {}) => {
  if (!jobId) return () => {};
  const ref = doc(db, 'jobs', jobId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData && onData(null);
        return;
      }
      onData && onData({ id: snap.id, ...snap.data() });
    },
    (error) => onError && onError(error)
  );
};

export const subscribeToMyApplicationForJob = (jobId, userId, { onData, onError } = {}) => {
  if (!jobId || !userId) return () => {};
  const applicationId = buildJobApplicationId(jobId, userId);
  const ref = doc(db, 'jobApplications', applicationId);
  return onSnapshot(
    ref,
    (snap) => {
      onData && onData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    },
    (error) => onError && onError(error)
  );
};

export const createJob = async ({
  title,
  company,
  location,
  type,
  salary,
  description,
  requirements,
  category,
  createdBy,
  contactEmail,
}) => {
  const payload = {
    title: (title || '').trim(),
    company: (company || '').trim(),
    location: (location || '').trim(),
    type: (type || '').trim(),
    salary: (salary || '').trim(),
    description: (description || '').trim(),
    requirements: (requirements || '').trim(),
    category: (category || '').trim(),
    createdBy: createdBy || null,
    contactEmail: contactEmail || null,
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'jobs'), payload);
  return docRef.id;
};

export const applyToJob = async ({ jobId, job, user }) => {
  if (!jobId) throw new Error('Missing jobId');
  if (!user?.uid) throw new Error('Not authenticated');

  const applicationId = buildJobApplicationId(jobId, user.uid);
  const ref = doc(db, 'jobApplications', applicationId);

  const existing = await getDoc(ref);
  if (existing.exists()) {
    const err = new Error('Already applied');
    err.code = 'already-applied';
    throw err;
  }

  const data = {
    jobId,
    jobTitle: job?.title || null,
    company: job?.company || null,
    employerId: job?.createdBy?.uid || job?.createdBy || null,
    userId: user.uid,
    applicantEmail: user.email || null,
    applicantName: user.fullName || null,
    applicantUsername: user.username || null,
    applicantPhotoURL: user.profileImageURL || null,
    contactEmail: job?.contactEmail || null,
    status: 'Pending',
    appliedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, data);
  return applicationId;
};

export const subscribeToApplicationsForJob = (jobId, { onData, onError } = {}) => {
  if (!jobId) return () => {};
  const q = query(collection(db, 'jobApplications'), where('jobId', '==', jobId), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData && onData(items);
    },
    (error) => onError && onError(error)
  );
};
