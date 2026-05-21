import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import OnboardingStepIndicator from '../components/OnboardingStepIndicator';
import { readOnboardingDraft, saveOnboardingDraft } from '../utils/onboardingDraft';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

const emptyLink = () => ({ url: '', platform: 'instagram', label: '' });

export default function OnboardingStep2() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const authenticated = !!user && !user.business?.onboardingComplete;

  const [links, setLinks] = useState([emptyLink()]);
  const [error, setError] = useState('');
  const [syncNotes, setSyncNotes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authenticated) return;
    const draft = readOnboardingDraft(false);
    if (draft?.sheetLinks?.length) {
      setLinks(draft.sheetLinks);
    }
  }, [authenticated]);

  const updateLink = (index, field, value) => {
    setLinks((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addLink = () => setLinks((prev) => [...prev, emptyLink()]);

  const removeLink = (index) => {
    if (links.length <= 1) return;
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSyncNotes([]);

    const validLinks = links
      .filter((l) => l.url.trim())
      .map((l) => ({
        url: l.url.trim(),
        platform: l.platform,
        label: l.label?.trim() || '',
      }));

    if (validLinks.length === 0) {
      setError('Add at least one Google Sheet link');
      return;
    }

    if (!authenticated) {
      saveOnboardingDraft({ sheetLinks: validLinks });
      navigate('/onboarding/payment');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/business/sheet-links', { links: validLinks });
      setSyncNotes(res.data.syncResults || []);

      await api.post('/business/complete-onboarding');
      await refreshUser();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to connect sheets');
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated && !readOnboardingDraft(false)) {
    return <Navigate to="/onboarding" replace />;
  }

  if (authenticated && user?.business?.onboardingComplete) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AuthLayout wide>
      <div className="auth-card auth-card-wide">
        <OnboardingStepIndicator step={2} />
        <h2>Connect Google Form sheets</h2>
        <p className="muted">
          Step 2 of 3 — Paste the Google Sheet link where your form responses are stored, then continue to payment.
          Share each sheet as <strong>Anyone with the link can view</strong>.
        </p>

        <div className="info-box">
          <p>
            <strong>Tip:</strong> In Google Forms → Responses → Link to Sheets. Copy the <strong>spreadsheet URL</strong>{' '}
            (starts with docs.google.com/spreadsheets), not the Form URL. Share as Viewer: Anyone with the link.
          </p>
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            Add <strong>one sheet per platform</strong>. Do not paste the same sheet URL for Instagram, Facebook, etc. —
            that marks all leads as the last platform chosen.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="form">
          {links.map((link, index) => (
            <div key={index} className="sheet-link-row">
              <div className="sheet-link-header">
                <span>Sheet {index + 1}</span>
                {links.length > 1 && (
                  <button type="button" className="btn-text" onClick={() => removeLink(index)}>
                    Remove
                  </button>
                )}
              </div>
              <label>
                Platform
                <select
                  value={link.platform}
                  onChange={(e) => updateLink(index, 'platform', e.target.value)}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Google Sheet URL *
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(index, 'url', e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  required={index === 0}
                />
              </label>
              <label>
                Label <span className="optional">(optional)</span>
                <input
                  value={link.label}
                  onChange={(e) => updateLink(index, 'label', e.target.value)}
                  placeholder="e.g. IG campaign March"
                />
              </label>
            </div>
          ))}

          <button type="button" className="btn btn-secondary btn-block" onClick={addLink}>
            + Add another sheet
          </button>

          {error && <p className="error">{error}</p>}

          {syncNotes.length > 0 && (
            <div className="sync-results">
              {syncNotes.map((note, i) => (
                <p key={i} className={note.success ? 'success' : 'error'}>
                  {note.platform}:{' '}
                  {note.success ? `${note.count} leads imported` : note.error}
                </p>
              ))}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading
              ? 'Importing leads...'
              : authenticated
                ? 'Finish setup & open dashboard'
                : 'Continue to payment'}
          </button>
        </form>

        {!authenticated && (
          <p className="footer-link">
            <Link to="/onboarding">← Back to business details</Link>
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
