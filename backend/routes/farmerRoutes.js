const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Farmer = require('../models/Farmer');
const Pool = require('../models/Pool');
const Product = require('../models/Product');
const Request = require('../models/Request');

// Get farmer dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id);
    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found' });
    }

    // Get farmer's pools
    const pools = await Pool.find({ creatorFarmer: req.user.id })
      .populate('members.farmer', 'name mobileNumber location kisanId address city state pincode')
      .populate('creatorFarmer', 'name mobileNumber location kisanId')
      .sort({ createdAt: -1 });

    // Also get pools where farmer is a member (only if still a member after potential removal)
    const memberPools = await Pool.find({ 
      'members.farmer': req.user.id,
      'members.status': 'accepted',
      creatorFarmer: { $ne: req.user.id }
    })
      .populate('creatorFarmer', 'name mobileNumber location kisanId address city state pincode')
      .populate('members.farmer', 'name mobileNumber location kisanId address city state pincode')
      .sort({ createdAt: -1 });
    
    // Filter to ensure the farmer is still actually a member (in case of async updates)
    const validMemberPools = memberPools.filter(pool => 
      pool.members.some(m => 
        m.farmer && (m.farmer._id?.toString() === req.user.id || m.farmer.toString() === req.user.id) && 
        m.status === 'accepted'
      )
    );

    // Get pool requests received
    const poolRequests = await Request.find({ 
      to: req.user.id, 
      type: 'pool',
      status: 'pending'
    }).populate('from', 'name mobileNumber location kisanId address city state pincode').populate('poolId');

    // Get buy requests
    const buyRequests = await Request.find({ 
      to: req.user.id, 
      type: 'buy',
      status: { $in: ['pending', 'accepted', 'completed'] }
    }).populate('from', 'name mobileNumber location address city state pincode').populate('productId');

    // Get farmer's products
    const products = await Product.find({ farmer: req.user.id })
      .sort({ createdAt: -1 });

    res.json({
      farmer: {
        id: farmer._id,
        name: farmer.name,
        mobileNumber: farmer.mobileNumber,
        kisanId: farmer.kisanId,
        location: farmer.location
      },
      pools,
      memberPools: validMemberPools || [],
      poolRequests,
      buyRequests,
      products
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
  }
});

// Create a pool
router.post('/pool/create', authenticateToken, async (req, res) => {
  try {
    const { cropTypes, location, targetQuantity, initialContribution, expectedCompletionDate } = req.body;

    if (!cropTypes || !Array.isArray(cropTypes) || cropTypes.length === 0) {
      return res.status(400).json({ message: 'At least one crop type is required' });
    }

    if (!targetQuantity || targetQuantity <= 0) {
      return res.status(400).json({ message: 'Target quantity is required and must be greater than 0' });
    }

    const initialQty = parseFloat(initialContribution) || 0;
    if (initialQty < 0 || initialQty > targetQuantity) {
      return res.status(400).json({ message: 'Initial contribution must be between 0 and target quantity' });
    }

    const farmer = await Farmer.findById(req.user.id);
    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found' });
    }

    const remainingQty = targetQuantity - initialQty;

    const resolvedLocation = location
      ? { ...farmer.location, ...location }
      : farmer.location;

    const pool = new Pool({
      creatorFarmer: req.user.id,
      cropTypes,
      targetQuantity: parseFloat(targetQuantity),
      initialContribution: initialQty,
      remainingQuantity: remainingQty,
      location: resolvedLocation,
      expectedCompletionDate: expectedCompletionDate ? new Date(expectedCompletionDate) : undefined
    });

    // Add creator as a member with initial contribution
    if (initialQty > 0) {
      pool.members.push({
        farmer: req.user.id,
        status: 'accepted',
        quantity: initialQty
      });
    }

    await pool.save();
    await pool.populate('creatorFarmer', 'name mobileNumber location');

    res.status(201).json({ message: 'Pool created successfully', pool });
  } catch (error) {
    console.error('Pool creation error:', error);
    res.status(500).json({ message: 'Error creating pool', error: error.message });
  }
});

