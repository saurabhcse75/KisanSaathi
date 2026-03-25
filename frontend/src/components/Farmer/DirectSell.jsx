import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const DirectSell = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    cropType: '',
    quantity: '',
    price: '',
    unit: 'kg'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [myProducts, setMyProducts] = useState([]);
  const [buyRequests, setBuyRequests] = useState([]);
  const { API_URL } = useAuth();

  const fetchMyProducts = async () => {
    try {
      const res = await axios.get(`${API_URL}/farmer/dashboard`);
      const products = res.data?.products || [];
      const requests = res.data?.buyRequests || [];
      setMyProducts(products);
      setBuyRequests(requests);
    } catch (err) {
      console.error('Failed to fetch products', err);
    }
  };

  useEffect(() => {
    fetchMyProducts();
    const onUpdated = () => fetchMyProducts();
    window.addEventListener('farmer-dashboard-updated', onUpdated);
    return () => window.removeEventListener('farmer-dashboard-updated', onUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    if (!formData.cropType || !formData.quantity || !formData.price) {
      setError('All fields are required');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API_URL}/farmer/product/create`, {
        cropType: formData.cropType,
        quantity: parseFloat(formData.quantity),
        price: parseFloat(formData.price),
        unit: formData.unit
      });

      setSuccess('Product listed successfully!');
      setFormData({
        cropType: '',
        quantity: '',
        price: '',
        unit: 'kg'
      });
      if (onSuccess) onSuccess();
      fetchMyProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Remove this listing?')) return;
    try {
      await axios.delete(`${API_URL}/farmer/product/${productId}`);
      setSuccess('Listing removed successfully!');
      fetchMyProducts();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove listing');
    }
  };

  const hasPendingRequestForProduct = (productId) => {
    return (buyRequests || []).some(
      (r) => r?.type === 'buy' && r?.status === 'pending' && String(r?.productId?._id || r?.productId) === String(productId)
    );
  };

  const hasAcceptedRequestForProduct = (productId) => {
    // Farmer acceptance is stored as status: "completed" in backend.
    return (buyRequests || []).some(
      (r) =>
        r?.type === 'buy' &&
        r?.status === 'completed' &&
        String(r?.productId?._id || r?.productId) === String(productId)
    );
  };

  const getDirectSellDisplayStatus = (product) => {
    if (!product) return 'requested';
    if (product.status === 'sold' || hasAcceptedRequestForProduct(product._id)) return 'sold';
    if (hasPendingRequestForProduct(product._id)) return 'accepted by buyer';
    // For newly listed products in direct sell module, show requested as required.
    return 'requested';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Sell Directly</h2>

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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Crop Type <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="cropType"
              value={formData.cropType}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="e.g., Wheat, Rice, Corn"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit
              </label>
              <select
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="kg">kg</option>
                <option value="quintal">Quintal</option>
                <option value="ton">Ton</option>
                <option value="bag">Bag</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="0.00"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? 'Listing Product...' : 'List Product'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">My Direct Sell Listings</h3>
        {myProducts.filter(p => !p.isFromPool).length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {myProducts
              .filter(p => !p.isFromPool)
              .map((p) => (
                <div key={p._id} className="border border-gray-100 rounded-xl p-4">
                  {(() => {
                    const displayStatus = getDirectSellDisplayStatus(p);
                    const statusClass =
                      displayStatus === 'sold'
                        ? 'text-green-700'
                        : displayStatus === 'accepted by buyer'
                          ? 'text-orange-700'
                          : 'text-blue-700';
                    return (
                      <>
                  <p className="font-semibold text-gray-900">{p.cropType}</p>
                  <div className="mt-2 text-sm text-gray-700 space-y-1">
                    <p><span className="font-medium">Quantity:</span> {p.quantity} {p.unit}</p>
                    <p><span className="font-medium">Price:</span> ₹{p.price} / {p.unit}</p>
                    <p>
                      <span className="font-medium">Status:</span>{' '}
                      <span className={`font-semibold ${statusClass}`}>
                        {displayStatus}
                      </span>
                    </p>
                  </div>

                      </>
                    );
                  })()}
                </div>
              ))}
          </div>
        ) : (
          <p className="text-gray-500">No direct sell listings yet.</p>
        )}
      </div>
    </div>
  );
};

export default DirectSell;

