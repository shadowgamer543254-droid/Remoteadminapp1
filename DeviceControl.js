import React, { useState } from 'react';
import {
  Box, Paper, Typography, IconButton, Tooltip, Button, Chip,
  Divider, TextField, Grid, Tabs, Tab,
} from '@mui/material';
import {
  ScreenShare, CameraAlt, Mic, MicOff, VideocamOff,
  Home, ArrowBack, Apps, KeyboardArrowUp, KeyboardArrowDown,
  Keyboard, LocationOn, PhoneAndroid, TouchApp, Folder,
  Contacts, Sms, CallLog, FiberManualRecord, Stop,
  CameraFront, CameraRear, Refresh, Send, Settings,
} from '@mui/icons-material';

/**
 * DeviceControl — Full control panel for a single device.
 *
 * Layout:
 *  - Left: Live phone screen (touch forwarded to device)
 *  - Right: Controls (screen capture, camera, mic, nav, text, location)
 *
 * Tabs at bottom for: Controls | Data (contacts/SMS/calls) | Files
 */
export default function DeviceControl({
  deviceId, send, deviceStatus, screenFrame, cameraFrame, location, lastData,
  remoteScreenStream, remoteCameraStream, remoteAudioStream,
  pcState, connectionStats,
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [textInput, setTextInput] = useState('');

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 1, md: 2 } }}>
      <Grid container spacing={2}>
        {/* ─── Phone Screen ───────────────────────────────── */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #E0E0E0' }}>
            <PhoneScreen
              screenFrame={screenFrame}
              remoteScreenStream={remoteScreenStream}
              pcState={pcState}
              connectionStats={connectionStats}
              send={send}
              status={deviceStatus}
            />
          </Paper>
        </Grid>

        {/* ─── Control Panel ──────────────────────────────── */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Screen Capture */}
            <ControlCard title="SCREEN CAPTURE" icon={<ScreenShare />}>
              <Button
                fullWidth
                variant={deviceStatus.screenCapture ? 'outlined' : 'contained'}
                color={deviceStatus.screenCapture ? 'error' : 'primary'}
                startIcon={deviceStatus.screenCapture ? <Stop /> : <FiberManualRecord />}
                onClick={() => send(deviceStatus.screenCapture ? 'stopScreenCapture' : 'startScreenCapture')}
              >
                {deviceStatus.screenCapture ? 'STOP CAPTURE' : 'START CAPTURE'}
              </Button>
            </ControlCard>

            {/* Camera & Mic */}
            <ControlCard title="CAMERA & MIC" icon={<CameraAlt />}>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                <MedBtn icon={<CameraFront />} label="Front" onClick={() => send('startCamera', { front: true })} />
                <MedBtn icon={<CameraRear />} label="Back" onClick={() => send('startCamera', { front: false })} />
                <MedBtn icon={<VideocamOff />} label="Stop" color="#C62828" onClick={() => send('stopCamera')} />
                <Divider orientation="vertical" flexItem />
                <MedBtn
                  icon={deviceStatus.mic ? <Mic /> : <MicOff />}
                  label={deviceStatus.mic ? 'On' : 'Off'}
                  color={deviceStatus.mic ? '#2E7D32' : '#9E9E9E'}
                  bgColor={deviceStatus.mic ? '#E8F5E9' : '#F5F5F5'}
                  onClick={() => send(deviceStatus.mic ? 'stopMic' : 'startMic')}
                />
              </Box>
            </ControlCard>

            {/* Navigation */}
            <ControlCard title="NAVIGATION" icon={<TouchApp />}>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                <NavBtn icon={<ArrowBack />} label="Back" onClick={() => send('back')} />
                <NavBtn icon={<Home />} label="Home" onClick={() => send('home')} />
                <NavBtn icon={<Apps />} label="Recents" onClick={() => send('recents')} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 1 }}>
                <ScrollBtn icon={<KeyboardArrowUp />} onClick={() => send('scrollUp')} />
                <ScrollBtn icon={<KeyboardArrowDown />} onClick={() => send('scrollDown')} />
              </Box>
            </ControlCard>

            {/* Text Input */}
            <ControlCard title="TEXT INPUT" icon={<Keyboard />}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth size="small"
                  placeholder="Type to send..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && textInput.trim()) {
                      send('text', { text: textInput });
                      setTextInput('');
                    }
                  }}
                />
                <Tooltip title="Send">
                  <IconButton
                    onClick={() => { if (textInput.trim()) { send('text', { text: textInput }); setTextInput(''); } }}
                    disabled={!textInput.trim()}
                    sx={{ bgcolor: '#1565C0', color: '#fff', '&:hover': { bgcolor: '#0D47A1' } }}
                  >
                    <Send />
                  </IconButton>
                </Tooltip>
              </Box>
            </ControlCard>

            {/* Location */}
            <ControlCard title="LOCATION" icon={<LocationOn />}>
              {location ? (
                <Box>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <Chip label={`Lat: ${location.latitude?.toFixed(6)}`} size="small" sx={{ fontSize: '0.7rem' }} />
                    <Chip label={`Lng: ${location.longitude?.toFixed(6)}`} size="small" sx={{ fontSize: '0.7rem' }} />
                  </Box>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                    target="_blank"
                    startIcon={<LocationOn />}
                    sx={{ borderColor: '#2E7D32', color: '#2E7D32' }}
                  >
                    Open in Google Maps
                  </Button>
                </Box>
              ) : (
                <Typography variant="caption" sx={{ color: '#9E9E9E', textAlign: 'center', display: 'block' }}>
                  Waiting for location data...
                </Typography>
              )}
            </ControlCard>

            {/* Quick Actions */}
            <ControlCard title="QUICK ACTIONS" icon={<Settings />}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {['openSettings', 'notifications', 'quickSettings'].map((action) => (
                  <Button key={action} size="small" variant="outlined"
                    onClick={() => send(action)}
                    sx={{ textTransform: 'none', fontSize: '0.7rem', borderColor: '#BBDEFB', color: '#1565C0' }}>
                    {action.replace(/([A-Z])/g, ' $1').trim()}
                  </Button>
                ))}
              </Box>
            </ControlCard>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

