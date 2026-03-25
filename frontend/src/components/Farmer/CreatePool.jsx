import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const CreatePool = ({ onSuccess }) => {
  const [cropType, setCropType] = useState('');
  const [rate, setRate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [initialContribution, setInitialContribution] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [location, setLocation] = useState({
    address: '',
    city: '',
    state: '',
    pincode: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { API_URL } = useAuth();

  useEffect(() => {
    fetchMyLocation();
  }, []);

  const fetchMyLocation = async () => {
    try {
      const response = await axios.get(`${API_URL}/farmer/dashboard`);
      const farmer = response.data?.farmer;
      const loc = farmer?.location || {};
      setLocation({
        address: loc.address || '',
        city: loc.city || '',
        state: loc.state || '',
        pincode: loc.pincode || ''
      });
    } catch (err) {
      console.error('Error fetching location:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation (single crop type only)
    if (!cropType || !rate) {
      setError('Crop type and rate are required');
      return;
    }

    const targetQty = parseFloat(quantity);
    if (!targetQty || targetQty <= 0) {
      setError('Quantity is required and must be greater than 0');
      return;
    }

    const initialQty = parseFloat(initialContribution) || 0;
    if (initialQty < 0 || initialQty > targetQty) {
      setError('Initial contribution must be between 0 and pool quantity');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/farmer/pool/create`, {
        cropTypes: [
          {
            type: cropType,
            rate: parseFloat(rate),
            // Quantity for this crop will be taken from each farmer's member contribution on lock.
            quantity: 0
          }
        ],
        targetQuantity: targetQty,
        initialContribution: initialQty,
        location: {
          address: location.address || '',
          city: location.city || '',
          state: location.state || '',
          pincode: location.pincode || ''
        },
        expectedCompletionDate: expectedCompletionDate || undefined
      });

      setSuccess('Pool created successfully!');
      setCropType('');
      setRate('');
      setQuantity('');
      setInitialContribution('');
      setExpectedCompletionDate('');
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create pool');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-6">Create Pool</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity (kg) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              placeholder="e.g., 500"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Initial Contribution by You (kg)
            </label>
            <input
              type="number"
              placeholder="e.g., 100"
              value={initialContribution}
              onChange={(e) => setInitialContribution(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              min="0"
            />
            {quantity && (
              <p className="mt-1 text-sm text-gray-600">
                Remaining Quantity After Initial Contribution: {Math.max(
                  0,
                  parseFloat(quantity || '0') - (parseFloat(initialContribution || '0') || 0)
                )}{' '}
                kg
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Crop Type and Rate
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Crop Type (e.g., Wheat)"
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
              <input
                type="number"
                placeholder="Rate (₹)"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full sm:w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
            <textarea
              rows="3"
              value={location.address}
              onChange={(e) => setLocation((prev) => ({ ...prev, address: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="House/Street, Locality"
            />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <input
                type="text"
                value={location.city}
                onChange={(e) => setLocation((prev) => ({ ...prev, city: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="City"
              />
              <input
                type="text"
                value={location.pincode}
                onChange={(e) => setLocation((prev) => ({ ...prev, pincode: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Pincode"
              />
              <input
                type="text"
                value={location.state}
                onChange={(e) => setLocation((prev) => ({ ...prev, state: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 col-span-2"
                placeholder="State"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expected Completion Date
            </label>
            <input
              type="date"
              value={expectedCompletionDate}
              onChange={(e) => setExpectedCompletionDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? 'Creating Pool...' : 'Create Pool'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreatePool;

