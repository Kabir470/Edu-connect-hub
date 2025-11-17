import { db } from '../../firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  getDoc,
} from 'firebase/firestore';

// Collection: projects (global) each project has ownerId for queries.
// A user's portfolio is all projects with ownerId == user.uid

const projectsCol = collection(db, 'projects');
const codeSitesColName = 'portfolioSites';

export const subscribeToUserProjects = (userId, onData, onError) => {
  if (!userId) return () => {};
  const q = query(projectsCol, where('ownerId', '==', userId));
  return onSnapshot(q, onData, onError);
};

export const createProject = async ({ owner, name, description, primaryLanguage, tags = [], visibility = 'public' }) => {
  if (!owner?.uid || !name?.trim()) throw new Error('Missing required fields');
  const nowName = name.trim();
  const payload = {
    ownerId: owner.uid,
    ownerName: owner.fullName || owner.email?.split('@')[0] || 'Member',
    name: nowName,
    description: description?.trim() || '',
    primaryLanguage: primaryLanguage?.trim() || 'Other',
    tags: tags.slice(0, 12),
    visibility: visibility === 'private' ? 'private' : 'public',
    pinned: false,
    starsCount: 0,
    forksCount: 0,
    watchersCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(projectsCol, payload);
  return { id: ref.id, ...payload };
};

export const updateProject = async ({ projectId, ownerId, patch }) => {
  if (!projectId || !ownerId) throw new Error('Missing ids');
  const ref = doc(db, 'projects', projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Not found');
  if (snap.data().ownerId !== ownerId) throw new Error('Forbidden');
  const safePatch = { ...patch };
  delete safePatch.ownerId;
  delete safePatch.createdAt;
  safePatch.updatedAt = serverTimestamp();
  await updateDoc(ref, safePatch);
};

export const deleteProject = async ({ projectId, ownerId }) => {
  if (!projectId || !ownerId) throw new Error('Missing ids');
  const ref = doc(db, 'projects', projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().ownerId !== ownerId) throw new Error('Forbidden');
  await deleteDoc(ref);
};

export const togglePinProject = async ({ projectId, ownerId, pinned }) => {
  if (!projectId || !ownerId) throw new Error('Missing ids');
  const ref = doc(db, 'projects', projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Not found');
  if (snap.data().ownerId !== ownerId) throw new Error('Forbidden');
  await updateDoc(ref, { pinned: !!pinned, updatedAt: serverTimestamp() });
};

// Code-based portfolio (single per user): stores html, css, js and metadata.
export const subscribeToCodeSite = (ownerId, onSnapshotCb, onError) => {
  if (!ownerId) return () => {};
  const ref = doc(db, codeSitesColName, ownerId);
  return onSnapshot(ref, onSnapshotCb, onError);
};

export const saveCodeSite = async ({ ownerId, title = 'My Portfolio', html = '', css = '', js = '', isPublic = true }) => {
  if (!ownerId) throw new Error('Missing ownerId');
  const ref = doc(db, codeSitesColName, ownerId);
  const payload = {
    ownerId,
    title: title || 'My Portfolio',
    html: String(html),
    css: String(css),
    js: String(js),
    public: !!isPublic,
    updatedAt: serverTimestamp(),
  };
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await updateDoc(ref, { ...payload, createdAt: serverTimestamp() }).catch(async () => {
      // If update fails (no doc), try set via addDoc pattern using known id through set (updateDoc requires exists)
      const { setDoc } = await import('firebase/firestore');
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
    });
  }
  return { id: ownerId };
};

export const buildInlineHtml = ({ title = 'Portfolio', html = '', css = '', js = '' }) => {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title.replace(/</g, '&lt;')}</title>
    <style>${css || ''}</style>
  </head>
  <body>
    ${html || ''}
    <script>${js || ''}<\/script>
  </body>
</html>`;
};
