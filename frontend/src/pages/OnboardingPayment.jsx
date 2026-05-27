import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import OnboardingStepIndicator from '../components/OnboardingStepIndicator';
import { ONBOARDING_DRAFT_KEY } from '../components/OnboardingStepIndicator';
import { readOnboardingDraft } from '../utils/onboardingDraft';

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      const t0 = Date.now();
      const interval = setInterval(() => {
        if (window.Razorpay) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - t0 > 20000) {
          clearInterval(interval);
          reject(new Error('Razorpay load timeout'));
        }
      }, 50);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.dataset.razorpayCheckout = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay'));
    document.body.appendChild(s);
  });
}

async function uploadLogoFromDataUrl(dataUrl) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], 'logo.png', { type: blob.type || 'image/png' });
  const data = new FormData();
  data.append('logo', file);
  await api.patch('/business/logo', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export default function OnboardingPayment() {
  const navigate = useNavigate();
  const { user, loading: authLoading, register } = useAuth();
  const [draft, setDraft] = useState(() => readOnboardingDraft(true));
  const [paymentCfg, setPaymentCfg] = useState(null);
  const [cfgError, setCfgError] = useState('');
  const [error, setError] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  useEffect(() => {
    setDraft(readOnboardingDraft(true));
  }, []);

  useEffect(() => {
    api
      .get('/auth/payment-config')
      .then((res) => setPaymentCfg(res.data))
      .catch(() => setCfgError('Could not load payment settings. Is the backend running?'));
  }, []);

  const finishSignup = useCallback(
    async (payload) => {
      setError('');
      setPayBusy(true);
      try {
        await register({
          businessName: draft.businessName,
          name: draft.name,
          username: draft.username,
          password: draft.password,
          links: draft.sheetLinks,
          ...payload,
        });

        if (draft.logoDataUrl) {
          try {
            await uploadLogoFromDataUrl(draft.logoDataUrl);
          } catch {
            /* optional */
          }
        }

        sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
        navigate('/dashboard');
      } catch (err) {
        setError(err.response?.data?.message || 'Could not create account. Contact support.');
      } finally {
        setPayBusy(false);
      }
    },
    [draft, navigate, register]
  );

  const continueWithBypass = useCallback(() => {
    finishSignup({ paymentBypass: true });
  }, [finishSignup]);

  const startRazorpayPayment = useCallback(async () => {
    if (!draft || !paymentCfg?.razorpayEnabled) return;
    setError('');
    setPayBusy(true);
    try {
      await loadRazorpayScript();
      const { data } = await api.post('/auth/payment-order');

      const options = {
        key: data.keyId,
        amount: String(data.amount),
        currency: data.currency,
        name: data.name,
        description: data.description || 'New account signup',
        order_id: data.orderId,
        handler: async (response) => {
          await finishSignup({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => {
            setPayBusy(false);
          },
        },
        theme: { color: '#2563eb' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (fail) => {
        setError(fail?.error?.description || 'Payment failed. Try again.');
        setPayBusy(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not start payment.');
      setPayBusy(false);
    }
  }, [finishSignup, draft, paymentCfg?.razorpayEnabled]);

  const handleContinue = useCallback(() => {
    if (paymentCfg?.razorpayBypass) {
      continueWithBypass();
    } else {
      startRazorpayPayment();
    }
  }, [paymentCfg?.razorpayBypass, continueWithBypass, startRazorpayPayment]);

  if (authLoading) {
    return (
      <AuthLayout>
        <div className="auth-card">
          <p className="muted center">Loading...</p>
        </div>
      </AuthLayout>
    );
  }

  if (user) {
    return <Navigate to={user.business?.onboardingComplete ? '/dashboard' : '/onboarding/sheets'} replace />;
  }

  if (!readOnboardingDraft(false)) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!draft) {
    return <Navigate to="/onboarding/sheets" replace />;
  }

  const rupees = paymentCfg?.amountRupees ?? '—';
  const razorpayLive = paymentCfg?.razorpayEnabled === true;
  const razorpayBypass = paymentCfg?.razorpayBypass === true;
  const canContinue = razorpayLive || razorpayBypass;
  const sheetCount = draft.sheetLinks?.length || 0;

  return (
    <AuthLayout>
      <div className="auth-card">
        <OnboardingStepIndicator step={3} />
        <h2>Pay &amp; create account</h2>
        <p className="muted">
          Step 3 of 3 — {razorpayBypass ? (
            <>
              <strong>Razorpay checkout</strong> (UPI, card, etc.) will apply once payment keys are added. For now you
              can continue without being charged. We will import leads from your {sheetCount} sheet
              {sheetCount === 1 ? '' : 's'} when you finish.
            </>
          ) : (
            <>
              Your account is created only after a <strong>successful Razorpay payment</strong>. We will import leads
              from your {sheetCount} sheet{sheetCount === 1 ? '' : 's'} after payment.
            </>
          )}
        </p>

        {cfgError && <p className="error banner">{cfgError}</p>}

        {paymentCfg && (
          <div className="info-box payment-info-box" style={{ marginBottom: 20 }}>
            <p style={{ margin: 0 }}>
              <strong>Amount:</strong> ₹{rupees}
              {razorpayBypass && (
                <span className="payment-bypass-badge"> — not charged until Razorpay is enabled</span>
              )}
            </p>
            <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.88rem' }}>
              {razorpayBypass ? (
                <>
                  Click <strong>Continue</strong> to create your account. Add <code>RAZORPAY_KEY_ID</code> and{' '}
                  <code>RAZORPAY_KEY_SECRET</code> on the server and set <code>RAZORPAY_BYPASS=false</code> when you
                  are ready for real payments.
                </>
              ) : (
                <>
                  Click <strong>Pay securely</strong> and complete payment in the Razorpay window. Your account and sheet
                  links will be saved together.
                </>
              )}
            </p>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className="payment-actions">
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={payBusy || !canContinue}
            onClick={handleContinue}
          >
            {payBusy
              ? 'Please wait…'
              : razorpayBypass
                ? `Continue — ₹${rupees} (payment skipped)`
                : `Pay securely — ₹${rupees}`}
          </button>
        </div>

        <p className="footer-link">
          <Link to="/onboarding/sheets">← Back to Google Sheets</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
