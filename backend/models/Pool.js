const mongoose = require('mongoose');

const poolSchema = new mongoose.Schema({
  creatorFarmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: true
  },
  cropTypes: [{
    type: {
      type: String,
      required: true
    },
    rate: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      default: 0
    }
  }],
  targetQuantity: {
    type: Number,
    required: true,
    default: 0
  },
  initialContribution: {
    type: Number,
    default: 0
  },
  remainingQuantity: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'locked', 'completed', 'deleted'],
    default: 'active'
  },
  members: [{
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farmer'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    quantity: {
      type: Number,
      default: 0
    },
    requestedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isSold: {
    type: Boolean,
    default: false
  },
  location: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    address: String
  },
  expectedCompletionDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lockedAt: {
    type: Date
  }
});

module.exports = mongoose.model('Pool', poolSchema);

