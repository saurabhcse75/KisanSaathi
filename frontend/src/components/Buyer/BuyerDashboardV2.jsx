import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaSignOutAlt, FaSearch, FaFilter, FaUser, FaMapMarkerAlt } from 'react-icons/fa';
import { getCurrentLocation } from '../../utils/location';
import { useAuth } from '../../context/AuthContext';

const StatusPill = ({ status }) => {
  const s = String(status || '').toLowerCase();
  const className =
    s === 'active' || s === 'available' || s === 'completed' || s === 'complete'
      ? 'bg-green-100 text-green-700'
      : s === 'pending' || s === 'requested by buyer'
        ? 'bg-orange-100 text-orange-700'
        : s === 'locked' || s === 'deleted' || s === 'sold'
          ? 'bg-red-100 text-red-700'
          : 'bg-gray-100 text-gray-700';
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
};

const BuyerDashboardV2 = () => {
  const [products, setProducts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [buyerData, setBuyerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectedGroupKeys, setRejectedGroupKeys] = useState(new Set());
  const [detailsGroup, setDetailsGroup] = useState(null);
  const [detailsContext, setDetailsContext] = useState('available'); // 'available' | 'ongoing' | 'completed'

  const [activeTab, setActiveTab] = useState('available'); // 'available' | 'ongoing' | 'completed'
  const [filter, setFilter] = useState({
    cropType: '',
    showFilters: false,
    radiusKm: 50
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
    // Ongoing = pending/accepted.
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

      const poolId = r?.poolId?._id || r?.poolId;
      if (poolId) keys.add(`${poolId}|${cropType}`);
      else if (r?.productId?._id) keys.add(`direct|${r.productId._id}`);
    });
    return keys;
  }, [ongoingRequests]);

  const visiblePoolGroups = useMemo(() => {
    // Remove cards that already have an ongoing request from the main dashboard.
    return poolGroups.filter((g) => !requestedGroupKeys.has(g.groupKey) && !rejectedGroupKeys.has(g.groupKey));
  }, [poolGroups, requestedGroupKeys, rejectedGroupKeys]);

  const fetchDashboardData = async () => {
    try {
      const [dashboardRes, productsRes] = await Promise.all([
        axios.get(`${API_URL}/buyer/dashboard`),
        axios.get(`${API_URL}/buyer/products?radius=${filter.radiusKm}`)
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
      if (filter.radiusKm) params.append('radius', String(filter.radiusKm));

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

  const handleRejectGroup = (group) => {
    setRejectedGroupKeys((prev) => {
      const next = new Set(prev);
      next.add(group.groupKey);
      return next;
    });
    setDetailsGroup(null);
    alert('Offer rejected and removed from dashboard.');
  };

  const removePendingRequest = async (requestId) => {
    try {
      await axios.delete(`${API_URL}/buyer/request/${requestId}`);
      alert('Request removed');
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove request');
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌾</span>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Kisan Saathi</h1>
                <p className="text-sm text-gray-500">Buyer Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-gray-800"
                title="Open profile"
              >
                <span className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold">
                  {(buyerData?.name || user?.mobileNumber || 'U').toString().trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="text-sm font-semibold">
                  {buyerData?.name || user?.mobileNumber}
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
              >
                <FaSignOutAlt /> Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      {showProfile && buyerData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[85vh]">
            <div className="px-5 py-4 bg-gradient-to-r from-primary-600 to-indigo-600 text-white flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Profile</h3>
                <p className="text-sm text-white/80 mt-1">Update your details</p>
              </div>
              <button
                onClick={() => setShowProfile(false)}
                className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white"
                type="button"
              >
                Close
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(85vh-72px)] bg-gray-50">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
                <p className="text-sm text-gray-500">Name</p>
                <p className="text-base font-semibold text-gray-900">{buyerData.name || 'N/A'}</p>
                <p className="text-sm text-gray-500 mt-3">Mobile Number</p>
                <p className="text-base font-semibold text-gray-900">{buyerData.mobileNumber || 'N/A'}</p>
              </div>

              <form onSubmit={handleProfileUpdate} className="space-y-5">
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
                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 disabled:opacity-50 font-semibold"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                    placeholder="6-digit pincode"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={profileUpdating}
                    className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-xl hover:bg-primary-700 transition-colors font-semibold disabled:opacity-50"
                  >
                    {profileUpdating ? 'Updating...' : 'Update Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b mt-4">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 py-3">
            <button
              onClick={() => setActiveTab('available')}
              className={`px-4 py-2 rounded-xl font-semibold transition-colors ${
                activeTab === 'available'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Available Pools
            </button>
            <button
              onClick={() => setActiveTab('ongoing')}
              className={`px-4 py-2 rounded-xl font-semibold transition-colors ${
                activeTab === 'ongoing'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Ongoing
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 rounded-xl font-semibold transition-colors ${
                activeTab === 'completed'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-6">
              <div className="flex gap-4 items-center">
                <button
                  onClick={() => setFilter({ ...filter, showFilters: !filter.showFilters })}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 font-semibold"
                >
                  <FaFilter /> Filters
                </button>
                {filter.showFilters && (
                  <div className="flex gap-4 flex-1">
                    <input
                      type="text"
                      placeholder="Search by crop name..."
                      value={filter.cropType}
                      onChange={(e) => setFilter({ ...filter, cropType: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      type="number"
                      placeholder="Search by distance (km)"
                      value={filter.radiusKm}
                      onChange={(e) => setFilter({ ...filter, radiusKm: parseFloat(e.target.value || '0') })}
                      className="w-full md:w-40 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500"
                      min="1"
                      max="200"
                    />
                    <button
                      onClick={handleFilter}
                      className="px-6 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-semibold"
                    >
                      <FaSearch />
                    </button>
                    <button
                      onClick={() => {
                        setFilter({ cropType: '', showFilters: false, radiusKm: 50 });
                        fetchDashboardData();
                      }}
                      className="px-6 py-2 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 font-semibold"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-6 text-gray-900">Available Pools</h2>

            {visiblePoolGroups.length > 0 ? (
              <div className="space-y-4">
                {visiblePoolGroups.map((group) => (
                  <div
                    key={group.groupKey}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{group.cropType}</h3>
                          <StatusPill status={group.poolId ? 'available' : (group.representative?.status || 'available')} />
                        </div>

                        <div className="space-y-1 text-sm text-gray-700">
                          <p>
                            <span className="font-medium">Quantity:</span> {group.totalQuantity} {group.unit}
                          </p>
                          <p>
                            <span className="font-medium">Total Price:</span> ₹{group.totalValue.toFixed(2)}
                          </p>
                          <p>
                            <span className="font-medium">Rate:</span> ₹{group.price} / {group.unit}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => {
                            setDetailsContext('available');
                            setDetailsGroup(group);
                          }}
                          className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 hover:-translate-y-[1px] transition-transform font-semibold"
                        >
                          See Details
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
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Ongoing Requests</h2>
            {ongoingRequests.length > 0 ? (
              <div className="space-y-4">
                {ongoingRequests.map((request) => (
                  <div
                    key={request._id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
                  >
                    {(() => {
                      const displayQuantity = Number(request.poolId?.targetQuantity ?? request.productId?.quantity ?? 0);
                      const displayUnit = request.productId?.unit || 'kg';
                      const ongoingStatus = request.status === 'pending' ? 'requested by buyer' : request.status;
                      const farmerName =
                        request.poolId?.creatorFarmer?.name ||
                        request.productId?.farmer?.name ||
                        request.to?.name ||
                        'N/A';
                      const farmerMobile =
                        request.poolId?.creatorFarmer?.mobileNumber ||
                        request.productId?.farmer?.mobileNumber ||
                        request.to?.mobileNumber ||
                        'N/A';
                      const farmerAddress =
                        request.poolId?.creatorFarmer?.location?.address ||
                        request.productId?.farmer?.location?.address ||
                        request.to?.location?.address ||
                        'N/A';
                      return (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 mb-1 truncate">
                      {request.productId?.cropType || 'Product'}
                        </h4>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-gray-600">Farmer Name:</span>{' '}
                          <span className="font-semibold text-gray-900">{farmerName}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-gray-600">Mobile Number:</span>{' '}
                          <span className="font-semibold text-gray-900">{farmerMobile}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-gray-600">Address:</span>{' '}
                          <span className="font-semibold text-gray-900">{farmerAddress}</span>
                        </p>
                        <div className="mt-3 text-sm text-gray-700 space-y-1">
                          <p>
                            <span className="font-medium text-gray-600">Quantity:</span>{' '}
                            <span className="font-semibold text-gray-900">{displayQuantity} {displayUnit}</span>
                          </p>
                          <p>
                            <span className="font-medium text-gray-600">Rate:</span>{' '}
                            <span className="font-semibold text-gray-900">₹{request.productId?.price} / {request.productId?.unit}</span>
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-600">Status:</span>
                          <StatusPill status={ongoingStatus} />
                          <span className="text-xs text-gray-500 ml-auto">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        onClick={() => {
                          // Reuse details modal shape with a synthetic group from this request
                          const cropType = request.productId?.cropType || '';
                          const poolId = request.poolId || null;
                          const unit = request.productId?.unit || 'kg';
                          const price = request.productId?.price || 0;
                          const quantity = Number(request.poolId?.targetQuantity ?? request.productId?.quantity ?? 0);
                          setDetailsContext('ongoing');
                          setDetailsGroup({
                            groupKey: poolId?._id ? `${poolId._id}|${cropType}` : `direct|${request.productId?._id}`,
                            poolId,
                            cropType,
                            unit,
                            price,
                            totalQuantity: Number(quantity || 0),
                            totalValue: Number(price || 0) * Number(quantity || 0),
                            representative: request.productId
                          });
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 hover:-translate-y-[1px] transition-transform font-semibold"
                      >
                        See Details
                      </button>

                      {request.status === 'pending' && (
                        <button
                          onClick={() => removePendingRequest(request._id)}
                          className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 hover:-translate-y-[1px] transition-transform font-semibold"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                <p className="text-gray-500">No ongoing requests yet.</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'completed' && (
          <>
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Completed</h2>
            {completedRequests.length > 0 ? (
              <div className="space-y-4">
                {completedRequests.map((request) => (
                  <div
                    key={request._id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
                  >
                    {(() => {
                      const displayQuantity = Number(request.poolId?.targetQuantity ?? request.productId?.quantity ?? 0);
                      const displayTotalPrice = Number(request.productId?.price || 0) * displayQuantity;
                      return (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 mb-2 truncate">
                          {request.productId?.cropType || 'Crop'}
                        </h4>
                        <div className="text-sm text-gray-700 space-y-1">
                          <p>
                            <span className="font-medium text-gray-600">Pool Creator:</span>{' '}
                            <span className="font-semibold text-gray-900">{request.poolId?.creatorFarmer?.name || 'N/A'}</span>
                          </p>
                          <p>
                            <span className="font-medium text-gray-600">Total Price:</span>{' '}
                            <span className="font-semibold text-gray-900">₹{displayTotalPrice}</span>
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-600">Status:</span>
                          <StatusPill status={request.status} />
                          <span className="text-xs text-gray-500 ml-auto">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                      <button
                        onClick={() => {
                          const cropType = request.productId?.cropType || '';
                          const poolId = request.poolId || null;
                          const unit = request.productId?.unit || 'kg';
                          const price = request.productId?.price || 0;
                          const quantity = Number(request.poolId?.targetQuantity ?? request.productId?.quantity ?? 0);
                          setDetailsContext('completed');
                          setDetailsGroup({
                            groupKey: poolId?._id ? `${poolId._id}|${cropType}` : `direct|${request.productId?._id}`,
                            poolId,
                            cropType,
                            unit,
                            price,
                            totalQuantity: Number(quantity || 0),
                            totalValue: Number(price || 0) * Number(quantity || 0),
                            representative: request.productId
                          });
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 hover:-translate-y-[1px] transition-transform font-semibold"
                      >
                        View Detail
                      </button>
                      </div>
                    </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                <p className="text-gray-500">No completed transactions yet.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Details Modal (Pool/direct offer) */}
      {detailsGroup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[85vh]">
            <div className="px-5 py-4 bg-gradient-to-r from-primary-600 to-indigo-600 text-white flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-xl font-bold truncate">
                  {detailsGroup.poolId ? `Pool · ${detailsGroup.cropType}` : `Direct Offer · ${detailsGroup.cropType}`}
                </h3>
                <p className="text-sm text-white/80 mt-1">
                  Quantity: {detailsGroup.totalQuantity} {detailsGroup.unit} • Total: ₹{detailsGroup.totalValue.toFixed(2)}
                </p>
                <p className="text-sm text-white/80 mt-1">
                  Rate: ₹{detailsGroup.price} / {detailsGroup.unit}
                </p>
              </div>
              <button
                onClick={() => setDetailsGroup(null)}
                className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white"
              >
                Close
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(85vh-72px)] bg-gray-50">

            {/* Pool details */}
            {detailsGroup.poolId ? (
              <div className="space-y-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="font-semibold">Pool Members</p>
                    <StatusPill status={detailsGroup.poolId?.status || 'active'} />
                  </div>

                  {(() => {
                    const pool = detailsGroup.poolId;
                    const accepted = (pool?.members || []).filter((m) => m.status === 'accepted');
                    const seen = new Set();
                    const unique = [];
                    accepted.forEach((m) => {
                      const fid = m?.farmer?._id || m?.farmer;
                      const key = fid
                        ? String(fid)
                        : (m?.farmer?.mobileNumber ? String(m.farmer.mobileNumber) : `unknown-${unique.length}`);
                      if (seen.has(key)) return;
                      seen.add(key);
                      unique.push(m);
                    });

                    return unique.length > 0 ? (
                      <div className="space-y-2">
                        {unique.map((m, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-4 bg-gray-50 border border-gray-100 rounded-xl p-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">
                                {m.farmer?.name || m.farmer?.mobileNumber || 'Farmer'}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                <span className="font-medium">Phone:</span> {m.farmer?.mobileNumber || 'N/A'}
                              </p>
                              {m.farmer?.location?.address && (
                                <p className="text-xs text-gray-600 truncate">
                                  <span className="font-medium">Address:</span> {m.farmer.location.address}
                                </p>
                              )}
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <p className="text-xs text-gray-600">Contribution</p>
                              <p className="font-bold text-gray-900">{m.quantity} kg</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">No members yet.</p>
                    );
                  })()}
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <p className="font-semibold mb-2">Pool Creator</p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium text-gray-600">Name:</span>{' '}
                    <span className="font-semibold text-gray-900">{detailsGroup.poolId?.creatorFarmer?.name || 'N/A'}</span>
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium text-gray-600">Phone:</span>{' '}
                    <span className="font-semibold text-gray-900">{detailsGroup.poolId?.creatorFarmer?.mobileNumber || 'N/A'}</span>
                  </p>
                  {detailsGroup.poolId?.creatorFarmer?.kisanId && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-gray-600">Kisan ID:</span>{' '}
                      <span className="font-semibold text-gray-900">{detailsGroup.poolId?.creatorFarmer?.kisanId}</span>
                    </p>
                  )}
                  {detailsGroup.poolId?.creatorFarmer?.location?.address && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-gray-600">Address:</span>{' '}
                      <span className="font-semibold text-gray-900">{detailsGroup.poolId?.creatorFarmer?.location?.address}</span>
                    </p>
                  )}
                  {detailsGroup.poolId?.expectedCompletionDate && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-gray-600">Expected Completion:</span>{' '}
                      <span className="font-semibold text-gray-900">{new Date(detailsGroup.poolId.expectedCompletionDate).toLocaleDateString()}</span>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <p className="font-semibold mb-2">Seller</p>
                  <p className="text-sm text-gray-700">
                    Crop Type: <span className="font-medium">{detailsGroup.cropType}</span>
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    Farmer Name: <span className="font-medium">{detailsGroup.representative?.farmer?.name || 'N/A'}</span>
                  </p>
                  <p className="text-sm text-gray-700">
                    Mobile Number: <span className="font-medium">{detailsGroup.representative?.farmer?.mobileNumber || 'N/A'}</span>
                  </p>
                  {detailsGroup.representative?.farmer?.kisanId && (
                    <p className="text-sm text-gray-700">
                      Kisan ID: <span className="font-medium">{detailsGroup.representative.farmer.kisanId}</span>
                    </p>
                  )}
                  {detailsGroup.representative?.farmer?.location?.address && (
                    <p className="text-sm text-gray-700">
                      Address: <span className="font-medium">{detailsGroup.representative.farmer.location.address}</span>
                    </p>
                  )}
                  {detailsGroup.representative?.farmer?.location?.city && (
                    <p className="text-sm text-gray-700">
                      City: <span className="font-medium">{detailsGroup.representative.farmer.location.city}</span>
                    </p>
                  )}
                  {detailsGroup.representative?.farmer?.location?.state && (
                    <p className="text-sm text-gray-700">
                      State: <span className="font-medium">{detailsGroup.representative.farmer.location.state}</span>
                    </p>
                  )}
                  {detailsGroup.representative?.farmer?.location?.pincode && (
                    <p className="text-sm text-gray-700">
                      Pincode: <span className="font-medium">{detailsGroup.representative.farmer.location.pincode}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {detailsContext === 'available' && (
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => {
                    // Buy => move to ongoing
                    const productId = detailsGroup.representative?._id;
                    if (!productId) return alert('Missing product id');
                    const currentGroupKey = detailsGroup.groupKey;
                    setDetailsGroup(null);
                    // Remove from Available Pools immediately after request.
                    setRejectedGroupKeys((prev) => {
                      const next = new Set(prev);
                      if (currentGroupKey) next.add(currentGroupKey);
                      return next;
                    });
                    sendBuyRequest(productId);
                  }}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 hover:-translate-y-[1px] transition-transform font-semibold"
                >
                  Buy Request
                </button>
                <button
                  onClick={() => handleRejectGroup(detailsGroup)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 hover:-translate-y-[1px] transition-transform font-semibold"
                >
                  Reject
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerDashboardV2;

