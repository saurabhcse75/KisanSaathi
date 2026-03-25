# Setup Guide for Kisan Saathi

## Quick Start

### 1. Install Dependencies

**Backend:**
```bash
npm install
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/kisanSaathi
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**Note:** Make sure MongoDB is running on your system. If using MongoDB Atlas (cloud), update the `MONGO_URI` accordingly.

### 3. Start the Application

**Option 1: Run both backend and frontend together**
```bash
npm run dev:all
```

**Option 2: Run separately**

Terminal 1 (Backend):
```bash
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm start
```

### 4. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Testing the Application

### Farmer Flow:
1. Go to http://localhost:3000
2. Click "Register as Farmer"
3. Fill in:
   - Mobile Number (10 digits)
   - Kisan ID
   - Password
4. Location will be auto-detected (allow browser location access)
5. After registration, you'll be redirected to the Farmer Dashboard

### Buyer Flow:
1. Go to http://localhost:3000
2. Click "Register as Buyer"
3. Fill in:
   - Mobile Number (10 digits)
   - Password
4. Location will be auto-detected
5. After registration, you'll be redirected to the Buyer Dashboard

## Important Notes

1. **Location Access**: The app requires browser location access for auto-detection. If denied, you can manually update location in the Profile section.

2. **MongoDB**: Ensure MongoDB is installed and running. For Windows:
   ```bash
   # If MongoDB is installed as a service, it should start automatically
   # Or start manually:
   mongod
   ```

3. **Port Conflicts**: If port 5000 or 3000 is already in use, update the PORT in `.env` and restart.

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running
- Check if the connection string in `.env` is correct
- For MongoDB Atlas, ensure your IP is whitelisted

### Location Not Detected
- Allow location access in browser settings
- Use HTTPS in production (geolocation requires secure context in some browsers)
- Manually update location in Profile section

### CORS Errors
- Ensure backend is running on port 5000
- Check that `REACT_APP_API_URL` in frontend matches backend URL

## Production Deployment

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Set environment variables on your hosting platform

3. Use a process manager like PM2 for Node.js:
   ```bash
   npm install -g pm2
   pm2 start backend/server.js
   ```

4. Serve the frontend build folder using a web server (nginx, Apache, etc.)

