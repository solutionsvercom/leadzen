const VALID_PERIODS = ['all', 'day', 'week', 'month', 'quarter', 'year'];

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getPeriodRange(period) {
  if (!period || period === 'all') return null;

  const now = new Date();
  const end = new Date(now);
  let start;

  switch (period) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    case 'week':
      start = startOfWeek(now);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter': {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), quarterMonth, 1);
      break;
    }
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return null;
  }

  return { start, end };
}

function buildPeriodCondition(period) {
  const range = getPeriodRange(period);
  if (!range) return null;

  return {
    $expr: {
      $and: [
        { $gte: [{ $ifNull: ['$submittedAt', '$createdAt'] }, range.start] },
        { $lte: [{ $ifNull: ['$submittedAt', '$createdAt'] }, range.end] },
      ],
    },
  };
}

function mergeBusinessPeriodFilter(businessId, period) {
  const periodCond = buildPeriodCondition(period);
  const base = { business: businessId };
  if (!periodCond) return base;
  return { $and: [base, periodCond] };
}

function isValidPeriod(period) {
  return !period || VALID_PERIODS.includes(period);
}

const PERIOD_LABELS = {
  all: 'All time',
  day: 'Today',
  week: 'This week',
  month: 'This month',
  quarter: 'This quarter',
  year: 'This year',
};

module.exports = {
  VALID_PERIODS,
  PERIOD_LABELS,
  getPeriodRange,
  buildPeriodCondition,
  mergeBusinessPeriodFilter,
  isValidPeriod,
};
