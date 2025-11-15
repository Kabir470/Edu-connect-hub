import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

const toBlob = async (uri) => {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Failed to fetch file data');
  }
  return response.blob();
};

export const uploadChatAttachment = async ({
  uri,
  conversationId,
  filename = 'attachment',
  mimeType = 'application/octet-stream',
}) => {
  if (!uri || !conversationId) {
    throw new Error('Missing attachment payload');
  }
  const blob = await toBlob(uri);
  const safeMime = mimeType || blob.type || 'application/octet-stream';
  const extension = filename.includes('.') ? filename.split('.').pop() : 'bin';
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `conversations/${conversationId}/${uniqueId}.${extension}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, { contentType: safeMime });
  const downloadURL = await getDownloadURL(storageRef);
  return { downloadURL, storagePath, contentType: safeMime };
};