// Get nearby farmers
router.get('/nearby-farmers', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, radius = 50 } = req.query; // radius in km

    const farmer = await Farmer.findById(req.user.id);
    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found' });
    }

    const lat = parseFloat(latitude) || farmer.location.latitude;
    const lon = parseFloat(longitude) || farmer.location.longitude;

    // Find nearby farmers (excluding self)
    const nearbyFarmers = await Farmer.find({
      _id: { $ne: req.user.id },
      'location.latitude': { $exists: true, $ne: 0 },
      'location.longitude': { $exists: true, $ne: 0 }
    });

    // Calculate distance and filter
    const farmersWithDistance = nearbyFarmers
      .map(f => {
        const distance = calculateDistance(
          lat, lon,
          f.location.latitude, f.location.longitude
        );
        return { ...f.toObject(), distance };
      })
      .filter(f => f.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20); // Limit to 20 nearest

    res.json({ nearbyFarmers: farmersWithDistance });
  } catch (error) {
    console.error('Nearby farmers error:', error);
    res.status(500).json({ message: 'Error fetching nearby farmers', error: error.message });
  }
});

// Send pool request
router.post('/pool/request', authenticateToken, async (req, res) => {
  try {
    const { poolId, toFarmerId } = req.body;

    if (!poolId || !toFarmerId) {
      return res.status(400).json({ message: 'Pool ID and target farmer ID are required' });
    }

    const pool = await Pool.findById(poolId);
    if (!pool) {
      return res.status(404).json({ message: 'Pool not found' });
    }

    // Check if already a member
    const existingMember = pool.members.find(
      m => m.farmer.toString() === toFarmerId
    );

    if (existingMember) {
      return res.status(400).json({ message: 'Request already sent to this farmer' });
    }

    // Add to pool members
    pool.members.push({
      farmer: toFarmerId,
      status: 'pending'
    });
    await pool.save();

    // Create request record
    const request = new Request({
      type: 'pool',
      from: req.user.id,
      fromModel: 'Farmer',
      to: toFarmerId,
      poolId: poolId
    });
    await request.save();

    res.status(201).json({ message: 'Pool request sent successfully', request });
  } catch (error) {
    console.error('Pool request error:', error);
    res.status(500).json({ message: 'Error sending pool request', error: error.message });
  }
});

// Accept/Reject pool request
router.put('/pool/request/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, quantity } = req.body; // 'accept' or 'reject', quantity for accept

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.to.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to respond to this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    const pool = await Pool.findById(request.poolId);
    if (!pool) {
      return res.status(404).json({ message: 'Pool not found' });
    }

    if (pool.status === 'locked') {
      return res.status(400).json({ message: 'Cannot accept/reject requests for a locked pool' });
    }

    // When responding to a pool request, the responder is `request.to`.
    // Pool membership for the responder is stored under `pool.members[].farmer`.
    const member = pool.members.find(
      m => m.farmer.toString() === request.to.toString()
    );

    if (action === 'accept') {
      const acceptQty = parseFloat(quantity);
      if (!acceptQty || acceptQty <= 0) {
        return res.status(400).json({ message: 'Quantity is required when accepting a request' });
      }
      if (acceptQty > pool.remainingQuantity) {
        return res.status(400).json({
          message: `Contribution cannot exceed remaining quantity (${pool.remainingQuantity} kg)`
        });
      }

      if (!member) {
        return res.status(400).json({ message: 'Member not found in this pool' });
      }

      request.status = 'accepted';
      member.status = 'accepted';
      member.quantity = acceptQty;

      // Update pool remaining quantity based on accepted contribution.
      pool.remainingQuantity = Math.max(0, pool.remainingQuantity - acceptQty);
    } else if (action === 'reject') {
      request.status = 'rejected';
      if (member) {
        member.status = 'rejected';
      }
    } else {
      return res.status(400).json({ message: 'Invalid action. Use "accept" or "reject"' });
    }

    request.respondedAt = new Date();
    await request.save();
    await pool.save();

    // Populate farmer details for response
    await pool.populate('members.farmer', 'mobileNumber location kisanId');

    res.json({ message: `Request ${action}ed successfully`, request, pool });
  } catch (error) {
    console.error('Request response error:', error);
    res.status(500).json({ message: 'Error processing request', error: error.message });
  }
});

