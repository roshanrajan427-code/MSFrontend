import { Link } from 'react-router-dom'

export default function Register({ mobileNumber, registerForm, setRegisterForm, onRegister }) {
  return <section className="card border-0 shadow-sm p-3 p-md-4 mb-4"><h2 className="h4 mb-3">Complete your profile</h2><p className="text-secondary">Verified mobile: {mobileNumber}</p><form onSubmit={onRegister}>
    <div className="mb-3"><label className="form-label" htmlFor="register-name">Username</label><input id="register-name" maxLength={20} autoComplete="name" className="form-control" value={registerForm.name} onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })} required /></div>
    <div className="mb-3"><label className="form-label" htmlFor="register-email">Email (optional)</label><input id="register-email" type="email" maxLength={254} autoComplete="email" className="form-control" value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })} /></div>
    <div className="mb-3"><label className="form-label" htmlFor="register-role">Account type</label><select id="register-role" className="form-select" value={registerForm.role} onChange={(event) => setRegisterForm({ ...registerForm, role: event.target.value })}><option value="customer">Customer</option><option value="seller">Seller</option></select></div>
    <button className="btn btn-dark" type="submit">Create account</button>
  </form><p className="small text-secondary mt-3 mb-0">Already have an account? <Link to="/login">Sign in</Link></p></section>
}
