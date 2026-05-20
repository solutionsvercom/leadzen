export const LEAD_PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
];

export function getPeriodLabel(value) {
  return LEAD_PERIODS.find((p) => p.value === value)?.label || 'All time';
}
