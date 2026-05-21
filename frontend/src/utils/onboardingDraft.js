import { ONBOARDING_DRAFT_KEY } from '../components/OnboardingStepIndicator';

export function readOnboardingDraft(requireSheetLinks = false) {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.businessName || !d?.name || !d?.username || !d?.password) return null;
    if (requireSheetLinks) {
      const links = Array.isArray(d.sheetLinks) ? d.sheetLinks.filter((l) => l?.url?.trim()) : [];
      if (links.length === 0) return null;
      return { ...d, sheetLinks: links };
    }
    return d;
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(partial) {
  const current = readOnboardingDraft(false) || {};
  const next = { ...current, ...partial };
  sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(next));
  return next;
}
