const express = require('express');
const { body, param } = require('express-validator');
const controller = require('../controllers/conversationController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

const router = express.Router();

router.use(protect);

const idRule = param('id').isInt({ min: 1 }).withMessage('Invalid conversation id').toInt();
const isGroup = body('type').equals('group');

const createRules = [
  body('type').optional().isIn(['private', 'group']).withMessage('type must be private or group'),
  body('userId')
    .if(body('type').not().equals('group'))
    .isInt({ min: 1 })
    .withMessage('userId is required')
    .toInt(),
  body('name')
    .if(isGroup)
    .isString()
    .withMessage('Group name is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Group name must be 1 to 100 characters'),
  body('memberIds').if(isGroup).isArray({ min: 1, max: 49 }).withMessage('Add 1 to 49 members'),
  body('memberIds.*').if(isGroup).isInt({ min: 1 }).withMessage('Invalid member id').toInt(),
];

const renameRules = [
  idRule,
  body('name')
    .isString()
    .withMessage('Group name is required')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Group name must be 1 to 100 characters'),
];

const addMemberRules = [
  idRule,
  body('userIds').isArray({ min: 1, max: 49 }).withMessage('Choose 1 to 49 people to add'),
  body('userIds.*').isInt({ min: 1 }).withMessage('Invalid user id').toInt(),
];

const removeMemberRules = [
  idRule,
  param('userId').isInt({ min: 1 }).withMessage('Invalid user id').toInt(),
];

router.get('/', controller.list);
router.post('/', createRules, validate, controller.create);
router.get('/:id', idRule, validate, controller.getOne);
router.delete('/:id', idRule, validate, controller.remove);

router.put('/:id', renameRules, validate, controller.updateGroup);
router.put('/:id/image', idRule, validate, uploadSingle, controller.setImage);
router.post('/:id/members', addMemberRules, validate, controller.addMembers);
router.delete('/:id/members/:userId', removeMemberRules, validate, controller.removeMember);
router.post('/:id/leave', idRule, validate, controller.leave);

module.exports = router;