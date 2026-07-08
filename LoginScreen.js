import React, { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, InputAdornment, IconButton, Divider,
} from '@mui/material';
import {
  LockOutlined, Visibility, VisibilityOff,
  Router, Person, Security,
} from '@mui/icons-material';

/**
 * LoginScreen
 *
 * Mparivahan-styled secure login page with government branding.
 * Deep blue gradient header, white card, saffron accent button.
 */
export default function LoginScreen({ onLogin, serverUrl: defaultUrl }) {
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState(
    defaultUrl || process.env.REACT_APP_SERVER_URL || 'http://localhost:3001'
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      onLogin(data.token, serverUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={styles.page}>
      {/* Government-style gradient header */}
      <Box sx={styles.header}>
        <Box sx={styles.headerContent}>
          <Security sx={{ fontSize: 40, color: '#FFD54F', mb: 1 }} />
          <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700 }}>
            RemoteAdmin
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.5 }}>
            Secure Remote Administration Platform
          </Typography>
        </Box>
        {/* Saffron accent stripe */}
        <Box sx={styles.saffronStripe} />
      </Box>

      {/* Login Card */}
      <Box sx={styles.cardWrapper}>
        <Card sx={styles.card}>
          <CardContent sx={{ p: 4 }}>
            {/* Card Header */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box sx={styles.avatarCircle}>
                <LockOutlined sx={{ fontSize: 28, color: '#1565C0' }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#0D47A1', mt: 2 }}>
                Secure Access
              </Typography>
              <Typography variant="body2" sx={{ color: '#757575', mt: 0.5 }}>
                Enter your credentials to continue
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleLogin}>
              {/* Server URL */}
              <TextField
                fullWidth
                label="Server URL"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                sx={{ mb: 2.5 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Router sx={{ color: '#757575' }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Password */}
              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person sx={{ color: '#757575' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        size="small"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Login Button */}
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 700,
                  letterSpacing: 1,
                  background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0A3A8A 0%, #0D47A1 100%)',
                  },
                }}
              >
                {loading ? 'CONNECTING...' : 'CONNECT'}
              </Button>
            </form>

            <Divider sx={{ my: 3 }} />

            {/* Security notice */}
            <Box sx={styles.securityNotice}>
              <Security sx={{ fontSize: 16, color: '#F9A825' }} />
              <Typography variant="caption" sx={{ color: '#757575', ml: 1 }}>
                All communication is encrypted end-to-end. Only authorized operators
                can access connected devices.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Footer */}
      <Box sx={styles.footer}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          RemoteAdmin Platform v1.0 — Authorized Use Only
        </Typography>
      </Box>
    </Box>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'linear-gradient(180deg, #E3F2FD 0%, #F5F5F5 50%)',
  },
  header: {
    width: '100%',
    background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 50%, #1976D2 100%)',
    textAlign: 'center',
    pt: 6,
    pb: 4,
    position: 'relative',
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  saffronStripe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    background: 'linear-gradient(90deg, #FF6F00 0%, #FFA040 50%, #FF6F00 100%)',
  },
  cardWrapper: {
    mt: -4,
    width: '100%',
    maxWidth: 440,
    px: 2,
    zIndex: 1,
  },
  card: {
    borderRadius: 3,
    boxShadow: '0 8px 32px rgba(13,71,161,0.15)',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#E3F2FD',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    mx: 'auto',
  },
  securityNotice: {
    display: 'flex',
    alignItems: 'flex-start',
    p: 1.5,
    borderRadius: 2,
    backgroundColor: '#FFF8E1',
  },
  footer: {
    mt: 'auto',
    py: 3,
    textAlign: 'center',
  },
};
