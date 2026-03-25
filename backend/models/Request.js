const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['pool', 'buy'],
    required: true
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'fromModel'
  },
  fromModel: {
    type: String,
    required: true,
    enum: ['Farmer', 'Buyer']
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: true
  },
  poolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pool'
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', '0'],
    default: 'pending'
  },
  message: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  }
});

module.exports = mongoose.model('Request', requestSchema);

