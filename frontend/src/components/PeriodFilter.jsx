import { LEAD_PERIODS } from '../utils/periods';

export default function PeriodFilter({ value, onChange, className = '', label = 'Time period' }) {
  return (
    <div className={`period-filter ${className}`.trim()}>
      <label className="period-filter-label">
        {label}
        <select
          className="period-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        >
          {LEAD_PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
