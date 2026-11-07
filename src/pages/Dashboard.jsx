import Loading from '../components/Loading.jsx'
import ShopCard from '../components/ShopCard.jsx'

export default function Dashboard({ shops, loading, onRefresh, isOwner, onViewProducts, onManageProducts, onEditShop, onDeleteShop, showShopForm, editingShopId, shopForm, setShopForm, onSaveShop, onCancelShopForm }) {
  return <>
    {showShopForm && <section className="card border-0 shadow-sm p-3 p-md-4 mb-4"><h2 className="h4 mb-3">{editingShopId ? 'Edit shop' : 'Create a shop'}</h2><form onSubmit={onSaveShop}>
      <div className="mb-3"><label className="form-label" htmlFor="shop-name">Shop name</label><input id="shop-name" maxLength={50} className="form-control" value={shopForm.name} onChange={(event) => setShopForm({ ...shopForm, name: event.target.value })} required /></div>
      <div className="mb-3"><label className="form-label" htmlFor="shop-category">Category</label><select id="shop-category" className="form-select" value={shopForm.category} onChange={(event) => setShopForm({ ...shopForm, category: event.target.value })} required>{['Food', 'Health', 'Clothing', 'Electronics', 'Other'].map((category) => <option key={category}>{category}</option>)}</select></div>
      <div className="mb-3"><label className="form-label" htmlFor="shop-location">Location</label><input id="shop-location" maxLength={30} className="form-control" value={shopForm.location} onChange={(event) => setShopForm({ ...shopForm, location: event.target.value })} required /></div>
      <button className="btn btn-dark me-2" type="submit">{editingShopId ? 'Save changes' : 'Create shop'}</button><button className="btn btn-outline-secondary" type="button" onClick={onCancelShopForm}>Cancel</button>
    </form></section>}
    <section><div className="d-flex justify-content-between align-items-center mb-3"><h2 className="h4 mb-0">Available shops</h2><button className="btn btn-outline-secondary btn-sm" onClick={onRefresh}>Refresh</button></div>
      {loading ? <Loading>Loading shops...</Loading> : shops.length === 0 ? <p className="text-secondary">No shops found yet.</p> : <div className="row g-3">{shops.map((shop) => <ShopCard key={shop.id} shop={shop} isOwner={isOwner(shop)} onViewProducts={() => onViewProducts(shop)} onManageProducts={() => onManageProducts(shop)} onEdit={() => onEditShop(shop)} onDelete={() => onDeleteShop(shop)} />)}</div>}
    </section>
  </>
}
