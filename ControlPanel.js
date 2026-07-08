import React, { useState } from 'react';
import {
  Box, Typography, Paper, IconButton, Tooltip, Button, Chip,
  Divider, Switch, FormControlLabel, TextField, Alert,
} from '@mui/material';
import {
  TouchApp, ScreenShare, CameraAlt, Mic, MicOff, Videocam, VideocamOff,
  Home, ArrowBack, Apps, KeyboardArrowUp, KeyboardArrowDown,
  Keyboard, Settings, PowerSettingsNew, Refresh, Send,
  FiberManualRecord, Stop, CameraFront, CameraRear,
} from '@mui/icons-material';

/**
 * ControlPanel
 *
 * Mparivahan-themed control center with buttons for:
 * - Screen capture toggle
 * - Camera toggle (front/back)
 * - Microphone toggle
 * - Navigation: Home, Back, Recents
 * - Scroll up/down
 * - Text input
 * - Quick app launcher
 * - Device status display
 */
export default function ControlPanel({ sendCommand, status, currentDevice }) {
  const [textInput, setTextInput] = useState('');
  const [flashOn, setFlashOn] = useState(false);

  const handleSendText = () => {
    if (textInput.trim()) {
      sendCommand('text', { text: textInput });
      setTextInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSendText();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* ─── Device Status Card ──────────────────────────────────────── */}
      <Paper sx={styles.card}>
        <Box sx={styles.cardHeader}>
          <Typography variant="subtitle2" sx={{ color: '#0D47A1', fontWeight: 700 }}>
            DEVICE STATUS
          </Typography>
          {currentDevice && (
            <Chip
              label={currentDevice.deviceInfo?.model || 'Connected'}
              size="small"
              color="info"
              sx={{ height: 22, fontSize: '0.7rem' }}
            />
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1 }}>
          <StatusIndicator
            label="Screen"
            active={status.screenCapture}
            icon={<ScreenShare sx={{ fontSize: 14 }} />}
          />
          <StatusIndicator
            label="Camera"
            active={status.camera}
            icon={<CameraAlt sx={{ fontSize: 14 }} />}
          />
          <StatusIndicator
            label="Mic"
            active={status.mic}
            icon={<Mic sx={{ fontSize: 14 }} />}
          />
          <StatusIndicator
            label="A11y"
            active={status.accessibility}
            icon={<TouchApp sx={{ fontSize: 14 }} />}
          />
        </Box>

        {currentDevice?.deviceInfo?.batteryLevel != null && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" sx={{ color: '#757575' }}>
              Battery: {currentDevice.deviceInfo.batteryLevel}%
            </Typography>
            <Box sx={styles.batteryBar}>
              <Box
                sx={{
                  height: '100%',
                  width: `${currentDevice.deviceInfo.batteryLevel}%`,
                  borderRadius: 1,
                  background: currentDevice.deviceInfo.batteryLevel > 20
                    ? 'linear-gradient(90deg, #2E7D32, #66BB6A)'
                    : 'linear-gradient(90deg, #C62828, #EF5350)',
                }}
              />
            </Box>
          </Box>
        )}
      </Paper>

      {/* ─── Screen Capture ──────────────────────────────────────────── */}
      <Paper sx={styles.card}>
        <Box sx={styles.cardHeader}>
          <Typography variant="subtitle2" sx={{ color: '#0D47A1', fontWeight: 700 }}>
            SCREEN CAPTURE
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button
            fullWidth
            variant={status.screenCapture ? 'outlined' : 'contained'}
            color={status.screenCapture ? 'error' : 'primary'}
            startIcon={status.screenCapture ? <Stop /> : <FiberManualRecord />}
            onClick={() => sendCommand(status.screenCapture ? 'stopScreenCapture' : 'startScreenCapture')}
            sx={{ py: 1 }}
          >
            {status.screenCapture ? 'STOP' : 'START'}
          </Button>
        </Box>
      </Paper>

      {/* ─── Camera & Mic ───────────────────────────────────────────── */}
      <Paper sx={styles.card}>
        <Box sx={styles.cardHeader}>
          <Typography variant="subtitle2" sx={{ color: '#0D47A1', fontWeight: 700 }}>
            CAMERA & MIC
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          {/* Camera Front */}
          <Tooltip title="Front Camera">
            <IconButton
              onClick={() => sendCommand('startCamera', { front: true })}
              sx={{
                ...styles.mediaButton,
                backgroundColor: status.camera ? '#E3F2FD' : '#F5F5F5',
                color: status.camera ? '#1565C0' : '#757575',
              }}
            >
              <CameraFront />
            </IconButton>
          </Tooltip>

          {/* Camera Back */}
          <Tooltip title="Back Camera">
            <IconButton
              onClick={() => sendCommand('startCamera', { front: false })}
              sx={{
                ...styles.mediaButton,
                backgroundColor: status.camera ? '#E3F2FD' : '#F5F5F5',
                color: status.camera ? '#1565C0' : '#757575',
              }}
            >
              <CameraRear />
            </IconButton>
          </Tooltip>

          {/* Camera Off */}
          <Tooltip title="Stop Camera">
            <IconButton
              onClick={() => sendCommand('stopCamera')}
              sx={{
                ...styles.mediaButton,
                backgroundColor: '#F5F5F5',
                color: '#C62828',
              }}
            >
              <VideocamOff />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem />

          {/* Microphone Toggle */}
          <Tooltip title={status.mic ? 'Stop Mic' : 'Start Mic'}>
            <IconButton
              onClick={() => sendCommand(status.mic ? 'stopMic' : 'startMic')}
              sx={{
                ...styles.mediaButton,
                backgroundColor: status.mic ? '#E8F5E9' : '#F5F5F5',
                color: status.mic ? '#2E7D32' : '#757575',
              }}
            >
              {status.mic ? <Mic /> : <MicOff />}
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* ─── Navigation Controls ─────────────────────────────────────── */}
      <Paper sx={styles.card}>
        <Box sx={styles.cardHeader}>
          <Typography variant="subtitle2" sx={{ color: '#0D47A1', fontWeight: 700 }}>
            NAVIGATION
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 1, justifyContent: 'center' }}>
          <Tooltip title="Back (Right-click on screen)">
            <IconButton onClick={() => sendCommand('back')} sx={styles.navButton}>
              <ArrowBack />
            </IconButton>
          </Tooltip>
          <Tooltip title="Home (Double-click on screen)">
            <IconButton onClick={() => sendCommand('home')} sx={styles.navButton}>
              <Home />
            </IconButton>
          </Tooltip>
          <Tooltip title="Recent Apps">
            <IconButton onClick={() => sendCommand('recents')} sx={styles.navButton}>
              <Apps />
            </IconButton>
          </Tooltip>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* Scroll Buttons */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
          <Tooltip title="Scroll Up">
            <IconButton onClick={() => sendCommand('scrollUp')} sx={styles.scrollButton}>
              <KeyboardArrowUp />
            </IconButton>
          </Tooltip>
          <Tooltip title="Scroll Down">
            <IconButton onClick={() => sendCommand('scrollDown')} sx={styles.scrollButton}>
              <KeyboardArrowDown />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* ─── Text Input ─────────────────────────────────────────────── */}
      <Paper sx={styles.card}>
        <Box sx={styles.cardHeader}>
          <Typography variant="subtitle2" sx={{ color: '#0D47A1', fontWeight: 700 }}>
            TEXT INPUT
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Type text to send..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            InputProps={{
              startAdornment: <Keyboard sx={{ mr: 0.5, color: '#9E9E9E', fontSize: 18 }} />,
            }}
          />
          <Tooltip title="Send">
            <IconButton
              onClick={handleSendText}
              disabled={!textInput.trim()}
              sx={{
                backgroundColor: '#1565C0',
                color: '#fff',
                '&:hover': { backgroundColor: '#0D47A1' },
                '&.Mui-disabled': { backgroundColor: '#E0E0E0', color: '#9E9E9E' },
              }}
            >
              <Send />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* ─── Quick Actions ──────────────────────────────────────────── */}
      <Paper sx={styles.card}>
        <Box sx={styles.cardHeader}>
          <Typography variant="subtitle2" sx={{ color: '#0D47A1', fontWeight: 700 }}>
            QUICK ACTIONS
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {quickActions.map((action) => (
            <Button
              key={action.action}
              size="small"
              variant="outlined"
              startIcon={<action.icon sx={{ fontSize: 16 }} />}
              onClick={() => sendCommand(action.action, action.payload)}
              sx={styles.quickAction}
            >
              {action.label}
            </Button>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function StatusIndicator({ label, active, icon }) {
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 0.75,
      p: 0.75,
      borderRadius: 1.5,
      backgroundColor: active ? '#E8F5E9' : '#FAFAFA',
      border: `1px solid ${active ? '#A5D6A7' : '#E0E0E0'}`,
    }}>
      <Box sx={{
        width: 8, height: 8, borderRadius: '50%',
        backgroundColor: active ? '#2E7D32' : '#BDBDBD',
      }} />
      <Box sx={{ color: active ? '#2E7D32' : '#9E9E9E', display: 'flex' }}>
        {icon}
      </Box>
      <Typography variant="caption" sx={{
        fontWeight: 600,
        color: active ? '#2E7D32' : '#9E9E9E',
        fontSize: '0.7rem',
      }}>
        {label}
      </Typography>
    </Box>
  );
}

