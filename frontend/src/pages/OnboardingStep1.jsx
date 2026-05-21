import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import OnboardingStepIndicator, { ONBOARDING_DRAFT_KEY } from '../components/OnboardingStepIndicator';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OnboardingStep1() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: '',
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      setForm((prev) => ({
        ...prev,
        businessName: d.businessName || '',
        name: d.name || '',
        username: d.username || '',
        password: '',
        confirmPassword: '',
      }));
      if (d.logoDataUrl) setLogoPreview(d.logoDataUrl);
    } catch {
      /* ignore */
    }
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      let logoDataUrl = '';
      if (logoFile) {
        logoDataUrl = await fileToDataUrl(logoFile);
      } else if (logoPreview && logoPreview.startsWith('data:')) {
        logoDataUrl = logoPreview;
      }

      const draft = {
        businessName: form.businessName.trim(),
        name: form.name.trim(),
        username: form.username.toLowerCase().trim(),
        password: form.password,
        logoDataUrl: logoDataUrl || undefined,
      };

      const existing = sessionStorage.getItem(ONBOARDING_DRAFT_KEY);
      let sheetLinks;
      try {
        sheetLinks = existing ? JSON.parse(existing).sheetLinks : undefined;
      } catch {
        sheetLinks = undefined;
      }
      sessionStorage.setItem(
        ONBOARDING_DRAFT_KEY,
        JSON.stringify({ ...draft, ...(sheetLinks ? { sheetLinks } : {}) })
      );
      navigate('/onboarding/sheets');
    } catch {
      setError('Could not read logo file. Try another image or skip the logo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card">
        <OnboardingStepIndicator step={1} />
        <h2>Set up your business</h2>
        <p className="muted">Step 1 of 3 — Business & account details (Google Sheets, then payment)</p>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Business name *
            <input
              name="businessName"
              value={form.businessName}
              onChange={handleChange}
              placeholder="e.g. Acme Digital"
              required
            />
          </label>

          <label>
            Business logo <span className="optional">(optional)</span>
            <div className="logo-upload">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="logo-preview" />
              ) : (
                <div className="logo-placeholder">No logo</div>
              )}
              <input type="file" accept="image/*" onChange={handleLogo} />
            </div>
          </label>

          <label>
            Your full name *
            <input name="name" value={form.name} onChange={handleChange} placeholder="John Doe" required />
          </label>

          <label>
            Username *
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="johndoe"
              autoComplete="username"
              required
            />
          </label>

          <label>
            Password *
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </label>

          <label htmlFor="show-password-onboarding" className="checkbox-row show-password-row">
            <input
              type="checkbox"
              id="show-password-onboarding"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            Show password
          </label>

          <label>
            Confirm password *
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Saving...' : 'Continue to Google Sheets'}
          </button>
        </form>

        <p className="footer-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
