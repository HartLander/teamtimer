import { useApp } from '@/contexts/AppContext';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppProvider } from '@/contexts/AppContext';
import Login from '@/pages/Login';
import AppLayout from '@/components/AppLayout';
import Planning from '@/pages/Planning';
import Employees from '@/pages/Employees';
import Evaluation from '@/pages/Evaluation';
import SettingsPage from '@/pages/Settings';
import AccountsPage from '@/pages/Accounts';
import NotFound from '@/pages/NotFound';

function AppRoutes() {
  const { isInitializing, isLoggedIn, currentUser } = useApp();

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        TeamTimer wird geladen …
      </div>
    );
  }

  if (!isLoggedIn) return <Login />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Planning />} />
        <Route path="/mitarbeiter" element={<Employees />} />
        <Route path="/auswertung" element={<Evaluation />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="/konten" element={currentUser?.isAdmin ? <AccountsPage /> : <NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <AppProvider>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </AppProvider>
);

export default App;
