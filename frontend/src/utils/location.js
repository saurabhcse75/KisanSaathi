// Get user's current location
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};

// Get address from coordinates using reverse geocoding
export const getAddressFromCoordinates = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=YOUR_API_KEY`
    );
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        address: result.formatted,
        city: result.components.city || result.components.town || '',
        state: result.components.state || '',
        pincode: result.components.postcode || ''
      };
    }
    
    return {
      address: '',
      city: '',
      state: '',
      pincode: ''
    };
  } catch (error) {
    console.error('Error getting address:', error);
    return {
      address: '',
      city: '',
      state: '',
      pincode: ''
    };
  }
};

// Simple location fetch (without API key - using browser geolocation only)
export const fetchLocation = async () => {
  try {
    const coords = await getCurrentLocation();
    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: '',
      city: '',
      state: '',
      pincode: ''
    };
  } catch (error) {
    console.error('Error fetching location:', error);
    return {
      latitude: 0,
      longitude: 0,
      address: '',
      city: '',
      state: '',
      pincode: ''
    };
  }
};

