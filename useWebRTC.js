/**
 * useWebRTC — Browser-side WebRTC peer connection hook.
 *
 * Handles:
 * - Creating RTCPeerConnection with STUN/TURN config
 * - Sending SDP offer to device via signaling server
 * - Receiving SDP answer from device
 * - ICE candidate exchange
 * - Receiving remote MediaStream (screen, camera, audio)
 * - Connection state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Public STUN servers + free TURN fallback
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Add your TURN server here for production:
  // { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' },
];

export default function useWebRTC(wsRef, selectedDevice) {
  const [pcState, setPcState] = useState('disconnected'); // disconnected | connecting | connected | failed
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [remoteCameraStream, setRemoteCameraStream] = useState(null);
  const [remoteAudioStream, setRemoteAudioStream] = useState(null);
  const [connectionStats, setConnectionStats] = useState({});

  const pcRef = useRef(null);
  const pendingCandidates = useRef([]);
  const statsInterval = useRef(null);

  // ─── Create Peer Connection ────────────────────────────────────────────

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN && selectedDevice) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc_ice',
          targetDeviceId: selectedDevice,
          candidate: event.candidate.toJSON(),
        }));
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track:', event.track.kind, event.track.id);
      const stream = event.streams[0];
      if (!stream) return;

      // Determine track type by label or context
      const trackLabel = event.track.label || '';
      if (trackLabel.includes('screen') || trackLabel.includes('display')) {
        setRemoteScreenStream(stream);
      } else if (trackLabel.includes('camera') || trackLabel.includes('video')) {
        setRemoteCameraStream(stream);
      } else if (trackLabel.includes('audio') || event.track.kind === 'audio') {
        setRemoteAudioStream(stream);
      } else {
        // Default: if video, treat as screen; if audio, treat as mic
        if (event.track.kind === 'video') {
          setRemoteScreenStream(stream);
        } else {
          setRemoteAudioStream(stream);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] Connection state:', state);
      setPcState(state === 'connected' ? 'connected'
        : state === 'failed' || state === 'disconnected' ? 'failed'
        : 'connecting');
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
    };

    pcRef.current = pc;
    return pc;
  }, [wsRef, selectedDevice]);

  // ─── Start Screen Streaming (Offerer: Browser → Device) ────────────────

  const startScreenStream = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !selectedDevice) return;

    setPcState('connecting');
    const pc = createPeerConnection();

    // Browser captures screen and sends to device (reversed: device renders it)
    // For remote admin: device IS the source, browser is the viewer
    // So browser creates offer, device answers with screen track

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      // Send SDP offer to device via signaling server
      wsRef.current.send(JSON.stringify({
        type: 'webrtc_offer',
        targetDeviceId: selectedDevice,
        sdp: pc.localDescription.toJSON(),
      }));

      console.log('[WebRTC] Sent offer to device');
    } catch (err) {
      console.error('[WebRTC] Failed to create offer:', err);
      setPcState('failed');
    }
  }, [wsRef, selectedDevice, createPeerConnection]);

  // ─── Handle Incoming WebRTC Signaling ──────────────────────────────────

  const handleSignaling = useCallback(async (msg) => {
    if (!msg.type?.startsWith('webrtc_')) return;

    switch (msg.type) {
      case 'webrtc_offer': {
        // Device sent an offer (device-initiated streaming)
        console.log('[WebRTC] Received offer from device');
        let pc = pcRef.current;
        if (!pc) {
          pc = createPeerConnection();
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));

          // Process any pending ICE candidates
          for (const candidate of pendingCandidates.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidates.current = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // Send answer back
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'webrtc_answer',
              targetDeviceId: selectedDevice,
              sdp: pc.localDescription.toJSON(),
            }));
          }

          console.log('[WebRTC] Sent answer to device');
        } catch (err) {
          console.error('[WebRTC] Failed to handle offer:', err);
        }
        break;
      }

      case 'webrtc_answer': {
        // Device answered our offer
        console.log('[WebRTC] Received answer from device');
        const pc = pcRef.current;
        if (!pc) break;

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));

          // Process any pending ICE candidates
          for (const candidate of pendingCandidates.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidates.current = [];

          console.log('[WebRTC] Remote description set, ICE gathering...');
        } catch (err) {
          console.error('[WebRTC] Failed to handle answer:', err);
        }
        break;
      }

      case 'webrtc_ice': {
        // ICE candidate from device
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (err) {
            console.error('[WebRTC] Failed to add ICE candidate:', err);
          }
        } else {
          // Queue for later
          pendingCandidates.current.push(msg.candidate);
        }
        break;
      }

      default:
        break;
    }
  }, [wsRef, selectedDevice, createPeerConnection]);

  // ─── Stats Monitoring ──────────────────────────────────────────────────

  const startStats = useCallback(() => {
    if (statsInterval.current) clearInterval(statsInterval.current);
    statsInterval.current = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc || pc.connectionState !== 'connected') return;

      try {
        const stats = await pc.getStats();
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            setConnectionStats({
              width: report.frameWidth,
              height: report.frameHeight,
              fps: report.framesPerSecond,
              bytesReceived: report.bytesReceived,
              packetsLost: report.packetsLost,
              jitter: report.jitter,
            });
          }
        });
      } catch (e) { /* ignore */ }
    }, 2000);
  }, []);

  // ─── Disconnect ────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingCandidates.current = [];
    setPcState('disconnected');
    setRemoteScreenStream(null);
    setRemoteCameraStream(null);
    setRemoteAudioStream(null);
    setConnectionStats({});
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
      statsInterval.current = null;
    }
  }, []);

  // ─── Cleanup on device switch ──────────────────────────────────────────

  useEffect(() => {
    return () => disconnect();
  }, [selectedDevice, disconnect]);

  return {
    pcState,
    remoteScreenStream,
    remoteCameraStream,
    remoteAudioStream,
    connectionStats,
    startScreenStream,
    handleSignaling,
    disconnect,
  };
}
