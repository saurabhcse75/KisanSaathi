import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const CreatePool = ({ onSuccess }) => {
  const [cropType, setCropType] = useState('');
  const [rate, setRate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [initialContribution, setInitialContribution] = useState('');
  const [nearbyFarmers, setNearbyFarmers] = useState([]);
  const [createdPools, setCreatedPools] = useState([]);
  const [selectedPoolId, setSelectedPoolId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user, API_URL } = useAuth();

  useEffect(() => {
    fetchNearbyFarmers();
    fetchMyPools();
  }, []);

  const fetchMyPools = async () => {
    try {
      const response = await axios.get(`${API_URL}/farmer/dashboard`);
      const pools = response.data.pools || [];
      setCreatedPools(pools.filter(p => p.status === 'active'));
      if (pools.length > 0 && !selectedPoolId) {
        setSelectedPoolId(pools[0]._id);
      }
    } catch (err) {
      console.error('Error fetching pools:', err);
    }
  };

  const fetchNearbyFarmers = async () => {
    try {
      const response = await axios.get(`${API_URL}/farmer/nearby-farmers`);
      setNearbyFarmers(response.data.nearbyFarmers || []);
    } catch (err) {
      console.error('Error fetching nearby farmers:', err);
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
        initialContribution: initialQty
      });

      setSuccess('Pool created successfully!');
      setCropType('');
      setRate('');
      setQuantity('');
      setInitialContribution('');
      setSelectedPoolId(response.data.pool._id);
      fetchMyPools();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create pool');
    } finally {
      setLoading(false);
    }
  };

  const sendPoolRequest = async (farmerId) => {
    if (!selectedPoolId) {
      alert('Please create a pool first or select an existing pool');
      return;
    }
    try {
      await axios.post(`${API_URL}/farmer/pool/request`, {
        poolId: selectedPoolId,
        toFarmerId: farmerId
      });
      alert('Pool request sent successfully!');
      fetchNearbyFarmers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send request');
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
                className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
                min="0"
              />
            </div>
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

      {/* Nearby Farmers */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Nearby Farmers</h2>
        
        {createdPools.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Pool to Send Request From:
            </label>
            <select
              value={selectedPoolId}
              onChange={(e) => setSelectedPoolId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              {createdPools.map((pool) => (
                <option key={pool._id} value={pool._id}>
                  Pool #{pool._id.slice(-6)} - {pool.cropTypes.map(c => c.type).join(', ')}
                </option>
              ))}
            </select>
          </div>
        )}

        {nearbyFarmers.length > 0 ? (
          <div className="space-y-4">
            {nearbyFarmers.map((farmer) => (
              <div key={farmer._id} className="border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">Mobile: {farmer.mobileNumber}</p>
                    <p className="text-sm text-gray-600">
                      Distance: {farmer.distance?.toFixed(2)} km
                    </p>
                    {farmer.location?.address && (
                      <p className="text-sm text-gray-500">{farmer.location.address}</p>
                    )}
                  </div>
                  <button
                    onClick={() => sendPoolRequest(farmer._id)}
                    disabled={!selectedPoolId}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send Request
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No nearby farmers found.</p>
        )}
      </div>
    </div>
  );
};

export default CreatePool;

