# Professional Seller Dashboard - React + Vite

A fully responsive, professional-grade seller and admin dashboard built with React 19, Vite, TypeScript, and Tailwind CSS. Includes complete order management, inventory tracking, delivery management, and professional receipt generation with automatic issuance.

## Features

### 🎯 Core Features
- **Professional Dashboard**: Real-time stats showing total revenue, orders, deliveries, and inventory insights
- **Products Management**: Complete inventory management with stock tracking and low-stock alerts
- **Orders Management**: Full order lifecycle management with status tracking and payment status
- **Deliveries Tracking**: Track deliveries with automatic receipt generation when marked as delivered
- **Professional Receipts**: Print-ready receipt generation with PDF download capability
- **Settings**: Customizable store settings including currency, tax rates, and shipping costs

### 📱 Responsive Design
- **Mobile-first approach**: Optimized for all devices (320px and up)
- **Drawer Navigation**: Mobile-friendly sidebar that slides in/out
- **Collapsible Sidebar**: Desktop sidebar that collapses for better space utilization
- **Tablet Optimization**: Perfect tablet experience with appropriate padding and spacing
- **Touch-friendly**: All buttons and controls are properly sized for mobile touch

### 🔄 API Integration
- Complete REST API integration with proper error handling
- Mock data API endpoints for development and testing
- Smooth loading states with skeleton screens
- Real-time data fetching with proper state management
- Error handling with user-friendly error messages

### 🎨 Professional UI
- Clean, modern design with consistent color scheme
- Smooth animations and transitions
- Proper spacing and typography hierarchy
- Accessible components following WCAG guidelines
- Dark/Light mode support via design tokens

## Project Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx      # Navigation sidebar (responsive)
│   │   └── Header.tsx       # Top header with user menu
│   ├── StatCard.tsx         # Dashboard stat card component
│   ├── RecentOrders.tsx     # Recent orders table
│   └── InventoryStatus.tsx  # Low stock inventory widget
├── pages/
│   ├── Dashboard.tsx        # Main dashboard home
│   ├── Products.tsx         # Products management
│   ├── Orders.tsx           # Orders management
│   ├── Deliveries.tsx       # Deliveries tracking
│   ├── Receipts.tsx         # Receipts view & management
│   └── Settings.tsx         # Store settings
├── types/
│   └── index.ts            # TypeScript interfaces
├── App.tsx                  # Main app component with routing
├── main.tsx                 # React entry point
└── index.css               # Global styles & Tailwind

index.html                   # HTML entry point
vite.config.ts              # Vite configuration
tailwind.config.js          # Tailwind CSS config
postcss.config.js           # PostCSS configuration
```

## Key Pages

### Dashboard (`/`)
- Real-time sales statistics
- Recent orders overview
- Low stock items alert
- Quick access to all features

### Products (`/products`)
- Complete inventory listing
- Add/Edit/Delete products
- SKU and price management
- Stock quantity tracking
- Low stock highlighting

### Orders (`/orders`)
- All customer orders with details
- Order status management (pending, confirmed, shipped, delivered)
- Payment status tracking
- Customer information display
- Receipt generation from orders

### Deliveries (`/deliveries`)
- Track all deliveries
- Delivery person assignment
- Location tracking
- Estimated delivery time
- Automatic receipt issuance when delivery is marked complete

### Receipts (`/receipts`)
- View all issued receipts
- Print-ready receipt format
- PDF download capability
- Professional receipt template with:
  - Customer details
  - Itemized list
  - Subtotal, tax, and shipping breakdown
  - Payment method
  - Professional formatting

### Settings (`/settings`)
- Store name and contact info
- Business settings (currency, tax rate, shipping rate)
- User account management
- Application preferences

## API Endpoints

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create new product
- `GET /api/products/:id` - Get product details
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `PATCH /api/products/:id/stock` - Update stock

### Orders
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id` - Update order
- `PATCH /api/orders/:id/status` - Update order status
- `DELETE /api/orders/:id` - Delete order

