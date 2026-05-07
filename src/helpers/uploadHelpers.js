/**
 * Upload one file via session-authenticated multipart endpoint; returns public URL string.
 */
export async function uploadPublicImage(file) {
  if (!file || typeof file !== 'object') {
    throw new Error('Choose an image first.');
  }
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  const body = new FormData();
  body.append('file', file);

  const res = await fetch('/api/uploads', {
    method: 'POST',
    credentials: 'include',
    body,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    const msg = (data && data.error) || res.statusText || 'Upload failed';
    throw new Error(msg);
  }
  const url = data && data.url ? String(data.url) : '';
  if (!url) {
    throw new Error('Upload did not return a URL.');
  }
  return url;
}

/**
 * Same upload as {@link uploadPublicImage}; returns `{ url }` for account/profile flows.
 */
export async function uploadFile(file) {
  const url = await uploadPublicImage(file);
  return { url };
}
