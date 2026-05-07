const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

let storageClient;
function getStorageClient() {
  if (storageClient !== undefined) return storageClient;

  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (!bucketName) {
    storageClient = null;
    return null;
  }

  try {
    const { Storage } = require('@google-cloud/storage');
    const keyJson = process.env.GOOGLE_CLOUD_STORAGE_KEY;
    const opts = {};
    if (keyJson) {
      try {
        opts.credentials = JSON.parse(keyJson);
      } catch (error) {
        console.warn('[upload] GOOGLE_CLOUD_STORAGE_KEY is not valid JSON; using ADC.');
      }
    }
    storageClient = new Storage(opts);
    return storageClient;
  } catch (error) {
    console.warn('[upload] @google-cloud/storage unavailable:', error.message);
    storageClient = null;
    return null;
  }
}

async function uploadFile({ buffer, filename, mimeType, userId }) {
  const ext = path.extname(filename) || '';
  const base = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 64);
  const id = crypto.randomBytes(8).toString('hex');
  const storedName = `${Date.now()}-${id}-${base}${ext}`;

  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  const client = getStorageClient();

  if (client && bucketName) {
    const bucket = client.bucket(bucketName);
    const objectName = `uploads/${userId}/${storedName}`;
    const file = bucket.file(objectName);
    await file.save(buffer, { contentType: mimeType, resumable: false });
    return {
      storage: 'gcs',
      bucket: bucketName,
      object: objectName,
      url: `https://storage.googleapis.com/${bucketName}/${objectName}`,
      filename,
      mimeType,
      size: buffer.length,
    };
  }

  const uploadsDir = path.join(process.cwd(), 'uploads', String(userId));
  await fs.mkdir(uploadsDir, { recursive: true });
  const fullPath = path.join(uploadsDir, storedName);
  await fs.writeFile(fullPath, buffer);
  return {
    storage: 'local',
    path: fullPath,
    url: `/uploads/${userId}/${storedName}`,
    filename,
    mimeType,
    size: buffer.length,
  };
}

module.exports = { uploadFile };
