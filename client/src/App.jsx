import { useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage.jsx';
import SavingsGoalsPage from './pages/SavingsGoalsPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import PagesPage from './pages/PagesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import FixedExpensesPage from './pages/FixedExpensesPage.jsx';

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('budsjett-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

const App = () => {
  const [theme, setTheme] = useState(getInitialTheme);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('budsjett-theme', theme);
  }, [theme]);

  const standaloneMediaQuery = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return null;
    return window.matchMedia('(display-mode: standalone)');
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setIsInstalled(true);
    };

    const checkStandalone = () => {
      const isStandalone =
        Boolean(window.navigator.standalone) || (standaloneMediaQuery && standaloneMediaQuery.matches);
      setIsInstalled(isStandalone);
    };

    checkStandalone();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (standaloneMediaQuery) {
      standaloneMediaQuery.addEventListener('change', checkStandalone);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);

      if (standaloneMediaQuery) {
        standaloneMediaQuery.removeEventListener('change', checkStandalone);
      }
    };
  }, [standaloneMediaQuery]);

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
      setInstallPromptEvent(null);
      setIsInstalled(true);
    }
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="navbar-brand">
          <h1>Familiebudsjett</h1>
          <p>Hold styr på økonomien med ro i sjela</p>
        </div>
        <div className="navbar-actions">
          {!isInstalled && installPromptEvent && (
            <button type="button" className="install-button" onClick={handleInstallClick}>
              📲 Installer appen
            </button>
          )}
          <div className="nav-links">
            <NavLink to="/" end>
              Oversikt
            </NavLink>
            <NavLink to="/faste-utgifter">Faste utgifter</NavLink>
            <NavLink to="/sparemal">Sparemål</NavLink>
            <NavLink to="/categories">Kategorier</NavLink>
            <NavLink to="/innstillinger">Innstillinger</NavLink>
          </div>
          <button type="button" className="theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? '🌙 Mørk modus' : '☀️ Lys modus'}
          </button>
        </div>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/faste-utgifter" element={<FixedExpensesPage />} />
          <Route path="/sparemal" element={<SavingsGoalsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/pages" element={<PagesPage />} />
          <Route path="/innstillinger" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
