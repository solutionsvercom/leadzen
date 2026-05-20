import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import adminApi from '../../api/adminApi';
import PeriodFilter from '../../components/PeriodFilter';
import { useAuth } from '../../context/AuthContext';
import { getPeriodLabel } from '../../utils/periods';

export default function AdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('clients');
  const [clients, setClients] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [platformForm, setPlatformForm] = useState({ value: '', label: '', color: '#2563eb' });
  const [period, setPeriod] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const periodParams = period !== 'all' ? { period } : {};
      const [clientsRes, platformsRes] = await Promise.all([
        adminApi.getClients(periodParams),
        adminApi.getPlatforms(),
      ]);
      setClients(clientsRes.data.clients);
      setPlatforms(platformsRes.data.platforms);
    } catch {
      setMessage('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [period]);

  const totals = useMemo(
    () => ({
      leads: clients.reduce((sum, c) => sum + (c.leadCount || 0), 0),
      sheets: clients.reduce((sum, c) => sum + (c.business?.sheetLinksCount || 0), 0),
    }),
    [clients]
  );

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const handleAddPlatform = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createPlatform(platformForm);
      setPlatformForm({ value: '', label: '', color: '#2563eb' });
      setMessage('Platform added');
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to add platform');
    }
  };

  const togglePlatform = async (platform) => {
    await adminApi.updatePlatform(platform._id, { enabled: !platform.enabled });
    load();
  };

  const deletePlatform = async (id) => {
    if (!window.confirm('Delete this platform?')) return;
    await adminApi.deletePlatform(id);
    load();
  };

  const deleteClient = async (businessId) => {
    if (!window.confirm('Delete this client and ALL their leads permanently?')) return;
    await adminApi.deleteClient(businessId);
    setMessage('Client deleted');
    load();
  };

  return (
    <div className="admin-page">
      <header className="admin-hero">
        <div className="admin-hero-content">
          <span className="admin-hero-badge">Super Admin</span>
          <h1>Control Center</h1>
          <p className="admin-hero-sub">Manage clients, platforms, sheet links & leads</p>
        </div>
        <button type="button" className="btn btn-admin-ghost" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {message && <p className="success banner admin-banner">{message}</p>}

      <PeriodFilter
        value={period}
        onChange={setPeriod}
        className="admin-period-filter"
        label="View leads by period"
      />

      <div className="admin-overview-stats">
        <div className="admin-overview-card">
          <span className="admin-overview-icon">🏢</span>
          <div>
            <span className="admin-overview-value">{clients.length}</span>
            <span className="admin-overview-label">Clients</span>
          </div>
        </div>
        <div className="admin-overview-card">
          <span className="admin-overview-icon">👥</span>
          <div>
            <span className="admin-overview-value">{totals.leads}</span>
            <span className="admin-overview-label">Leads ({getPeriodLabel(period)})</span>
          </div>
        </div>
        <div className="admin-overview-card">
          <span className="admin-overview-icon">📋</span>
          <div>
            <span className="admin-overview-value">{totals.sheets}</span>
            <span className="admin-overview-label">Sheet links</span>
          </div>
        </div>
        <div className="admin-overview-card">
          <span className="admin-overview-icon">🔗</span>
          <div>
            <span className="admin-overview-value">{platforms.filter((p) => p.enabled).length}</span>
            <span className="admin-overview-label">Platforms active</span>
          </div>
        </div>
      </div>

      <div className="admin-tabs admin-tabs-pill">
        <button type="button" className={`admin-tab ${tab === 'clients' ? 'active' : ''}`} onClick={() => setTab('clients')}>
          All clients
        </button>
        <button type="button" className={`admin-tab ${tab === 'platforms' ? 'active' : ''}`} onClick={() => setTab('platforms')}>
          Platforms
        </button>
      </div>

      {loading ? (
        <p className="muted center admin-loading">Loading...</p>
      ) : tab === 'clients' ? (
        <section className="admin-clients-grid">
          {clients.length === 0 ? (
            <p className="muted center admin-empty">No clients registered yet.</p>
          ) : (
            clients.map((c) => (
              <article key={c.userId} className="admin-client-card">
                <div className="admin-client-card-top">
                  <h3>{c.business?.name || 'Unnamed business'}</h3>
                  <span className={`status-pill ${c.isActive ? 'active' : 'disabled'}`}>
                    {c.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="admin-client-user">
                  {c.name} · <span>{c.username}</span>
                </p>
                <div className="admin-client-metrics">
                  <div>
                    <strong>{c.leadCount ?? 0}</strong>
                    <span>Leads</span>
                  </div>
                  <div>
                    <strong>{c.business?.sheetLinksCount ?? 0}</strong>
                    <span>Sheets</span>
                  </div>
                </div>
                <div className="admin-client-actions">
                  <Link to={`/admin/clients/${c.business?.id}`} className="btn btn-admin-accent btn-block">
                    Open dashboard
                  </Link>
                  <Link
                    to={`/admin/clients/${c.business?.id}?panel=sheets${period !== 'all' ? `&period=${period}` : ''}`}
                    className="btn btn-admin-outline"
                  >
                    📋 Sheet links ({c.business?.sheetLinksCount ?? 0})
                  </Link>
                  <Link
                    to={`/admin/clients/${c.business?.id}?panel=leads${period !== 'all' ? `&period=${period}` : ''}`}
                    className="btn btn-admin-outline"
                  >
                    👥 All leads ({c.leadCount ?? 0})
                  </Link>
                  <button type="button" className="btn-delete btn-sm" onClick={() => deleteClient(c.business?.id)}>
                    Delete client
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      ) : (
        <section className="admin-panel admin-platforms-panel">
          <form onSubmit={handleAddPlatform} className="admin-form-row form">
            <label>
              Value (id)
              <input
                value={platformForm.value}
                onChange={(e) => setPlatformForm({ ...platformForm, value: e.target.value })}
                placeholder="e.g. linkedin"
                required
              />
            </label>
            <label>
              Label
              <input
                value={platformForm.label}
                onChange={(e) => setPlatformForm({ ...platformForm, label: e.target.value })}
                placeholder="LinkedIn"
                required
              />
            </label>
            <label>
              Color
              <input
                type="color"
                value={platformForm.color}
                onChange={(e) => setPlatformForm({ ...platformForm, color: e.target.value })}
              />
            </label>
            <button type="submit" className="btn btn-admin-accent">
              Add platform
            </button>
          </form>

          <div className="admin-platforms-grid">
            {platforms.map((p) => (
              <div key={p._id} className="admin-platform-chip">
                <span className="platform-dot" style={{ background: p.color }} />
                <div>
                  <strong>{p.label}</strong>
                  <span className="muted">{p.value}</span>
                </div>
                <button type="button" className="btn btn-admin-outline btn-sm" onClick={() => togglePlatform(p)}>
                  {p.enabled ? 'On' : 'Off'}
                </button>
                <button type="button" className="btn-delete btn-sm" onClick={() => deletePlatform(p._id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
