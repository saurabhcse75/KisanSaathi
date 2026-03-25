import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { fetchLocation } from '../../utils/location';

const Profile = ({ onSuccess }) => {
  const [profileData, setProfileData] = useState(null);
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    pincode: ''
  });
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user, API_URL } = useAuth();

  useEffect(() => {
    fetchProfileData();
    fetchCurrentLocation();
  }, []);

  const fetchProfileData = async () => {
    try {
      const response = await axios.get(`${API_URL}/farmer/dashboard`);
      if (response.data.farmer) {
        setProfileData(response.data.farmer);
        const loc = response.data.farmer.location || {};
        setFormData({
          address: loc.address || '',
          city: loc.city || '',
          state: loc.state || '',
          pincode: loc.pincode || ''
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const loc = await fetchLocation();
      setLocation(loc);
      setFormData({
        address: loc.address || '',
        city: loc.city || '',
        state: loc.state || '',
        pincode: loc.pincode || ''
      });
    } catch (err) {
      console.error('Location error:', err);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    setLoading(true);

    try {
      await axios.put(`${API_URL}/farmer/profile`, {
        location: {
          ...location,
          ...formData
        }
      });

      setSuccess('Profile updated successfully!');
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Display */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Profile Details</h2>
        {profileData ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Name</p>
              <p className="text-base font-semibold text-gray-900">{profileData.name || user?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Mobile Number</p>
              <p className="text-base font-semibold text-gray-900">{profileData.mobileNumber || user?.mobileNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Kisan ID</p>
              <p className="text-base font-semibold text-gray-900">{profileData.kisanId || 'N/A'}</p>
            </div>
            {profileData.location && (
              <>
                {profileData.location.address && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Address</p>
                    <p className="text-base text-gray-800">{profileData.location.address}</p>
                  </div>
                )}
                {profileData.location.city && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">City</p>
                    <p className="text-base text-gray-800">{profileData.location.city}</p>
                  </div>
                )}
                {profileData.location.state && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">State</p>
                    <p className="text-base text-gray-800">{profileData.location.state}</p>
                  </div>
                )}
                {profileData.location.pincode && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Pincode</p>
                    <p className="text-base text-gray-800">{profileData.location.pincode}</p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <p className="text-gray-500">Loading profile...</p>
        )}
      </div>

      {/* Profile Update Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Update Profile</h2>

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

        {location && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              📍 Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter your full address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="City"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="State"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pincode
            </label>
            <input
              type="text"
              name="pincode"
              value={formData.pincode}
              onChange={handleChange}
              maxLength="6"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="6-digit pincode"
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={fetchCurrentLocation}
              disabled={locationLoading}
              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 disabled:opacity-50 font-semibold"
            >
              {locationLoading ? 'Fetching...' : '📍 Get Current Location'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-xl hover:bg-primary-700 transition-colors font-semibold disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;

