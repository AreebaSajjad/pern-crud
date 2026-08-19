const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminMiddleware');
const { queryOkf } = require('../controllers/okfController');
const { rebuildFullOkfBundle } = require('../utils/okfGenerator');

router.post('/query', protect, queryOkf);

router.post('/rebuild', protect, isAdmin, async (req, res) => {
  await rebuildFullOkfBundle();
  res.status(200).json({ message: 'OKF bundle rebuilt successfully' });
});

module.exports = router;
