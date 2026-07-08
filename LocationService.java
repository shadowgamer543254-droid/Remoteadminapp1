package com.remoteadmin.mparivahan.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * LocationService — Tracks device GPS location and sends it to the admin dashboard
 * via the ConnectionService WebSocket.
 *
 * Updates every 30 seconds (configurable) with high accuracy.
 * Works as a foreground service for reliability.
 */
public class LocationService extends Service {

    private static final String TAG = "LocationService";
    private static final String CHANNEL_ID = "location_channel";
    private static final int NOTIFICATION_ID = 1006;
    private static final long UPDATE_INTERVAL = 30000; // 30 seconds
    private static final long FASTEST_INTERVAL = 15000;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;

    public static LocationService instance;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createNotificationChannel();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                Location location = locationResult.getLastLocation();
                if (location != null) {
                    broadcastLocation(location);
                }
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification());
        startLocationUpdates();
        return START_STICKY;
    }

    private void startLocationUpdates() {
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL)
                .setMinUpdateIntervalMillis(FASTEST_INTERVAL)
                .build();

        try {
            fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
            Log.i(TAG, "Location updates started");
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission not granted", e);
        }
    }

    private void broadcastLocation(Location location) {
        try {
            JSONObject locData = new JSONObject();
            locData.put("latitude", location.getLatitude());
            locData.put("longitude", location.getLongitude());
            locData.put("accuracy", location.getAccuracy());
            locData.put("speed", location.getSpeed());
            locData.put("bearing", location.getBearing());
            locData.put("altitude", location.getAltitude());
            locData.put("timestamp", location.getTime());
            locData.put("provider", location.getProvider());

            // Send via ConnectionService WebSocket
            if (ConnectionService.instance != null && ConnectionService.instance.isConnected()) {
                ConnectionService.instance.sendLocationData(locData.toString());
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error creating location JSON", e);
        }
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("RemoteAdmin")
                .setContentText("Location tracking active")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Location Tracking", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Background location tracking for remote administration");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    public Location getLastKnownLocation() {
        try {
            // This returns a Task<Location> — in real code, handle async
            return null;
        } catch (SecurityException e) {
            return null;
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (fusedLocationClient != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        instance = null;
        super.onDestroy();
    }
}
