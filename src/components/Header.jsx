export default function Header({ user, cartCount, onCreateShop, onOrders, onCart, onLogout }) {
  return <header className="d-flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
    <div><h1 className="fw-bold mb-1">Mini Shop</h1><p className="text-secondary mb-0">Find local shops and products</p></div>
    <div className="d-flex align-items-center gap-2 flex-wrap"><span className="text-secondary">Hi, {user.name}</span>{user.role === 'seller' ? <><button className="btn btn-dark" onClick={onCreateShop}>Create shop</button><button className="btn btn-outline-primary" onClick={onOrders}>Orders</button></> : <button className="btn btn-outline-primary" onClick={onOrders}>My orders</button>}<button className="btn btn-outline-dark" onClick={onCart}>Cart ({cartCount})</button><button className="btn btn-outline-secondary" onClick={onLogout}>Log out</button></div>
  </header>
}
