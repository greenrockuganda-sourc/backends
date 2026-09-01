# Mobile App - Quick Start Guide

## Setup Instructions

### Prerequisites
- Node.js and npm installed
- Expo CLI installed (`npm install -g expo-cli`)
- Expo Go app installed on your phone (for testing on device) OR
- Android Emulator or iOS Simulator installed (for testing on emulator)

### Installation

```bash
# Navigate to the mobile app directory
cd c:\Users\Mroke\Desktop\backend\mobile

# Install dependencies
npm install

# Start the development server
npm start
```

### Running the App

#### On Web Browser (Recommended for Quick Testing)
```bash
npm run web
# Opens the app in your default browser at http://localhost:8081
```

#### On Android Emulator
```bash
npm run android
```

#### On iOS Simulator
```bash
npm run ios
```

#### On Physical Device
1. Run `npm start`
2. Install Expo Go from your phone's app store
3. Scan the QR code shown in terminal with Expo Go app
4. App will load on your device

## Key Features to Test

### Home Page
- [ ] Hero banner displays correctly
- [ ] Brand carousel loads and is scrollable
- [ ] Category carousel loads and is scrollable
- [ ] Best Selling products section displays products
- [ ] Deals of the Day section displays products
- [ ] Fresh Picks section displays products
- [ ] Discover more section displays product grid
- [ ] Pull to refresh loads new data
- [ ] Search bar is functional

### Product Browsing
- [ ] Tap on any product to open detail view
- [ ] Product images load correctly
- [ ] Product details are displayed (name, price, description)
- [ ] Wishlist button (heart icon) works
- [ ] Product detail modal closes when tapping X or backdrop

### Categories Screen
- [ ] Sidebar shows all categories and brands
- [ ] Select category to filter products
- [ ] Select brand to filter products
- [ ] Product grid displays filtered products
- [ ] Sort options work (Featured, Price, Name)
- [ ] Add to cart button works in categories
- [ ] Quantity controls appear after adding to cart

### Shopping Cart
- [ ] Items display correctly
- [ ] Quantity can be adjusted with +/- buttons
- [ ] Prices calculate correctly
- [ ] Remove item button works
- [ ] Cart persists after closing app (if logged in)

### Checkout
- [ ] Address selection/management works
- [ ] Payment method selection works
- [ ] Order summary displays correctly
- [ ] Place order button creates order
- [ ] Success confirmation appears after order

### Orders
- [ ] Orders list loads (if logged in)
- [ ] Order status displays correctly
- [ ] Delivery tracking shows ETA
- [ ] Filter by status works
- [ ] Can view order details

### Profile
- [ ] Login/Signup forms work
- [ ] Profile information displays
- [ ] Can edit profile details
- [ ] Can change password
- [ ] Can add/edit addresses
- [ ] Can select default address
- [ ] Can select payment method
- [ ] Logout button works

## Debugging Tips

### Check Console Logs
The app logs important information:
- `[API]` logs show API request status
- `[INFO]` logs show general information
- `[WARN]` logs show warnings
- `[ERROR]` logs show errors

To view logs:
- **Web:** Open browser Developer Tools (F12) → Console tab
- **Mobile (physical device):** Use Expo Go app's built-in logs
- **Emulator:** Check terminal output

### Common Issues and Solutions

#### Products Not Showing
- Check that backend API is running
- Verify API base URL in App.tsx (around line 60-65)
- Check browser console for API errors
- Look for `[API] Loaded products count:` in logs

#### Can't Connect to Backend
- Ensure backend server is running
- For local testing: backend should be at `http://localhost:8000`
- For Android emulator: use `10.0.2.2:8000` instead of `localhost`
- Check API base URL configuration

#### Login Not Working
- Verify backend auth endpoints exist
- Check that credentials are correct
- Look for auth errors in console logs

#### Cart Not Saving
- Ensure AsyncStorage is working
- Check that `@glow-cart-v1` key exists in storage
- Verify user is authenticated for server-side cart

## Performance Tips

1. **Refresh Data:** Pull down on home page to refresh products
2. **Search:** Use search bar to find products quickly
3. **Filter:** Use categories and brands to narrow down products
4. **Back Navigation:** Use back button/arrows consistently

## Security Notes

- Auth tokens are stored securely in AsyncStorage
- Never commit API base URLs with real server addresses
- Use environment variables for sensitive configuration
- HTTPS recommended for production

## Support

If you encounter issues:
1. Check the MOBILE_APP_FIXES.md file for detailed information
2. Review console logs for error messages
3. Verify backend API is responding correctly
4. Check that all required API endpoints are implemented

## Files Overview

- `App.tsx` - Main application file with all screens and logic
- `utils.ts` - Utility functions for formatting and image handling
- `app.json` - Expo configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration

## Next Steps

1. Start the app with `npm start`
2. Test all features listed above
3. Check console for any errors
4. Fix any issues found during testing
5. Deploy to your target platform when ready
