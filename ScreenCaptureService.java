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

import androidx.core.app.NotificationCompat;

import com.remoteadmin.mparivahan.R;
import com.remoteadmin.mparivahan.ui.MainActivity;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * ScreenCaptureService - Captures the device screen using MediaProjection API
 * and streams JPEG frames to the connected dashboard via WebSocket.
 *
 * Uses MediaProjection to create a VirtualDisplay that renders to an ImageReader.
 * Frames are captured at configurable FPS and quality, then encoded as JPEG
 * and sent as binary WebSocket messages.
 *
 * Resolution: Matches device screen resolution
 * Format: JPEG (H.264 via MediaCodec for lower bandwidth when WebRTC is available)
 * FPS: 15-30 (configurable)
 */
public class ScreenCaptureService extends Service {

    private static final String TAG = "ScreenCaptureService";
    private static final String CHANNEL_ID = "screen_capture_channel";
    private static final int NOTIFICATION_ID = 1001;

    // Frame capture settings
    private static final int DEFAULT_FPS = 20;
    private static final int JPEG_QUALITY = 80;
    private static final int SCALE_FACTOR = 1; // 1 = full resolution, 2 = half, etc.

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private Handler captureHandler;
    private Runnable captureRunnable;
    private final AtomicBoolean isCapturing = new AtomicBoolean(false);

    private int screenWidth;
    private int screenHeight;
    private int screenDensity;
    private int fps = DEFAULT_FPS;

    private FrameCallback frameCallback;

    public interface FrameCallback {
        void onFrameCaptured(byte[] jpegData, int width, int height);
        void onError(String error);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        captureHandler = new Handler(Looper.getMainLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if ("STOP".equals(intent.getAction())) {
            stopCapture();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        int resultCode = intent.getIntExtra("resultCode", -1);
        Intent data = intent.getParcelableExtra("data");

        if (resultCode == -1 || data == null) {
            Log.e(TAG, "Invalid result code or data");
            stopSelf();
            return START_NOT_STICKY;
        }

        fps = intent.getIntExtra("fps", DEFAULT_FPS);
        String serverUrl = intent.getStringExtra("serverUrl");
        String deviceId = intent.getStringExtra("deviceId");

        // Get screen dimensions
        WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        DisplayMetrics metrics = new DisplayMetrics();
        wm.getDefaultDisplay().getMetrics(metrics);
        screenWidth = metrics.widthPixels / SCALE_FACTOR;
        screenHeight = metrics.heightPixels / SCALE_FACTOR;
        screenDensity = (int) (metrics.densityDpi / SCALE_FACTOR);

        // Start foreground notification
        startForeground(NOTIFICATION_ID, buildNotification("Screen capture active"));

        // Set up MediaProjection
        MediaProjectionManager projectionManager =
                (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        mediaProjection = projectionManager.getMediaProjection(resultCode, data);

        if (mediaProjection == null) {
            Log.e(TAG, "Failed to create MediaProjection");
            stopSelf();
            return START_NOT_STICKY;
        }

        // Register callback for projection events
        mediaProjection.registerCallback(new MediaProjection.Callback() {
            @Override
            public void onStop() {
                Log.d(TAG, "MediaProjection stopped");
                stopCapture();
            }
        }, captureHandler);

        startCapture();

        return START_STICKY;
    }

    private void startCapture() {
        if (isCapturing.getAndSet(true)) return;

        // Create ImageReader for frame capture
        imageReader = ImageReader.newInstance(
                screenWidth, screenHeight,
                PixelFormat.RGBA_8888,
                2 // double buffer
        );

        imageReader.setOnImageAvailableListener(reader -> {
            if (!isCapturing.get()) return;

            Image image = null;
            try {
                image = reader.acquireLatestImage();
                if (image != null) {
                    byte[] jpegData = imageToJpeg(image);
                    if (jpegData != null && frameCallback != null) {
                        frameCallback.onFrameCaptured(jpegData, screenWidth, screenHeight);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error capturing frame", e);
            } finally {
                if (image != null) {
                    image.close();
                }
            }
        }, captureHandler);

        // Create VirtualDisplay
        virtualDisplay = mediaProjection.createVirtualDisplay(
                "RemoteAdmin",
                screenWidth, screenHeight, screenDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),
                null, captureHandler
        );

        if (virtualDisplay == null) {
            Log.e(TAG, "Failed to create VirtualDisplay");
            isCapturing.set(false);
            return;
        }

        Log.i(TAG, "Screen capture started: " + screenWidth + "x" + screenHeight + " @ " + fps + "fps");
    }

    private byte[] imageToJpeg(Image image) {
        try {
            Image.Plane[] planes = image.getPlanes();
            ByteBuffer buffer = planes[0].getBuffer();
            int pixelStride = planes[0].getPixelStride();
            int rowStride = planes[0].getRowStride();
            int rowPadding = rowStride - pixelStride * screenWidth;

            // Create bitmap from image data
            Bitmap bitmap = Bitmap.createBitmap(
                    screenWidth + rowPadding / pixelStride,
                    screenHeight,
                    Bitmap.Config.ARGB_8888
            );
            bitmap.copyPixelsFromBuffer(buffer);

            // Crop to actual screen size if there's padding
            if (rowPadding > 0) {
                Bitmap cropped = Bitmap.createBitmap(bitmap, 0, 0, screenWidth, screenHeight);
                bitmap.recycle();
                bitmap = cropped;
            }

            // Compress to JPEG
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, baos);
            bitmap.recycle();

            return baos.toByteArray();
        } catch (Exception e) {
            Log.e(TAG, "Error converting image to JPEG", e);
            return null;
        }
    }

    private void stopCapture() {
        if (!isCapturing.getAndSet(false)) return;

        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }

        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }

        if (mediaProjection != null) {
            mediaProjection.stop();
            mediaProjection = null;
        }

        Log.i(TAG, "Screen capture stopped");
    }

    private Notification buildNotification(String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0,
                notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("RemoteAdmin")
                .setContentText(text)
                .setSmallIcon(R.drawable.ic_screen_capture)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Screen Capture",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Active screen capture notification");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    public void setFrameCallback(FrameCallback callback) {
        this.frameCallback = callback;
    }

    public boolean isCapturing() {
        return isCapturing.get();
    }

    public void setFps(int newFps) {
        this.fps = Math.max(5, Math.min(30, newFps));
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopCapture();
        super.onDestroy();
    }
}
