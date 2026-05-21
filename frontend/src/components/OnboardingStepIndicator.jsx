export const ONBOARDING_DRAFT_KEY = 'onboarding_registration_draft';

export default function OnboardingStepIndicator({ step }) {
  const cls = (n) => {
    if (step === n) return 'step active';
    if (step > n) return 'step done';
    return 'step';
  };

  const labels = ['Details', 'Sheets', 'Payment'];

  return (
    <div className="step-indicator step-indicator-3" aria-label={`Onboarding step ${step} of 3`}>
      <div className="step-indicator-item">
        <span className={cls(1)}>1</span>
        <span className="step-label">{labels[0]}</span>
      </div>
      <span className="step-line" aria-hidden="true" />
      <div className="step-indicator-item">
        <span className={cls(2)}>2</span>
        <span className="step-label">{labels[1]}</span>
      </div>
      <span className="step-line" aria-hidden="true" />
      <div className="step-indicator-item">
        <span className={cls(3)}>3</span>
        <span className="step-label">{labels[2]}</span>
      </div>
    </div>
  );
}