// Lock pool
router.put('/pool/:poolId/lock', authenticateToken, async (req, res) => {
  try {
    const { poolId } = req.params;

    const pool = await Pool.findById(poolId);
    if (!pool) {
      return res.status(404).json({ message: 'Pool not found' });
    }

    if (pool.creatorFarmer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only pool creator can lock the pool' });
    }

    if (pool.status === 'locked') {
      return res.status(400).json({ message: 'Pool is already locked' });
    }

    pool.status = 'locked';
    pool.lockedAt = new Date();

    // Clear all pending requests for this pool
    await Request.updateMany(
      { poolId: pool._id, status: 'pending' },
      { status: 'rejected', respondedAt: new Date() }
    );

    // Remove all pending members from pool
    pool.members = pool.members.filter(m => m.status !== 'pending');

    // Create ONE aggregated product per crop type, owned by pool creator.
    // This ensures buy requests always go to the pool creator (not each contributor).
    const acceptedMembers = pool.members.filter(m => m.status === 'accepted');
    const totalPoolQuantity = acceptedMembers.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);

    for (const cropType of pool.cropTypes) {
      // Avoid creating zero-quantity products.
      if (!totalPoolQuantity || totalPoolQuantity <= 0) continue;

      const product = new Product({
        farmer: pool.creatorFarmer,
        cropType: cropType.type,
        quantity: totalPoolQuantity,
        price: cropType.rate,
        location: pool.location,
        isFromPool: true,
        poolId: pool._id
      });
      await product.save();
    }

    await pool.save();
    res.json({ message: 'Pool locked successfully. Products are now visible to buyers.', pool });
  } catch (error) {
    console.error('Lock pool error:', error);
    res.status(500).json({ message: 'Error locking pool', error: error.message });
  }
});

// Edit pool quantity/price (creator only, when pool is active)
router.put('/pool/:poolId/edit', authenticateToken, async (req, res) => {
  try {
    const { poolId } = req.params;
    const { targetQuantity, cropRate } = req.body; // quantity and rate are for the single cropType

    const pool = await Pool.findById(poolId);
    if (!pool) return res.status(404).json({ message: 'Pool not found' });

    if (pool.creatorFarmer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only pool creator can edit the pool' });
    }

    if (pool.status !== 'active') {
      return res.status(400).json({ message: 'Cannot edit a locked/closed pool' });
    }

    const newTargetQty = targetQuantity !== undefined ? parseFloat(targetQuantity) : null;
    if (newTargetQty !== null && (!newTargetQty || newTargetQty <= 0)) {
      return res.status(400).json({ message: 'targetQuantity must be greater than 0' });
    }

    const newRate = cropRate !== undefined ? parseFloat(cropRate) : null;
    if (newRate !== null && (!newRate || newRate < 0)) {
      return res.status(400).json({ message: 'cropRate must be 0 or greater' });
    }

    if (newTargetQty === null && newRate === null) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    if (newTargetQty !== null) pool.targetQuantity = newTargetQty;
    if (newRate !== null && pool.cropTypes?.length) {
      pool.cropTypes[0].rate = newRate;
    }

    // Recompute remaining quantity from accepted member quantities (including initialContribution).
    const totalContributed = pool.members
      .filter((m) => m.status === 'accepted')
      .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);

    pool.remainingQuantity = Math.max(0, pool.targetQuantity - totalContributed);

    await pool.save();
    await pool.populate('creatorFarmer', 'name mobileNumber location kisanId');
    await pool.populate('members.farmer', 'name mobileNumber location kisanId address city state pincode');

    res.json({ message: 'Pool updated successfully', pool });
  } catch (error) {
    console.error('Edit pool error:', error);
    res.status(500).json({ message: 'Error editing pool', error: error.message });
  }
});

// Delete pool
router.delete('/pool/:poolId', authenticateToken, async (req, res) => {
  try {
    const { poolId } = req.params;

    const pool = await Pool.findById(poolId);
    if (!pool) {
      return res.status(404).json({ message: 'Pool not found' });
    }

    if (pool.creatorFarmer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only pool creator can delete the pool' });
    }

    if (pool.status === 'locked') {
      return res.status(400).json({ message: 'Locked pools cannot be deleted' });
    }

    pool.status = 'deleted';
    await pool.save();

    res.json({ message: 'Pool deleted successfully' });
  } catch (error) {
    console.error('Delete pool error:', error);
    res.status(500).json({ message: 'Error deleting pool', error: error.message });
  }
});

