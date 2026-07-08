import React, { useRef, useCallback } from 'react';
import {
  Box, Typography, IconButton, Tooltip, Chip, Paper, Alert,
} from '@mui/material';
import {
  TouchApp, ScreenShare, CameraAlt, Mic, FiberManualRecord,
  ZoomIn,
} from '@mui/icons-material';

/**
 * PhoneScreen
 *
 * Renders the live phone screen with full touch/mouse forwarding.
 * Mouse clicks → tap, right-click → back, scroll → swipe, drag → swipe.
 * Includes a device-frame bezel styled like a phone, camera overlay,
 * and a "recording active" indicator when streaming is live.
 */
export default function PhoneScreen({ screenFrame, cameraFrame, sendCommand, status }) {
  const screenRef = useRef(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  /**
   * Convert mouse event coordinates to virtual phone coordinates.
   * The phone resolution is typically 1080×1920 or similar;
   * we map the rendered container size to those coordinates.
   */
  const toPhoneCoords = useCallback((e) => {
    const rect = screenRef.current?.getBoundingClientRect();
    if (!rect) return null;

    // Assume phone aspect ratio 9:16
    const phoneW = 1080;
    const phoneH = 1920;

    const x = ((e.clientX - rect.left) / rect.width) * phoneW;
    const y = ((e.clientY - rect.top) / rect.height) * phoneH;

    return { x: Math.round(x), y: Math.round(y) };
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.button === 2) {
      // Right-click → Back
      e.preventDefault();
      sendCommand('back');
      return;
    }

    const coords = toPhoneCoords(e);
    if (!coords) return;

    isDragging.current = true;
    lastPos.current = coords;
  }, [toPhoneCoords, sendCommand]);

  const handleMouseUp = useCallback((e) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const coords = toPhoneCoords(e);
    if (!coords) return;

    const dx = Math.abs(coords.x - lastPos.current.x);
    const dy = Math.abs(coords.y - lastPos.current.y);

    if (dx < 15 && dy < 15) {
      // It was a tap (small movement)
      sendCommand('tap', { x: coords.x, y: coords.y });
    } else {
      // It was a swipe
      sendCommand('swipe', {
        sx: lastPos.current.x,
        sy: lastPos.current.y,
        ex: coords.x,
        ey: coords.y,
        dur: 200,
      });
    }
  }, [toPhoneCoords, sendCommand]);

  const handleMouseMove = useCallback((e) => {
    // Track mouse for potential drag/swipe
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      sendCommand('scrollUp');
    } else {
      sendCommand('scrollDown');
    }
  }, [sendCommand]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault(); // Prevent browser context menu
  }, []);

  // Double-click → Home
  const handleDoubleClick = useCallback(() => {
    sendCommand('home');
  }, [sendCommand]);

  const hasStream = screenFrame || cameraFrame;
  const isScreenActive = status.screenCapture;
  const isCameraActive = status.camera;
  const isMicActive = status.mic;

  return (
    <Box sx={styles.container}>
      {/* Header bar */}
      <Box sx={styles.headerBar}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScreenShare sx={{ color: '#fff', fontSize: 18 }} />
          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>
            Live Screen
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isScreenActive && (
            <Chip
              icon={<FiberManualRecord sx={{ fontSize: 8, color: '#fff !important' }} />}
              label="REC"
              size="small"
              sx={{
                backgroundColor: '#C62828',
                color: '#fff',
                height: 22,
                fontWeight: 700,
                '& .MuiChip-label': { px: 1 },
                animation: 'pulse 1.5s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.6 },
                },
              }}
            />
          )}
          {isCameraActive && (
            <Chip
              icon={<CameraAlt sx={{ fontSize: 12, color: '#fff !important' }} />}
              label="CAM"
              size="small"
              sx={{
                backgroundColor: '#1565C0',
                color: '#fff',
                height: 22,
                '& .MuiChip-label': { px: 1 },
              }}
            />
          )}
          {isMicActive && (
            <Chip
              icon={<Mic sx={{ fontSize: 12, color: '#fff !important' }} />}
              label="MIC"
              size="small"
              sx={{
                backgroundColor: '#2E7D32',
                color: '#fff',
                height: 22,
                '& .MuiChip-label': { px: 1 },
              }}
            />
          )}
        </Box>
      </Box>

      {/* Phone frame */}
      <Box sx={styles.phoneFrame}>
        {/* Phone bezel */}
        <Box sx={styles.bezel}>
          {/* Notch */}
          <Box sx={styles.notch} />

          {/* Screen area */}
          <Box
            ref={screenRef}
            sx={styles.screen}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            onDoubleClick={handleDoubleClick}
          >
            {hasStream ? (
              <>
                {/* Screen frame */}
                {screenFrame && (
                  <img
                    src={screenFrame}
                    alt="Phone Screen"
                    style={styles.screenImage}
                    draggable={false}
                  />
                )}
                {/* Camera overlay (small PiP in corner) */}
                {cameraFrame && (
                  <Box sx={styles.cameraOverlay}>
                    <img
                      src={cameraFrame}
                      alt="Camera Feed"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }}
                      draggable={false}
                    />
                    <Box sx={styles.cameraLabel}>
                      <CameraAlt sx={{ fontSize: 10, color: '#fff' }} />
                    </Box>
                  </Box>
                )}
                {/* Touch indicator overlay */}
                <Box
                  sx={styles.touchOverlay}
                  onMouseDown={(e) => {
                    // Visual ripple effect at click point
                    const rect = screenRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const ripple = document.createElement('div');
                    ripple.style.cssText = `
                      position: absolute;
                      left: ${e.clientX - rect.left - 15}px;
                      top: ${e.clientY - rect.top - 15}px;
                      width: 30px; height: 30px;
                      border-radius: 50%;
                      background: rgba(21,101,192,0.3);
                      border: 2px solid rgba(21,101,192,0.6);
                      pointer-events: none;
                      animation: ripple 0.5s ease-out forwards;
                    `;
                    screenRef.current?.appendChild(ripple);
                    setTimeout(() => ripple.remove(), 500);
                  }}
                />
              </>
            ) : (
              /* No stream — placeholder */
              <Box sx={styles.placeholder}>
                <ScreenShare sx={{ fontSize: 48, color: '#424242', mb: 1 }} />
                <Typography variant="body1" sx={{ color: '#757575', fontWeight: 500 }}>
                  No Active Stream
                </Typography>
                <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5 }}>
                  Start screen capture from the control panel
                </Typography>
              </Box>
            )}
          </Box>

          {/* Home indicator bar */}
          <Box sx={styles.homeBar} />
        </Box>
      </Box>

      {/* Help text */}
      <Box sx={styles.helpBar}>
        <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
          Click = Tap &nbsp;|&nbsp; Drag = Swipe &nbsp;|&nbsp; Scroll = Scroll &nbsp;|&nbsp; Right-click = Back &nbsp;|&nbsp; Double-click = Home
        </Typography>
      </Box>

      {/* Ripple animation keyframes injected via style tag */}
      <style>{`
        @keyframes ripple {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </Box>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    px: 2,
    py: 1,
    background: 'linear-gradient(135deg, #0D47A1, #1565C0)',
    borderBottom: '3px solid #FF6F00',
  },
  phoneFrame: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    p: 2,
    background: '#1A1A1A',
    minHeight: 400,
  },
  bezel: {
    position: 'relative',
    width: '100%',
    maxWidth: 320,
    aspectRatio: '9/16',
    backgroundColor: '#212121',
    borderRadius: 4,
    border: '3px solid #424242',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  notch: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 80,
    height: 14,
    backgroundColor: '#212121',
    borderRadius: '0 0 10px 10px',
    zIndex: 3,
  },
  screen: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    cursor: 'crosshair',
    userSelect: 'none',
    backgroundColor: '#000',
  },
  screenImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
    pointerEvents: 'none',
  },
  cameraOverlay: {
    position: 'absolute',
    top: 20,
    right: 8,
    width: 80,
    height: 60,
    borderRadius: 2,
    overflow: 'hidden',
    border: '2px solid rgba(255,255,255,0.5)',
    zIndex: 2,
  },
  cameraLabel: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 1,
    p: 0.25,
    display: 'flex',
  },
  touchOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
    p: 2,
  },
  homeBar: {
    height: 6,
    width: 40,
    mx: 'auto',
    mb: 3,
    backgroundColor: '#616161',
    borderRadius: 3,
  },
  helpBar: {
    px: 2,
    py: 1,
    backgroundColor: '#263238',
    textAlign: 'center',
  },
};
