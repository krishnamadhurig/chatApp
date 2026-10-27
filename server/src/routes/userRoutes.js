const express = require('express');
const { param } = require('express-validator');
const controller = require('../controllers/userController');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { uploadSingle } = require('../middleware/upload');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', controller.search);
router.get(
  '/:id',
  param('id').isInt({ min: 1 }).withMessage('Invalid user id'),
  validate,
  controller.getById
);

router.put(
  '/profile',
  protect,
  uploadSingle, 
  body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2 to 80 characters'),
  validate,
  controller.updateProfile
);


module.exports = router;