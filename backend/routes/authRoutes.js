const express = require('express');
const router = express.Router();
const Farmer = require('../models/Farmer');
const Buyer = require('../models/Buyer');
const { generateToken } = require('../middleware/auth');

// Farmer Registration
router.post('/farmer/register', async (req, res) => {
  try {
    const { name, mobileNumber, password, kisanId, location } = req.body;

    // Validation
    if (!name || !mobileNumber || !password || !kisanId) {
      return res.status(400).json({ message: 'Name, mobile number, password, and Kisan ID are required' });
    }

    // Check if farmer already exists
    const existingFarmer = await Farmer.findOne({ mobileNumber });
    if (existingFarmer) {
      return res.status(400).json({ message: 'Farmer with this mobile number already exists' });
    }

    // Create new farmer
    const farmer = new Farmer({
      name,
      mobileNumber,
      password,
      kisanId,
      location: location || { latitude: 0, longitude: 0 }
    });

    await farmer.save();

    // Generate token
    const token = generateToken({ 
      id: farmer._id, 
      mobileNumber: farmer.mobileNumber,
      type: 'farmer' 
    });

    res.status(201).json({
      message: 'Farmer registered successfully',
      token,
      farmer: {
        id: farmer._id,
        name: farmer.name,
        mobileNumber: farmer.mobileNumber,
        kisanId: farmer.kisanId,
        location: farmer.location
      }
    });
  } catch (error) {
    console.error('Farmer registration error:', error);
    res.status(500).json({ message: 'Error registering farmer', error: error.message });
  }
});

// Farmer Login
router.post('/farmer/login', async (req, res) => {
  try {
    const { mobileNumber, password } = req.body;

    if (!mobileNumber || !password) {
      return res.status(400).json({ message: 'Mobile number and password are required' });
    }

    const farmer = await Farmer.findOne({ mobileNumber });
    if (!farmer) {
      return res.status(401).json({ message: 'Invalid mobile number or password' });
    }

    const isMatch = await farmer.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid mobile number or password' });
    }

    const token = generateToken({ 
      id: farmer._id, 
      mobileNumber: farmer.mobileNumber,
      type: 'farmer' 
    });

    res.json({
      message: 'Login successful',
      token,
      farmer: {
        id: farmer._id,
        name: farmer.name,
        mobileNumber: farmer.mobileNumber,
        kisanId: farmer.kisanId,
        location: farmer.location
      }
    });
  } catch (error) {
    console.error('Farmer login error:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// Buyer Registration
router.post('/buyer/register', async (req, res) => {
  try {
    const { name, mobileNumber, password, location } = req.body;

    if (!name || !mobileNumber || !password) {
      return res.status(400).json({ message: 'Name, mobile number, and password are required' });
    }

    const existingBuyer = await Buyer.findOne({ mobileNumber });
    if (existingBuyer) {
      return res.status(400).json({ message: 'Buyer with this mobile number already exists' });
    }

    const buyer = new Buyer({
      name,
      mobileNumber,
      password,
      location: location || { latitude: 0, longitude: 0 }
    });

    await buyer.save();

    const token = generateToken({ 
      id: buyer._id, 
      mobileNumber: buyer.mobileNumber,
      type: 'buyer' 
    });

    res.status(201).json({
      message: 'Buyer registered successfully',
      token,
      buyer: {
        id: buyer._id,
        name: buyer.name,
        mobileNumber: buyer.mobileNumber,
        location: buyer.location
      }
    });
  } catch (error) {
    console.error('Buyer registration error:', error);
    res.status(500).json({ message: 'Error registering buyer', error: error.message });
  }
});

// Buyer Login
router.post('/buyer/login', async (req, res) => {
  try {
    const { mobileNumber, password } = req.body;

    if (!mobileNumber || !password) {
      return res.status(400).json({ message: 'Mobile number and password are required' });
    }

    const buyer = await Buyer.findOne({ mobileNumber });
    if (!buyer) {
      return res.status(401).json({ message: 'Invalid mobile number or password' });
    }

    const isMatch = await buyer.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid mobile number or password' });
    }

    const token = generateToken({ 
      id: buyer._id, 
      mobileNumber: buyer.mobileNumber,
      type: 'buyer' 
    });

    res.json({
      message: 'Login successful',
      token,
      buyer: {
        id: buyer._id,
        name: buyer.name,
        mobileNumber: buyer.mobileNumber,
        location: buyer.location
      }
    });
  } catch (error) {
    console.error('Buyer login error:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

module.exports = router;