// Create direct product
router.post('/product/create', authenticateToken, async (req, res) => {
  try {
    const { cropType, quantity, price, unit, location } = req.body;

    if (!cropType || !quantity || !price) {
      return res.status(400).json({ message: 'Crop type, quantity, and price are required' });
    }

    const farmer = await Farmer.findById(req.user.id);
    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found' });
    }

    const product = new Product({
      farmer: req.user.id,
      cropType,
      quantity,
      price,
      unit: unit || 'kg',
      location: location || farmer.location
    });

    await product.save();
    await product.populate('farmer', 'mobileNumber location');

    res.status(201).json({ message: 'Product created successfully', product });
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({ message: 'Error creating product', error: error.message });
  }
});

// Delete/Remove direct product listing (farmer only)
router.delete('/product/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (product.farmer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }

    if (product.isFromPool) {
      return res.status(400).json({ message: 'Pool products cannot be deleted from direct sell' });
    }

    product.status = 'removed';
    await product.save();

    res.json({ message: 'Product removed successfully', product });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
});

// Accept/Reject buy request
router.put('/buy-request/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.to.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to respond to this request' });
    }

    if (request.type !== 'buy') {
      return res.status(400).json({ message: 'This is not a buy request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    if (action === 'accept') {
      request.status = 'completed'; // Set status to completed (0 equivalent)
      // Mark product as sold
      if (request.productId) {
        const product = await Product.findById(request.productId);
        if (product) {
          product.status = 'sold';
          await product.save();

          // If product is from a pool, mark pool as sold
          if (product.isFromPool && product.poolId) {
            // Pool creator accepted buyer request: mark pool as completed for all farmers in pool.
            await Pool.findByIdAndUpdate(product.poolId, { isSold: true, status: 'completed' });
          }
        }
      }

      // Only the clicked request should be updated.
    } else if (action === 'reject') {
      request.status = 'rejected';
    } else {
      return res.status(400).json({ message: 'Invalid action. Use "accept" or "reject"' });
    }

    request.respondedAt = new Date();
    await request.save();

    // Populate buyer details for response
    await request.populate('from', 'mobileNumber location address city state pincode');

    res.json({ message: `Buy request ${action}ed successfully`, request });
  } catch (error) {
    console.error('Buy request response error:', error);
    res.status(500).json({ message: 'Error processing buy request', error: error.message });
  }
});

// Get nearby pools for discovery
router.get('/nearby-pools', authenticateToken, async (req, res) => {
  try {
    const { maxDistance = 50 } = req.query;

    const farmer = await Farmer.findById(req.user.id);
    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found' });
    }

    const lat = farmer.location.latitude;
    const lon = farmer.location.longitude;

    // Get all active pools (excluding those created by this farmer)
    // Only show pools with remaining quantity > 0 (target not completed)
    const allPools = await Pool.find({
      status: 'active',
      creatorFarmer: { $ne: req.user.id },
      remainingQuantity: { $gt: 0 } // Only show pools where target is not completed
    })
      .populate('creatorFarmer', 'name mobileNumber location kisanId')
      .populate('members.farmer', 'name mobileNumber location kisanId');

    // Calculate distance and filter
    const poolsWithDistance = allPools
      .map(pool => {
        const distance = calculateDistance(
          lat, lon,
          pool.location.latitude, pool.location.longitude
        );
        return { ...pool.toObject(), distance };
      })
      .filter(pool => pool.distance <= parseFloat(maxDistance))
      .sort((a, b) => a.distance - b.distance);

    res.json({ pools: poolsWithDistance });
  } catch (error) {
    console.error('Nearby pools error:', error);
    res.status(500).json({ message: 'Error fetching nearby pools', error: error.message });
  }
});

