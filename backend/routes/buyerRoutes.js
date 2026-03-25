const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Buyer = require('../models/Buyer');
const Product = require('../models/Product');
const Request = require('../models/Request');
const Farmer = require('../models/Farmer');

// Get buyer dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.user.id);
    if (!buyer) {
      return res.status(404).json({ message: 'Buyer not found' });
    }

    // Get all available products
    const products = await Product.find({ status: 'available' })
      .populate('farmer', 'mobileNumber location kisanId')
      .sort({ createdAt: -1 });

    // Get buyer's requests
    const requests = await Request.find({ 
      from: req.user.id,
      fromModel: 'Buyer'
    })
      .populate('to', 'name mobileNumber location address city state pincode')
      .populate({
        path: 'productId',
        populate: {
          path: 'farmer',
          select: 'name mobileNumber location kisanId address city state pincode'
        }
      })
      .populate({
        path: 'poolId',
        select:
          'creatorFarmer cropTypes status targetQuantity remainingQuantity location expectedCompletionDate members',
        populate: [
          {
            path: 'creatorFarmer',
            select: 'name mobileNumber kisanId location address city state pincode'
          },
          {
            path: 'members.farmer',
            select: 'name mobileNumber kisanId location'
          }
        ]
      })
      .sort({ createdAt: -1 });

    res.json({
      buyer: {
        id: buyer._id,
        name: buyer.name,
        mobileNumber: buyer.mobileNumber,
        location: buyer.location
      },
      products,
      requests
    });
  } catch (error) {
    console.error('Buyer dashboard error:', error);
    res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
  }
});

// Get products filtered by location and crop type
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const { cropType, latitude, longitude, radius = 50 } = req.query;

    const buyer = await Buyer.findById(req.user.id);
    if (!buyer) {
      return res.status(404).json({ message: 'Buyer not found' });
    }

    let query = { status: 'available' };

    if (cropType) {
      query.cropType = new RegExp(cropType, 'i');
    }

    // Use buyer's location if not provided in query
    const lat = latitude ? parseFloat(latitude) : buyer.location.latitude;
    const lon = longitude ? parseFloat(longitude) : buyer.location.longitude;
    const radiusKm = parseFloat(radius);

    let products = await Product.find(query)
      .populate('farmer', 'name mobileNumber location kisanId address city state pincode')
      .populate({
        path: 'poolId',
        select:
          'creatorFarmer cropTypes status targetQuantity remainingQuantity location expectedCompletionDate members',
        populate: [
          {
            path: 'creatorFarmer',
            select: 'name mobileNumber kisanId location address city state pincode'
          },
          {
            path: 'members.farmer',
            select: 'name mobileNumber kisanId location'
          }
        ]
      })
      .sort({ createdAt: -1 });

    // Filter by location and calculate distance
    products = products
      .map(p => {
        if (p.location && p.location.latitude && p.location.longitude && lat && lon) {
          const distance = calculateDistance(
            lat, lon,
            p.location.latitude, p.location.longitude
          );
          return { ...p.toObject(), distance };
        }
        return p.toObject();
      })
      .filter(p => !p.distance || p.distance <= radiusKm)
      .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

    res.json({ products });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

// Send buy request
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const { productId, message } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.status !== 'available') {
      return res.status(400).json({ message: 'Product is not available' });
    }

    // Check if request already exists
    const existingRequest = await Request.findOne({
      from: req.user.id,
      fromModel: 'Buyer',
      productId: productId,
      status: { $in: ['pending', 'accepted'] }
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'Request already sent for this product' });
    }

    const request = new Request({
      type: 'buy',
      from: req.user.id,
      fromModel: 'Buyer',
      to: product.farmer,
      productId: productId,
      // Link buy request to the pool for better buyer dashboard grouping.
      poolId: product.poolId,
      message: message || ''
    });

    await request.save();
    await request.populate('to', 'mobileNumber location');
    await request.populate('productId');

    res.status(201).json({ message: 'Buy request sent successfully', request });
  } catch (error) {
    console.error('Buy request error:', error);
    res.status(500).json({ message: 'Error sending buy request', error: error.message });
  }
});

// Cancel/remove a pending buy request (buyer only)
router.delete('/request/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.from.toString() !== req.user.id || request.fromModel !== 'Buyer') {
      return res.status(403).json({ message: 'Not authorized to cancel this request' });
    }

    if (request.type !== 'buy') {
      return res.status(400).json({ message: 'This is not a buy request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be removed' });
    }

    // Use existing enum value to avoid schema change.
    request.status = 'rejected';
    request.respondedAt = new Date();
    request.message = request.message ? `${request.message} (cancelled by buyer)` : 'cancelled by buyer';
    await request.save();

    res.json({ message: 'Request removed successfully', request });
  } catch (error) {
    console.error('Cancel request error:', error);
    res.status(500).json({ message: 'Error cancelling request', error: error.message });
  }
});

// Get request status
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const requests = await Request.find({ 
      from: req.user.id,
      fromModel: 'Buyer'
    })
      .populate('to', 'name mobileNumber location address city state pincode')
      .populate({
        path: 'productId',
        populate: {
          path: 'farmer',
          select: 'name mobileNumber location kisanId address city state pincode'
        }
      })
      .populate({
        path: 'poolId',
        select:
          'creatorFarmer cropTypes status targetQuantity remainingQuantity location expectedCompletionDate members',
        populate: [
          {
            path: 'creatorFarmer',
            select: 'name mobileNumber kisanId location address city state pincode'
          },
          {
            path: 'members.farmer',
            select: 'name mobileNumber kisanId location'
          }
        ]
      })
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
});

// Update buyer profile/location
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { location } = req.body;

    const buyer = await Buyer.findById(req.user.id);
    if (!buyer) {
      return res.status(404).json({ message: 'Buyer not found' });
    }

    if (location) {
      buyer.location = { ...buyer.location, ...location };
    }

    await buyer.save();

    res.json({ message: 'Profile updated successfully', buyer });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

module.exports = router;

