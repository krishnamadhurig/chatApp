const express = require('express');
const { body, param, query } = require('express-validator');
const controller = require('../controllers/messageController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');


const router = express.Router();

const conversationIdRule = param('conversationId')
  .isInt({ min: 1 })
  .withMessage('Invalid conversation id')
  .toInt();

const messageIdRule = param('id')
  .isInt({ min: 1 })
  .withMessage('Invalid message id')
  .toInt();

const listRules = [
  conversationIdRule,
  query('page').optional().isInt({ min: 1 }).withMessage('page must be 1 or more').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50').toInt(),
];

const sendRules = [
  conversationIdRule,
  body('message')
    .isString()
    .withMessage('Message is required')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be 1 to 5000 characters'),
];

router.get('/conversations/:conversationId/messages', protect, listRules, validate, controller.list);
router.post('/conversations/:conversationId/messages', protect, sendRules, validate, controller.create);
router.put('/conversations/:conversationId/read', protect, conversationIdRule, validate, controller.markConversationRead);
router.put('/messages/:id/read', protect, messageIdRule, validate, controller.markRead);
router.delete('/messages/:id', protect, messageIdRule, validate, controller.remove);
router.post('/conversations/:conversationId/media', protect, conversationIdRule,  validate,uploadSingle, controller.upload);
module.exports = router;