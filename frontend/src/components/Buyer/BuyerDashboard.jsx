import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { FaSignOutAlt, FaSearch, FaFilter, FaUser } from 'react-icons/fa';

const BuyerDashboard = () => {
  const [products, setProducts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [buyerData, setBuyerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [filter, setFilter] = useState({
    cropType: '',
    showFilters: false
  });
  const { user, logout, API_URL } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const ongoingRequests = useMemo(() => {
    // "Ongoing" here = buyer requests that are not rejected yet.
    // In this app, successful buy acceptance uses status: "completed".
    return (requests || []).filter(
      (r) => r?.status === 'pending' || r?.status === 'accepted' || r?.status === 'completed'
    );
  }, [requests]);

  const requestedGroupKeys = useMemo(() => {
    // Matches the grouping logic inside poolGroups.
    const keys = new Set();
    ongoingRequests.forEach((r) => {
      const cropType = r?.productId?.cropType;
      if (!cropType) return;

      if (r?.poolId?._id) {
        keys.add(`${r.poolId._id}|${cropType}`);
      } else if (r?.productId?._id) {
        keys.add(`direct|${r.productId._id}`);
      }
    });
    return keys;
  }, [ongoingRequests]);

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
          offers: []
        });
      }

      const g = map.get(groupKey);
      g.offers.push(p);
      g.totalQuantity += Number(p.quantity || 0);
      g.price = p.price ?? g.price;

      // Keep nearest distance (for nicer UX).
      if (typeof p.distance === 'number') {
        if (g.distance === null) g.distance = p.distance;
        else g.distance = Math.min(g.distance, p.distance);
      }
    });

    return Array.from(map.values()).map((g) => {
      // Pick a single representative offer for "Buy Request" (keeps one request per card).
      const representative = g.offers.reduce((best, cur) => {
        const bestQty = Number(best.quantity || 0);
        const curQty = Number(cur.quantity || 0);
        return curQty > bestQty ? cur : best;
      }, g.offers[0]);

      return { ...g, representative };
    });
  }, [products]);

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
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send request');
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

      {/* Filters */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
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
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Ongoing Bar */}
        {ongoingRequests.length > 0 && (
          <div className="mb-6 bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-bold mb-3">Ongoing</h2>
            <div className="flex flex-wrap gap-3">
              {ongoingRequests.slice(0, 8).map((request) => (
                <div
                  key={request._id}
                  className="px-4 py-2 bg-primary-50 border border-primary-200 rounded-lg flex items-center gap-2"
                >
                  <p className="text-sm font-medium text-primary-800 whitespace-nowrap">
                    {request.poolId?._id ? `Pool #${String(request.poolId._id).slice(-6)}` : 'Direct Offer'} ·{' '}
                    {request.productId?.cropType || 'N/A'}
                  </p>
                  <p
                    className={`text-xs font-semibold ${
                      request.status === 'accepted' || request.status === 'completed'
                        ? 'text-green-700'
                        : 'text-yellow-700'
                    }`}
                  >
                    {request.status}
                  </p>
                </div>
              ))}
              {ongoingRequests.length > 8 && (
                <div className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600">
                  +{ongoingRequests.length - 8} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Profile Display */}
        {showProfile && buyerData && (
          <div className="mb-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Profile Details</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="text-lg font-semibold text-gray-800">{buyerData.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Mobile Number</p>
                <p className="text-lg font-semibold text-gray-800">{buyerData.mobileNumber || 'N/A'}</p>
              </div>
              {buyerData.location && (
                <>
                  {buyerData.location.address && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Address</p>
                      <p className="text-lg text-gray-800">{buyerData.location.address}</p>
                    </div>
                  )}
                  {buyerData.location.city && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">City</p>
                      <p className="text-lg text-gray-800">{buyerData.location.city}</p>
                    </div>
                  )}
                  {buyerData.location.state && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">State</p>
                      <p className="text-lg text-gray-800">{buyerData.location.state}</p>
                    </div>
                  )}
                  {buyerData.location.pincode && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Pincode</p>
                      <p className="text-lg text-gray-800">{buyerData.location.pincode}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Products */}
          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold mb-6">Available Pools </h2>
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
                          {typeof group.distance === 'number' && (
                            <p className="text-primary-600 font-medium">
                              📍 Distance: {group.distance.toFixed(2)} km away
                            </p>
                          )}
                        </div>
                        
                        {/* Farmer Details Card */}
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
                        
                        <p className="mt-2 text-xs text-gray-500">
                          Status: <span className={`font-medium ${
                            group.representative.status === 'available' ? 'text-green-600' : 'text-gray-600'
                          }`}>{group.representative.status}</span>
                        </p>
                      </div>
                      <div className="ml-4">
                        {group.representative.status === 'available' && (
                          <button
                            onClick={() => sendBuyRequest(group.representative._id)}
                            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                          >
                            Buy Request
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500">No products available. Try adjusting your filters.</p>
              </div>
            )}
          </div>

          {/* Requests */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Ongoing Requests</h2>
            {ongoingRequests.length > 0 ? (
              <div className="space-y-4">
                {ongoingRequests.map((request) => (
                  <div key={request._id} className="bg-white rounded-lg shadow p-4">
                    <h4 className="font-semibold mb-2">
                      {request.productId?.cropType || 'Product'}
                    </h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Farmer: {request.to?.mobileNumber}
                    </p>
                    {request.poolId?._id && (
                      <p className="text-xs text-gray-500 mb-2">
                        Pool: #{String(request.poolId._id).slice(-6)}
                      </p>
                    )}
                    <p className="text-sm">
                      Status: <span className={`font-medium ${
                        request.status === 'accepted' || request.status === 'completed' ? 'text-green-600' :
                        request.status === 'rejected' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>{request.status}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-500">No requests yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default BuyerDashboard;

