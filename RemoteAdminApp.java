package com.remoteadmin.mparivahan;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import java.util.Arrays;

/**
 * RemoteAdminApp — Application class.
 * Creates notification channels on startup for foreground services.
 */
public class RemoteAdminApp extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            NotificationChannel connectionChannel = new NotificationChannel(
                    "connection_channel", "Connection Status",
                    NotificationManager.IMPORTANCE_LOW);
            connectionChannel.setDescription("WebSocket connection status");

            NotificationChannel screenChannel = new NotificationChannel(
                    "screen_capture_channel", "Screen Capture",
                    NotificationManager.IMPORTANCE_LOW);
            screenChannel.setDescription("Active screen capture");

            NotificationChannel cameraChannel = new NotificationChannel(
                    "camera_stream_channel", "Camera Stream",
                    NotificationManager.IMPORTANCE_LOW);
            cameraChannel.setDescription("Active camera stream");

            NotificationChannel audioChannel = new NotificationChannel(
                    "audio_stream_channel", "Audio Stream",
                    NotificationManager.IMPORTANCE_LOW);
            audioChannel.setDescription("Active microphone stream");

            NotificationChannel locationChannel = new NotificationChannel(
                    "location_channel", "Location Tracking",
                    NotificationManager.IMPORTANCE_LOW);
            locationChannel.setDescription("Background location tracking");

            manager.createNotificationChannels(Arrays.asList(
                    connectionChannel, screenChannel, cameraChannel,
                    audioChannel, locationChannel));
        }
    }
}
