const path = require('path');
const ApiError = require('./ApiError');

const MAX_SIZE = 10 * 1024 * 1024;

const startsWith = (buf, bytes, offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

const isJpeg = (b) => startsWith(b, [0xff, 0xd8, 0xff]);
const isPng = (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]);
const isGif = (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]);
const isWebp = (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8);
const isPdf = (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]);
const isZip = (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]);
const isOle = (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]);

const OFFICE = 'application/vnd.openxmlformats-officedocument';

const RULES = {
  '.jpg': { type: 'image', mimes: ['image/jpeg'], check: isJpeg },
  '.jpeg': { type: 'image', mimes: ['image/jpeg'], check: isJpeg },
  '.png': { type: 'image', mimes: ['image/png'], check: isPng },
  '.gif': { type: 'image', mimes: ['image/gif'], check: isGif },
  '.webp': { type: 'image', mimes: ['image/webp'], check: isWebp },
  '.pdf': { type: 'file', mimes: ['application/pdf'], check: isPdf },
  '.doc': { type: 'file', mimes: ['application/msword'], check: isOle },
  '.docx': { type: 'file', mimes: [`${OFFICE}.wordprocessingml.document`], check: isZip },
  '.xls': { type: 'file', mimes: ['application/vnd.ms-excel'], check: isOle },
  '.xlsx': { type: 'file', mimes: [`${OFFICE}.spreadsheetml.sheet`], check: isZip },
  '.ppt': { type: 'file', mimes: ['application/vnd.ms-powerpoint'], check: isOle },
  '.pptx': { type: 'file', mimes: [`${OFFICE}.presentationml.presentation`], check: isZip },
  '.txt': { type: 'file', mimes: ['text/plain'], check: null },
  '.csv': { type: 'file', mimes: ['text/csv', 'application/vnd.ms-excel', 'text/plain'], check: null },
};

const validateFile = (file) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const rule = RULES[ext];

  if (!rule) throw new ApiError(400, 'This file type is not allowed');
  if (file.size === 0) throw new ApiError(400, 'The file is empty');
  if (file.size > MAX_SIZE) throw new ApiError(400, 'File is too large (max 10 MB)');
  if (!rule.mimes.includes(file.mimetype)) throw new ApiError(400, 'The file type does not match its extension');
  if (rule.check && !rule.check(file.buffer)) throw new ApiError(400, 'The file content does not match its type');

  return { ext, type: rule.type, contentType: rule.mimes[0] };
};

const displayName = (originalName) =>
  path.basename(originalName || 'file').replace(/[\u0000-\u001f]/g, '').slice(0, 255);

module.exports = { MAX_SIZE, validateFile, displayName };