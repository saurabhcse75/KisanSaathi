import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaSignOutAlt, FaSearch, FaFilter, FaUser, FaMapMarkerAlt } from 'react-icons/fa';
import { getCurrentLocation } from '../../utils/location';
import { useAuth } from '../../context/AuthContext';

const BuyerDashboardV2 = () => {
  const [products, setProducts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [buyerData, setBuyerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'ongoing' | 'completed'
  const [filter, setFilter] = useState({
    cropType: '',
    showFilters: false
  });

  const { user, logout, API_URL } = useAuth();
  const navigate = useNavigate();

  // Profile panel state
  const [showProfile, setShowProfile] = useState(false);
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileForm, setProfileForm] = useState({
    latitude: 0,
    longitude: 0,
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    // Prefill profile form once buyer data is loaded.
    if (!buyerData?.location) return;
    setProfileForm({
      latitude: buyerData.location.latitude ?? 0,
      longitude: buyerData.location.longitude ?? 0,
      address: buyerData.location.address ?? '',
      city: buyerData.location.city ?? '',
      state: buyerData.location.state ?? '',
      pincode: buyerData.location.pincode ?? ''
    });
  }, [buyerData]);

  const ongoingRequests = useMemo(() => {
    // Ongoing = pending/accepted (successful transactions move to completed).
    return (requests || []).filter(
      (r) => r?.status === 'pending' || r?.status === 'accepted'
    );
  }, [requests]);

  const completedRequests = useMemo(() => {
    // Last 10 completed transactions
    return (requests || [])
      .filter((r) => r?.status === 'completed')
      .slice(0, 10);
  }, [requests]);

  const poolGroups = useMemo(() => {
    // Group repeated entries from the same pool (different farmers) into one card.
    // Key strategy: poolId + cropType (direct products don't have poolId).
    const map = new Map();

    products.forEach((p) => {
      const hasPool = Boolean(p.poolId);
      const groupKey = hasPool ? `${p.poolId}|${p.cropType}` : `direct|${p._id}`;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupKey,
          poolId: hasPool ? p.poolId : null,
          cropType: p.cropType || '',
          unit: p.unit || 'kg',
          price: p.price || 0,
          distance: p.distance ?? null,
          totalQuantity: 0,
          totalValue: 0,
          offers: []
        });
      }

      const g = map.get(groupKey);
      g.offers.push(p);
      g.totalQuantity += Number(p.quantity || 0);
      g.price = p.price ?? g.price;
      g.totalValue += Number(p.price || 0) * Number(p.quantity || 0);

      // Keep nearest distance (for nicer UX).
      if (typeof p.distance === 'number') {
        if (g.distance === null) g.distance = p.distance;
        else g.distance = Math.min(g.distance, p.distance);
      }
    });

    return Array.from(map.values()).map((g) => {
      // Pick a single representative offer for "Buy Request"
      const representative = g.offers.reduce((best, cur) => {
        const bestQty = Number(best.quantity || 0);
        const curQty = Number(cur.quantity || 0);
        return curQty > bestQty ? cur : best;
      }, g.offers[0]);

      return { ...g, representative };
    });
  }, [products]);

  const requestedGroupKeys = useMemo(() => {
    // Matches poolGroups grouping logic.
    const keys = new Set();
    ongoingRequests.forEach((r) => {
      const cropType = r?.productId?.cropType;
      if (!cropType) return;

      if (r?.poolId?._id) keys.add(`${r.poolId._id}|${cropType}`);
      else if (r?.productId?._id) keys.add(`direct|${r.productId._id}`);
    });
    return keys;
  }, [ongoingRequests]);

  const visiblePoolGroups = useMemo(() => {
    // Remove cards that already have an ongoing request from the main dashboard.
    return poolGroups.filter((g) => !requestedGroupKeys.has(g.groupKey));
  }, [poolGroups, requestedGroupKeys]);

  const fetchDashboardData = async () => {
    try {
      const [dashboardRes, productsRes] = await Promise.all([
        axios.get(`${API_URL}/buyer/dashboard`),
        axios.get(`${API_URL}/buyer/products`)
      ]);
      setProducts(productsRes.data.products || []);
      setRequests(dashboardRes.data.requests || []);
      setBuyerData(dashboardRes.data.buyer);
      setError('');
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleFilter = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.cropType) params.append('cropType', filter.cropType);

      const response = await axios.get(`${API_URL}/buyer/products?${params.toString()}`);
      setProducts(response.data.products || []);
    } catch (err) {
      console.error('Filter error:', err);
    }
  };

  const sendBuyRequest = async (productId) => {
    try {
      await axios.post(`${API_URL}/buyer/request`, {
        productId,
        message: 'Interested in buying this product'
      });
      alert('Buy request sent successfully!');
      setActiveTab('ongoing');
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send request');
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
    setProfileError('');
    setProfileSuccess('');
  };

  const handleGetCurrentLocation = async () => {
    setProfileError('');
    setProfileSuccess('');
    try {
      const loc = await getCurrentLocation();
      setProfileForm((prev) => ({
        ...prev,
        latitude: loc.latitude,
        longitude: loc.longitude
      }));
    } catch (err) {
      setProfileError(err?.message || 'Failed to fetch current location');
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileUpdating(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      await axios.put(`${API_URL}/buyer/profile`, {
        location: {
          latitude: parseFloat(profileForm.latitude) || 0,
          longitude: parseFloat(profileForm.longitude) || 0,
          address: profileForm.address || '',
          city: profileForm.city || '',
          state: profileForm.state || '',
          pincode: profileForm.pincode || ''
        }
      });
      setProfileSuccess('Profile updated successfully!');
      fetchDashboardData();
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary-700">🌾 Kisan Saathi</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center gap-2 px-4 py-2 text-primary-700 hover:text-primary-800"
              >
                <FaUser /> {buyerData?.name || user?.mobileNumber}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700"
              >
                <FaSignOutAlt /> Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Panel */}
      {showProfile && buyerData && (
        <div className="container mx-auto px-4 pt-6 pb-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Buyer Profile</h2>

            <div className="space-y-2 mb-6">
              <p className="text-sm text-gray-500">Name</p>
              <p className="text-lg font-semibold text-gray-800">{buyerData.name || 'N/A'}</p>
              <p className="text-sm text-gray-500">Mobile Number</p>
              <p className="text-lg font-semibold text-gray-800">{buyerData.mobileNumber || 'N/A'}</p>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-6">
              {profileError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{profileError}</p>
                </div>
              )}
              {profileSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">{profileSuccess}</p>
                </div>
              )}

              <div className="flex gap-3 items-center">
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={profileUpdating}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  <FaMapMarkerAlt className="inline mr-2" />
                  Get Current Location
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
                  <input
                    name="latitude"
                    type="number"
                    step="0.0001"
                    value={profileForm.latitude}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
                  <input
                    name="longitude"
                    type="number"
                    step="0.0001"
                    value={profileForm.longitude}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  name="address"
                  rows="3"
                  value={profileForm.address}
                  onChange={handleProfileChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="House/Street, Locality"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    name="city"
                    type="text"
                    value={profileForm.city}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    name="state"
                    type="text"
                    value={profileForm.state}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="State"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                <input
                  name="pincode"
                  type="text"
                  maxLength={6}
                  value={profileForm.pincode}
                  onChange={handleProfileChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="6-digit pincode"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={profileUpdating}
                  className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
                >
                  {profileUpdating ? 'Updating...' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white border-b mt-4">
        <div className="container mx-auto px-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('available')}
              className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                activeTab === 'available'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Available Pools
            </button>
            <button
              onClick={() => setActiveTab('ongoing')}
              className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                activeTab === 'ongoing'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Ongoing
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                activeTab === 'completed'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Last 10 Completed
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {activeTab === 'available' && (
          <>
            {/* Filters */}
            <div className="bg-white border rounded-lg shadow p-4 mb-6">
              <div className="flex gap-4 items-center">
                <button
                  onClick={() => setFilter({ ...filter, showFilters: !filter.showFilters })}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  <FaFilter /> Filters
                </button>
                {filter.showFilters && (
                  <div className="flex gap-4 flex-1">
                    <input
                      type="text"
                      placeholder="Filter by crop type..."
                      value={filter.cropType}
                      onChange={(e) => setFilter({ ...filter, cropType: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={handleFilter}
                      className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      <FaSearch />
                    </button>
                    <button
                      onClick={() => {
                        setFilter({ cropType: '', showFilters: false });
                        fetchDashboardData();
                      }}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-6">Available Pools</h2>

            {visiblePoolGroups.length > 0 ? (
              <div className="space-y-4">
                {visiblePoolGroups.map((group) => (
                  <div key={group.groupKey} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                          {group.poolId ? `Pool #${String(group.poolId).slice(-6)}` : 'Direct Offer'} · {group.cropType}
                        </h3>
                        <div className="space-y-1 text-sm text-gray-600 mb-3">
                          <p>
                            <span className="font-medium">Total Quantity:</span> {group.totalQuantity} {group.unit}
                          </p>
                          <p>
                            <span className="font-medium">Price:</span> ₹{group.price} per {group.unit}
                          </p>
                        <p className="text-gray-800">
                          <span className="font-medium">Accumulated Price:</span> ₹{group.totalValue.toFixed(2)}
                        </p>
                          {typeof group.distance === 'number' && (
                            <p className="text-primary-600 font-medium">
                              📍 Distance: {group.distance.toFixed(2)} km away
                            </p>
                          )}
                        </div>

                        <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="font-medium text-gray-700 mb-2">
                            {group.poolId ? `Farmers in Pool (${group.offers.length})` : 'Farmer Details'}
                          </p>
                          <div className="space-y-1 text-sm text-gray-600">
                            {group.offers.slice(0, 3).map((offer) => (
                              <div key={offer._id} className="flex justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate">
                                    <span className="font-medium">Name:</span> {offer.farmer?.name || 'N/A'}
                                  </p>
                                  <p className="truncate">
                                    <span className="font-medium">Mobile:</span> {offer.farmer?.mobileNumber || 'N/A'}
                                  </p>
                                </div>
                                <p className="whitespace-nowrap">
                                  {offer.quantity} {offer.unit}
                                </p>
                              </div>
                            ))}
                            {group.offers.length > 3 && (
                              <p className="text-xs text-gray-600">
                                +{group.offers.length - 3} more
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="ml-4">
                        <button
                          onClick={() => sendBuyRequest(group.representative._id)}
                          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          Buy Request
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500">No available pools/offers for your filters.</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'ongoing' && (
          <>
            <h2 className="text-2xl font-bold mb-6">Ongoing Requests</h2>
            {ongoingRequests.length > 0 ? (
              <div className="space-y-4">
                {ongoingRequests.map((request) => (
                  <div key={request._id} className="bg-white rounded-lg shadow p-4">
                    <h4 className="font-semibold mb-1">
                      {request.poolId?._id ? `Pool #${String(request.poolId._id).slice(-6)}` : 'Direct Offer'} ·{' '}
                      {request.productId?.cropType || 'Product'}
                    </h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Farmer: {request.to?.mobileNumber}
                    </p>

                    <div className="text-sm text-gray-700 space-y-1 mb-2">
                      <p>
                        Quantity: {request.productId?.quantity} {request.productId?.unit}
                      </p>
                      <p>
                        Price: ₹{request.productId?.price} per {request.productId?.unit}
                      </p>
                    </div>

                    <p className="text-sm">
                      Status:{' '}
                      <span className={`font-medium ${
                        request.status === 'accepted' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {request.status}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-500">No ongoing requests yet.</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'completed' && (
          <>
            <h2 className="text-2xl font-bold mb-6">Completed</h2>
            {completedRequests.length > 0 ? (
              <div className="space-y-4">
                {completedRequests.map((request) => (
                  <div key={request._id} className="bg-white rounded-lg shadow p-4">
                    <h4 className="font-semibold mb-1">
                      {request.poolId?._id ? `Pool #${String(request.poolId._id).slice(-6)}` : 'Direct Offer'} ·{' '}
                      {request.productId?.cropType || 'Product'}
                    </h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Farmer: {request.to?.mobileNumber}
                    </p>

                    <div className="text-sm text-gray-700 space-y-1 mb-2">
                      <p>
                        Quantity: {request.productId?.quantity} {request.productId?.unit}
                      </p>
                      <p>
                        Price: ₹{request.productId?.price} per {request.productId?.unit}
                      </p>
                    </div>

                    <p className="text-sm">
                      Status:{' '}
                      <span className="font-medium text-green-600">
                        {request.status}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-500">No completed transactions yet.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default BuyerDashboardV2;

