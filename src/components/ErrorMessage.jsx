export default function ErrorMessage({ children }) {
  if (!children) return null
  return <div className="alert alert-danger" role="alert">{children}</div>
}
