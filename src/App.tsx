import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdvicePage } from './pages/AdvicePage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { RecordPage } from './pages/RecordPage';
import { SettingsPage } from './pages/SettingsPage';
import { useApp } from './store/AppContext';

function RequireProfile({ children }: { children: ReactNode }) {
  const { profile } = useApp();
  if (!profile) return <Navigate to="/onboarding" replace />;
  return children;
}

export default function App() {
  const { ready } = useApp();

  if (!ready) {
    return <div className="loading">読み込み中…</div>;
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        element={
          <RequireProfile>
            <Layout />
          </RequireProfile>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/advice" element={<AdvicePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="/record"
        element={
          <RequireProfile>
            <RecordPage />
          </RequireProfile>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
