import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import CreatePool from './CreatePool';
import DirectSell from './DirectSell';
import Profile from './Profile';
import { FaSignOutAlt, FaSeedling, FaUsers, FaPlus, FaShoppingCart, FaBell } from 'react-icons/fa';

const StatusPill = ({ status }) => {
  const s = String(status || '').toLowerCase();
  const className =
    s === 'active' || s === 'completed' ? 'bg-green-100 text-green-700' :
    s === 'locked' ? 'bg-red-100 text-red-700' :
    s === 'deleted' ? 'bg-red-100 text-red-700' :
    s === 'rejected' ? 'bg-red-100 text-red-700' :
    s === 'pending' ? 'bg-orange-100 text-orange-700' :
    'bg-gray-100 text-gray-700';
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
};

const displayPoolStatus = (pool) => {
  return pool?.status;
};

const FarmerDashboardV2 = () => {
  const { user, logout, API_URL } = useAuth();
  const navigate = useNavigate();

  const [activeNav, setActiveNav] = useState('overview'); // overview | my-pools | create-pool | direct-sell | requests
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState(null);

  const [nearbyPools, setNearbyPools] = useState([]);
  const [maxDistance, setMaxDistance] = useState(50);
  const [rejectedPoolIds, setRejectedPoolIds] = useState(new Set());

  const [myPoolsTab, setMyPoolsTab] = useState('joined'); // joined | created

  // Modals
  const [detailsPool, setDetailsPool] = useState(null);
  const [managePool, setManagePool] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedBuyRequest, setSelectedBuyRequest] = useState(null);

  const [poolContributionByPoolId, setPoolContributionByPoolId] = useState({});

  const pendingRequestCount = useMemo(() => {
    const buyPending = (dashboardData?.buyRequests || []).filter((r) => r.status === 'pending').length;
    return buyPending;
  }, [dashboardData]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/farmer/dashboard`);
      setDashboardData(response.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyPools = async () => {
    try {
      const response = await axios.get(`${API_URL}/farmer/nearby-pools?maxDistance=${maxDistance}`);
      setNearbyPools(response.data.pools || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchNearbyPools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Refresh nearby pools when distance changes
    if (activeNav === 'overview') fetchNearbyPools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDistance]);

  const isAlreadyJoined = (pool) => {
    const myId = String(user?.id);
    return pool.members?.some((m) => {
      const mid = String(m.farmer?._id || m.farmer || '');
      return mid === myId && m.status === 'accepted';
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleAcceptNearbyPool = async (poolId) => {
    const pool = nearbyPools.find((p) => p._id === poolId);
    if (!pool) return;

    if (isAlreadyJoined(pool)) {
      alert('You are already in this pool');
      return;
    }

    const qtyStr = poolContributionByPoolId[poolId];
    const qty = parseFloat(qtyStr || '');
    if (!qty || qty <= 0) {
      alert('Please enter a valid contribution quantity');
      return;
    }
    if (qty > pool.remainingQuantity) {
      alert(`Quantity cannot exceed remaining quantity (${pool.remainingQuantity} kg)`);
      return;
    }

    try {
      await axios.post(`${API_URL}/farmer/pool/${poolId}/contribute`, { quantity: qty });
      alert('Contribution successful!');
      setRejectedPoolIds((prev) => {
        const next = new Set(prev);
        next.add(poolId);
        return next;
      });
      setActiveNav('my-pools');
      setMyPoolsTab('joined');
      setPoolContributionByPoolId((prev) => {
        const next = { ...prev };
        delete next[poolId];
        return next;
      });
      await fetchDashboardData();
      await fetchNearbyPools();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to contribute');
    }
  };

  const handleRejectNearbyPool = async (poolId) => {
    // No backend "reject" exists for discovery cards; hide it in UI.
    setRejectedPoolIds((prev) => {
      const next = new Set(prev);
      next.add(poolId);
      return next;
    });
    try {
      await fetchNearbyPools();
    } catch {}
  };

  const last10CompletedTransactionsForPool = (poolId) => {
    const pool = String(poolId);
    const completed = (dashboardData?.buyRequests || [])
      .filter((r) => r.status === 'completed')
      .filter((r) => String(r.poolId?._id || r.poolId) === pool);
    return completed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
  };

  const handleRequestResponse = async (requestId, action, type = 'pool', quantity = null) => {
    try {
      const endpoint = type === 'pool'
        ? `${API_URL}/farmer/pool/request/${requestId}`
        : `${API_URL}/farmer/buy-request/${requestId}`;

      const payload = type === 'pool' && action === 'accept' && quantity
        ? { action, quantity: parseFloat(quantity) }
        : { action };

      await axios.put(endpoint, payload);
      if (type === 'pool' && action === 'accept') {
        // After accepting a pool request, show in My Pools.
        setActiveNav('my-pools');
        setMyPoolsTab('joined');
      }
      await fetchDashboardData();
      await fetchNearbyPools();
      // Notify other modules (e.g., DirectSell) to refresh.
      try {
        window.dispatchEvent(new Event('farmer-dashboard-updated'));
      } catch {}
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process request');
    }
  };

  const handleLockPool = async (poolId) => {
    try {
      await axios.put(`${API_URL}/farmer/pool/${poolId}/lock`);
      alert('Pool locked successfully');
      setManagePool(null);
      await fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lock failed');
    }
  };

  const handleRemovePool = async (poolId) => {
    if (!window.confirm('Are you sure you want to remove/delete this pool?')) return;
    try {
      await axios.delete(`${API_URL}/farmer/pool/${poolId}`);
      alert('Pool removed');
      setManagePool(null);
      await fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || 'Remove failed');
    }
  };

  const handleEditPool = async (poolId) => {
    const pool = dashboardData?.pools?.find((p) => p._id === poolId) || dashboardData?.pools?.find((p) => p._id === poolId);
    const currentRate = pool?.cropTypes?.[0]?.rate;
    const currentQty = pool?.targetQuantity;

    const qtyStr = window.prompt('Edit total quantity (kg):', currentQty);
    const rateStr = window.prompt('Edit rate (₹):', currentRate);
    const newQty = parseFloat(qtyStr);
    const newRate = parseFloat(rateStr);
    if (!newQty || !newRate) {
      alert('Invalid values');
      return;
    }

    try {
      await axios.put(`${API_URL}/farmer/pool/${poolId}/edit`, {
        targetQuantity: newQty,
        cropRate: newRate
      });
      alert('Pool updated');
      setManagePool(null);
      await fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || 'Edit failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const poolsJoined = dashboardData?.memberPools || [];
  const poolsCreated = dashboardData?.pools || [];

  // Completed transactions blocks removed per requirement.

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaSeedling className="text-primary-600 text-2xl" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Kisan Saathi</h1>
              <p className="text-sm text-gray-500">Farmer Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
              title="Open profile"
            >
              <span className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold">
                {(dashboardData?.farmer?.name || user?.mobileNumber || 'U').toString().trim().slice(0, 1).toUpperCase()}
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {dashboardData?.farmer?.name || user?.mobileNumber}
              </span>
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
            >
              <span className="flex items-center gap-2">
                <FaSignOutAlt /> Logout
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 grid md:grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="md:col-span-3 lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
            <NavItem
              active={activeNav === 'overview'}
              onClick={() => setActiveNav('overview')}
              title="Overview"
              icon={<FaUsers />}
            />
            <NavItem
              active={activeNav === 'my-pools'}
              onClick={() => setActiveNav('my-pools')}
              title="My Pools"
              icon={<FaSeedling />}
            />
            <NavItem
              active={activeNav === 'create-pool'}
              onClick={() => setActiveNav('create-pool')}
              title="Create Pools"
              icon={<FaPlus />}
            />
            <NavItem
              active={activeNav === 'direct-sell'}
              onClick={() => setActiveNav('direct-sell')}
              title="Direct Sell"
              icon={<FaShoppingCart />}
            />
            <NavItem
              active={activeNav === 'requests'}
              onClick={() => setActiveNav('requests')}
              title="Requests"
              icon={<FaBell />}
              badge={pendingRequestCount > 0 ? pendingRequestCount : null}
            />
          </div>
        </aside>

        {/* Main */}
        <main className="md:col-span-9 lg:col-span-10">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {activeNav === 'overview' && (
            <div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Nearby Pools</h2>
                    <p className="text-sm text-gray-500 mt-1">Accept or reject to join. If you accept, you must contribute.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                    <label className="text-sm font-medium text-gray-600">Distance (km)</label>
                    <input
                      type="number"
                      value={maxDistance}
                      onChange={(e) => setMaxDistance(parseFloat(e.target.value || '0'))}
                      className="w-full sm:w-24 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500"
                      min="1"
                      max="200"
                    />
                    <button
                      onClick={fetchNearbyPools}
                      className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-semibold"
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {nearbyPools
                  .filter((p) => !rejectedPoolIds.has(p._id))
                  .filter((p) => !isAlreadyJoined(p))
                  .map((pool) => {
                    const crop = pool.cropTypes?.[0] || {};
                    const creatorName = pool.creatorFarmer?.name || 'N/A';
                    const creatorMobile = pool.creatorFarmer?.mobileNumber || 'N/A';
                    return (
                      <div key={pool._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-5">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-lg font-bold text-gray-900">
                                {crop.type || 'Crop'}
                              </h3>
                              <StatusPill status={pool.status} />
                            </div>

                            <div className="mt-3 text-sm text-gray-700 space-y-1.5">
                              <p><span className="font-medium text-gray-600">Farmer Name:</span> <span className="font-semibold text-gray-900">{creatorName}</span></p>
                              <p><span className="font-medium text-gray-600">Mobile Number:</span> <span className="font-semibold text-gray-900">{creatorMobile}</span></p>
                              <p><span className="font-medium text-gray-600">Required Quantity:</span> <span className="font-semibold text-gray-900">{pool.targetQuantity} kg</span></p>
                              <p><span className="font-medium text-gray-600">Price:</span> <span className="font-semibold text-gray-900">₹{crop.rate} / kg</span></p>
                              {typeof pool.distance === 'number' && (
                                <p><span className="font-medium text-gray-600">Distance:</span> <span className="font-semibold text-gray-900">{pool.distance.toFixed(2)} km</span></p>
                              )}
                              <p>
                                <span className="font-medium text-gray-600">Location:</span>{' '}
                                <span className="font-semibold text-gray-900">{pool.location?.address || 'N/A'}</span>
                              </p>
                              <p className="text-gray-600"><span className="font-medium text-gray-600">Remaining:</span> <span className="font-semibold text-gray-900">{pool.remainingQuantity} kg</span></p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 lg:min-w-[220px]">
                            <input
                              type="number"
                              inputMode="decimal"
                              placeholder="Contribution (kg)"
                              value={poolContributionByPoolId[pool._id] ?? ''}
                              onChange={(e) =>
                                setPoolContributionByPoolId((prev) => ({
                                  ...prev,
                                  [pool._id]: e.target.value
                                }))
                              }
                              max={pool.remainingQuantity}
                              min="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500"
                            />
                            <button
                              onClick={() => setDetailsPool(pool)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => handleAcceptNearbyPool(pool._id)}
                              className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold"
                            >
                              ✅ Accept
                            </button>
                            <button
                              onClick={() => handleRejectNearbyPool(pool._id)}
                              className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold"
                            >
                              ❌ Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {nearbyPools.length === 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
                    No nearby pools found.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeNav === 'my-pools' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow p-4 flex gap-3 flex-wrap">
                <button
                  onClick={() => setMyPoolsTab('joined')}
                  className={`px-4 py-2 rounded-lg ${myPoolsTab === 'joined' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Pools I am in
                </button>
                <button
                  onClick={() => setMyPoolsTab('created')}
                  className={`px-4 py-2 rounded-lg ${myPoolsTab === 'created' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Pools I created
                </button>
              </div>

              {myPoolsTab === 'joined' && (
                <div className="space-y-4">
                  {poolsJoined.length > 0 ? poolsJoined.map((pool) => {
                    const crop = pool.cropTypes?.[0] || {};
                    const myMember = pool.members?.find((m) => String(m.farmer?._id || m.farmer) === String(user.id));
                    const myQty = myMember?.quantity || 0;
                    const displayStatus = displayPoolStatus(pool);
                    return (
                      <div
                        key={pool._id}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900">{crop.type || 'Crop'}</h3>
                            <div className="mt-3 text-sm text-gray-700 space-y-1">
                              <p className="flex items-center gap-2">
                                <span className="font-medium text-gray-600">My Contributed Quantity:</span>
                                <span className="font-semibold text-gray-900">{myQty} kg</span>
                              </p>
                              {String(displayStatus).toLowerCase() !== 'completed' && (
                                <p className="flex items-center gap-2">
                                  <span className="font-medium text-gray-600">Remaining Quantity:</span>
                                  <span className="font-semibold text-gray-900">{pool.remainingQuantity} kg</span>
                                </p>
                              )}
                              <p className="flex items-center gap-2">
                                <span className="font-medium text-gray-600">Price:</span>
                                <span className="font-semibold text-gray-900">₹{crop.rate}</span>
                              </p>
                              <p className="flex items-center gap-2">
                                <span className="font-medium text-gray-600">Pool Status:</span>
                                <StatusPill status={displayStatus} />
                              </p>
                            </div>
                          </div>
                          <div>
                            <button
                              onClick={() => setDetailsPool(pool)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 hover:-translate-y-[1px] transition-transform"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
                      You haven't joined any pools yet.
                    </div>
                  )}

                  {/* Last 10 Completed Transactions removed */}
                </div>
              )}

              {myPoolsTab === 'created' && (
                <div className="space-y-4">
                  {poolsCreated.length > 0 ? poolsCreated.map((pool) => {
                    const crop = pool.cropTypes?.[0] || {};
                    const displayStatus = displayPoolStatus(pool);
                    return (
                      <div
                        key={pool._id}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900">{crop.type || 'Crop'}</h3>
                            <div className="mt-3 text-sm text-gray-700 space-y-1">
                              <p className="flex items-center gap-2">
                                <span className="font-medium text-gray-600">Total Quantity:</span>
                                <span className="font-semibold text-gray-900">{pool.targetQuantity} kg</span>
                              </p>
                              {String(displayStatus).toLowerCase() !== 'completed' && (
                                <p className="flex items-center gap-2">
                                  <span className="font-medium text-gray-600">Remaining Quantity:</span>
                                  <span className="font-semibold text-gray-900">{pool.remainingQuantity} kg</span>
                                </p>
                              )}
                              <p className="flex items-center gap-2">
                                <span className="font-medium text-gray-600">Price:</span>
                                <span className="font-semibold text-gray-900">₹{crop.rate}</span>
                              </p>
                              <p className="flex items-center gap-2">
                                <span className="font-medium text-gray-600">Pool Status:</span>
                                <StatusPill status={displayStatus} />
                              </p>
                            </div>
                          </div>
                          <div>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => setDetailsPool(pool)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 hover:-translate-y-[1px] transition-transform"
                              >
                                View Details
                              </button>
                              {pool.status !== 'locked' && (
                                <button
                                  onClick={() => setManagePool(pool)}
                                  className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 hover:-translate-y-[1px] transition-transform"
                                >
                                  Manage
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
                      You haven't created any pools yet.
                    </div>
                  )}
                  {/* Last 10 Completed Transactions removed */}
                </div>
              )}
            </div>
          )}

          {activeNav === 'create-pool' && (
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-2xl font-bold mb-4">Create Pool</h2>
              <CreatePool onSuccess={fetchDashboardData} />
            </div>
          )}

          {activeNav === 'direct-sell' && (
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-2xl font-bold mb-4">Direct Sell</h2>
              <DirectSell onSuccess={fetchDashboardData} />
            </div>
          )}

          {activeNav === 'requests' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow p-5">
                <h2 className="text-2xl font-bold">Requests</h2>
                <p className="text-sm text-gray-500 mt-1">Accept or reject requests. View details for more information.</p>
              </div>

              <div className="bg-white rounded-xl shadow p-5">
                <h3 className="text-lg font-bold mb-4">Buy Requests</h3>
                {(dashboardData?.buyRequests || []).filter((r) => r.status === 'pending').length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.buyRequests
                      .filter((r) => r.status === 'pending')
                      .map((r) => (
                        <div key={r._id} className="border border-gray-100 rounded-xl p-4">
                          <p className="font-semibold text-gray-900">{r.from?.name || 'Buyer'}</p>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium text-gray-600">Mobile:</span> {r.from?.mobileNumber || 'N/A'}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium text-gray-600">Product:</span> {r.productId?.cropType || 'N/A'}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium text-gray-600">Address:</span> {r.from?.location?.address || r.from?.address || 'N/A'}
                          </p>
                          <div className="flex gap-2 mt-3">
                            <button
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                              onClick={() => handleRequestResponse(r._id, 'accept', 'buy')}
                            >
                              Accept
                            </button>
                            <button
                              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                              onClick={() => handleRequestResponse(r._id, 'reject', 'buy')}
                            >
                              Reject
                            </button>
                            <button
                              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                              onClick={() => setSelectedBuyRequest(r)}
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">No pending buy requests.</div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Profile Modal */}
      {showProfile && (
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
              >
                Close
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(85vh-72px)] bg-gray-50">
              <Profile
                onSuccess={async () => {
                  await fetchDashboardData();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Pool Details Modal */}
      {detailsPool && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[85vh]">
            <div className="px-5 py-4 bg-gradient-to-r from-primary-600 to-indigo-600 text-white flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">
                  Pool Details <span className="text-white/80">#{detailsPool._id.slice(-6)}</span>
                </h3>
                <p className="text-sm text-white/80 mt-1">
                  {detailsPool.cropTypes?.[0]?.type} • ₹{detailsPool.cropTypes?.[0]?.rate}/kg
                </p>
              </div>
              <button
                onClick={() => setDetailsPool(null)}
                className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white"
              >
                Close
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(85vh-72px)]">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-gray-100 rounded-2xl p-4 bg-white">
                  <p className="font-semibold mb-3 text-gray-900">Pool Info</p>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700 flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-600">Required Quantity</span>
                      <span className="font-semibold text-gray-900">{detailsPool.targetQuantity} kg</span>
                    </p>
                    {String(displayPoolStatus(detailsPool)).toLowerCase() !== 'completed' && (
                      <p className="text-sm text-gray-700 flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-600">Remaining Quantity</span>
                        <span className="font-semibold text-gray-900">{detailsPool.remainingQuantity} kg</span>
                      </p>
                    )}
                    <p className="text-sm text-gray-700 flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-600">Status</span>
                      <StatusPill status={displayPoolStatus(detailsPool)} />
                    </p>
                    {detailsPool.location?.address && (
                      <p className="text-sm text-gray-700">
                        <span className="font-medium text-gray-600">Location</span>
                        <span className="text-gray-900">: {detailsPool.location.address}</span>
                      </p>
                    )}
                    {detailsPool.expectedCompletionDate && (
                      <p className="text-sm text-gray-700">
                        <span className="font-medium text-gray-600">Expected Completion</span>
                        <span className="text-gray-900">: {new Date(detailsPool.expectedCompletionDate).toLocaleDateString()}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="border border-gray-100 rounded-2xl p-4 bg-white">
                  <p className="font-semibold mb-3 text-gray-900">Contributors</p>
                  <div className="space-y-2">
                    {(detailsPool.members || [])
                      .filter((m) => m.status === 'accepted')
                      .map((m, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {m.farmer?.name || m.farmer?.mobileNumber || 'Farmer'}
                            </p>
                            <div className="mt-1 space-y-0.5">
                              <p className="text-xs text-gray-600">
                                <span className="font-medium">Mobile:</span> {m.farmer?.mobileNumber || 'N/A'}
                              </p>
                              <p className="text-xs text-gray-600 truncate">
                                <span className="font-medium">Address:</span> {m.farmer?.location?.address || m.farmer?.address || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <p className="text-xs text-gray-600">Contribution</p>
                            <p className="font-bold text-gray-900">{m.quantity} kg</p>
                          </div>
                        </div>
                      ))}
                    {(detailsPool.members || []).filter((m) => m.status === 'accepted').length === 0 && (
                      <p className="text-sm text-gray-500">No contributors yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buy Request Details Modal */}
      {selectedBuyRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[85vh]">
            <div className="px-5 py-4 bg-gradient-to-r from-primary-600 to-indigo-600 text-white flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Buyer Details</h3>
                <p className="text-sm text-white/80 mt-1">
                  Product: {selectedBuyRequest.productId?.cropType || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setSelectedBuyRequest(null)}
                className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white"
              >
                Close
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(85vh-72px)] bg-gray-50">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2 text-sm text-gray-700">
                <p><span className="font-medium text-gray-600">Name:</span> <span className="font-semibold text-gray-900">{selectedBuyRequest.from?.name || 'N/A'}</span></p>
                <p><span className="font-medium text-gray-600">Mobile Number:</span> <span className="font-semibold text-gray-900">{selectedBuyRequest.from?.mobileNumber || 'N/A'}</span></p>
                {selectedBuyRequest.from?.kisanId && (
                  <p><span className="font-medium text-gray-600">Kisan ID:</span> <span className="font-semibold text-gray-900">{selectedBuyRequest.from.kisanId}</span></p>
                )}
                <p><span className="font-medium text-gray-600">Address:</span> <span className="font-semibold text-gray-900">{selectedBuyRequest.from?.location?.address || selectedBuyRequest.from?.address || 'N/A'}</span></p>
                <p><span className="font-medium text-gray-600">City:</span> <span className="font-semibold text-gray-900">{selectedBuyRequest.from?.location?.city || selectedBuyRequest.from?.city || 'N/A'}</span></p>
                <p><span className="font-medium text-gray-600">State:</span> <span className="font-semibold text-gray-900">{selectedBuyRequest.from?.location?.state || selectedBuyRequest.from?.state || 'N/A'}</span></p>
                <p><span className="font-medium text-gray-600">Pincode:</span> <span className="font-semibold text-gray-900">{selectedBuyRequest.from?.location?.pincode || selectedBuyRequest.from?.pincode || 'N/A'}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Pool Modal */}
      {managePool && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-bold">Manage Pool #{managePool._id.slice(-6)}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {managePool.cropTypes?.[0]?.type} - ₹{managePool.cropTypes?.[0]?.rate}
                </p>
              </div>
              <button onClick={() => setManagePool(null)} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">
                Close
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleLockPool(managePool._id)}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                disabled={managePool.status === 'locked'}
              >
                🔒 Lock Pool
              </button>
              <button
                onClick={() => handleRemovePool(managePool._id)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                disabled={managePool.status === 'deleted' || managePool.status === 'locked'}
              >
                🗑 Remove Pool
              </button>
              <button
                onClick={() => handleEditPool(managePool._id)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={managePool.status === 'locked'}
              >
                ✏ Edit Quantity / Price
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const NavItem = ({ title, icon, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl mb-2 transition-colors ${
      active ? 'bg-primary-600 text-white shadow-sm' : 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-100'
    }`}
  >
    <span className="flex items-center gap-3">
      <span className="text-base">{icon}</span>
      <span className="font-semibold">{title}</span>
    </span>
    {badge !== null && badge !== undefined && badge > 0 && (
      <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
        {badge}
      </span>
    )}
  </button>
);

export default FarmerDashboardV2;

