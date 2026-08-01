import { useEffect, useMemo, useState } from 'react'
import {
  cancelOrder,
  confirmOrder,
  createBrand,
  createCategory,
  createProduct,
  fetchBrands,
  fetchCategories,
  fetchCustomers,
  fetchDashboard,
  fetchDeliveries,
  fetchInventory,
  fetchOrders,
  fetchPayments,
  fetchProducts,
  fetchProfile,
  fetchReceipts,
  fetchReceiptPdf,
  sendReceiptEmail,
  fetchReports,
  login,
  logout,
  updateInventory,
  updateOrderStatus,
  deleteProduct,
} from './api'
import type { Brand, Category, Customer, DashboardSummary, Delivery, Order, Payment, Product, Receipt, User } from './types'

const sellerSections = ['dashboard', 'products', 'inventory', 'orders', 'deliveries', 'receipts'] as const
const adminSections = ['dashboard', 'products', 'categories', 'brands', 'inventory', 'customers', 'orders', 'payments', 'deliveries', 'receipts', 'reports'] as const

const sections = [...new Set([...sellerSections, ...adminSections])] as const

type Section = (typeof sections)[number]

const sectionTitles: Record<Section, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  categories: 'Categories',
  brands: 'Brands',
  inventory: 'Inventory',
  customers: 'Customers',
  orders: 'Orders',
  payments: 'Payments',
  deliveries: 'Deliveries',
  receipts: 'Receipts',
  reports: 'Reports',
}

