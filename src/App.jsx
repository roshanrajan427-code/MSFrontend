import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import './App.css'
import { api, jsonOptions } from './services/api.js'
import ErrorMessage from './components/ErrorMessage.jsx'
import Header from './components/Header.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ShopDetails from './pages/ShopDetails.jsx'
import Cart from './pages/Cart.jsx'
import Orders from './pages/Orders.jsx'
import SellerOrders from './pages/SellerOrders.jsx'

const emptyShop = { name: '', category: 'Food', location: '' }
const emptyProduct = { name: '', stock: '0', price: '', color: '', size: '', image: null }

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [screen, setScreen] = useState('phone')
  const [token, setToken] = useState('')
  const [user, setUser] = useState(null)
  const [mobileNumber, setMobileNumber] = useState('')
  const [onboardingToken, setOnboardingToken] = useState('')
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', role: 'customer' })
  const [otp, setOtp] = useState('0000')
  const [shopForm, setShopForm] = useState(emptyShop)
  const [editingShopId, setEditingShopId] = useState(null)
  const [showShopForm, setShowShopForm] = useState(false)
  const [selectedShop, setSelectedShop] = useState(null)
  const [managingProducts, setManagingProducts] = useState(false)
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [productForm, setProductForm] = useState(emptyProduct)
  const [editingProductId, setEditingProductId] = useState(null)
  const [productSaving, setProductSaving] = useState(false)
  // A cart belongs to the current browser session. Server restarts do not
  // clear localStorage, so keep it in memory instead of restoring old items.
  const [cart, setCart] = useState([])
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [myOrders, setMyOrders] = useState([])
  const [myOrdersLoading, setMyOrdersLoading] = useState(false)

  useEffect(() => { window.localStorage.removeItem('mini-shop-cart') }, [])

  useEffect(() => {
    if (pathname !== '/orders' || !token || user?.role !== 'customer') return undefined
    const refreshOrders = () => api('/my/orders', { headers: { Authorization: `Bearer ${token}` } }).then(setMyOrders).catch(() => {})
    refreshOrders()
    const timer = window.setInterval(refreshOrders, 15000)
    return () => window.clearInterval(timer)
  }, [pathname, token, user?.role])

  function setShopInURL(shopId) {
    if (shopId) navigate(`/shops/?shop=${encodeURIComponent(shopId)}`)
    else navigate('/dashboard')
  }

  async function loadShops(authToken = token) {
    setLoading(true)
    try {
      const shopList = await api('/shops', authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {})
      setShops(shopList)
      setError('')
      return shopList
    } catch {
      setError('Could not connect to the backend. Make sure the Go server is running.')
      return []
    } finally {
      setLoading(false)
    }
  }

  async function loadProducts(shop, manage = false, updateRoute = true) {
    setSelectedShop(shop)
    if (updateRoute) setShopInURL(shop.id)
    setManagingProducts(manage)
    setEditingProductId(null)
    setProductForm(emptyProduct)
    setProductsError('')
    setProductsLoading(true)
    try {
      setProducts(await api(`/shops/${shop.id}/products`))
    } catch (err) {
      setProductsError(err.message || 'Could not load products')
    } finally {
      setProductsLoading(false)
    }
  }

  function addToCart(product, shop) {
    if (Number(product.stock) < 1) return
    setCart((current) => {
      const existing = current.find((item) => Number(item.product_id) === Number(product.id))
      if (existing) return current.map((item) => Number(item.product_id) === Number(product.id)
        ? { ...item, quantity: Math.min(item.quantity + 1, Number(product.stock)) }
        : item)
      return [...current, {
        product_id: product.id,
        shop_id: shop.id,
        shop_name: shop.name,
        name: product.name,
        price: Number(product.price),
        color: product.color,
        size: product.size,
        image_url: product.image_url,
        stock: Number(product.stock),
        quantity: 1,
      }]
    })
    setMessage(`${product.name} added to cart.`)
  }

  function changeCartQuantity(productId, quantity) {
    if (quantity < 1) return
    setCart((current) => current.map((item) => Number(item.product_id) === Number(productId)
      ? { ...item, quantity: Math.min(quantity, item.stock) }
      : item))
  }

  async function placeOrder() {
    setError('')
    if (cart.length === 0) return setError('Your cart is empty.')
    if (!user) {
      navigate('/login')
      setMessage('Sign in or create a customer account to continue checkout. Your cart is saved.')
      return
    }
    if (user.role !== 'customer') return setError('A customer account is required to place an order.')
    try {
      const result = await api('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: cart.map(({ product_id, quantity }) => ({ product_id, quantity })) }),
      })
      setCart([])
      setMessage(`Order placed. ${result.order_ids.length} seller order${result.order_ids.length === 1 ? '' : 's'} sent for review.`)
      navigate('/orders')
      await loadMyOrders()
      if (selectedShop) await loadProducts(selectedShop, false, false)
    } catch (err) { setError(err.message || 'Could not place order') }
  }

  async function loadOrders() {
    setOrdersLoading(true)
    try {
      setOrders(await api('/seller/orders', { headers: { Authorization: `Bearer ${token}` } }))
    } catch (err) { setError(err.message || 'Could not load orders') }
    finally { setOrdersLoading(false) }
  }

  useEffect(() => {
    if (pathname === '/seller/orders' && token && user?.role === 'seller') loadOrders()
  }, [pathname, token, user?.role])
  async function loadMyOrders() {
    setMyOrdersLoading(true)
    try {
      setMyOrders(await api('/my/orders', { headers: { Authorization: `Bearer ${token}` } }))
    } catch (err) { setError(err.message || 'Could not load your orders') }
    finally { setMyOrdersLoading(false) }
  }

  async function updateOrderStatus(order, status) {
    try {
      await api(`/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      setMessage(`Order #${order.id} ${status}.`)
      await loadOrders()
    } catch (err) { setError(err.message || 'Could not update order') }
  }

  useEffect(() => {
    function restoreShop(shopList) {
      const shopId = new URLSearchParams(window.location.search).get('shop')
      if (!shopId) return
      const shop = shopList.find((item) => String(item.id) === shopId)
      if (shop) loadProducts(shop)
      else setShopInURL(null)
    }

    const savedToken = window.localStorage.getItem('mini-shop-token')
    if (!savedToken) {
      loadShops('').then(restoreShop).finally(() => setAuthReady(true))
      return
    }
    api('/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } })
      .then((savedUser) => {
        setToken(savedToken)
        setUser(savedUser)
        setScreen('home')
        return loadShops(savedToken).then(restoreShop)
      })
      .catch(() => {
        window.localStorage.removeItem('mini-shop-token')
        return loadShops('').then(restoreShop)
      })
      .finally(() => setAuthReady(true))
  }, [])

  useEffect(() => {
    if (!authReady) return
    const protectedPaths = ['/dashboard', '/shops', '/cart', '/orders', '/seller/orders']
    if (!user && protectedPaths.some((path) => pathname === path || pathname === `${path}/`)) {
      navigate('/login', { replace: true })
      return
    }
    if (user && (pathname === '/login' || pathname === '/register')) {
      navigate('/dashboard', { replace: true })
      return
    }
    if (user?.role === 'customer' && pathname === '/seller/orders') {
      navigate('/orders', { replace: true })
      return
    }
    if (user?.role === 'seller' && pathname === '/orders') {
      navigate('/seller/orders', { replace: true })
      return
    }
    if (pathname === '/register' && !onboardingToken) navigate('/login', { replace: true })
    if (pathname === '/shops' && location.search) navigate(`/shops/${location.search}`, { replace: true })
    if (pathname === '/shops' && !location.search && !selectedShop) navigate('/dashboard', { replace: true })
  }, [authReady, user, pathname, location.search, onboardingToken, selectedShop, navigate])
  function switchScreen(next) {
    setScreen(next)
    setError('')
    setMessage('')
  }

  async function verifyOTP(event) {
    event.preventDefault()
    setError('')
    if (!/^\d{10,12}$/.test(mobileNumber.trim())) return setError('Enter a valid mobile number containing 10 to 12 digits.')
    try {
      const result = await api('/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile_number: mobileNumber.trim(), otp }) })
      if (result.needs_profile) {
        setOnboardingToken(result.onboarding_token)
        setMessage('Phone verified. Complete your profile to create your account.')
        navigate('/register')
      } else {
        // A browser can be shared by multiple accounts. Never carry the
        // previous visitor's locally saved cart into a signed-in account.
        setCart([])
        window.localStorage.setItem('mini-shop-token', result.token)
        setToken(result.token)
        setUser(result.user)
        navigate('/dashboard')
        setMessage('Signed in successfully.')
        await loadShops(result.token)
      }
    } catch (err) { setError(err.message) }
  }

  async function register(event) {
    event.preventDefault()
    setError('')
    const name = registerForm.name.trim()
    if (!name || name.length > 20) return setError('Username is required and must be at most 20 characters.')
    try {
      const result = await api('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${onboardingToken}` }, body: JSON.stringify({ ...registerForm, name }) })
      setCart([])
      window.localStorage.setItem('mini-shop-token', result.token)
      setToken(result.token)
      setUser(result.user)
      setOnboardingToken('')
      navigate('/dashboard')
      setMessage('Account created and signed in.')
      await loadShops(result.token)
    } catch (err) { setError(err.message) }
  }

  function logout() {
    window.localStorage.removeItem('mini-shop-token')
    setCart([])
    setToken('')
    setUser(null)
    setSelectedShop(null)
    setProducts([])
    setMessage('')
    setError('')
    navigate('/login')
    loadShops('')
  }

  function startCreateShop() {
    setEditingShopId(null)
    setShopForm(emptyShop)
    setShowShopForm(true)
    setError('')
  }

  function startEditShop(shop) {
    setEditingShopId(shop.id)
    setShopForm({ name: shop.name, category: shop.category, location: shop.location })
    setShowShopForm(true)
    setError('')
  }

  async function saveShop(event) {
    event.preventDefault()
    setError('')
    const body = { name: shopForm.name.trim(), category: shopForm.category.trim(), location: shopForm.location.trim() }
    if (!body.name || body.name.length > 50) return setError('Shop name is required and must be at most 50 characters.')
    if (!body.category || body.category.length > 20) return setError('Choose a category of at most 20 characters.')
    if (!body.location || body.location.length > 30) return setError('Location is required and must be at most 30 characters.')
    try {
      const route = editingShopId ? `/shops/${editingShopId}` : '/shops'
      const result = await api(route, jsonOptions(token, editingShopId ? 'PUT' : 'POST', body))
      setShowShopForm(false)
      setEditingShopId(null)
      setShopForm(emptyShop)
      setMessage(editingShopId ? 'Shop updated.' : 'Shop created.')
      await loadShops()
      if (Number(selectedShop?.id) === Number(result.id)) setSelectedShop(result)
    } catch (err) { setError(err.message) }
  }

  async function deleteShop(shop) {
    if (!window.confirm(`Delete “${shop.name}” and its products? This cannot be undone.`)) return
    try {
      await api(`/shops/${shop.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (Number(selectedShop?.id) === Number(shop.id)) { setSelectedShop(null); setShopInURL(null); setProducts([]); setManagingProducts(false) }
      setMessage('Shop deleted.')
      await loadShops()
    } catch (err) { setError(err.message) }
  }

  function startAddProduct() {
    setEditingProductId(null)
    setProductForm(emptyProduct)
  }

  function startEditProduct(product) {
    setEditingProductId(product.id)
    setProductForm({ name: product.name, stock: String(product.stock), price: String(product.price), color: product.color || '', size: product.size || '', image: null })
    setProductsError('')
  }

  async function saveProduct(event) {
    event.preventDefault()
    if (!selectedShop) return
    setProductsError('')
    const body = { name: productForm.name.trim(), stock: Number(productForm.stock), price: Number(productForm.price), color: productForm.color.trim(), size: productForm.size.trim() }
    if (!body.name || body.name.length > 40) return setProductsError('Product name is required and must be at most 40 characters.')
    if (!Number.isInteger(body.stock) || body.stock < 0) return setProductsError('Stock must be a whole number greater than or equal to 0.')
    if (!Number.isFinite(body.price) || body.price < 0) return setProductsError('Price must be a valid number greater than or equal to 0.')
    if (body.color.length > 30 || body.size.length > 30) return setProductsError('Colour and size must be at most 30 characters.')
    if (!editingProductId && products.some((product) => product.name.trim().toLocaleLowerCase() === body.name.toLocaleLowerCase() && product.color === body.color && product.size === body.size)) return setProductsError('This product and variant already exists in this shop.')
    setProductSaving(true)
    try {
      const product = editingProductId
        ? await api(`/products/${editingProductId}`, jsonOptions(token, 'PUT', body))
        : await api(`/shops/${selectedShop.id}/products`, jsonOptions(token, 'POST', { ...body, shop_id: Number(selectedShop.id) }))
      let imageError = ''
      if (productForm.image) {
        const data = new FormData()
        data.append('image', productForm.image)
        try {
          await api(`/products/${product.id}/image`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data })
        } catch (err) { imageError = `Product saved, but its image could not be uploaded: ${err.message}` }
      }
      setProductForm(emptyProduct)
      setEditingProductId(null)
      setMessage(editingProductId ? 'Product updated.' : 'Product added.')
      await loadProducts(selectedShop)
      if (imageError) setProductsError(`${imageError}. Restart the Go backend so the image upload endpoint is available, then edit this product to retry.`)
    } catch (err) { setProductsError(err.message || 'Could not save product') }
    finally { setProductSaving(false) }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete “${product.name}”${product.color || product.size ? ` (${[product.color, product.size].filter(Boolean).join(' / ')})` : ''}? This cannot be undone.`)) return
    setProductsError('')
    try {
      await api(`/products/${product.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      setMessage(`${product.name} deleted.`)
      await loadProducts(selectedShop)
    } catch (err) { setProductsError(err.message || 'Could not delete product') }
  }

  const isOwner = (shop) => user?.role === 'seller' && Number(shop?.owner_id) === Number(user.id)
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)

  return (
    <main className="container py-4 py-md-5">
      {user && <Header
        user={user}
        cartCount={cartCount}
        onCreateShop={startCreateShop}
        onOrders={() => {
          if (user.role === 'seller') {
            loadOrders()
            navigate('/seller/orders')
          } else {
            loadMyOrders()
            navigate('/orders')
          }
        }}
        onCart={() => navigate('/cart')}
        onLogout={logout}
      />}

      {!user && authReady && pathname === '/login' && <Login
        screen={screen}
        setScreen={setScreen}
        mobileNumber={mobileNumber}
        setMobileNumber={setMobileNumber}
        otp={otp}
        setOtp={setOtp}
        onContinue={(event) => {
          event.preventDefault()
          if (!/^\d{10,12}$/.test(mobileNumber.trim())) return setError('Enter a valid mobile number containing 10 to 12 digits.')
          setError('')
          setScreen('otp')
        }}
        onVerify={verifyOTP}
      />}
      {!user && authReady && pathname === '/register' && <Register
        mobileNumber={mobileNumber}
        registerForm={registerForm}
        setRegisterForm={setRegisterForm}
        onRegister={register}
      />}

      {message && <div className="alert alert-success" role="status">{message}</div>}
      <ErrorMessage>{error}</ErrorMessage>

      {user && pathname === '/dashboard' && <Dashboard
        shops={shops}
        loading={loading}
        onRefresh={loadShops}
        isOwner={isOwner}
        onViewProducts={(shop) => loadProducts(shop)}
        onManageProducts={(shop) => loadProducts(shop, true)}
        onEditShop={startEditShop}
        onDeleteShop={deleteShop}
        showShopForm={showShopForm && user.role === 'seller'}
        editingShopId={editingShopId}
        shopForm={shopForm}
        setShopForm={setShopForm}
        onSaveShop={saveShop}
        onCancelShopForm={() => { setShowShopForm(false); setEditingShopId(null) }}
      />}
      {user && pathname === '/shops/' && selectedShop && <ShopDetails
        shop={selectedShop}
        products={products}
        productsLoading={productsLoading}
        productsError={productsError}
        isOwner={isOwner(selectedShop)}
        managingProducts={managingProducts}
        onToggleManagement={() => { setManagingProducts(!managingProducts); setEditingProductId(null); setProductForm(emptyProduct) }}
        onBack={() => { setSelectedShop(null); navigate('/dashboard'); setManagingProducts(false) }}
        productForm={productForm}
        setProductForm={setProductForm}
        editingProductId={editingProductId}
        productSaving={productSaving}
        onSaveProduct={saveProduct}
        onCancelEdit={startAddProduct}
        onEditProduct={startEditProduct}
        onDeleteProduct={deleteProduct}
        onAddToCart={addToCart}
      />}
      {user && pathname === '/cart' && <Cart
        cart={cart}
        cartTotal={cartTotal}
        onClose={() => navigate('/dashboard')}
        onChangeQuantity={changeCartQuantity}
        onRemove={(productId) => setCart((current) => current.filter((item) => Number(item.product_id) !== Number(productId)))}
        onPlaceOrder={placeOrder}
      />}
      {user?.role === 'customer' && pathname === '/orders' && <Orders orders={myOrders} loading={myOrdersLoading} onRefresh={loadMyOrders} />}
      {user?.role === 'seller' && pathname === '/seller/orders' && <SellerOrders orders={orders} loading={ordersLoading} onRefresh={loadOrders} onUpdateStatus={updateOrderStatus} />}
      {authReady && !['/login', '/register', '/dashboard', '/shops', '/shops/', '/cart', '/orders', '/seller/orders'].includes(pathname) && <Navigate to={user ? '/dashboard' : '/login'} replace />}
    </main>
  )
}

export default App
