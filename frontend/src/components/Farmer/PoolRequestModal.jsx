import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';

const PoolRequestModal = ({ request, onClose, onAccept, onReject }) => {
  const [quantity, setQuantity] = useState('');

  const handleAccept = () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      alert('Please enter a valid quantity');
      return;
    }
    onAccept(quantity);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Accept Pool Request</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FaTimes />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            From: {request.from?.mobileNumber}
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Pool: {request.poolId?.cropTypes?.map(c => c.type).join(', ') || 'N/A'}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quantity to Contribute <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Enter quantity"
            required
          />
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleAccept}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
          >
            Accept
          </button>
          <button
            onClick={onReject}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
          >
            Reject
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PoolRequestModal;