### Deliveries
- `GET /api/deliveries` - Get all deliveries
- `POST /api/deliveries` - Create new delivery
- `GET /api/deliveries/:id` - Get delivery details
- `PUT /api/deliveries/:id` - Update delivery
- `PATCH /api/deliveries/:id/status` - Update delivery status
- `POST /api/deliveries/:id/receipt` - Issue receipt (auto-receipt generation)

### Receipts
- `GET /api/receipts` - Get all receipts
- `POST /api/receipts` - Create new receipt
- `GET /api/receipts/:id` - Get receipt details
- `GET /api/receipts/:id/pdf` - Download receipt as PDF

### Dashboard
- `GET /api/stats` - Get dashboard statistics

## Getting Started

### Prerequisites
- Node.js 18+ or higher
- pnpm or npm

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open browser
# Navigate to http://localhost:3000
```

### Development
- Vite provides lightning-fast development server
- Hot Module Replacement (HMR) with instant updates
- Fast refresh for React components
- TypeScript support with auto-compilation

### Building for Production

```bash
# Build the application
pnpm build

# Preview production build locally
pnpm preview

# Output will be in the dist/ directory
```

## Technologies Used

- **Framework**: React 19
- **Build Tool**: Vite 5.4
- **Language**: TypeScript 5.7
- **Styling**: Tailwind CSS v4
- **State Management**: React hooks (useState, useEffect)
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **PDF Generation**: jsPDF + html2canvas
- **Development Server**: Vite with HMR

## Features Implementation Details

### Responsive Design
- Mobile drawer navigation that slides in/out
- Desktop collapsible sidebar (hidden on mobile)
- Touch-friendly buttons and controls (minimum 44px height)
- Flexible grid layouts that adapt to screen size
- Proper padding and margin scaling

### Receipt System
- Professional receipt template with company branding
- Itemized product list with quantities and pricing
- Tax and shipping calculations
- Multiple export options (Print, PDF, Email ready)
- Print-optimized styling
- Automatic issuance when delivery is marked complete

### Auto-Receipt Generation
- Integrated into delivery workflow
- Automatically generates receipt when delivery status is "delivered"
- One-click issuance with confirmation
- Can be manually triggered for pending deliveries

### API Integration
- Centralized API client for type-safe requests
- Proper error handling with user-friendly messages
- Loading states with skeleton screens
- Mock data for development and testing

## Color System

The dashboard uses a clean, professional color system with 5 colors:
- **Primary**: #2563eb (Blue) - Main actions and highlights
- **Success**: #10b981 (Green) - Positive status and delivered items
- **Warning**: #f59e0b (Amber) - Low stock alerts
- **Destructive**: #ef4444 (Red) - Destructive actions
- **Neutral**: Gray scale for text and backgrounds

## Typography

- **Headings**: System fonts with proper hierarchy
- **Body**: Clean, readable sans-serif
- Line heights optimized for readability (1.4-1.6)
- Proper contrast ratios for accessibility

## Performance

- Next.js 16 with Turbopack for fast builds
- Automatic code splitting and lazy loading
- Optimized images and assets
- Efficient database queries (when connected to real DB)
- Caching strategies for API responses

## Security Considerations

When deploying to production:
1. Replace mock API with real backend
2. Implement proper authentication
3. Add authorization checks
4. Use environment variables for sensitive data
5. Implement rate limiting
6. Validate all user input
7. Use HTTPS/TLS for all connections
8. Implement proper session management
9. Add CSRF protection
10. Set proper security headers

## Future Enhancements

- User authentication and authorization
- Real database integration (Neon, Supabase, etc.)
- Advanced analytics and reporting
- Inventory forecasting
- Customer management
- Payment processing integration
- Email notifications
- SMS notifications
- Barcode scanning
- Multi-warehouse support
- Bulk operations
- Custom reports
- API webhooks

## Support

For issues or feature requests, please create a GitHub issue or contact support.

## License

MIT License - Feel free to use this dashboard for your business.

---

Built with ❤️ for sellers and administrators
