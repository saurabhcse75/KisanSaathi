import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { FaUser, FaSignOutAlt, FaPlus, FaShoppingCart, FaHandshake, FaLock, FaTrash, FaCheck, FaTimes, FaChevronDown, FaChevronUp, FaUsers, FaSeedling, FaDoorOpen } from 'react-icons/fa';
import CreatePool from './CreatePool';
import DirectSell from './DirectSell';
import Profile from './Profile';
import PoolRequestModal from './PoolRequestModal';
import PoolDiscovery from './PoolDiscovery';

const FarmerDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [expandedPools, setExpandedPools] = useState({});
  const { user, logout, API_URL } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API_URL}/farmer/dashboard`);
      setDashboardData(response.data);
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

  const handlePoolAction = async (poolId, action) => {
    try {
      if (action === 'lock') {
        await axios.put(`${API_URL}/farmer/pool/${poolId}/lock`);
      } else if (action === 'delete') {
        if (window.confirm('Are you sure you want to delete this pool?')) {
          await axios.delete(`${API_URL}/farmer/pool/${poolId}`);
        }
      }
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  const handleRemoveMember = async (poolId, memberId) => {
    if (!window.confirm('Are you sure you want to remove this member? Their contribution will be returned to the remaining quantity, and the pool will be visible to other farmers if the target is not completed.')) {
      return;
    }
    try {
      const response = await axios.delete(`${API_URL}/farmer/pool/${poolId}/member/${memberId}`);
      alert(response.data.message || 'Member removed successfully. The pool has been updated and is now visible to other farmers.');
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const togglePoolDetails = (poolId) => {
    setExpandedPools(prev => ({
      ...prev,
      [poolId]: !prev[poolId]
    }));
  };

  const handleExitPool = async (poolId) => {
    if (!window.confirm('Are you sure you want to leave this pool? Your contribution will be returned to the remaining quantity.')) {
      return;
    }
    try {
      await axios.post(`${API_URL}/farmer/pool/${poolId}/exit`);
      alert('Successfully left the pool');
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to exit pool');
    }
  };

  const handleRequestResponse = async (requestId, action, type = 'pool', quantity = null) => {
    try {
      const endpoint = type === 'pool' 
        ? `${API_URL}/farmer/pool/request/${requestId}`
        : `${API_URL}/farmer/buy-request/${requestId}`;
      
      const payload = type === 'pool' && action === 'accept' && quantity
        ? { action, quantity: parseFloat(quantity) }
        : { action };
      
      const response = await axios.put(endpoint, payload);
      
      if (type === 'pool' && action === 'accept' && response.data.pool) {
        // Show farmer details after acceptance
        const acceptedFarmer = response.data.pool.members?.find(
          m => m.farmer?._id === response.data.request.from
        );
        if (acceptedFarmer?.farmer) {
          alert(`Request accepted! Farmer Details:\nMobile: ${acceptedFarmer.farmer.mobileNumber}\nKisan ID: ${acceptedFarmer.farmer.kisanId || 'N/A'}\nLocation: ${acceptedFarmer.farmer.location?.address || 'N/A'}`);
        }
      }
      
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process request');
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
              <span className="text-gray-700">👤 {dashboardData?.farmer?.name || user?.mobileNumber}</span>
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

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex gap-4">
            {['overview', 'create-pool', 'discover-pools', 'direct-sell', 'requests', 'profile'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </button>
            ))}
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

        {activeTab === 'overview' && dashboardData && (
          <div className="space-y-8">
            {/* Pools You Created */}
            <div className="bg-gradient-to-br from-white to-green-50 rounded-xl shadow-lg border border-green-100 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <FaSeedling className="text-2xl" />
                  Pools You Created
                </h2>
                <p className="text-primary-100 text-sm mt-1">Manage your pools: lock, delete, and remove members</p>
              </div>
              
              <div className="p-6">
                {dashboardData.pools && dashboardData.pools.length > 0 ? (
                  <div className="space-y-4">
                    {dashboardData.pools.map((pool) => (
                      <div key={pool._id} className="bg-white rounded-lg border-2 border-gray-200 hover:border-primary-300 transition-all shadow-md hover:shadow-lg">
                        <div className="p-5">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <h3 className="text-xl font-bold text-gray-800">Pool #{pool._id.slice(-6)}</h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  pool.status === 'locked' ? 'bg-green-100 text-green-700' : 
                                  pool.status === 'deleted' ? 'bg-red-100 text-red-700' : 
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {pool.status.toUpperCase()}
                                </span>
                              </div>
                              
                              {pool.targetQuantity && (
                                <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                                  <div className="text-center">
                                    <p className="text-xs text-gray-500 mb-1">Target Quantity</p>
                                    <p className="text-lg font-bold text-primary-600">{pool.targetQuantity} kg</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-500 mb-1">Initial Contribution</p>
                                    <p className="text-lg font-bold text-green-600">{pool.initialContribution} kg</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-500 mb-1">Remaining</p>
                                    <p className="text-lg font-bold text-orange-600">{pool.remainingQuantity} kg</p>
                                  </div>
                                </div>
                              )}

                              <div className="mb-4">
                                <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                  <FaSeedling className="text-primary-600" />
                                  Crop Types
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {pool.cropTypes.map((crop, idx) => (
                                    <span key={idx} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-md text-sm font-medium">
                                      {crop.type} - ₹{crop.rate}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="border-t pt-4">
                                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <FaUsers className="text-primary-600" />
                                  Members ({pool.members?.filter(m => m.status === 'accepted').length || 0})
                                </p>
                                <div className="space-y-2">
                                  {pool.members?.filter(m => m.status === 'accepted').map((member, idx) => {
                                    const isCreator = String(member.farmer?._id || member.farmer) === String(pool.creatorFarmer?._id || pool.creatorFarmer);
                                    const canRemove = pool.status === 'active' && 
                                                     String(pool.creatorFarmer?._id || pool.creatorFarmer) === String(user.id) && 
                                                     !isCreator;
                                    
                                    return (
                                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <p className="font-medium text-gray-800">{member.farmer?.name || member.farmer?.mobileNumber}</p>
                                            {isCreator && (
                                              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-semibold">
                                                Creator
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs text-gray-500">Contribution: {member.quantity} kg</p>
                                        </div>
                                        {canRemove && (
                                          <button
                                            onClick={() => handleRemoveMember(pool._id, member.farmer._id)}
                                            className="ml-3 px-3 py-1.5 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 transition-colors flex items-center gap-1"
                                          >
                                            <FaTrash className="text-xs" />
                                            Remove
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {pool.members?.filter(m => m.status === 'accepted').length === 0 && (
                                    <p className="text-sm text-gray-500 italic">No members yet</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {pool.status === 'active' && String(pool.creatorFarmer?._id || pool.creatorFarmer) === String(user.id) && (
                              <div className="flex flex-col gap-2 ml-4">
                                <button
                                  onClick={() => handlePoolAction(pool._id, 'lock')}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                                >
                                  <FaLock />
                                  Lock Pool
                                </button>
                                <button
                                  onClick={() => handlePoolAction(pool._id, 'delete')}
                                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                                >
                                  <FaTrash />
                                  Delete Pool
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                    <FaSeedling className="text-6xl text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No pools created yet</p>
                    <p className="text-gray-400 text-sm mt-2">Create a pool to get started!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pools You are Part Of */}
            {dashboardData.memberPools && dashboardData.memberPools.length > 0 && (
              <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-lg border border-blue-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <FaUsers className="text-2xl" />
                    Pools You are Part Of
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">View details of pools you've joined</p>
                </div>
                
                <div className="p-6">
                  <div className="space-y-4">
                    {dashboardData.memberPools.map((pool) => {
                      const isExpanded = expandedPools[pool._id];
                      const myMember = pool.members?.find(m => m.farmer?._id === user.id && m.status === 'accepted');
                      
                      return (
                        <div key={pool._id} className="bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 transition-all shadow-md hover:shadow-lg">
                          <div className="p-5">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <h3 className="text-xl font-bold text-gray-800">Pool #{pool._id.slice(-6)}</h3>
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    pool.status === 'locked' ? 'bg-green-100 text-green-700' : 
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {pool.status.toUpperCase()}
                                  </span>
                                </div>
                                
                                <div className="mb-3">
                                  <p className="text-sm text-gray-600 mb-2">
                                    <span className="font-semibold">Created by:</span> {pool.creatorFarmer?.name || pool.creatorFarmer?.mobileNumber}
                                  </p>
                                  {myMember && (
                                    <div className="p-4 bg-gradient-to-r from-primary-100 to-primary-50 border-2 border-primary-300 rounded-lg shadow-sm">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="text-xs text-primary-600 font-semibold uppercase tracking-wide mb-1">Your Contribution</p>
                                          <p className="text-2xl font-bold text-primary-700">{myMember.quantity} kg</p>
                                        </div>
                                        <div className="bg-primary-200 rounded-full p-3">
                                          <FaUsers className="text-primary-700 text-xl" />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {pool.targetQuantity && (
                                  <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                                    <div className="text-center">
                                      <p className="text-xs text-gray-500 mb-1">Target Quantity</p>
                                      <p className="text-lg font-bold text-blue-600">{pool.targetQuantity} kg</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xs text-gray-500 mb-1">Initial Contribution</p>
                                      <p className="text-lg font-bold text-green-600">{pool.initialContribution} kg</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-xs text-gray-500 mb-1">Remaining</p>
                                      <p className="text-lg font-bold text-orange-600">{pool.remainingQuantity} kg</p>
                                    </div>
                                  </div>
                                )}

                                {!isExpanded && (
                                  <div className="mb-3">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">Crop Types</p>
                                    <div className="flex flex-wrap gap-2">
                                      {pool.cropTypes.slice(0, 3).map((crop, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                                          {crop.type} - ₹{crop.rate}
                                        </span>
                                      ))}
                                      {pool.cropTypes.length > 3 && (
                                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md text-sm">
                                          +{pool.cropTypes.length - 3} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {isExpanded && (
                                  <div className="space-y-4 mb-4 border-t pt-4">
                                    <div>
                                      <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        <FaSeedling className="text-blue-600" />
                                        All Crop Types
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {pool.cropTypes.map((crop, idx) => (
                                          <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-md text-sm font-medium">
                                            {crop.type} - ₹{crop.rate}
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="border-t pt-4">
                                      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <FaUsers className="text-blue-600" />
                                        All Members ({pool.members?.filter(m => m.status === 'accepted').length || 0})
                                      </p>
                                      <div className="space-y-2">
                                        {pool.members?.filter(m => m.status === 'accepted').map((member, idx) => (
                                          <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                                            <p className="font-medium text-gray-800">{member.farmer?.name || member.farmer?.mobileNumber}</p>
                                            <div className="mt-1 space-y-1 text-xs text-gray-600">
                                              <p>Contribution: {member.quantity} kg</p>
                                              {member.farmer?.kisanId && (
                                                <p>Kisan ID: {member.farmer.kisanId}</p>
                                              )}
                                              {member.farmer?.location?.address && (
                                                <p>Location: {member.farmer.location.address}</p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {pool.isSold && (
                                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-sm text-green-700 font-semibold flex items-center gap-2">
                                          <FaCheck className="text-green-600" />
                                          Pool Crop Sold
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex flex-col gap-2 ml-4">
                                <button
                                  onClick={() => togglePoolDetails(pool._id)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                                >
                                  {isExpanded ? (
                                    <>
                                      <FaChevronUp />
                                      Hide Details
                                    </>
                                  ) : (
                                    <>
                                      <FaChevronDown />
                                      View Details
                                    </>
                                  )}
                                </button>
                                {myMember && pool.status === 'active' && (
                                  <button
                                    onClick={() => handleExitPool(pool._id)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                                  >
                                    <FaDoorOpen />
                                    Leave Pool
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {(!dashboardData.memberPools || dashboardData.memberPools.length === 0) && (
              <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-lg border border-blue-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <FaUsers className="text-2xl" />
                    Pools You are Part Of
                  </h2>
                </div>
                <div className="p-6">
                  <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                    <FaUsers className="text-6xl text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">You haven't joined any pools yet</p>
                    <p className="text-gray-400 text-sm mt-2">Discover and join pools from other farmers!</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'create-pool' && (
          <CreatePool onSuccess={fetchDashboardData} />
        )}

        {activeTab === 'discover-pools' && (
          <PoolDiscovery />
        )}

        {activeTab === 'direct-sell' && (
          <DirectSell onSuccess={fetchDashboardData} />
        )}

        {activeTab === 'requests' && dashboardData && (
          <div className="space-y-6">
            {/* Pool Requests */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Pool Requests</h2>
              {dashboardData.poolRequests && dashboardData.poolRequests.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.poolRequests.map((request) => (
                    <div 
                      key={request._id} 
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedRequest(request)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold">From: {request.from?.name || request.from?.mobileNumber}</p>
                          <p className="text-sm text-gray-600">Pool: {request.poolId?._id.slice(-6)}</p>
                          {request.from?.kisanId && (
                            <p className="text-sm text-gray-600">Kisan ID: {request.from.kisanId}</p>
                          )}
                          {request.from?.location?.address && (
                            <p className="text-sm text-gray-500">Location: {request.from.location.address}</p>
                          )}
                          <p className="text-sm text-gray-500">Status: {request.status}</p>
                        </div>
                        {request.status === 'pending' && (
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedRequest(request)}
                              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              <FaCheck className="inline mr-1" /> Accept
                            </button>
                            <button
                              onClick={() => handleRequestResponse(request._id, 'reject', 'pool')}
                              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              <FaTimes className="inline mr-1" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No pending pool requests.</p>
              )}
            </div>

            {/* Buy Requests */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Buy Requests</h2>
              {dashboardData.buyRequests && dashboardData.buyRequests.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.buyRequests.map((request) => (
                    <div 
                      key={request._id} 
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        // Show detailed view or modal
                        alert(`Buy Request Details:\n\nFrom: ${request.from?.name || request.from?.mobileNumber}\nProduct: ${request.productId?.cropType} - ${request.productId?.quantity} ${request.productId?.unit}\nStatus: ${request.status}\n\n${request.from?.location?.address ? `Address: ${request.from.location.address}` : ''}`);
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-semibold">From: {request.from?.name || request.from?.mobileNumber}</p>
                          <p className="text-sm text-gray-600">
                            Product: {request.productId?.cropType} - {request.productId?.quantity} {request.productId?.unit}
                          </p>
                          {(request.status === 'completed' || request.status === 'accepted' || request.status === 'pending') && request.from && (
                            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                              <p className="text-sm font-medium text-gray-700 mb-1">Buyer Details:</p>
                              <p className="text-sm text-gray-600">Name: {request.from.name || 'N/A'}</p>
                              <p className="text-sm text-gray-600">Mobile: {request.from.mobileNumber}</p>
                              {request.from.location?.address && (
                                <p className="text-sm text-gray-600">Address: {request.from.location.address}</p>
                              )}
                              {request.from.location?.city && (
                                <p className="text-sm text-gray-600">City: {request.from.location.city}</p>
                              )}
                              {request.from.location?.state && (
                                <p className="text-sm text-gray-600">State: {request.from.location.state}</p>
                              )}
                              {request.from.location?.pincode && (
                                <p className="text-sm text-gray-600">Pincode: {request.from.location.pincode}</p>
                              )}
                            </div>
                          )}
                          <p className="text-sm text-gray-500 mt-2">Status: <span className={`font-medium ${
                            request.status === 'completed' || request.status === 'accepted' ? 'text-green-600' : 
                            request.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
                          }`}>{request.status === 'completed' ? 'Completed' : request.status}</span></p>
                        </div>
                        {request.status === 'pending' && (
                          <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleRequestResponse(request._id, 'accept', 'buy')}
                              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              <FaCheck className="inline mr-1" /> Accept
                            </button>
                            <button
                              onClick={() => handleRequestResponse(request._id, 'reject', 'buy')}
                              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              <FaTimes className="inline mr-1" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No buy requests yet.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <Profile onSuccess={fetchDashboardData} />
        )}
      </main>

      {/* Pool Request Modal */}
      {selectedRequest && (
        <PoolRequestModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onAccept={(quantity) => {
            handleRequestResponse(selectedRequest._id, 'accept', 'pool', quantity);
            setSelectedRequest(null);
          }}
          onReject={() => {
            handleRequestResponse(selectedRequest._id, 'reject', 'pool');
            setSelectedRequest(null);
          }}
        />
      )}
    </div>
  );
};

export default FarmerDashboard;

