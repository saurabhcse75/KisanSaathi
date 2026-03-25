import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { FaSearch, FaMapMarkerAlt, FaUsers, FaSignOutAlt } from 'react-icons/fa';

const PoolDiscovery = () => {
  const [nearbyPools, setNearbyPools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [distanceFilter, setDistanceFilter] = useState(50);
  const [selectedPool, setSelectedPool] = useState(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const { user, API_URL } = useAuth();

  useEffect(() => {
    fetchNearbyPools();
  }, [distanceFilter]);

  const fetchNearbyPools = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/farmer/nearby-pools?maxDistance=${distanceFilter}`);
      setNearbyPools(response.data.pools || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch nearby pools');
    } finally {
      setLoading(false);
    }
  };

  const handleContribute = async (poolId) => {
    if (!contributionAmount || parseFloat(contributionAmount) <= 0) {
      setError('Please enter a valid contribution amount');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_URL}/farmer/pool/${poolId}/contribute`, {
        quantity: parseFloat(contributionAmount)
      });
      setSuccess('Contribution successful!');
      setContributionAmount('');
      setSelectedPool(null);
      fetchNearbyPools();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to contribute');
    } finally {
      setLoading(false);
    }
  };

  const handleExitPool = async (poolId) => {
    if (!window.confirm('Are you sure you want to leave this pool?')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_URL}/farmer/pool/${poolId}/exit`);
      setSuccess('Successfully left the pool');
      fetchNearbyPools();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to exit pool');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Discover Nearby Pools</h2>

        <div className="flex flex-col md:flex-row gap-3 md:items-center mb-4">
          <label className="text-sm font-medium text-gray-700">
            Filter by Distance (KM):
          </label>
          <input
            type="number"
            value={distanceFilter}
            onChange={(e) => setDistanceFilter(e.target.value)}
            className="w-full md:w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            min="1"
            max="200"
          />
          <button
            onClick={fetchNearbyPools}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <FaSearch /> Search
          </button>
        </div>

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

        {loading && !nearbyPools.length ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : nearbyPools.length > 0 ? (
          <div className="space-y-4">
            {nearbyPools.map((pool) => {
              const isMember = pool.members?.some(
                m => m.farmer?._id === user.id && m.status === 'accepted'
              );
              const canContribute = !isMember && pool.status === 'active' && pool.remainingQuantity > 0;

              return (
                <div key={pool._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">Pool #{pool._id.slice(-6)}</h3>
                      
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Creator:</span> {pool.creatorFarmer?.name || pool.creatorFarmer?.mobileNumber || 'N/A'}
                        </p>
                        <p>
                          <span className="font-medium">Target Quantity:</span> {pool.targetQuantity} kg
                        </p>
                        <p>
                          <span className="font-medium">Initial Contribution:</span> {pool.initialContribution} kg
                        </p>
                        <p>
                          <span className="font-medium">Remaining Quantity:</span> {pool.remainingQuantity} kg
                        </p>
                        {pool.distance && (
                          <p className="text-primary-600">
                            <FaMapMarkerAlt className="inline mr-1" />
                            Distance: {pool.distance.toFixed(2)} km
                          </p>
                        )}
                        <p>
                          <span className="font-medium">Status:</span>{' '}
                          <span className={`font-medium ${
                            pool.status === 'locked' ? 'text-green-600' :
                            pool.status === 'active' ? 'text-blue-600' : 'text-gray-600'
                          }`}>
                            {pool.status}
                          </span>
                        </p>
                      </div>

                      <div className="mt-3">
                        <p className="text-sm font-medium mb-2">Crops:</p>
                        <ul className="list-disc list-inside text-sm text-gray-600">
                          {pool.cropTypes.map((crop, idx) => (
                            <li key={idx}>{crop.type} - ₹{crop.rate}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-3">
                        <p className="text-sm font-medium mb-2">
                          <FaUsers className="inline mr-1" />
                          Members ({pool.members?.filter(m => m.status === 'accepted').length || 0}):
                        </p>
                        <div className="space-y-1 text-sm text-gray-600">
                          {pool.members?.filter(m => m.status === 'accepted').map((member, idx) => (
                            <div key={idx} className="pl-4">
                              {member.farmer?.name || member.farmer?.mobileNumber} - {member.quantity} kg
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 flex flex-col gap-2">
                      {canContribute && (
                        <>
                          <input
                            type="number"
                            placeholder="Contribution (kg)"
                            value={selectedPool === pool._id ? contributionAmount : ''}
                            onChange={(e) => {
                              setContributionAmount(e.target.value);
                              setSelectedPool(pool._id);
                            }}
                            max={pool.remainingQuantity}
                            min="1"
                            className="w-full max-w-[260px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          />
                          <button
                            onClick={() => handleContribute(pool._id)}
                            disabled={!contributionAmount || parseFloat(contributionAmount) <= 0 || parseFloat(contributionAmount) > pool.remainingQuantity}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Contribute
                          </button>
                        </>
                      )}
                      {isMember && pool.status === 'active' && (
                        <button
                          onClick={() => handleExitPool(pool._id)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                        >
                          <FaSignOutAlt /> Leave Pool
                        </button>
                      )}
                      {pool.status === 'locked' && (
                        <span className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-center">
                          Pool Locked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No nearby pools found. Try adjusting the distance filter.
          </div>
        )}
      </div>
    </div>
  );
};

export default PoolDiscovery;
