const BG_IMAGE = '/lead-management-bg.png';

export default function AuthLayout({ children, wide = false }) {
  return (
    <div className="auth-page">
      <img src={BG_IMAGE} alt="" className="auth-page-bg" aria-hidden="true" />
      <div className={`auth-page-content ${wide ? 'auth-page-content-wide' : ''}`}>{children}</div>
    </div>
  );
}