// ─── Phone Screen (with touch forwarding) ──────────────────────────────

function PhoneScreen({ screenFrame, remoteScreenStream, pcState, connectionStats, send, status }) {
  const ref = React.useRef(null);
  const videoRef = React.useRef(null);
  const dragging = React.useRef(false);
  const start = React.useRef({ x: 0, y: 0 });

  // Attach remote stream to video element
  React.useEffect(() => {
    if (videoRef.current && remoteScreenStream) {
      videoRef.current.srcObject = remoteScreenStream;
    }
  }, [remoteScreenStream]);

  const coords = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return null;
    return {
      x: Math.round(((e.clientX - r.left) / r.width) * 1080),
      y: Math.round(((e.clientY - r.top) / r.height) * 1920),
    };
  };

  return (
    <Box>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1, background: 'linear-gradient(135deg, #0D47A1, #1565C0)',
        borderBottom: '3px solid #FF6F00',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScreenShare sx={{ color: '#fff', fontSize: 18 }} />
          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>Live Screen</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {status.screenCapture && (
            <Chip icon={<FiberManualRecord sx={{ fontSize: 8, color: '#fff !important' }} />}
              label="REC" size="small"
              sx={{ backgroundColor: '#C62828', color: '#fff', height: 22, fontWeight: 700,
                '& .MuiChip-label': { px: 1 },
                animation: 'pulse 1.5s ease-in-out infinite',
                '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
              }}
            />
          )}
        </Box>
      </Box>

      <Box ref={ref} sx={{
        position: 'relative', background: '#000', aspectRatio: '9/16', maxHeight: '70vh',
        overflow: 'hidden', cursor: 'crosshair', userSelect: 'none',
      }}
        onMouseDown={(e) => {
          if (e.button === 2) { e.preventDefault(); send('back'); return; }
          dragging.current = true;
          start.current = coords(e) || { x: 0, y: 0 };
        }}
        onMouseUp={(e) => {
          if (!dragging.current) return;
          dragging.current = false;
          const end = coords(e);
          if (!end) return;
          const dx = Math.abs(end.x - start.current.x);
          const dy = Math.abs(end.y - start.current.y);
          if (dx < 15 && dy < 15) {
            send('tap', { x: end.x, y: end.y });
          } else {
            send('swipe', { sx: start.current.x, sy: start.current.y, ex: end.x, ey: end.y, dur: 200 });
          }
        }}
        onWheel={(e) => { e.preventDefault(); send(e.deltaY < 0 ? 'scrollUp' : 'scrollDown'); }}
        onContextMenu={(e) => e.preventDefault()}
        onDoubleClick={() => send('home')}
      >
        {remoteScreenStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', backgroundColor: '#000' }}
          />
        ) : screenFrame ? (
          <img src={screenFrame} alt="Screen" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <ScreenShare sx={{ fontSize: 48, color: '#424242', mb: 1 }} />
            <Typography variant="body2" sx={{ color: '#757575' }}>No Active Stream</Typography>
            <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
              {pcState === 'connecting' ? 'Establishing WebRTC connection...' : 'Click "Start Capture" to begin'}
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 2, py: 1, background: '#263238', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
          Click=Tap | Drag=Swipe | Scroll | Right-click=Back | Double-click=Home
        </Typography>
        {pcState === 'connected' && connectionStats.fps && (
          <Chip
            label={`${connectionStats.width}x${connectionStats.height} @ ${connectionStats.fps}fps`}
            size="small"
            sx={{ height: 18, fontSize: '0.6rem', backgroundColor: '#1B5E20', color: '#fff' }}
          />
        )}
      </Box>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>
    </Box>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function ControlCard({ title, icon, children }) {
  return (
    <Paper sx={{ borderRadius: 3, border: '1px solid #E0E0E0', overflow: 'hidden' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        px: 2, py: 1, background: 'linear-gradient(135deg, #0D47A1, #1565C0)',
        borderBottom: '2px solid #FF6F00',
      }}>
        <Box sx={{ color: '#FFD54F', display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.7rem', letterSpacing: 0.5 }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Paper>
  );
}

function MedBtn({ icon, label, color = '#757575', bgColor = '#F5F5F5', onClick }) {
  return (
    <Tooltip title={label}>
      <IconButton onClick={onClick} sx={{
        width: 48, height: 48, borderRadius: 2,
        backgroundColor: bgColor, color,
        border: '1px solid #E0E0E0',
        transition: 'all 0.2s',
        '&:hover': { transform: 'scale(1.05)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
      }}>
        {icon}
      </IconButton>
    </Tooltip>
  );
}

function NavBtn({ icon, label, onClick }) {
  return (
    <Tooltip title={label}>
      <IconButton onClick={onClick} sx={{
        width: 52, height: 52, borderRadius: '50%',
        backgroundColor: '#E3F2FD', color: '#1565C0',
        border: '2px solid #BBDEFB',
        transition: 'all 0.2s',
        '&:hover': { backgroundColor: '#BBDEFB', transform: 'scale(1.08)', boxShadow: '0 4px 12px rgba(21,101,192,0.2)' },
      }}>
        {icon}
      </IconButton>
    </Tooltip>
  );
}

function ScrollBtn({ icon, onClick }) {
  return (
    <IconButton onClick={onClick} sx={{
      width: 44, height: 44, borderRadius: 2,
      backgroundColor: '#F5F5F5', color: '#757575',
      border: '1px solid #E0E0E0',
      '&:hover': { backgroundColor: '#E0E0E0', color: '#424242' },
    }}>
      {icon}
    </IconButton>
  );
}
