export default function CollapsibleSection({ id, title, subtitle, icon, count, open, onToggle, children }) {
  return (
    <section className={`admin-collapse ${open ? 'is-open' : ''}`} id={id}>
      <button type="button" className="admin-collapse-trigger" onClick={onToggle} aria-expanded={open}>
        <span className="admin-collapse-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="admin-collapse-text">
          <span className="admin-collapse-title">{title}</span>
          {subtitle && <span className="admin-collapse-subtitle">{subtitle}</span>}
        </span>
        {count !== undefined && <span className="admin-collapse-badge">{count}</span>}
        <span className="admin-collapse-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="admin-collapse-body">{children}</div>}
    </section>
  );
}
