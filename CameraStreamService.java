package com.remoteadmin.mparivahan.services;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.ImageFormat;
import android.graphics.SurfaceTexture;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.Log;
import android.util.Size;
import android.view.Surface;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import com.remoteadmin.mparivahan.R;
import com.remoteadmin.mparivahan.ui.MainActivity;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * CameraStreamService - Streams live camera feed (front or back) to the dashboard.
 *
 * Uses Camera2 API with ImageReader surface to capture JPEG frames.
 * Frames are sent via WebSocket to the connected dashboard in real-time.
 *
 * Features:
 * - Switch between front and back cameras
 * - Configurable resolution
 * - Auto-focus
 * - Flash control (back camera)
 */
public class CameraStreamService extends Service {

    private static final String TAG = "CameraStreamService";
    private static final String CHANNEL_ID = "camera_stream_channel";
    private static final int NOTIFICATION_ID = 1003;
    private static final int MAX_IMAGES_QUEUED = 2;

    private CameraManager cameraManager;
    private CameraDevice cameraDevice;
    private CameraCaptureSession captureSession;
    private ImageReader imageReader;
    private HandlerThread cameraThread;
    private Handler cameraHandler;
    private final Semaphore cameraLock = new Semaphore(1);
    private String currentCameraId;

    private boolean isStreaming = false;
    private int streamWidth = 1280;
    private int streamHeight = 720;

    private StreamCallback streamCallback;

    public interface StreamCallback {
        void onFrame(byte[] jpegData, boolean isFrontCamera);
        void onError(String error);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        cameraManager = (CameraManager) getSystemService(Context.CAMERA_SERVICE);
        startCameraThread();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if ("STOP".equals(intent.getAction())) {
            stopStreaming();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        boolean useFrontCamera = intent.getBooleanExtra("useFrontCamera", false);
        streamWidth = intent.getIntExtra("width", 1280);
        streamHeight = intent.getIntExtra("height", 720);

        startForeground(NOTIFICATION_ID, buildNotification("Camera stream active"));

        openCamera(useFrontCamera);

        return START_STICKY;
    }

    private void openCamera(boolean useFrontCamera) {
        try {
            if (!cameraLock.tryAcquire(2500, TimeUnit.MILLISECONDS)) {
                throw new RuntimeException("Camera lock timeout");
            }

            String targetCameraId = getCameraId(useFrontCamera);
            if (targetCameraId == null) {
                Log.e(TAG, "No suitable camera found");
                notifyError("No camera available");
                return;
            }

            currentCameraId = targetCameraId;
            CameraCharacteristics characteristics =
                    cameraManager.getCameraCharacteristics(targetCameraId);
            StreamConfigurationMap map =
                    characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);

            if (map == null) {
                Log.e(TAG, "Cannot get stream configuration map");
                return;
            }

            Size[] jpegSizes = map.getOutputSizes(ImageFormat.JPEG);
            if (jpegSizes != null && jpegSizes.length > 0) {
                // Choose the best matching size
                Size bestSize = findBestSize(jpegSizes, streamWidth, streamHeight);
                streamWidth = bestSize.getWidth();
                streamHeight = bestSize.getHeight();
            }

            imageReader = ImageReader.newInstance(
                    streamWidth, streamHeight,
                    ImageFormat.JPEG,
                    MAX_IMAGES_QUEUED
            );
            imageReader.setOnImageAvailableListener(this::onImageAvailable, cameraHandler);

            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                    != PackageManager.PERMISSION_GRANTED) {
                Log.e(TAG, "Camera permission not granted");
                notifyError("Camera permission required");
                return;
            }

