import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Welcome from './pages/Welcome';
import OnboardingStep1 from './pages/OnboardingStep1';
import OnboardingPayment from './pages/OnboardingPayment';
import OnboardingStep2 from './pages/OnboardingStep2';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminLayout from './pages/admin/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminClientDetail from './pages/admin/AdminClientDetail';

function ProtectedRoute({ children }) {
  const { user, loading, isSuperAdmin } = useAuth();
  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (isSuperAdmin) return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }

  return (
    <Routes>
      <Route
        path="/admin/login"
        element={isSuperAdmin ? <Navigate to="/admin" replace /> : <AdminLogin />}
      />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="clients/:businessId" element={<AdminClientDetail />} />
      </Route>

      <Route
        path="/"
        element={
          user ? (
            isSuperAdmin ? (
              <Navigate to="/admin" replace />
            ) : user.business?.onboardingComplete ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/onboarding/sheets" replace />
            )
          ) : (
            <Welcome />
          )
        }
      />
      <Route
        path="/login"
        element={
          user ? (
            isSuperAdmin ? (
              <Navigate to="/admin" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/onboarding"
        element={
          user ? (
            <Navigate
              to={user.business?.onboardingComplete ? '/dashboard' : '/onboarding/sheets'}
              replace
            />
          ) : (
            <OnboardingStep1 />
          )
        }
      />
      <Route path="/onboarding/sheets" element={<OnboardingStep2 />} />
      <Route path="/onboarding/payment" element={<OnboardingPayment />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {user && !user.business?.onboardingComplete ? (
              <Navigate to="/onboarding/sheets" replace />
            ) : (
              <Dashboard />
            )}
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
