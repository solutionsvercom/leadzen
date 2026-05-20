import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import LeadCard from '../components/LeadCard';
import PeriodFilter from '../components/PeriodFilter';
import StatsCharts, { STATUS_COLORS, STATUS_LABELS } from '../components/StatsCharts';
import { getPeriodLabel } from '../utils/periods';

const PLATFORM_LIST = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

function getSubscribedPlatforms(sheetLinks) {
  const linked = new Set((sheetLinks || []).map((link) => link.platform));
  return PLATFORM_LIST.filter((p) => linked.has(p.value));
}

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Convert' },
];

const PLATFORM_COLORS = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  youtube: '#FF0000',
  whatsapp: '#25D366',
};

const LEADS_PER_PAGE = 7;

function getDisplayFields(data) {
  const priority = ['Name', 'name', 'Email', 'email', 'Phone', 'phone', 'Mobile', 'WhatsApp', 'Message'];
  const entries = Object.entries(data || {});
  const ordered = [];

  for (const key of priority) {
    const found = entries.find(([k]) => k === key);
    if (found) ordered.push(found);
  }

  for (const entry of entries) {
    if (!ordered.find(([k]) => k === entry[0]) && entry[0] !== 'Timestamp') {
      ordered.push(entry);
    }
  }

  return ordered.slice(0, 5);
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [platformCounts, setPlatformCounts] = useState({});
  const [statusCounts, setStatusCounts] = useState({});
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [period, setPeriod] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const subscribedPlatforms = useMemo(
    () => getSubscribedPlatforms(user?.business?.sheetLinks),
    [user?.business?.sheetLinks]
  );

  const platformFilters = useMemo(
    () => [{ value: 'all', label: 'All' }, ...subscribedPlatforms],
    [subscribedPlatforms]
  );

  useEffect(() => {
    if (filter !== 'all' && !subscribedPlatforms.some((p) => p.value === filter)) {
      setFilter('all');
    }
  }, [filter, subscribedPlatforms]);

  useEffect(() => {
    setPage(1);
  }, [filter, statusFilter, search, period]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/leads', {
        params: {
          platform: filter,
          status: statusFilter,
          search: search || undefined,
          period: period !== 'all' ? period : undefined,
          page,
          limit: LEADS_PER_PAGE,
        },
      });
      setLeads(res.data.leads);
      setPlatformCounts(res.data.platformCounts);
      setStatusCounts(res.data.statusCounts || {});
      setTotalLeads(res.data.total ?? 0);
      setTotalPages(res.data.totalPages ?? 1);
      if (res.data.page && res.data.page !== page) {
        setPage(res.data.page);
      }
    } catch {
      setMessage('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [filter, statusFilter, search, period, page]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [1];
    if (totalPages <= 8) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    if (page > 3) pages.push('…');
    for (let n = Math.max(2, page - 1); n <= Math.min(totalPages - 1, page + 1); n += 1) {
      if (!pages.includes(n)) pages.push(n);
    }
    if (page < totalPages - 2) pages.push('…');
    if (!pages.includes(totalPages)) pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  const rangeStart = totalLeads === 0 ? 0 : (page - 1) * LEADS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * LEADS_PER_PAGE, totalLeads);

  const platformChartData = useMemo(
    () =>
      subscribedPlatforms.map((p) => ({
        name: p.label,
        value: platformCounts[p.value] ?? 0,
        color: PLATFORM_COLORS[p.value],
      })),
    [subscribedPlatforms, platformCounts]
  );

  const statusChartData = useMemo(
    () =>
      ['pending', 'contacted', 'converted'].map((key) => ({
        name: STATUS_LABELS[key],
        value: statusCounts[key] ?? 0,
        color: STATUS_COLORS[key],
      })),
    [statusCounts]
  );

  useEffect(() => {
    const timer = setTimeout(fetchLeads, 300);
    return () => clearTimeout(timer);
  }, [fetchLeads]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage('');
    try {
      const res = await api.post('/leads/sync');
      const failed = res.data.syncResults?.filter((r) => !r.success);
      if (failed?.length) {
        setMessage(`Some sheets failed: ${failed.map((f) => f.error).join('; ')}`);
      } else {
        setMessage('Leads synced successfully');
      }
      fetchLeads();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleStatusChange = async (leadId, status) => {
    try {
      await api.patch(`/leads/${leadId}/status`, { status });
      setLeads((prev) => prev.map((lead) => (lead._id === leadId ? { ...lead, status } : lead)));
      fetchLeads();
    } catch {
      setMessage('Failed to update status');
    }
  };

  const handleDelete = async (leadId) => {
    if (!window.confirm('Delete this lead permanently?')) return;

    try {
      await api.delete(`/leads/${leadId}`);
      setMessage('Lead deleted');
      if (leads.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchLeads();
      }
    } catch {
      setMessage('Failed to delete lead');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const logoUrl = user?.business?.logo
    ? user.business.logo.startsWith('http')
      ? user.business.logo
      : user.business.logo
    : null;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="brand">
          {logoUrl ? <img src={logoUrl} alt="" className="brand-logo" /> : <div className="brand-logo placeholder">LM</div>}
          <div className="brand-text">
            <h1>{user?.business?.name}</h1>
            <p className="muted">Lead Management Portal</p>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync sheets'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="stats-grid">
        {subscribedPlatforms.map((p) => (
          <div key={p.value} className="stat-card" style={{ borderTopColor: PLATFORM_COLORS[p.value] }}>
            <span className="stat-label">{p.label}</span>
            <span className="stat-value">{platformCounts[p.value] ?? 0}</span>
          </div>
        ))}
        <div className="stat-card stat-total">
          <span className="stat-label">Total leads ({getPeriodLabel(period)})</span>
          <span className="stat-value">{platformCounts.total ?? 0}</span>
        </div>
      </section>

      <section className="stats-grid status-stats">
        {STATUSES.filter((s) => s.value !== 'all').map((s) => (
          <div key={s.value} className={`stat-card status-stat status-${s.value}`}>
            <span className="stat-label">{s.label}</span>
            <span className="stat-value">{statusCounts[s.value] ?? 0}</span>
          </div>
        ))}
      </section>

      <StatsCharts platformData={platformChartData} statusData={statusChartData} />

      <section className="leads-panel">
        <div className="leads-toolbar">
          <PeriodFilter value={period} onChange={setPeriod} label="View leads by period" />
          <div className="filter-group">
            <span className="filter-label">Platform</span>
            <div className="filter-tabs-scroll">
              <div className="filter-tabs">
              {platformFilters.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`filter-tab ${filter === p.value ? 'active' : ''}`}
                  onClick={() => setFilter(p.value)}
                >
                  {p.label}
                </button>
              ))}
              </div>
            </div>
          </div>
          <div className="filter-group">
            <span className="filter-label">Status</span>
            <div className="filter-tabs-scroll">
              <div className="filter-tabs">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`filter-tab status-tab status-tab-${s.value} ${statusFilter === s.value ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s.value)}
                >
                  {s.label}
                </button>
              ))}
              </div>
            </div>
          </div>
          <input
            type="search"
            className="search-input"
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {message && <p className={message.includes('failed') ? 'error banner' : 'success banner'}>{message}</p>}

        {loading ? (
          <p className="muted center">Loading leads...</p>
        ) : totalLeads === 0 ? (
          <div className="empty-state">
            <p>No leads yet.</p>
            <p className="muted">Connect Google Sheets and click Sync sheets to import form responses.</p>
          </div>
        ) : (
          <>
            <div className="leads-cards">
              {leads.map((lead) => (
                <LeadCard
                  key={lead._id}
                  lead={lead}
                  fields={getDisplayFields(lead.data)}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
            <div className="table-wrap leads-table-desktop">
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Lead details</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const fields = getDisplayFields(lead.data);
                  const status = lead.status || 'pending';
                  return (
                    <tr key={lead._id}>
                      <td>
                        <span
                          className="platform-badge"
                          style={{
                            backgroundColor: `${PLATFORM_COLORS[lead.platform]}22`,
                            color: PLATFORM_COLORS[lead.platform],
                          }}
                        >
                          {lead.platform}
                        </span>
                      </td>
                      <td>
                        <div className="lead-fields">
                          {fields.map(([key, value]) => (
                            <div key={key}>
                              <strong>{key}:</strong> {String(value)}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <select
                          className={`status-select status-${status}`}
                          value={status}
                          onChange={(e) => handleStatusChange(lead._id, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="contacted">Contacted</option>
                          <option value="converted">Convert</option>
                        </select>
                      </td>
                      <td className="date-cell">
                        {lead.submittedAt
                          ? new Date(lead.submittedAt).toLocaleString()
                          : new Date(lead.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <button type="button" className="btn-delete" onClick={() => handleDelete(lead._id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <p className="pagination-info">
                  Showing {rangeStart}–{rangeEnd} of {totalLeads} leads · {getPeriodLabel(period)}
                </p>
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="btn btn-secondary pagination-btn"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <div className="pagination-pages">
                    {pageNumbers.map((num, idx) =>
                      num === '…' ? (
                        <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                          …
                        </span>
                      ) : (
                        <button
                          key={num}
                          type="button"
                          className={`pagination-page ${page === num ? 'active' : ''}`}
                          onClick={() => setPage(num)}
                        >
                          {num}
                        </button>
                      )
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary pagination-btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