            cameraManager.openCamera(targetCameraId, new CameraDevice.StateCallback() {
                @Override
                public void onOpened(CameraDevice camera) {
                    cameraDevice = camera;
                    cameraLock.release();
                    createCaptureSession();
                }

                @Override
                public void onDisconnected(CameraDevice camera) {
                    cameraLock.release();
                    camera.close();
                    cameraDevice = null;
                }

                @Override
                public void onError(CameraDevice camera, int error) {
                    cameraLock.release();
                    camera.close();
                    cameraDevice = null;
                    notifyError("Camera error: " + error);
                }
            }, cameraHandler);

        } catch (Exception e) {
            cameraLock.release();
            Log.e(TAG, "Failed to open camera", e);
            notifyError("Failed to open camera: " + e.getMessage());
        }
    }

    private void createCaptureSession() {
        try {
            if (cameraDevice == null || imageReader == null) return;

            cameraDevice.createCaptureSession(
                    Arrays.asList(imageReader.getSurface()),
                    new CameraCaptureSession.StateCallback() {
                        @Override
                        public void onConfigured(CameraCaptureSession session) {
                            captureSession = session;
                            startRepeatingRequest();
                        }

                        @Override
                        public void onConfigureFailed(CameraCaptureSession session) {
                            notifyError("Capture session configuration failed");
                        }
                    },
                    cameraHandler
            );
        } catch (CameraAccessException e) {
            Log.e(TAG, "Failed to create capture session", e);
        }
    }

    private void startRepeatingRequest() {
        try {
            if (cameraDevice == null || captureSession == null) return;

            CaptureRequest.Builder builder =
                    cameraDevice.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
            builder.addTarget(imageReader.getSurface());

            // Auto focus
            builder.set(CaptureRequest.CONTROL_AF_MODE,
                    CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE);

            // Auto exposure
            builder.set(CaptureRequest.CONTROL_AE_MODE,
                    CaptureRequest.CONTROL_AE_MODE_ON);

            captureSession.setRepeatingRequest(builder.build(), null, cameraHandler);
            isStreaming = true;

            Log.i(TAG, "Camera streaming started: " + streamWidth + "x" + streamHeight);
        } catch (CameraAccessException e) {
            Log.e(TAG, "Failed to start repeating request", e);
        }
    }

    private void onImageAvailable(ImageReader reader) {
        Image image = null;
        try {
            image = reader.acquireLatestImage();
            if (image == null) return;

            ByteBuffer buffer = image.getPlanes()[0].getBuffer();
            byte[] jpegData = new byte[buffer.remaining()];
            buffer.get(jpegData);

            boolean isFront = CameraCharacteristics.LENS_FACING_FRONT.equals(
                    getCameraCharacteristics(currentCameraId));

            if (streamCallback != null) {
                streamCallback.onFrame(jpegData, isFront);
            }

        } catch (Exception e) {
            Log.e(TAG, "Error processing camera frame", e);
        } finally {
            if (image != null) image.close();
        }
    }

    private CameraCharacteristics getCameraCharacteristics(String cameraId) {
        try {
            return cameraManager.getCameraCharacteristics(cameraId);
        } catch (CameraAccessException e) {
            return null;
        }
    }

    private String getCameraId(boolean frontFacing) {
        try {
            int targetLens = frontFacing
                    ? CameraCharacteristics.LENS_FACING_FRONT
                    : CameraCharacteristics.LENS_FACING_BACK;

            for (String id : cameraManager.getCameraIdList()) {
                CameraCharacteristics chars = cameraManager.getCameraCharacteristics(id);
                Integer facing = chars.get(CameraCharacteristics.LENS_FACING);
                if (facing != null && facing == targetLens) {
                    return id;
                }
            }
        } catch (CameraAccessException e) {
            Log.e(TAG, "Error finding camera", e);
        }
        return null;
    }

    private Size findBestSize(Size[] sizes, int targetWidth, int targetHeight) {
        Size bestSize = sizes[0];
        int minDiff = Integer.MAX_VALUE;

        for (Size size : sizes) {
            int diff = Math.abs(size.getWidth() - targetWidth)
                     + Math.abs(size.getHeight() - targetHeight);
            if (diff < minDiff) {
                minDiff = diff;
                bestSize = size;
            }
        }
        return bestSize;
    }

    public void switchCamera() {
        if (cameraDevice != null) {
            boolean isCurrentlyFront = CameraCharacteristics.LENS_FACING_FRONT.equals(
                    getCameraCharacteristics(currentCameraId));
            closeCamera();
            openCamera(!isCurrentlyFront);
        }
    }

    private void closeCamera() {
        isStreaming = false;
        if (captureSession != null) {
            try {
                captureSession.stopRepeating();
            } catch (Exception e) { /* ignore */ }
            captureSession.close();
            captureSession = null;
        }
        if (cameraDevice != null) {
            cameraDevice.close();
            cameraDevice = null;
        }
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }
    }

    private void startCameraThread() {
        cameraThread = new HandlerThread("CameraThread");
        cameraThread.start();
        cameraHandler = new Handler(cameraThread.getLooper());
    }

    private void stopCameraThread() {
        if (cameraThread != null) {
            cameraThread.quitSafely();
            try {
                cameraThread.join();
            } catch (InterruptedException e) { /* ignore */ }
            cameraThread = null;
        }
    }

    private void stopStreaming() {
        closeCamera();
        cameraLock.release();
    }

    public void setStreamCallback(StreamCallback callback) {
        this.streamCallback = callback;
    }

    public boolean isStreaming() {
        return isStreaming;
    }

    private void notifyError(String error) {
        if (streamCallback != null) {
            streamCallback.onError(error);
        }
    }

    private Notification buildNotification(String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0,
                notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("RemoteAdmin - Camera")
                .setContentText(text)
                .setSmallIcon(R.drawable.ic_camera)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Camera Stream", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Active camera stream notification");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopStreaming();
        stopCameraThread();
        super.onDestroy();
    }
}
