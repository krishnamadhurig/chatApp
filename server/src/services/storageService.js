const crypto = require('crypto');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const ApiError = require('../utils/ApiError');

const bucket = () => process.env.AWS_S3_BUCKET;
const region = () => process.env.AWS_REGION;

let client = null;
const getClient = () => {
  if (!bucket() || !region()) {
    throw new ApiError(503, 'File uploads are not configured on the server');
  }
  if (!client) client = new S3Client({ region: region() });
  return client;
};

const keyFromUrl = (url) => decodeURIComponent(new URL(url).pathname.slice(1));

const uploadFile = async ({ buffer, contentType, ext, folder }) => {
  const key = `${folder}/${crypto.randomUUID()}${ext}`;
  await getClient().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: buffer, ContentType: contentType })
  );
  return { key, url: `https://${bucket()}.s3.${region()}.amazonaws.com/${key}` };
};

const headerSafe = (name) =>
  encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const getSignedMediaUrl = async (url, { fileName, download = false } = {}) => {
  const params = { Bucket: bucket(), Key: keyFromUrl(url) };
  if (download && fileName) {
    params.ResponseContentDisposition = `attachment; filename*=UTF-8''${headerSafe(fileName)}`;
  }
  return getSignedUrl(getClient(), new GetObjectCommand(params), { expiresIn: 3600 });
};

const deleteObject = async (url) => {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: keyFromUrl(url) }));
};

module.exports = { uploadFile, getSignedMediaUrl, deleteObject };