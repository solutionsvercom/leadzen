import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import adminApi from '../../api/adminApi';
import CollapsibleSection from '../../components/admin/CollapsibleSection';
import PeriodFilter from '../../components/PeriodFilter';
import StatsCharts from '../../components/StatsCharts';
import { getPeriodLabel } from '../../utils/periods';
import { STATUS_COLORS, STATUS_LABELS } from '../../components/StatsCharts';

const DEFAULT_COLORS = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  youtube: '#FF0000',
  whatsapp: '#25D366',
};

function getDisplayFields(data) {
  const priority = ['Name', 'name', 'Email', 'email', 'Phone', 'phone'];
  const entries = Object.entries(data || {});
  const ordered = [];
  for (const key of priority) {
    const found = entries.find(([k]) => k === key);
    if (found) ordered.push(found);
  }
  for (const entry of entries) {
    if (!ordered.find(([k]) => k === entry[0]) && entry[0] !== 'Timestamp') ordered.push(entry);
  }
  return ordered.slice(0, 5);
}

export default function AdminClientDetail() {
  const { businessId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [userForm, setUserForm] = useState({});
  const [businessForm, setBusinessForm] = useState({});
  const [newLink, setNewLink] = useState({ url: '', platform: 'instagram', label: '' });

  const openPanel = searchParams.get('panel') || '';
  const period = searchParams.get('period') || 'all';

  const updateSearchParams = (updates) => {
    const params = {};
    const nextPanel = updates.panel !== undefined ? updates.panel : openPanel;
    const nextPeriod = updates.period !== undefined ? updates.period : period;
    if (nextPanel) params.panel = nextPanel;
    if (nextPeriod && nextPeriod !== 'all') params.period = nextPeriod;
    setSearchParams(params);
  };

  const setPanel = (panel) => {
    if (openPanel === panel) {
      updateSearchParams({ panel: '', period });
    } else {
      updateSearchParams({ panel, period });
    }
  };

  const setPeriod = (nextPeriod) => {
    updateSearchParams({ panel: openPanel, period: nextPeriod });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const periodParams = period !== 'all' ? { period } : {};
      const [clientRes, platformsRes] = await Promise.all([
        adminApi.getClient(businessId, periodParams),
        adminApi.getPlatforms(),
      ]);
      setData(clientRes.data);
      setPlatforms(platformsRes.data.platforms.filter((p) => p.enabled));
      setUserForm({
        name: clientRes.data.user?.name || '',
        username: clientRes.data.user?.username || '',
        isActive: clientRes.data.user?.isActive !== false,
      });
      setBusinessForm({
        name: clientRes.data.business?.name || '',
        onboardingComplete: clientRes.data.business?.onboardingComplete || false,
      });
      setNewLink((prev) => ({
        ...prev,
        platform: platformsRes.data.platforms.find((p) => p.enabled)?.value || 'instagram',
      }));
    } catch {
      setMessage('Failed to load client');
    } finally {
      setLoading(false);
    }
  }, [businessId, period]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!openPanel || loading) return;
    const el = document.getElementById(openPanel);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [openPanel, loading]);

  const platformChartData = useMemo(() => {
    if (!data?.platformCounts) return [];
    return Object.entries(data.platformCounts).map(([value, count]) => ({
      name: value,
      value: count,
      color: platforms.find((p) => p.value === value)?.color || DEFAULT_COLORS[value] || '#64748b',
    }));
  }, [data, platforms]);

  const statusChartData = useMemo(
    () =>
      ['pending', 'contacted', 'converted'].map((key) => ({
        name: STATUS_LABELS[key],
        value: data?.statusCounts?.[key] ?? 0,
        color: STATUS_COLORS[key],
      })),
    [data]
  );

  const sheetCount = data?.business?.sheetLinks?.length || 0;
  const leadCount = data?.leadCount ?? data?.leads?.length ?? 0;

  const saveUser = async () => {
    await adminApi.updateUser(data.user.id, userForm);
    setMessage('User updated');
    load();
  };

  const saveBusiness = async () => {
    await adminApi.updateClient(businessId, businessForm);
    setMessage('Business updated');
    load();
  };

  const addLink = async (e) => {
    e.preventDefault();
    await adminApi.addSheetLink(businessId, newLink);
    setNewLink({ url: '', platform: platforms[0]?.value || 'instagram', label: '' });
    setMessage('Sheet link added and synced');
    setPanel('sheets');
    load();
  };

  const updateLink = async (linkId, patch) => {
    await adminApi.updateSheetLink(businessId, linkId, patch);
    setMessage('Sheet link updated');
    load();
  };

  const removeLink = async (linkId) => {
    if (!window.confirm('Delete this sheet link and its leads?')) return;
    await adminApi.deleteSheetLink(businessId, linkId);
    load();
  };

  const syncSheets = async () => {
    await adminApi.syncClient(businessId);
    setMessage('Sheets synced successfully');
    load();
  };

  if (loading) return <p className="page-loading admin-page-loading">Loading client...</p>;
  if (!data?.business) return <p className="error center">Client not found</p>;

  return (
    <div className="admin-page admin-client-page">
      <header className="admin-hero admin-hero-client">
        <div className="admin-hero-content">
          <Link to="/admin" className="admin-back">
            ← Back to all clients
          </Link>
          <h1>{data.business.name}</h1>
          <p className="admin-hero-sub">
            {data.user?.name} · <span>{data.user?.username}</span>
          </p>
        </div>
        <button type="button" className="btn btn-admin-accent" onClick={syncSheets}>
          ⟳ Sync sheets
        </button>
      </header>

      {message && <p className="success banner admin-banner">{message}</p>}

      <PeriodFilter
        value={period}
        onChange={setPeriod}
        className="admin-period-filter"
        label="View leads by period"
      />

      <div className="admin-mini-stats">
        <div className="admin-mini-stat">
          <span className="admin-mini-stat-value">{leadCount}</span>
          <span className="admin-mini-stat-label">Leads ({getPeriodLabel(period)})</span>
        </div>
        <div className="admin-mini-stat">
          <span className="admin-mini-stat-value">{sheetCount}</span>
          <span className="admin-mini-stat-label">Sheet links</span>
        </div>
        <div className="admin-mini-stat">
          <span className="admin-mini-stat-value">{data.statusCounts?.pending ?? 0}</span>
          <span className="admin-mini-stat-label">Pending</span>
        </div>
        <div className="admin-mini-stat">
          <span className={`status-pill ${data.user?.isActive ? 'active' : 'disabled'}`}>
            {data.user?.isActive ? 'Active' : 'Disabled'}
          </span>
          <span className="admin-mini-stat-label">Account</span>
        </div>
      </div>

      <div className="admin-action-bar">
        <button
          type="button"
          className={`admin-action-btn ${openPanel === 'settings' ? 'active' : ''}`}
          onClick={() => setPanel('settings')}
        >
          ⚙️ Account settings
        </button>
        <button
          type="button"
          className={`admin-action-btn ${openPanel === 'sheets' ? 'active' : ''}`}
          onClick={() => setPanel('sheets')}
        >
          📋 Google Sheet links
          <span className="admin-action-count">{sheetCount}</span>
        </button>
        <button
          type="button"
          className={`admin-action-btn ${openPanel === 'leads' ? 'active' : ''}`}
          onClick={() => setPanel('leads')}
        >
          👥 All leads
          <span className="admin-action-count">{leadCount}</span>
        </button>
      </div>

      <CollapsibleSection
        id="settings"
        title="Account settings"
        subtitle="Edit user and business details"
        icon="⚙️"
        open={openPanel === 'settings'}
        onToggle={() => setPanel('settings')}
      >
        <div className="admin-grid-2">
          <div className="admin-inner-card">
            <h4>User</h4>
            <div className="form">
              <label>
                Name
                <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
              </label>
              <label>
                Username
                <input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={userForm.isActive}
                  onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
                />
                Account active
              </label>
              {data.user?.signUpPaymentRef && (
                <p className="muted admin-payment-ref">
                  Signup UPI / transaction ref: <code>{data.user.signUpPaymentRef}</code>
                </p>
              )}
              <button type="button" className="btn btn-primary" onClick={saveUser}>
                Save user
              </button>
            </div>
          </div>
          <div className="admin-inner-card">
            <h4>Business</h4>
            <div className="form">
              <label>
                Business name
                <input value={businessForm.name} onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })} />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={businessForm.onboardingComplete}
                  onChange={(e) => setBusinessForm({ ...businessForm, onboardingComplete: e.target.checked })}
                />
                Onboarding complete
              </label>
              <button type="button" className="btn btn-primary" onClick={saveBusiness}>
                Save business
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="sheets"
        title="Google Sheet links"
        subtitle="Add, edit or remove connected form sheets"
        icon="📋"
        count={sheetCount}
        open={openPanel === 'sheets'}
        onToggle={() => setPanel('sheets')}
      >
        {data.business.sheetLinks?.map((link) => (
          <div key={link._id} className="sheet-link-row admin-sheet-row">
            <div className="admin-sheet-row-head">
              <span className="platform-badge admin-platform-tag">{link.platform}</span>
              {link.label && <span className="admin-sheet-label">{link.label}</span>}
              {link.url && (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-admin-outline btn-sm admin-open-sheet"
                >
                  Open in Google Sheets ↗
                </a>
              )}
            </div>
            <label>
              Platform
              <select value={link.platform} onChange={(e) => updateLink(link._id, { platform: e.target.value })}>
                {platforms.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Google Sheet URL
              <input
                defaultValue={link.url}
                onBlur={(e) => e.target.value !== link.url && updateLink(link._id, { url: e.target.value })}
              />
            </label>
            <label>
              Label
              <input
                defaultValue={link.label}
                onBlur={(e) => e.target.value !== link.label && updateLink(link._id, { label: e.target.value })}
              />
            </label>
            <button type="button" className="btn-delete" onClick={() => removeLink(link._id)}>
              Delete link
            </button>
          </div>
        ))}

        <form onSubmit={addLink} className="sheet-link-row form admin-add-sheet">
          <p className="filter-label">Add new sheet link</p>
          <label>
            Platform
            <select value={newLink.platform} onChange={(e) => setNewLink({ ...newLink, platform: e.target.value })}>
              {platforms.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Google Sheet URL
            <input type="url" value={newLink.url} onChange={(e) => setNewLink({ ...newLink, url: e.target.value })} required />
          </label>
          <label>
            Label
            <input value={newLink.label} onChange={(e) => setNewLink({ ...newLink, label: e.target.value })} />
          </label>
          <button type="submit" className="btn btn-admin-accent">
            Add & sync
          </button>
        </form>
      </CollapsibleSection>

      <CollapsibleSection
        id="leads"
        title="All leads"
        subtitle={`Imported form responses · ${getPeriodLabel(period)}`}
        icon="👥"
        count={leadCount}
        open={openPanel === 'leads'}
        onToggle={() => setPanel('leads')}
      >
        <div className="table-wrap admin-leads-table-wrap">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Lead details</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {data.leads?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="center muted">
                    No leads yet. Add sheet links and sync.
                  </td>
                </tr>
              ) : (
                data.leads.map((lead) => (
                  <tr key={lead._id}>
                    <td>
                      <span className="platform-badge admin-platform-tag">{lead.platform}</span>
                    </td>
                    <td>
                      {getDisplayFields(lead.data).map(([k, v]) => (
                        <div key={k}>
                          <strong>{k}:</strong> {String(v)}
                        </div>
                      ))}
                    </td>
                    <td>
                      <span className={`status-select status-${lead.status || 'pending'} admin-status-tag`}>
                        {lead.status || 'pending'}
                      </span>
                    </td>
                    <td className="date-cell">
                      {lead.submittedAt ? new Date(lead.submittedAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {(openPanel === '' || openPanel === 'charts') && (
        <section className="admin-panel admin-charts-panel">
          <h3 className="chart-section-title">Analytics overview</h3>
          <StatsCharts platformData={platformChartData} statusData={statusChartData} />
        </section>
      )}
    </div>
  );
}
