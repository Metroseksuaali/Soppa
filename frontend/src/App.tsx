import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { LoginPage } from './pages/Login';
import { HomePage } from './pages/Home';
import { InventoryPage } from './pages/Inventory';
import { ItemDetailPage } from './pages/ItemDetail';
import { LogPage } from './pages/Log';
import { LocationsPage } from './pages/Locations';
import { LocationDetailPage } from './pages/LocationDetail';
import { EventsPage } from './pages/Events';
import { ReportsPage } from './pages/Reports';
import { UsersPage } from './pages/Users';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/kirjaudu" state={{ from: location }} replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/kirjaudu" element={<LoginPage />} />
      <Route path="/" element={<Protected><HomePage /></Protected>} />
      <Route path="/inventaario" element={<Protected><InventoryPage /></Protected>} />
      <Route path="/inventaario/:id" element={<Protected><ItemDetailPage /></Protected>} />
      <Route path="/kirjaa" element={<Protected><LogPage /></Protected>} />
      <Route path="/sijainnit" element={<Protected><LocationsPage /></Protected>} />
      <Route path="/sijainnit/:id" element={<Protected><LocationDetailPage /></Protected>} />
      <Route path="/tapahtumat" element={<Protected><EventsPage /></Protected>} />
      <Route path="/raportit" element={<Protected><ReportsPage /></Protected>} />
      <Route path="/kayttajat" element={<Protected><UsersPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
