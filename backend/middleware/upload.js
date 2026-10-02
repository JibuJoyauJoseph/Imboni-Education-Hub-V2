const multer = require('multer');
const { persistUpload } = require('../utils/fileStorage');

const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

module.exports = {
  single(fieldName) {
    return (req, res, next) => parser.single(fieldName)(req, res, async error => {
      if (error) return next(error);
      if (!req.file) return next();

      try {
        req.file.filename = await persistUpload(req.file);
        next();
      } catch (storageError) {
        next(storageError);
      }
    });
  }
};
