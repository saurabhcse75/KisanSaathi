# Kisan Saathi - Farmer Marketplace Platform

A MERN stack application that helps small farmers collaborate with each other and sell their crops directly to buyers.

## Features

### For Farmers
- **Registration & Login**: Secure authentication with mobile number and password
- **Kisan ID Verification**: Integration with Government of India Kisan ID
- **Auto Location Detection**: Automatic geographical location detection
- **Pool Creation**: Create pools with other nearby farmers
- **Direct Selling**: List products directly for buyers
- **Request Management**: Accept/reject pool and buy requests
- **Profile Management**: Update address and location details

### For Buyers
- **Registration & Login**: Simple registration with mobile number
- **Product Browsing**: View all available products filtered by location
- **Crop Filtering**: Filter products by crop type
- **Buy Requests**: Send purchase requests to farmers
- **Request Tracking**: Track status of buy requests

## Tech Stack

- **Frontend**: React, React Router, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Location Services**: Browser Geolocation API

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Backend Setup

1. Install backend dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/kisanSaathi
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

3. Start the backend server:
```bash
npm run dev
```

The backend server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install frontend dependencies:
```bash
npm install
```

3. Create a `.env` file in the frontend directory (optional):
```env
REACT_APP_API_URL=http://localhost:5000/api
```

4. Start the frontend development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

### Running Both Together

From the root directory:
```bash
npm run dev:all
```

## Project Structure

```
KisanSaathi/
├── backend/
│   ├── models/
│   │   ├── Farmer.js
│   │   ├── Buyer.js
│   │   ├── Pool.js
│   │   ├── Product.js
│   │   └── Request.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── farmerRoutes.js
│   │   └── buyerRoutes.js
│   ├── middleware/
│   │   └── auth.js
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Home.js
│   │   │   ├── Farmer/
│   │   │   │   ├── FarmerRegister.js
│   │   │   │   ├── FarmerLogin.js
│   │   │   │   ├── FarmerDashboard.js
│   │   │   │   ├── CreatePool.js
│   │   │   │   ├── DirectSell.js
│   │   │   │   └── Profile.js
│   │   │   └── Buyer/
│   │   │       ├── BuyerRegister.js
│   │   │       ├── BuyerLogin.js
│   │   │       └── BuyerDashboard.js
│   │   ├── context/
│   │   │   └── AuthContext.js
│   │   ├── utils/
│   │   │   └── location.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/farmer/register` - Farmer registration
- `POST /api/auth/farmer/login` - Farmer login
- `POST /api/auth/buyer/register` - Buyer registration
- `POST /api/auth/buyer/login` - Buyer login

### Farmer Routes
- `GET /api/farmer/dashboard` - Get farmer dashboard data
- `POST /api/farmer/pool/create` - Create a pool
- `GET /api/farmer/nearby-farmers` - Get nearby farmers
- `POST /api/farmer/pool/request` - Send pool request
- `PUT /api/farmer/pool/request/:id` - Accept/reject pool request
- `PUT /api/farmer/pool/:id/lock` - Lock pool
- `DELETE /api/farmer/pool/:id` - Delete pool
- `POST /api/farmer/product/create` - Create direct product
- `PUT /api/farmer/profile` - Update profile

### Buyer Routes
- `GET /api/buyer/dashboard` - Get buyer dashboard data
- `GET /api/buyer/products` - Get products (with filters)
- `POST /api/buyer/request` - Send buy request
- `GET /api/buyer/requests` - Get all requests
- `PUT /api/buyer/profile` - Update profile

## Usage Flow

### Farmer Flow
1. Register with mobile number, password, and Kisan ID
2. Location is automatically detected
3. Create a pool or sell directly
4. View and respond to requests
5. Update profile with address details

### Buyer Flow
1. Register with mobile number and password
2. Browse available products
3. Filter by crop type and location
4. Send buy requests
5. Track request status

## Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Protected routes with middleware
- Input validation and sanitization

## Future Enhancements

- Real-time notifications
- Payment integration
- Rating and review system
- Advanced search and filters
- Mobile app version
- SMS/Email notifications

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

