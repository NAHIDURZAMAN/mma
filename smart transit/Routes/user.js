const express = require('express');
const multer = require('multer');
const { storage } = require('./cloudinary.js');
const { requireloginadmin } = require('./requirelogin_middleware');
const { createUser, validateUserData, getAllUsers, updateUserBalance } = require('../fareCalculator');

const router = express.Router();
const upload = multer({ storage });

// POST route to create a new user
router.post('/create', async (req, res) => {
    try {
        console.log('Creating user with data:', req.body);
        const result = await createUser(req.body);
        console.log('User creation result:', result);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// GET route to fetch all users (for admin purposes)
router.get('/admin/users', async (req, res) => {
    try {
        const result = await getAllUsers();
        res.json(result);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users',
            error: error.message
        });
    }
});

// PUT route to update user balance
router.put('/admin/users/:userId/balance', async (req, res) => {
    const { userId } = req.params;
    const { balance } = req.body;

    if (!balance || isNaN(balance) || balance < 0) {
        return res.status(400).json({
            success: false,
            message: 'Valid balance amount is required'
        });
    }

    try {
        const result = await updateUserBalance(userId, balance);
        res.json(result);
    } catch (error) {
        console.error('Error updating balance:', error);
        if (error.message.includes('User not found')) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error updating balance',
            error: error.message
        });
    }
});

module.exports = router;