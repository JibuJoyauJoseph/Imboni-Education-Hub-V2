const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const uploadStorage = process.env.UPLOAD_STORAGE || 'local';
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
const downloadTtl = Math.max(60, Math.min(600, Number(process.env.FILE_URL_TTL_SECONDS) || 300));
const fileKeyPattern = /^[a-zA-Z0-9_-]{1,120}(?:\.[a-zA-Z0-9]{1,10})?$/;
let s3Client;

function getS3Client() {
  if (!s3Client) {
    const endpoint = process.env.S3_ENDPOINT || undefined;
    s3Client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
      }
    });
  }
  return s3Client;
}

function makeFileKey(originalName) {
  const extension = path.extname(path.basename(originalName || '')).toLowerCase();
  const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
  return `f-${crypto.randomBytes(24).toString('hex')}${safeExtension}`;
}

async function persistUpload(file) {
  if (!file?.buffer) throw new Error('Uploaded file content is missing.');
  const key = makeFileKey(file.originalname);

  if (uploadStorage === 's3') {
    await getS3Client().send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: 'application/octet-stream',
      ContentDisposition: 'attachment'
    }));
  } else if (uploadStorage === 'local' || uploadStorage === 'volume') {
    await fs.mkdir(uploadDirectory, { recursive: true });
    await fs.writeFile(path.join(uploadDirectory, key), file.buffer, { flag: 'wx' });
  } else {
    throw new Error('UPLOAD_STORAGE must be local, volume, or s3.');
  }

  return key;
}

function createDownloadPath(filePath) {
  if (typeof filePath !== 'string' || !filePath.startsWith('/uploads/')) return filePath;
  const key = filePath.slice('/uploads/'.length);
  if (!fileKeyPattern.test(key)) return filePath;

  const expires = Math.floor(Date.now() / 1000) + downloadTtl;
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(`${key}:${expires}`)
    .digest('hex');
  return `/api/files/${encodeURIComponent(key)}?expires=${expires}&signature=${signature}`;
}

function signFilePaths(value) {
  if (Array.isArray(value)) return value.map(signFilePaths);
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value) || value instanceof Date) return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    key === 'file_path' && typeof item === 'string' ? createDownloadPath(item) : signFilePaths(item)
  ]));
}

function isValidDownload(key, expires, signature) {
  const expiry = Number(expires);
  if (!fileKeyPattern.test(key) || !Number.isSafeInteger(expiry) || expiry <= Date.now() / 1000 || expiry > Date.now() / 1000 + downloadTtl + 5) return false;
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return false;

  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${key}:${expiry}`).digest();
  const supplied = Buffer.from(signature, 'hex');
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

async function sendStoredFile(key, res) {
  if (uploadStorage === 's3') {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ResponseContentDisposition: 'attachment'
    });
    const url = await getSignedUrl(getS3Client(), command, { expiresIn: 120 });
    return res.redirect(302, url);
  }

  return res.sendFile(path.join(uploadDirectory, key), {
    headers: { 'Content-Disposition': 'attachment' }
  });
}

module.exports = { isValidDownload, persistUpload, sendStoredFile, signFilePaths, uploadStorage };