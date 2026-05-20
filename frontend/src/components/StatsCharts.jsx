import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const STATUS_COLORS = {
  pending: '#f59e0b',
  contacted: '#3b82f6',
  converted: '#16a34a',
};

const STATUS_LABELS = {
  pending: 'Pending',
  contacted: 'Contacted',
  converted: 'Convert',
};

function ChartEmpty({ message }) {
  return <p className="chart-empty muted">{message}</p>;
}

function filterNonZero(data) {
  return data.filter((item) => item.value > 0);
}

function renderSliceLabel({ name, percent, value }) {
  if (!value || value <= 0) return null;
  return `${name} ${(percent * 100).toFixed(0)}%`;
}

function renderTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="chart-tooltip">
      <strong>{item.name}</strong>: {item.value} leads
    </div>
  );
}

function ChartLegend({ items }) {
  return (
    <ul className="chart-legend-list">
      {items.map((item) => (
        <li key={item.name} className="chart-legend-item">
          <span className="chart-legend-dot" style={{ backgroundColor: item.color }} />
          <span className="chart-legend-name">{item.name}</span>
          <span className="chart-legend-value">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

function DonutChart({ data, allItems }) {
  const slices = filterNonZero(data);
  const total = slices.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) return null;

  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={slices.length > 1 ? 2 : 0}
            label={renderSliceLabel}
            labelLine={false}
          >
            {slices.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={renderTooltip} />
        </PieChart>
      </ResponsiveContainer>
      <ChartLegend items={allItems} />
    </>
  );
}

export default function StatsCharts({ platformData, statusData }) {
  const platformTotal = platformData.reduce((sum, item) => sum + item.value, 0);
  const statusTotal = statusData.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="charts-grid">
      <div className="chart-card">
        <h3 className="chart-title">Platform breakdown</h3>
        {platformTotal === 0 ? (
          <ChartEmpty message="No leads by platform yet." />
        ) : (
          <DonutChart data={platformData} allItems={platformData} />
        )}
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Status breakdown</h3>
        {statusTotal === 0 ? (
          <ChartEmpty message="No leads by status yet." />
        ) : (
          <DonutChart data={statusData} allItems={statusData} />
        )}
      </div>
    </section>
  );
}

export { STATUS_COLORS, STATUS_LABELS };
