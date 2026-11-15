const express = require('express');
const durumController = require('../controllers/durumController');

const router = express.Router();

router.get('/', durumController.goster);

module.exports = router;
