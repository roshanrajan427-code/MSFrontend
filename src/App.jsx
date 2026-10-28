import { useEffect, useState } from 'react'
import 'bootstrap/dist/css/bootstrap.min.css'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://16.4.23.217:8080'
const emptyShop = { name: '', category: 'Food', location: '' }
const emptyProduct = { name: '', stock: '0', price: '', color: '', size: '', image: null }

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options)
  const raw = await response.text()
  let body = {}
  try { body = raw ? JSON.parse(raw) : {} } catch { body = { error: raw } }
  if (!response.ok) throw new Error(body.error || body.message || `Request failed (${response.status})`)
  return body
}

function jsonOptions(token, method, body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }
}

function App() {
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
  const [showCart, setShowCart] = useState(false)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [showOrders, setShowOrders] = useState(false)
  const [myOrders, setMyOrders] = useState([])
  const [myOrdersLoading, setMyOrdersLoading] = useState(false)
  const [showMyOrders, setShowMyOrders] = useState(false)

  useEffect(() => { window.localStorage.removeItem('mini-shop-cart') }, [])

  useEffect(() => {
    if (!showMyOrders || !token || user?.role !== 'customer') return undefined
    const refreshOrders = () => api('/my/orders', { headers: { Authorization: `Bearer ${token}` } }).then(setMyOrders).catch(() => {})
    refreshOrders()
    const timer = window.setInterval(refreshOrders, 15000)
    return () => window.clearInterval(timer)
  }, [showMyOrders, token, user?.role])

  function setShopInURL(shopId) {
    const url = new URL(window.location.href)
    if (shopId) url.searchParams.set('shop', String(shopId))
    else url.searchParams.delete('shop')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
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

  async function loadProducts(shop, manage = false) {
    setSelectedShop(shop)
    setShopInURL(shop.id)
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
      setScreen('phone')
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
      setShowCart(false)
      setMessage(`Order placed. ${result.order_ids.length} seller order${result.order_ids.length === 1 ? '' : 's'} sent for review.`)
      setShowMyOrders(true)
      await loadMyOrders()
      if (selectedShop) await loadProducts(selectedShop)
    } catch (err) { setError(err.message || 'Could not place order') }
  }

  async function loadOrders() {
    setOrdersLoading(true)
    try {
      setOrders(await api('/seller/orders', { headers: { Authorization: `Bearer ${token}` } }))
    } catch (err) { setError(err.message || 'Could not load orders') }
    finally { setOrdersLoading(false) }
  }

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
        setScreen('profile')
      } else {
        // A browser can be shared by multiple accounts. Never carry the
        // previous visitor's locally saved cart into a signed-in account.
        setCart([])
        window.localStorage.setItem('mini-shop-token', result.token)
        setToken(result.token)
        setUser(result.user)
        setScreen('home')
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
      setScreen('home')
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
    setShopInURL(null)
    setProducts([])
    setMessage('')
    setError('')
    setScreen('phone')
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
      <header className="d-flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
        <div><h1 className="fw-bold mb-1">Mini Shop</h1><p className="text-secondary mb-0">Find local shops and products</p></div>
        <div className="d-flex align-items-center gap-2 flex-wrap">{user && <><span className="text-secondary">Hi, {user.name}</span>{user.role === 'seller' ? <><button className="btn btn-dark" onClick={startCreateShop}>Create shop</button><button className="btn btn-outline-primary" onClick={() => { const next = !showOrders; setShowOrders(next); if (next) loadOrders() }}>Orders</button></> : <button className="btn btn-outline-primary" onClick={() => { const next = !showMyOrders; setShowMyOrders(next); if (next) loadMyOrders() }}>My orders</button>}</>}<button className="btn btn-outline-dark" onClick={() => setShowCart(!showCart)}>Cart ({cartCount})</button>{user && <button className="btn btn-outline-secondary" onClick={logout}>Log out</button>}</div>
      </header>

      {!user && authReady && <section className="card border-0 shadow-sm p-3 p-md-4 mb-4">
        {screen === 'phone' && <><h2 className="h4 mb-3">Sign in or create an account</h2><form onSubmit={(event) => { event.preventDefault(); if (!/^\d{10,12}$/.test(mobileNumber.trim())) return setError('Enter a valid mobile number containing 10 to 12 digits.'); setError(''); setScreen('otp') }}>
          <div className="mb-3"><label className="form-label" htmlFor="auth-mobile">Mobile number</label><input id="auth-mobile" type="tel" inputMode="numeric" autoComplete="tel" maxLength={12} minLength={10} pattern="[0-9]{10,12}" className="form-control" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 12))} required /></div><button className="btn btn-dark">Continue</button>
        </form></>}
        {screen === 'otp' && <><h2 className="h4 mb-3">Verify your mobile number</h2><p className="text-secondary">Development OTP: <strong>0000</strong></p><form onSubmit={verifyOTP}><div className="mb-3"><label className="form-label" htmlFor="otp">OTP</label><input id="otp" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" className="form-control" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} required /></div><button className="btn btn-dark">Verify and continue</button> <button type="button" className="btn btn-link" onClick={() => switchScreen('phone')}>Change number</button></form></>}
        {screen === 'profile' && <><h2 className="h4 mb-3">Complete your profile</h2><p className="text-secondary">Verified mobile: {mobileNumber}</p><form onSubmit={register}>
          <div className="mb-3"><label className="form-label" htmlFor="register-name">Username</label><input id="register-name" maxLength={20} autoComplete="name" className="form-control" value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} required /></div>
          <div className="mb-3"><label className="form-label" htmlFor="register-email">Email (optional)</label><input id="register-email" type="email" maxLength={254} autoComplete="email" className="form-control" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} /></div>
          <div className="mb-3"><label className="form-label" htmlFor="register-role">Account type</label><select id="register-role" className="form-select" value={registerForm.role} onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}><option value="customer">Customer</option><option value="seller">Seller</option></select></div>
          <button className="btn btn-dark" type="submit">Create account</button>
        </form></>}
      </section>}

      {message && <div className="alert alert-success" role="status">{message}</div>}{error && <div className="alert alert-danger" role="alert">{error}</div>}

      {showCart && <section className="card border-0 shadow-sm p-3 p-md-4 mb-4"><div className="d-flex justify-content-between align-items-center mb-3"><h2 className="h4 mb-0">Your cart</h2><button className="btn btn-outline-secondary btn-sm" onClick={() => setShowCart(false)}>Close</button></div>
        {cart.length === 0 ? <p className="text-secondary mb-0">Your cart is empty. Browse a shop and add products.</p> : <><div className="list-group list-group-flush">{cart.map((item) => <div className="list-group-item px-0 d-flex justify-content-between align-items-center gap-3 flex-wrap" key={item.product_id}><div><strong>{item.name}</strong><div className="small text-secondary">{item.shop_name}{(item.color || item.size) ? ` · ${[item.color, item.size].filter(Boolean).join(' / ')}` : ''} · ₹{item.price.toFixed(2)} each</div></div><div className="d-flex align-items-center gap-2"><input aria-label={`Quantity for ${item.name}`} className="form-control form-control-sm" type="number" min="1" max={item.stock} value={item.quantity} style={{ width: 78 }} onChange={(event) => changeCartQuantity(item.product_id, Number(event.target.value))} /><span className="text-nowrap">₹{(item.price * item.quantity).toFixed(2)}</span><button className="btn btn-outline-danger btn-sm" onClick={() => setCart((current) => current.filter((entry) => Number(entry.product_id) !== Number(item.product_id)))}>Remove</button></div></div>)}</div><div className="d-flex justify-content-between align-items-center mt-3"><strong>Total: ₹{cartTotal.toFixed(2)}</strong><button className="btn btn-dark" onClick={placeOrder}>Place order</button></div>{!user && <p className="small text-secondary mt-2 mb-0">You’ll be asked to sign in or create a customer account before checkout.</p>}</>}
      </section>}

      {showOrders && user?.role === 'seller' && <section className="card border-0 shadow-sm p-3 p-md-4 mb-4"><div className="d-flex justify-content-between align-items-center mb-3"><h2 className="h4 mb-0">Incoming orders</h2><button className="btn btn-outline-secondary btn-sm" onClick={loadOrders}>Refresh</button></div>{ordersLoading ? <p>Loading orders…</p> : orders.length === 0 ? <p className="text-secondary mb-0">No orders yet.</p> : <div className="d-grid gap-3">{orders.map((order) => <article className="border rounded p-3" key={order.id}><div className="d-flex justify-content-between gap-2 flex-wrap"><strong>Order #{order.id} · {order.shop_name}</strong><span className="badge text-bg-light text-capitalize">{order.status}</span></div><p className="small text-secondary mb-2">From {order.customer_name} · {new Date(order.created_at).toLocaleString()}</p><ul className="mb-2">{order.items.map((item, index) => <li key={`${order.id}-${index}`}>{item.product_name} × {item.quantity} — ₹{(item.unit_price * item.quantity).toFixed(2)}</li>)}</ul>{order.status === 'pending' && <div className="d-flex gap-2"><button className="btn btn-success btn-sm" onClick={() => updateOrderStatus(order, 'accepted')}>Accept</button><button className="btn btn-outline-danger btn-sm" onClick={() => updateOrderStatus(order, 'rejected')}>Reject</button></div>}</article>)}</div>}</section>}

      {showMyOrders && user?.role === 'customer' && <section className="card border-0 shadow-sm p-3 p-md-4 mb-4"><div className="d-flex justify-content-between align-items-center mb-3"><h2 className="h4 mb-0">My orders</h2><button className="btn btn-outline-secondary btn-sm" onClick={loadMyOrders}>Refresh</button></div>{myOrdersLoading ? <p>Loading orders…</p> : myOrders.length === 0 ? <p className="text-secondary mb-0">You haven’t placed an order yet.</p> : <div className="d-grid gap-3">{myOrders.map((order) => { const total = order.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0); return <article className="border rounded p-3" key={order.id}><div className="d-flex justify-content-between gap-2 flex-wrap"><strong>Order #{order.id} · {order.shop_name}</strong><span className={`badge text-bg-${order.status === 'accepted' ? 'success' : order.status === 'rejected' ? 'danger' : 'warning'}`}>{order.status === 'pending' ? 'Waiting for seller' : order.status}</span></div><p className="small text-secondary mb-2">Placed {new Date(order.created_at).toLocaleString()}</p><ul className="mb-2">{order.items.map((item, index) => <li key={`${order.id}-${index}`}>{item.product_name} × {item.quantity} — ₹{(item.unit_price * item.quantity).toFixed(2)}</li>)}</ul><strong>Order total: ₹{total.toFixed(2)}</strong></article> })}</div>}</section>}

      {showShopForm && user?.role === 'seller' && <section className="card border-0 shadow-sm p-3 p-md-4 mb-4"><h2 className="h4 mb-3">{editingShopId ? 'Edit shop' : 'Create a shop'}</h2><form onSubmit={saveShop}>
        <div className="mb-3"><label className="form-label" htmlFor="shop-name">Shop name</label><input id="shop-name" maxLength={50} className="form-control" value={shopForm.name} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} required /></div>
        <div className="mb-3"><label className="form-label" htmlFor="shop-category">Category</label><select id="shop-category" className="form-select" value={shopForm.category} onChange={(e) => setShopForm({ ...shopForm, category: e.target.value })} required>{['Food', 'Health', 'Clothing', 'Electronics', 'Other'].map((category) => <option key={category}>{category}</option>)}</select></div>
        <div className="mb-3"><label className="form-label" htmlFor="shop-location">Location</label><input id="shop-location" maxLength={30} className="form-control" value={shopForm.location} onChange={(e) => setShopForm({ ...shopForm, location: e.target.value })} required /></div>
        <button className="btn btn-dark me-2" type="submit">{editingShopId ? 'Save changes' : 'Create shop'}</button><button className="btn btn-outline-secondary" type="button" onClick={() => { setShowShopForm(false); setEditingShopId(null) }}>Cancel</button>
      </form></section>}

      <section><div className="d-flex justify-content-between align-items-center mb-3"><h2 className="h4 mb-0">Available shops</h2><button className="btn btn-outline-secondary btn-sm" onClick={loadShops}>Refresh</button></div>
        {loading ? <p>Loading shops...</p> : shops.length === 0 ? <p className="text-secondary">No shops found yet.</p> : <div className="row g-3">{shops.map((shop) => <div className="col-12 col-md-6 col-lg-4" key={shop.id}><article className="card h-100 border-0 shadow-sm"><div className="card-body"><span className="badge text-bg-light mb-3">{shop.category}</span><h3 className="h5">{shop.name}</h3><p className="text-secondary mb-0">{shop.location}</p><div className="d-flex gap-2 flex-wrap mt-3"><button className="btn btn-outline-dark btn-sm" onClick={() => loadProducts(shop)}>View products</button>{isOwner(shop) && <><button className="btn btn-outline-primary btn-sm" onClick={() => loadProducts(shop, true)}>Manage products</button><button className="btn btn-outline-secondary btn-sm" onClick={() => startEditShop(shop)}>Edit shop</button><button className="btn btn-outline-danger btn-sm" onClick={() => deleteShop(shop)}>Delete shop</button></>}</div></div></article></div>)}</div>}
      </section>

      {selectedShop && <section className="mt-5"><div className="d-flex justify-content-between align-items-center mb-3"><h2 className="h4 mb-0">{selectedShop.name} — Products</h2><div className="d-flex gap-2">{isOwner(selectedShop) && <button className={`btn btn-sm ${managingProducts ? 'btn-outline-dark' : 'btn-dark'}`} onClick={() => { setManagingProducts(!managingProducts); setEditingProductId(null); setProductForm(emptyProduct) }}>{managingProducts ? 'Done editing' : 'Edit products'}</button>}<button className="btn btn-outline-secondary btn-sm" onClick={() => { setSelectedShop(null); setShopInURL(null); setManagingProducts(false) }}>Close</button></div></div>
        {isOwner(selectedShop) && managingProducts && <div className="card border-0 shadow-sm p-3 p-md-4 mb-4"><h3 className="h5 mb-3">{editingProductId ? 'Edit product' : 'Add a product'}</h3><form onSubmit={saveProduct}>
          <div className="row g-3"><div className="col-md-6"><label className="form-label" htmlFor="product-name">Product name</label><input id="product-name" maxLength={40} className="form-control" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required /></div><div className="col-md-3"><label className="form-label" htmlFor="product-color">Colour (optional)</label><input id="product-color" maxLength={30} className="form-control" value={productForm.color} onChange={(e) => setProductForm({ ...productForm, color: e.target.value })} /></div><div className="col-md-3"><label className="form-label" htmlFor="product-size">Size (optional)</label><input id="product-size" maxLength={30} className="form-control" value={productForm.size} onChange={(e) => setProductForm({ ...productForm, size: e.target.value })} /></div><div className="col-md-4"><label className="form-label" htmlFor="product-stock">Stock quantity</label><input id="product-stock" type="number" min="0" step="1" className="form-control" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} required /></div><div className="col-md-4"><label className="form-label" htmlFor="product-price">Price (₹)</label><input id="product-price" type="number" min="0" step="0.01" className="form-control" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required /></div><div className="col-md-4"><label className="form-label" htmlFor="product-image">Product image (JPEG, PNG, WebP or GIF, up to 5 MB)</label><input id="product-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="form-control" onChange={(e) => setProductForm({ ...productForm, image: e.target.files?.[0] || null })} /></div></div>
          {productForm.image && <p className="small text-secondary mt-2 mb-0">Selected: {productForm.image.name}</p>}<div className="mt-3"><button className="btn btn-dark me-2" type="submit" disabled={productSaving}>{productSaving ? 'Saving...' : editingProductId ? 'Save product' : 'Add product'}</button>{editingProductId && <button className="btn btn-outline-secondary" type="button" onClick={startAddProduct}>Cancel edit</button>}</div>
        </form></div>}
        {productsError && <div className="alert alert-danger" role="alert">{productsError}</div>}{productsLoading ? <p>Loading products...</p> : products.length === 0 ? <p className="text-secondary">No products in this shop yet.</p> : <div className="row g-3">{products.map((product) => <div className="col-12 col-md-6 col-lg-4" key={product.id}><article className="card h-100 shadow-sm border-0">{product.image_url && <img
  src={product.image_url.startsWith('http')
    ? product.image_url
    : `${API_URL}${product.image_url}`}
  className="card-img-top"
  alt={product.name}
  style={{ height: 220, objectFit: 'cover' }}
/>}<div className="card-body"><h3 className="h5">{product.name}</h3>{(product.color || product.size) && <p className="text-secondary mb-2">{[product.color && `Colour: ${product.color}`, product.size && `Size: ${product.size}`].filter(Boolean).join(' · ')}</p>}<p className="mb-1">Stock: {product.stock}</p><p className="mb-0">₹{Number(product.price).toFixed(2)}</p><button className="btn btn-dark btn-sm mt-3" disabled={Number(product.stock) < 1} onClick={() => addToCart(product, selectedShop)}>{Number(product.stock) < 1 ? 'Out of stock' : 'Add to cart'}</button>{isOwner(selectedShop) && managingProducts && <div className="d-flex gap-2 mt-3"><button className="btn btn-outline-primary btn-sm" onClick={() => startEditProduct(product)}>Edit product</button><button className="btn btn-outline-danger btn-sm" onClick={() => deleteProduct(product)}>Delete product</button></div>}</div></article></div>)}</div>}
      </section>}
    </main>
  )
}

export default App
