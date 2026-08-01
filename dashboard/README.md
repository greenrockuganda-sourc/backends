# Seller/Admin Dashboard

This folder contains a React + Vite admin dashboard for the backend.

## Run locally

1. Install dependencies:
   ```bash
   cd dashboard
   npm install
   ```

2. Start the dashboard:
   ```bash
   npm run dev
   ```

3. The app will load on `http://localhost:4173` by default.

## API

The dashboard uses the Django backend API at `http://localhost:8000` by default.

### Implemented admin features

- Dashboard metrics and summary cards
- Product list, product creation
- Category and brand management
- Inventory stock adjustments
- Customer list
- Order list, confirm/cancel, status updates
- Payment list
- Delivery list
- Receipt list
- Report fetches for sales, orders, products, and customers

## Notes

- Login uses `/api/auth/login/` and requires an admin account.
- If your backend runs at a different host, set `VITE_API_BASE_URL` in a `.env` file.