const quickActions = [
  { label: 'Settings', action: 'openSettings', icon: Settings },
  { label: 'Notifications', action: 'notifications', icon: null },
  { label: 'Quick Settings', action: 'quickSettings', icon: null },
];

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = {
  card: {
    borderRadius: 3,
    p: 2,
    border: '1px solid #E0E0E0',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediaButton: {
    width: 48,
    height: 48,
    borderRadius: 2,
    border: '1px solid #E0E0E0',
    transition: 'all 0.2s ease',
    '&:hover': { transform: 'scale(1.05)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  },
  navButton: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    backgroundColor: '#E3F2FD',
    color: '#1565C0',
    border: '2px solid #BBDEFB',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#BBDEFB',
      transform: 'scale(1.08)',
      boxShadow: '0 4px 12px rgba(21,101,192,0.2)',
    },
  },
  scrollButton: {
    width: 44,
    height: 44,
    borderRadius: 2,
    backgroundColor: '#F5F5F5',
    color: '#757575',
    border: '1px solid #E0E0E0',
    '&:hover': { backgroundColor: '#E0E0E0', color: '#424242' },
  },
  quickAction: {
    borderRadius: 2,
    borderColor: '#BBDEFB',
    color: '#1565C0',
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'none',
    '&:hover': { backgroundColor: '#E3F2FD', borderColor: '#1565C0' },
  },
  batteryBar: {
    height: 6,
    width: '100%',
    backgroundColor: '#E0E0E0',
    borderRadius: 1,
    overflow: 'hidden',
    mt: 0.25,
  },
};
