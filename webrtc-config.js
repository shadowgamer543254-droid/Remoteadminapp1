/**
 * WebRTC signaling configuration and TURN/STUN server setup.
 *
 * For production deployment:
 * 1. Set up a TURN server (e.g., coturn) or use a service like Twilio/Cloudflare
 * 2. Update the TURN_URL, TURN_USERNAME, TURN_CREDENTIAL below
 * 3. Set these as environment variables in the server .env
 *
 * For development:
 * - STUN servers are free public servers from Google
 * - No TURN needed for same-network or localhost testing
 */

module.exports = {
  // Public STUN servers (free, rate-limited)
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Production TURN server (uncomment and configure):
    // {
    //   urls: process.env.TURN_URL || 'turn:your-turn-server.com:3478',
    //   username: process.env.TURN_USERNAME || 'user',
    //   credential: process.env.TURN_CREDENTIAL || 'pass',
    // },
    // {
    //   urls: process.env.TURNS_URL || 'turns:your-turn-server.com:5349',
    //   username: process.env.TURN_USERNAME || 'user',
    //   credential: process.env.TURN_CREDENTIAL || 'pass',
    // },
  ],

  // SDP constraints for offer/answer
  offerConstraints: {
    mandatory: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: true,
    },
  },

  // Media stream constraints
  screenConstraints: {
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        maxWidth: 1920,
        maxHeight: 1080,
        maxFrameRate: 30,
      },
    },
    audio: false,
  },

  cameraConstraints: {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
      facingMode: 'environment',
    },
    audio: false,
  },

  audioConstraints: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000,
    },
    video: false,
  },
};
