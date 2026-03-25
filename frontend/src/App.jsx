import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home';
import FarmerRegister from './components/Farmer/FarmerRegister';
import FarmerLogin from './components/Farmer/FarmerLogin';
import BuyerRegister from './components/Buyer/BuyerRegister';
import BuyerLogin from './components/Buyer/BuyerLogin';
import FarmerDashboard from './components/Farmer/FarmerDashboard';
import BuyerDashboardV2 from './components/Buyer/BuyerDashboardV2';
import { AuthProvider, useAuth } from './context/AuthContext';

function PrivateRoute({ children, userType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  if (userType && user.type !== userType) {
    return <Navigate to="/" />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/farmer/register" element={<FarmerRegister />} />
          <Route path="/farmer/login" element={<FarmerLogin />} />
          <Route path="/buyer/register" element={<BuyerRegister />} />
          <Route path="/buyer/login" element={<BuyerLogin />} />
          <Route
            path="/farmer/dashboard"
            element={
              <PrivateRoute userType="farmer">
                <FarmerDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/buyer/dashboard"
            element={
              <PrivateRoute userType="buyer">
                <BuyerDashboardV2 />
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

