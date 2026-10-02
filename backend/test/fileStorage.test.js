const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const fs = require('node:fs/promises');
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const uploadDirectory = mkdtempSync(path.join(os.tmpdir(), 'imboni-upload-test-'));
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-file-signing';
process.env.UPLOAD_STORAGE = 'volume';
process.env.UPLOAD_DIR = uploadDirectory;

const { isValidDownload, persistUpload, signFilePaths } = require('../utils/fileStorage');

after(() => rmSync(uploadDirectory, { recursive: true, force: true }));

test('stores uploads under a random key in the configured directory', async () => {
  const content = Buffer.from('sample assignment');
  const key = await persistUpload({ buffer: content, originalname: 'assignment.pdf' });

  assert.match(key, /^f-[a-f0-9]{48}\.pdf$/);
  assert.deepEqual(await fs.readFile(path.join(uploadDirectory, key)), content);
});

test('signs valid upload references and rejects changed or expired links', () => {
  const filePath = '/uploads/f-0123456789abcdef0123456789abcdef0123456789abcdef.pdf';
  const result = signFilePaths({ file_path: filePath, external_url: 'https://example.test/file' });
  const match = result.file_path.match(/^\/api\/files\/([^?]+)\?expires=(\d+)&signature=([a-f0-9]{64})$/);

  assert.ok(match);
  const key = decodeURIComponent(match[1]);
  assert.equal(isValidDownload(key, match[2], match[3]), true);
  assert.equal(isValidDownload(key, Number(match[2]) - 1, match[3]), false);
  const altered = `${match[3][0] === '0' ? '1' : '0'}${match[3].slice(1)}`;
  assert.equal(isValidDownload(key, match[2], altered), false);
  assert.equal(result.external_url, 'https://example.test/file');
});