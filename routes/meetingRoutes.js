const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminMiddleware');
const { createMeeting, getAllMeetings, updateMeeting, deleteMeeting } = require('../controllers/meetingController');

router.post('/', protect, isAdmin, createMeeting);
router.get('/', protect, getAllMeetings);
router.put('/:id', protect, isAdmin, updateMeeting);
router.delete('/:id', protect, isAdmin, deleteMeeting);

module.exports = router;