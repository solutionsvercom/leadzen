import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

const PLATFORMS = [
  { name: 'Instagram', color: '#E1306C' },
  { name: 'Facebook', color: '#1877F2' },
  { name: 'YouTube', color: '#FF0000' },
  { name: 'WhatsApp', color: '#25D366' },
];

export default function Welcome() {
  return (
    <AuthLayout>
      <div className="auth-card welcome-card">
        <span className="badge">Lead Management Portal</span>
        <h1>Manage leads from your social channels</h1>
        <p className="muted">
          Connect Google Form response sheets from Instagram, Facebook, YouTube, and WhatsApp.
          View and track every lead in one place.
        </p>

        <div className="platform-pills">
          {PLATFORMS.map((p) => (
            <span key={p.name} className="platform-pill" style={{ borderColor: p.color, color: p.color }}>
              {p.name}
            </span>
          ))}
        </div>

        <div className="btn-row">
          <Link to="/onboarding" className="btn btn-primary">
            Get started
          </Link>
          <Link to="/login" className="btn btn-secondary">
            Sign in
          </Link>
        </div>

        <p className="footer-link">
          <Link to="/admin/login">Super Admin portal</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