function getSectionTitle(section: Section, role?: string) {
  const normalizedRole = role?.toLowerCase()
  if (normalizedRole === 'seller') {
    switch (section) {
      case 'dashboard':
        return 'Overview'
      case 'products':
        return 'Products'
      case 'inventory':
        return 'Stock'
      default:
        return sectionTitles[section]
    }
  }
  return sectionTitles[section]
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access'))
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem('refresh'))
  const [user, setUser] = useState<User | null>(null)
  const [section, setSection] = useState<Section>('dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [inventory, setInventory] = useState<Array<{ id: number; product: string; current_stock: number; reorder_level: number; stock_status: string; last_updated: string }>>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [reportData, setReportData] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [productCategoryFilter, setProductCategoryFilter] = useState('')
  const [productBrandFilter, setProductBrandFilter] = useState('')
  const [productStatusFilter, setProductStatusFilter] = useState('')
  const [formState, setFormState] = useState<Record<string, string>>({})
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null)
  const [showReceiptPreview, setShowReceiptPreview] = useState(false)
  const [receiptSearch, setReceiptSearch] = useState('')
  const [receiptDateFrom, setReceiptDateFrom] = useState('')
  const [receiptDateTo, setReceiptDateTo] = useState('')
  const [emailToSend, setEmailToSend] = useState('')
  const [sendingEmail, setSendingEmail] = useState<number | null>(null)
  const [sendStatus, setSendStatus] = useState<string | null>(null)
  const [showProductForm, setShowProductForm] = useState(false)
  const [showProductCatalog, setShowProductCatalog] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)

  const isLoggedIn = Boolean(token)

  const availableSections = useMemo<Section[]>(() => {
    const role = user?.role?.toLowerCase()
    if (role === 'admin') {
      return Array.from(sections) as Section[]
    }
    return ['dashboard', 'products', 'inventory', 'orders', 'deliveries', 'receipts'] as Section[]
  }, [user?.role])

  useEffect(() => {
    if (user && !availableSections.includes(section)) {
      setSection('dashboard')
    }
  }, [availableSections, section, user])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!token) {
      setSummary(null)
      return
    }
    if (section === 'dashboard') {
      loadDashboard()
      return
    }
    if (section === 'products') {
      loadProducts()
      loadCategories()
      loadBrands()
      return
    }
    if (section === 'categories') {
      loadCategories()
      return
    }
    if (section === 'brands') {
      loadBrands()
      return
    }
    if (section === 'inventory') {
      loadInventory()
      return
    }
    if (section === 'customers') {
      loadCustomers()
      return
    }
    if (section === 'orders') {
      loadOrders()
      return
    }
    if (section === 'payments') {
      loadPayments()
      return
    }
    if (section === 'deliveries') {
      loadDeliveries()
      return
    }
    if (section === 'receipts') {
      loadReceipts()
      return
    }
    if (section === 'reports') {
      setReportData(null)
      return
    }
  }, [section, token])

  const filteredReceipts = useMemo(() => {
    let list = receipts.slice()
    if (receiptSearch) {
      const q = receiptSearch.toLowerCase()
      list = list.filter((r) => [r.receipt_number, r.order_number, r.customer].some((v) => String(v || '').toLowerCase().includes(q)))
    }
    if (receiptDateFrom) {
      const from = new Date(receiptDateFrom)
      list = list.filter((r) => new Date(r.date) >= from)
    }
    if (receiptDateTo) {
      const to = new Date(receiptDateTo)
      // include the whole day
      to.setHours(23, 59, 59, 999)
      list = list.filter((r) => new Date(r.date) <= to)
    }
    return list
  }, [receipts, receiptSearch, receiptDateFrom, receiptDateTo])

  useEffect(() => {
    if (token && !user) {
      fetchProfile(token)
        .then((data) => setUser(data))
        .catch(() => {
          setUser(null)
          setToken(null)
          localStorage.removeItem('access')
          localStorage.removeItem('refresh')
        })
    }
  }, [token, user])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = event.currentTarget
    const data = new FormData(form)
    const emailOrPhone = String(data.get('email_or_phone') || '')
    const password = String(data.get('password') || '')

    if (!emailOrPhone || !password) {
      setError('Please enter credentials.')
      return
    }

    setLoading(true)
    try {
      const result = await login(emailOrPhone, password)
      setToken(result.access)
      setRefreshToken(result.refresh)
      localStorage.setItem('access', result.access)
      localStorage.setItem('refresh', result.refresh)
      setUser(result.user)
      setSection('dashboard')
      setError(null)
    } catch (err) {
      setError('Login failed. Check credentials or server settings.')
    } finally {
      setLoading(false)
    }
  }

  async function loadDashboard() {
    if (!token) return
    setLoading(true)
    try {
      const [data, orderData] = await Promise.all([fetchDashboard(token), fetchOrders(token)])
      setSummary(data.summary)
      setOrders(orderData)
    } catch (err) {
      setError('Unable to load dashboard metrics.')
    } finally {
      setLoading(false)
    }
  }

  async function loadProducts() {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetchProducts(token, searchTerm)
      setProducts(data.results)
    } catch (err) {
      setError('Unable to load products.')
    } finally {
      setLoading(false)
    }
  }

  async function loadCategories() {
    setLoading(true)
    try {
      const data = await fetchCategories()
      setCategories(data)
    } catch (err) {
      setError('Unable to load categories.')
    } finally {
      setLoading(false)
    }
  }

  async function loadBrands() {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetchBrands(token)
      setBrands(data)
    } catch (err) {
      setError('Unable to load brands.')
    } finally {
      setLoading(false)
    }
  }

  async function loadInventory() {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetchInventory(token)
      setInventory(data)
    } catch (err) {
      setError('Unable to load inventory.')
    } finally {
      setLoading(false)
    }
  }

  async function loadReceipts() {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetchReceipts(token)
      setReceipts(data)
      if (!selectedReceiptId && data.length > 0) {
        setSelectedReceiptId(data[0].id)
      }
    } catch (err) {
      setError('Unable to load receipts.')
    } finally {
      setLoading(false)
    }
  }

  async function loadCustomers() {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetchCustomers(token)
      setCustomers(data)
    } catch (err) {
      setError('Unable to load customers.')
    } finally {
      setLoading(false)
    }
  }

  async function loadOrders() {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetchOrders(token)
      setOrders(data)
    } catch (err) {
      setError('Unable to load orders.')
    } finally {
      setLoading(false)
    }
  }

  async function loadPayments() {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetchPayments(token)
      setPayments(data)
    } catch (err) {
      setError('Unable to load payments.')
    } finally {
      setLoading(false)
    }
  }

  async function loadDeliveries() {
    if (!token) return
    setLoading(true)
    try {
      const data = await fetchDeliveries(token)
      setDeliveries(data)
    } catch (err) {
      setError('Unable to load deliveries.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    setLoading(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      await createCategory(token, {
        category_name: String(data.get('category_name') || ''),
        description: String(data.get('description') || ''),
      })
      event.currentTarget.reset()
      loadCategories()
    } catch (err) {
      setError('Unable to create category.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateBrand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    setLoading(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      await createBrand(token, {
        brand_name: String(data.get('brand_name') || ''),
        description: String(data.get('description') || ''),
        country: String(data.get('country') || ''),
      })
      event.currentTarget.reset()
      loadBrands()
    } catch (err) {
      setError('Unable to create brand.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    const formData = new FormData(event.currentTarget)
    if (!formData.get('product_name') || !formData.get('category_id') || !formData.get('brand_id')) {
      setError('Product name, category and brand are required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await createProduct(token, formData)
      event.currentTarget.reset()
      loadProducts()
    } catch (err) {
      setError('Unable to create product.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateStock(productId: number, change: number) {
    if (!token) return
    setLoading(true)
    try {
      await updateInventory(token, productId, change)
      loadInventory()
    } catch (err) {
      setError('Unable to update inventory.')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmOrder(orderId: number) {
    if (!token) return
    setLoading(true)
    try {
      await confirmOrder(token, orderId)
      loadOrders()
    } catch (err) {
      setError('Unable to confirm order.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelOrder(orderId: number) {
    if (!token) return
    setLoading(true)
    try {
      await cancelOrder(token, orderId)
      loadOrders()
    } catch (err) {
      setError('Unable to cancel order.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateOrderStatus(orderId: number, statusValue: string) {
    if (!token) return
    setLoading(true)
    try {
      await updateOrderStatus(token, orderId, statusValue)
      loadOrders()
    } catch (err) {
      setError('Unable to update order status.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteProduct(productId: number) {
    if (!token) return
    setLoading(true)
    try {
      await deleteProduct(token, productId)
      loadProducts()
    } catch (err) {
      setError('Unable to delete product.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLoadReport(type: string) {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchReports(token, type)
      setReportData(data)
    } catch (err) {
      setError('Unable to load report.')
    } finally {
      setLoading(false)
    }
  }

  const title = getSectionTitle(section, user?.role)

  const lowStockItems = useMemo(
    () => inventory.filter((item) => item.current_stock <= item.reorder_level),
    [inventory],
  )

  const pendingOrders = useMemo(
    () => orders.filter((order) => ['Pending', 'Processing', 'Packed', 'Out for Delivery'].includes(order.order_status)),
    [orders],
  )

  const pendingDeliveries = useMemo(
    () => deliveries.filter((delivery) => ['Preparing', 'Packed', 'Out for Delivery'].includes(delivery.delivery_status)),
    [deliveries],
  )

  const alerts = useMemo(() => {
    const items = [] as Array<{ type: string; title: string; detail: string }>
    if (lowStockItems.length > 0) {
      items.push({
        type: 'low-stock',
        title: `${lowStockItems.length} low-stock item${lowStockItems.length > 1 ? 's' : ''}`,
        detail: lowStockItems.slice(0, 2).map((item) => `${item.product} (${item.current_stock})`).join(', '),
      })
    }
    if (pendingOrders.length > 0) {
      items.push({
        type: 'orders',
        title: `${pendingOrders.length} new or active order${pendingOrders.length > 1 ? 's' : ''}`,
        detail: pendingOrders.slice(0, 2).map((order) => `${order.order_number}`).join(', '),
      })
    }
    if (pendingDeliveries.length > 0) {
      items.push({
        type: 'deliveries',
        title: `${pendingDeliveries.length} pending delivery${pendingDeliveries.length > 1 ? 's' : ''}`,
        detail: pendingDeliveries.slice(0, 2).map((delivery) => `${delivery.order_number}`).join(', '),
      })
    }
    return items
  }, [lowStockItems, pendingOrders, pendingDeliveries])

  const prioritizedSummary = useMemo(() => {
    if (!summary) return []
    const preferredEntries: Array<[keyof DashboardSummary, string]> = [
      ['pending_orders', 'Pending orders'],
      ['low_stock_products', 'Low stock'],
      ['out_of_stock_products', 'Out of stock'],
      ['revenue_today', 'Revenue today'],
      ['orders_today', 'Orders today'],
      ['delivered_orders', 'Delivered'],
    ]

    return preferredEntries
      .map(([key, label]) => {
        const value = summary[key]
        if (value == null) return null
        return {
          label,
          value: typeof value === 'number' ? value.toLocaleString() : value,
        }
      })
      .filter(Boolean) as Array<{ label: string; value: string }>
  }, [summary])

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = [product.product_name, product.sku, product.status].some((value) =>
        String(value || '').toLowerCase().includes(searchTerm.toLowerCase()),
      )
      const matchesCategory = !productCategoryFilter || product.category?.category_name === productCategoryFilter
      const matchesBrand = !productBrandFilter || product.brand?.brand_name === productBrandFilter
      const matchesStatus = !productStatusFilter || product.status === productStatusFilter
      return matchesSearch && matchesCategory && matchesBrand && matchesStatus
    })
  }, [products, productBrandFilter, productCategoryFilter, productStatusFilter, searchTerm])

  const handleSelectReceipt = (receiptId: number) => {
    setSelectedReceiptId(receiptId)
    setShowReceiptPreview(false)
  }

  const printReceipt = () => {
    setShowReceiptPreview(true)
    window.setTimeout(() => window.print(), 150)
  }

  const downloadReceiptPdf = async (receipt: Receipt) => {
    if (!token) return
    setError(null)
    try {
      const blob = await fetchReceiptPdf(token, receipt.id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${receipt.receipt_number}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError('Unable to download receipt PDF.')
    }
  }

  const handleConfirmDelivery = (deliveryId: number) => {
    setDeliveries((current) => {
      const matchingDelivery = current.find((item) => item.id === deliveryId)
      if (matchingDelivery) {
        setOrders((orderCurrent) =>
          orderCurrent.map((order) =>
            order.order_number === matchingDelivery.order_number ? { ...order, order_status: 'Delivered' } : order,
          ),
        )
      }

      return current.map((item) => (item.id === deliveryId ? { ...item, delivery_status: 'Delivered' } : item))
    })
  }

  const sectionContent = useMemo(() => {
    if (!isLoggedIn) return null

    if (section === 'dashboard') {
      return (
        <>
          <div className="hero-card">
            <div>
              <p className="small-text">Mobile-first overview</p>
              <h2>Keep stock, orders, and deliveries moving without the clutter.</h2>
            </div>
            <div className="hero-actions">
              <button type="button" className="secondary" onClick={() => setSection('inventory')}>
                Reorder stock
              </button>
              <button type="button" className="secondary" onClick={() => setSection('orders')}>
                Review orders
              </button>
            </div>
          </div>

          <div className="cards compact-cards">
            {prioritizedSummary.map((item) => (
              <div className="card overview-card" key={item.label}>
                <p className="small-text">{item.label}</p>
                <h2>{item.value}</h2>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="section-toolbar">
              <h3 className="section-title">Priority alerts</h3>
              <div className="chip-row">
                <span className="tag">{lowStockItems.length} low stock</span>
                <span className="tag">{pendingOrders.length} active orders</span>
                <span className="tag">{pendingDeliveries.length} pending deliveries</span>
              </div>
            </div>
            {alerts.length > 0 ? (
              <div className="alert-list">
                {alerts.map((alert) => (
                  <div className={`alert-banner ${alert.type}`} key={alert.title}>
                    <strong>{alert.title}</strong>
                    <span>{alert.detail}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="small-text">Everything is looking steady right now.</p>
            )}
          </div>

          <div className="card">
            <div className="section-toolbar">
              <h3 className="section-title">Quick actions</h3>
            </div>
            <div className="quick-actions">
              <button type="button" className="secondary" onClick={() => setSection('inventory')}>
                Reorder stock
              </button>
              <button type="button" className="secondary" onClick={() => setSection('orders')}>
                Confirm pending orders
              </button>
              <button type="button" className="secondary" onClick={() => setSection('receipts')}>
                View receipts
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Recent Orders</h3>
            {isMobile ? (
              <div className="mobile-card-list">
                {orders.length > 0 ? (
                  orders.slice(0, 5).map((order) => (
                    <div className="mobile-card-item" key={order.id}>
                      <div className="mobile-card-title-row">
                        <strong>{order.order_number}</strong>
                        <span className={`status-pill ${order.order_status.toLowerCase().replace(/\s+/g, '-')}`}>{order.order_status}</span>
                      </div>
                      <p className="small-text">{order.customer}</p>
                      <p className="small-text">Total: {order.total_amount.toLocaleString()} • {order.payment_status}</p>
                    </div>
                  ))
                ) : (
                  <p className="small-text">No recent orders available.</p>
                )}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length > 0 ? (
                      orders.slice(0, 5).map((order) => (
                        <tr key={order.id}>
                          <td>{order.order_number}</td>
                          <td>{order.customer}</td>
                          <td>{order.total_amount.toLocaleString()}</td>
                          <td>{order.order_status}</td>
                          <td>{order.payment_status}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5}>No recent orders available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )
    }

    if (section === 'products') {
      return (
        <div className="card">
          <div className="section-toolbar" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>Product Management</h2>
            <div className="chip-row">
              <button type="button" className="secondary" onClick={() => setShowProductForm((open) => !open)}>
                {showProductForm ? '✕ Close' : '+ New product'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowProductCatalog((open) => !open)}
              >
                {showProductCatalog ? '✕ Hide' : '📋 Show catalog'}
              </button>
            </div>
          </div>

          {showProductForm && (
            <>
              <div style={{ paddingBottom: '2rem', borderBottom: '1px solid #e5e7eb', marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: '600', color: '#1f2937' }}>Add New Product</h3>
                {isMobile ? (
                  <form onSubmit={handleCreateProduct} className="input-group mobile-product-form" encType="multipart/form-data">
                    <input name="product_name" placeholder="Product name" />
                    <input name="sku" placeholder="SKU" />
                    <input name="selling_price" placeholder="Selling price" type="number" />
                    <input name="quantity_in_stock" placeholder="Stock" type="number" />
                    <select name="category_id" defaultValue="">
                      <option value="" disabled>
                        Choose category
                      </option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.category_name}
                        </option>
                      ))}
                    </select>
                    <select name="brand_id" defaultValue="">
                      <option value="" disabled>
                        Choose brand
                      </option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.brand_name}
                        </option>
                      ))}
                    </select>
                    <label className="file-input-label">
                      Upload images (up to 4)
                      <input name="images" type="file" accept="image/*" multiple />
                    </label>
                    <button type="submit" disabled={loading}>
                      Create product
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleCreateProduct} className="input-group" encType="multipart/form-data">
                    <input name="product_name" placeholder="Product name" />
                    <input name="sku" placeholder="SKU" />
                    <input name="barcode" placeholder="Barcode" />
                    <input name="selling_price" placeholder="Selling price" type="number" />
                    <input name="buying_price" placeholder="Buying price" type="number" />
                    <input name="quantity_in_stock" placeholder="Stock" type="number" />
                    <input name="reorder_level" placeholder="Reorder level" type="number" />
                    <select name="category_id" defaultValue="">
                      <option value="" disabled>
                        Choose category
                      </option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.category_name}
                        </option>
                      ))}
                    </select>
                    <select name="brand_id" defaultValue="">
                      <option value="" disabled>
                        Choose brand
                      </option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.brand_name}
                        </option>
                      ))}
                    </select>
                    <input name="image_url" placeholder="Main image URL (optional)" />
                    <label className="file-input-label">
                      Upload images (up to 4)
                      <input name="images" type="file" accept="image/*" multiple />
                    </label>
                    <textarea name="description" placeholder="Description" rows={3} />
                    <button type="submit" disabled={loading}>
                      Create product
                    </button>
                  </form>
                )}
              </div>
            </>
          )}

          {showProductCatalog && (
            <>
              <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: '600', color: '#1f2937' }}>Product Catalog</h3>
              <div className="filter-stack" style={{ marginBottom: '1.5rem' }}>
                <input
                  placeholder="Search by name, SKU, or status"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && loadProducts()}
                />
                <select value={productCategoryFilter} onChange={(event) => setProductCategoryFilter(event.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.category_name}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
                <select value={productBrandFilter} onChange={(event) => setProductBrandFilter(event.target.value)}>
                  <option value="">All brands</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.brand_name}>
                      {brand.brand_name}
                    </option>
                  ))}
                </select>
                <select value={productStatusFilter} onChange={(event) => setProductStatusFilter(event.target.value)}>
                  <option value="">All statuses</option>
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
                <button type="button" className="secondary" onClick={() => loadProducts()}>
                  Search
                </button>
              </div>
              {isMobile ? (
                <div className="mobile-card-list">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <div className="mobile-card-item" key={product.id}>
                        <div className="mobile-card-title-row">
                          <strong>{product.product_name}</strong>
                          <span className={`status-pill ${product.status.toLowerCase().replace(/\s+/g, '-')}`}>{product.status}</span>
                        </div>
                        <p className="small-text">{product.category?.category_name || '—'} • {product.brand?.brand_name || '—'}</p>
                        <p className="small-text">SKU: {product.sku || '—'} • Stock: {product.quantity_in_stock}</p>
                        <div className="mobile-card-actions">
                          <button type="button" onClick={() => handleDeleteProduct(product.id)} className="secondary">
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="small-text">No products found.</p>
                  )}
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Brand</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((product) => (
                          <tr key={product.id}>
                            <td>{product.product_name}</td>
                            <td>{product.category?.category_name}</td>
                            <td>{product.brand?.brand_name}</td>
                            <td>{product.selling_price.toLocaleString()}</td>
                            <td>{product.quantity_in_stock}</td>
                            <td>{product.status}</td>
                            <td>
                              <button type="button" onClick={() => handleDeleteProduct(product.id)} className="secondary">
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7}>No products found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {!showProductForm && !showProductCatalog && (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#6b7280' }}>
              <p style={{ margin: 0, fontSize: '1rem' }}>Click the buttons above to add a new product or view your catalog.</p>
            </div>
          )}
        </div>
      )
    }

    if (section === 'categories') {
      return (
        <>
          <div className="card">
            <form onSubmit={handleCreateCategory} className="input-group">
              <h3 className="section-title">New category</h3>
              <input name="category_name" placeholder="Category name" />
              <textarea name="description" placeholder="Description" rows={2} />
              <button type="submit" disabled={loading}>
                Add category
              </button>
            </form>
          </div>
          <div className="card">
            <h3 className="section-title">Categories</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.category_name}</td>
                    <td>{category.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )
    }

    if (section === 'brands') {
      return (
        <>
          <div className="card">
            <form onSubmit={handleCreateBrand} className="input-group">
              <h3 className="section-title">New brand</h3>
              <input name="brand_name" placeholder="Brand name" />
              <input name="country" placeholder="Country" />
              <textarea name="description" placeholder="Description" rows={2} />
              <button type="submit" disabled={loading}>
                Add brand
              </button>
            </form>
          </div>
          <div className="card">
            <h3 className="section-title">Brands</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Country</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((brand) => (
                  <tr key={brand.id}>
                    <td>{brand.brand_name}</td>
                    <td>{brand.country || '—'}</td>
                    <td>{brand.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )
    }

    if (section === 'inventory') {
      return (
        <div className="card">
          <div className="section-toolbar">
            <h3 className="section-title">Inventory</h3>
            <span className="tag">{lowStockItems.length} items need reorder</span>
          </div>
          {isMobile ? (
            <div className="mobile-card-list">
              {inventory.map((item) => (
                <div className="mobile-card-item" key={item.id}>
                  <div className="mobile-card-title-row">
                    <strong>{item.product}</strong>
                    <span className={`status-pill ${item.stock_status.toLowerCase().replace(/\s+/g, '-')}`}>{item.stock_status}</span>
                  </div>
                  <p className="small-text">Stock: {item.current_stock} • Reorder: {item.reorder_level}</p>
                  <div className="mobile-card-actions">
                    <button type="button" onClick={() => handleUpdateStock(item.id, 1)} className="secondary">
                      +1
                    </button>
                    <button type="button" onClick={() => handleUpdateStock(item.id, item.reorder_level)} className="secondary">
                      Reorder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Stock</th>
                    <th>Reorder</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product}</td>
                      <td>{item.current_stock}</td>
                      <td>{item.reorder_level}</td>
                      <td>{item.stock_status}</td>
                      <td>
                        <button type="button" onClick={() => handleUpdateStock(item.id, 1)} className="secondary">
                          +1
                        </button>
                        <button type="button" onClick={() => handleUpdateStock(item.id, item.reorder_level)} className="secondary">
                          Reorder
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )
    }

    if (section === 'customers') {
      return (
        <div className="card">
          <h3 className="section-title">Customers</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Salon</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Orders</th>
                <th>Spent</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.customer_name}</td>
                  <td>{customer.salon_name || '—'}</td>
                  <td>{customer.email}</td>
                  <td>{customer.phone || '—'}</td>
                  <td>{customer.number_of_orders}</td>
                  <td>{customer.total_purchases.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (section === 'orders') {
      return (
        <div className="card">
          <div className="section-toolbar" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>Order Management</h2>
            <span className="tag" style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}>{pendingOrders.length} pending</span>
          </div>

          {error && (
            <div style={{ padding: '1rem', marginBottom: '1.5rem', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.5rem', color: '#78350f' }}>
              {error}
            </div>
          )}

          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#6b7280' }}>
              <p style={{ margin: 0, fontSize: '1rem' }}>No orders available.</p>
            </div>
          ) : isMobile ? (
            <div className="mobile-card-list">
              {orders.map((order) => (
                <div className="mobile-card-item" key={order.id}>
                  <div className="mobile-card-title-row">
                    <strong>{order.order_number}</strong>
                    <span className={`status-pill ${order.order_status.toLowerCase().replace(/\s+/g, '-')}`}>{order.order_status}</span>
                  </div>
                  <p className="small-text">{order.customer} • {order.total_amount.toLocaleString()}</p>
                  <p className="small-text">Payment: {order.payment_status}</p>
                  <div className="mobile-card-actions">
                    <button type="button" onClick={() => handleConfirmOrder(order.id)} className="secondary">
                      Confirm
                    </button>
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value) {
                          handleUpdateOrderStatus(order.id, event.target.value)
                          event.target.value = ''
                        }
                      }}
                    >
                      <option value="">Status</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Processing">Processing</option>
                      <option value="Packed">Packed</option>
                      <option value="Out for Delivery">Out for Delivery</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.order_number}</td>
                      <td>{order.customer}</td>
                      <td>{order.total_amount.toLocaleString()}</td>
                      <td>{order.payment_status}</td>
                      <td>{order.order_status}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => handleConfirmOrder(order.id)} className="secondary" style={{ fontSize: '0.875rem', padding: '0.4rem 0.8rem' }}>
                            Confirm
                          </button>
                          <button type="button" onClick={() => handleCancelOrder(order.id)} className="secondary" style={{ fontSize: '0.875rem', padding: '0.4rem 0.8rem' }}>
                            Cancel
                          </button>
                          <select
                            defaultValue=""
                            onChange={(event) => {
                              if (event.target.value) {
                                handleUpdateOrderStatus(order.id, event.target.value)
                                event.target.value = ''
                              }
                            }}
                            style={{ fontSize: '0.875rem', padding: '0.4rem 0.8rem' }}
                          >
                            <option value="">Update status</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Processing">Processing</option>
                            <option value="Packed">Packed</option>
                            <option value="Out for Delivery">Out for Delivery</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )
    }

    if (section === 'payments') {
      return (
        <div className="card">
          <h3 className="section-title">Payments</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.order_number}</td>
                  <td>{payment.customer}</td>
                  <td>{payment.amount.toLocaleString()}</td>
                  <td>{payment.payment_method}</td>
                  <td>{payment.payment_status}</td>
                  <td>{payment.payment_date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (section === 'deliveries') {
      return (
        <div className="card">
          <div className="section-toolbar" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>Delivery Management</h2>
            <span className="tag" style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}>{pendingDeliveries.length} pending</span>
          </div>

          {deliveries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#6b7280' }}>
              <p style={{ margin: 0, fontSize: '1rem' }}>No deliveries available.</p>
            </div>
          ) : isMobile ? (
            <div className="mobile-card-list">
              {deliveries.map((delivery) => (
                <div className="mobile-card-item" key={delivery.id}>
                  <div className="mobile-card-title-row">
                    <strong>{delivery.order_number}</strong>
                    <span className={`status-pill ${delivery.delivery_status.toLowerCase().replace(/\s+/g, '-')}`}>{delivery.delivery_status}</span>
                  </div>
                  <p className="small-text">{delivery.customer}</p>
                  <p className="small-text">{delivery.delivery_address}</p>
                  <p className="small-text">Delivery Date: {delivery.delivery_date || '—'}</p>
                  <div className="mobile-card-actions">
                    <button type="button" className="secondary" onClick={() => handleConfirmDelivery(delivery.id)}>
                      Confirm delivery
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Address</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td>{delivery.order_number}</td>
                      <td>{delivery.customer}</td>
                      <td>{delivery.delivery_address}</td>
                      <td>{delivery.delivery_status}</td>
                      <td>{delivery.delivery_date || '—'}</td>
                      <td>
                        <button type="button" className="secondary" onClick={() => handleConfirmDelivery(delivery.id)} style={{ fontSize: '0.875rem', padding: '0.4rem 0.8rem' }}>
                          Confirm delivery
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )
    }

    if (section === 'receipts') {
      const selectedReceipt = receipts.find((item) => item.id === selectedReceiptId) || receipts[0] || null
      return (
        <div className="card receipt-card">
          <div className="receipt-toolbar">
            <div>
              <h3 className="section-title">Receipts</h3>
              <p className="small-text">Manage completed invoices and print polished receipt summaries for customers.</p>
            </div>
            <div className="receipt-toolbar-actions">
              <button type="button" className="secondary" onClick={() => setSection('orders')}>
                Review orders
              </button>
              <button type="button" className="secondary" onClick={() => setShowReceiptPreview((value) => !value)}>
                {showReceiptPreview ? 'Back to list' : 'Preview receipt'}
              </button>
              <button type="button" className="primary" onClick={printReceipt}>
                Print receipt
              </button>
            </div>
          </div>

          {receipts.length === 0 ? (
            <div className="empty-state">
              <p className="small-text">No receipts issued yet. Refresh after an order is completed.</p>
              <button type="button" onClick={loadReceipts}>
                Refresh receipts
              </button>
            </div>
          ) : (
            <div className={`receipt-grid ${showReceiptPreview ? 'preview-mode' : ''}`}>
              <div className="receipt-list">
                <div style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input aria-label="Receipt date from" type="date" value={receiptDateFrom} onChange={(e) => setReceiptDateFrom(e.target.value)} className="input" style={{ padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <input aria-label="Receipt date to" type="date" value={receiptDateTo} onChange={(e) => setReceiptDateTo(e.target.value)} className="input" style={{ padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  </div>
                  <input
                    aria-label="Search receipts"
                    placeholder="Search receipts by number, order or customer"
                    value={receiptSearch}
                    onChange={(e) => setReceiptSearch(e.target.value)}
                    className="input"
                    style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0' }}
                  />
                </div>
                {filteredReceipts.map((receipt) => (
                  <button
                    key={receipt.id}
                    type="button"
                    className={`receipt-item ${receipt.id === selectedReceipt?.id ? 'active' : ''}`}
                    onClick={() => handleSelectReceipt(receipt.id)}
                  >
                    <div className="receipt-item-heading">
                      <strong>{receipt.receipt_number}</strong>
                      <span>{receipt.date}</span>
                    </div>
                    <div className="small-text">{receipt.customer}</div>
                    <div className="receipt-item-meta">
                      <span>Order {receipt.order_number}</span>
                      <span>${receipt.amount.toLocaleString()}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="receipt-detail">
                {selectedReceipt ? (
                  <div className="receipt-preview-card">
                    <div className="receipt-header">
                      <div>
                        <p className="small-text">Receipt</p>
                        <h4>{selectedReceipt.receipt_number}</h4>
                      </div>
                      <div className="tag">Paid</div>
                    </div>

                    <div className="receipt-summary-grid">
                      <div>
                        <p className="small-text">Order reference</p>
                        <strong>{selectedReceipt.order_number}</strong>
                      </div>
                      <div>
                        <p className="small-text">Customer</p>
                        <strong>{selectedReceipt.customer}</strong>
                      </div>
                      <div>
                        <p className="small-text">Date</p>
                        <strong>{selectedReceipt.date}</strong>
                      </div>
                      <div>
                        <p className="small-text">Total</p>
                        <strong>${selectedReceipt.amount.toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className="receipt-footer">
                      <p className="small-text">This receipt confirms the completed transaction. Store it for record keeping and customer support.</p>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <label className="field-label">
                        Send receipt to email
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input aria-label="Recipient email" value={emailToSend} onChange={(e) => setEmailToSend(e.target.value)} placeholder="customer@example.com" />
                          <button
                            type="button"
                            className="secondary"
                            disabled={!emailToSend || sendingEmail === selectedReceipt.id}
                            onClick={async () => {
                              if (!token || !selectedReceipt) return
                              setSendingEmail(selectedReceipt.id)
                              setSendStatus(null)
                              try {
                                const res = await sendReceiptEmail(token, selectedReceipt.id, { email: emailToSend })
                                setSendStatus('Sent successfully')
                                // if server returned pdf_url, update local selectedReceipt
                                if ((res as any)?.pdf_url) {
                                  selectedReceipt.pdf_url = (res as any).pdf_url
                                }
                              } catch (err) {
                                setSendStatus('Failed to send')
                              } finally {
                                setSendingEmail(null)
                              }
                            }}
                          >
                            Send
                          </button>
                          <button
                            type="button"
                            className="primary"
                            onClick={() => selectedReceipt && downloadReceiptPdf(selectedReceipt)}
                          >
                            Download PDF
                          </button>
                        </div>
                      </label>
                      {sendStatus ? <p className="small-text">{sendStatus}</p> : null}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p className="small-text">Select a receipt to see the full details.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (section === 'reports') {
      return (
        <div className="card">
          <h3 className="section-title">Reports</h3>
          <div className="input-group">
            <button type="button" onClick={() => handleLoadReport('sales')}>
              Load sales report
            </button>
            <button type="button" onClick={() => handleLoadReport('orders')}>
              Load orders report
            </button>
            <button type="button" onClick={() => handleLoadReport('products')}>
              Load products report
            </button>
            <button type="button" onClick={() => handleLoadReport('customers')}>
              Load customers report
            </button>
          </div>
          {reportData ? <pre>{JSON.stringify(reportData, null, 2)}</pre> : <p>Select a report to load.</p>}
        </div>
      )
    }

    return <p>Section not found.</p>
  }, [section, isLoggedIn, summary, products, categories, brands, inventory, customers, orders, payments, deliveries, receipts, reportData, searchTerm, loading, lowStockItems, pendingOrders, pendingDeliveries, alerts, filteredProducts, isMobile, showProductForm, showProductCatalog, showReceiptPreview, selectedReceiptId])

  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h2>Seller / Admin Dashboard</h2>
          <form onSubmit={handleLogin} className="input-group">
            <input name="email_or_phone" placeholder="Email or phone" />
            <input name="password" placeholder="Password" type="password" />
            <button type="submit" disabled={loading}>
              Sign in
            </button>
          </form>
          {error ? <div className="alert">{error}</div> : null}
          <p className="small-text">Use your admin account to access product, order, and customer management.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div>
            <h1>{user?.role?.toLowerCase() === 'seller' ? 'Seller dashboard' : 'Admin dashboard'}</h1>
            {user?.role?.toLowerCase() === 'seller' ? <p className="sidebar-subtitle">Fast seller tools</p> : null}
          </div>
          <button type="button" className="sidebar-collapse-toggle" onClick={() => setSidebarCollapsed((value) => !value)}>
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>
        <nav>
          <ul className="nav-list">
            {availableSections.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className={`nav-button ${item === section ? 'active' : ''}`}
                  data-abbrev={sectionTitles[item].slice(0, 1)}
                  onClick={() => {
                    setSection(item)
                    setSidebarOpen(false)
                  }}
                >
                  <span className="nav-label">{getSectionTitle(item, user?.role)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const clearAuth = () => {
                localStorage.removeItem('access')
                localStorage.removeItem('refresh')
                setToken(null)
                setRefreshToken(null)
                setUser(null)
                setError(null)
                setSidebarOpen(false)
              }

              if (token) {
                logout(token).catch(() => undefined).finally(clearAuth)
              } else {
                clearAuth()
              }
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />
      {isMobile ? (
        <div className="mobile-shortcut-bar">
          {(['dashboard', 'products', 'inventory', 'orders', 'receipts'] as Section[]).filter((item) => availableSections.includes(item)).map((item) => (
            <button
              key={item}
              type="button"
              className={`shortcut-pill ${item === section ? 'active' : ''}`}
              onClick={() => setSection(item)}
            >
              {getSectionTitle(item, user?.role)}
            </button>
          ))}
        </div>
      ) : null}
      <main className="main-content">
        <div className="page-header">
          <div className="header-left">
            <button type="button" className="sidebar-toggle" onClick={() => setSidebarOpen((open) => !open)}>
              ☰
            </button>
            <div>
              <h1>{title}</h1>
              {user ? <p className="small-text">Signed in as {user.first_name} {user.last_name} ({user.role})</p> : null}
            </div>
          </div>
          {loading ? <span className="tag">Loading…</span> : null}
        </div>
        {error ? <div className="alert">{error}</div> : null}
        {sectionContent}
      </main>
    </div>
  )
}

export default App