// Contribute to a pool
router.post('/pool/:poolId/contribute', authenticateToken, async (req, res) => {
  try {
    const { poolId } = req.params;
    const { quantity } = req.body;

    if (!quantity || parseFloat(quantity) <= 0) {
      return res.status(400).json({ message: 'Valid quantity is required' });
    }

    const pool = await Pool.findById(poolId);
    if (!pool) {
      return res.status(404).json({ message: 'Pool not found' });
    }

    if (pool.status === 'locked') {
      return res.status(400).json({ message: 'Cannot contribute to a locked pool' });
    }

    const contributionQty = parseFloat(quantity);
    if (contributionQty > pool.remainingQuantity) {
      return res.status(400).json({ message: `Contribution cannot exceed remaining quantity (${pool.remainingQuantity} kg)` });
    }

    // Check if already a member
    const existingMember = pool.members.find(
      m => m.farmer.toString() === req.user.id
    );

    if (existingMember && existingMember.status === 'accepted') {
      return res.status(400).json({ message: 'You are already a member of this pool' });
    }

    // Add or update member
    if (existingMember) {
      existingMember.status = 'accepted';
      existingMember.quantity = (existingMember.quantity || 0) + contributionQty;
    } else {
      pool.members.push({
        farmer: req.user.id,
        status: 'accepted',
        quantity: contributionQty
      });
    }

    // Update remaining quantity
    pool.remainingQuantity = Math.max(0, pool.remainingQuantity - contributionQty);

    await pool.save();
    await pool.populate('members.farmer', 'name mobileNumber location kisanId');
    await pool.populate('creatorFarmer', 'name mobileNumber location kisanId');

    res.json({ message: 'Contribution successful', pool });
  } catch (error) {
    console.error('Contribution error:', error);
    res.status(500).json({ message: 'Error contributing to pool', error: error.message });
  }
});

// Exit a pool
router.post('/pool/:poolId/exit', authenticateToken, async (req, res) => {
  try {
    const { poolId } = req.params;

    const pool = await Pool.findById(poolId);
    if (!pool) {
      return res.status(404).json({ message: 'Pool not found' });
    }

    if (pool.status === 'locked') {
      return res.status(400).json({ message: 'Cannot exit a locked pool' });
    }

    if (pool.creatorFarmer.toString() === req.user.id) {
      return res.status(400).json({ message: 'Pool creator cannot exit. Delete the pool instead.' });
    }

    const member = pool.members.find(
      m => m.farmer.toString() === req.user.id && m.status === 'accepted'
    );

    if (!member) {
      return res.status(400).json({ message: 'You are not a member of this pool' });
    }

    // Return the quantity to remaining quantity
    pool.remainingQuantity += (member.quantity || 0);

    // Remove member
    pool.members = pool.members.filter(
      m => m.farmer.toString() !== req.user.id
    );

    await pool.save();

    res.json({ message: 'Successfully exited the pool', pool });
  } catch (error) {
    console.error('Exit pool error:', error);
    res.status(500).json({ message: 'Error exiting pool', error: error.message });
  }
});

// Remove member from pool (creator only)
router.delete('/pool/:poolId/member/:memberId', authenticateToken, async (req, res) => {
  try {
    const { poolId, memberId } = req.params;

    const pool = await Pool.findById(poolId);
    if (!pool) {
      return res.status(404).json({ message: 'Pool not found' });
    }

    if (pool.creatorFarmer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only pool creator can remove members' });
    }

    if (pool.status === 'locked') {
      return res.status(400).json({ message: 'Cannot remove members from a locked pool' });
    }

    const member = pool.members.find(
      m => m.farmer.toString() === memberId && m.status === 'accepted'
    );

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Prevent pool creator from removing themselves
    if (memberId === req.user.id || member.farmer.toString() === req.user.id) {
      return res.status(400).json({ message: 'Pool creator cannot remove themselves from the pool. Delete the pool instead if you want to leave.' });
    }

    // Return the quantity to remaining quantity
    // This ensures the pool becomes available again for other farmers if target is not completed
    pool.remainingQuantity += (member.quantity || 0);

    // Remove member
    pool.members = pool.members.filter(
      m => m.farmer.toString() !== memberId
    );

    await pool.save();
    await pool.populate('members.farmer', 'name mobileNumber location kisanId');
    await pool.populate('creatorFarmer', 'name mobileNumber location kisanId');

    res.json({ 
      message: 'Member removed successfully. Pool is now available for other farmers if target is not completed.', 
      pool 
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Error removing member', error: error.message });
  }
});

// Update profile/address
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { location } = req.body;

    const farmer = await Farmer.findById(req.user.id);
    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found' });
    }

    if (location) {
      farmer.location = { ...farmer.location, ...location };
    }

    await farmer.save();

    res.json({ message: 'Profile updated successfully', farmer });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});

// Helper function to calculate distance between two coordinates (Haversine formula)
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

