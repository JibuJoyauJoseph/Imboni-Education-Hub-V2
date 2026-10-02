require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

async function main() {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Configure S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY first.');
  }

  const uploadDirectory = path.resolve(process.env.LEGACY_UPLOAD_DIR || process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
  const entries = await fs.readdir(uploadDirectory, { withFileTypes: true });
  const client = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: { accessKeyId, secretAccessKey }
  });
  let copied = 0;

  for (const entry of entries) {
    if (!entry.isFile() || path.basename(entry.name) !== entry.name) continue;
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: entry.name,
      Body: await fs.readFile(path.join(uploadDirectory, entry.name)),
      ContentType: 'application/octet-stream',
      ContentDisposition: 'attachment'
    }));
    copied += 1;
  }

  console.log(`Copied ${copied} local upload(s) to the private bucket. Local files were retained.`);
}

main().catch(error => {
  console.error('Could not migrate local uploads:', error.message);
  process.exitCode = 1;
});