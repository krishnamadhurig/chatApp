const multer = require('multer');
const { MAX_SIZE } = require('../utils/fileRules');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
});

module.exports = { uploadSingle: upload.single('file') };