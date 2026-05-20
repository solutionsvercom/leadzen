import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) return <p className="page-loading">Loading...</p>;

  if (!user || !isSuperAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
