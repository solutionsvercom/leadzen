const PLATFORM_COLORS = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  youtube: '#FF0000',
  whatsapp: '#25D366',
};

export default function LeadCard({ lead, fields, onStatusChange, onDelete }) {
  const status = lead.status || 'pending';

  return (
    <article className="lead-card">
      <div className="lead-card-header">
        <span
          className="platform-badge"
          style={{
            backgroundColor: `${PLATFORM_COLORS[lead.platform]}22`,
            color: PLATFORM_COLORS[lead.platform],
          }}
        >
          {lead.platform}
        </span>
        <span className="lead-card-date">
          {lead.submittedAt
            ? new Date(lead.submittedAt).toLocaleString()
            : new Date(lead.createdAt).toLocaleString()}
        </span>
      </div>

      <div className="lead-fields">
        {fields.map(([key, value]) => (
          <div key={key}>
            <strong>{key}:</strong> {String(value)}
          </div>
        ))}
      </div>

      <div className="lead-card-actions">
        <select
          className={`status-select status-${status}`}
          value={status}
          onChange={(e) => onStatusChange(lead._id, e.target.value)}
          aria-label="Lead status"
        >
          <option value="pending">Pending</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Convert</option>
        </select>
        <button type="button" className="btn-delete" onClick={() => onDelete(lead._id)}>
          Delete
        </button>
      </div>
    </article>
  );
}
