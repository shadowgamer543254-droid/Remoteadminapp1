import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import mparivahanTheme from './theme';
import LoginScreen from './components/LoginScreen';
import AdminPanel from './components/AdminPanel';

/**
 * App Root
 * Simple flow: Login → Admin Panel (device list → device control)
 */
export default function App() {
  const [token, setToken] = React.useState(null);
  const [serverUrl, setServerUrl] = React.useState(
    localStorage.getItem('ra_server') || 'http://localhost:3001'
  );

  const handleLogin = (newToken, url) => {
    setToken(newToken);
    setServerUrl(url);
    localStorage.setItem('ra_token', newToken);
    localStorage.setItem('ra_server', url);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('ra_token');
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('ra_token');
    if (saved) setToken(saved);
  }, []);

  return (
    <ThemeProvider theme={mparivahanTheme}>
      <CssBaseline />
      {!token ? (
        <LoginScreen onLogin={handleLogin} defaultUrl={serverUrl} />
      ) : (
        <AdminPanel token={token} serverUrl={serverUrl} onLogout={handleLogout} />
      )}
    </ThemeProvider>
  );
}
