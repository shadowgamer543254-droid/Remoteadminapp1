package com.remoteadmin.mparivahan.receivers;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import com.remoteadmin.mparivahan.services.ConnectionService;

/**
 * BootReceiver - Automatically restarts the connection service
 * when the device boots, ensuring persistent remote access.
 *
 * Reads saved connection preferences to restore the session.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BootReceiver";
    private static final String PREFS_NAME = "remote_admin_prefs";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !"android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            return;
        }

        Log.i(TAG, "Boot completed, checking for saved session");

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean autoConnect = prefs.getBoolean("auto_connect", false);
        String serverUrl = prefs.getString("server_url", null);
        String deviceId = prefs.getString("device_id", null);
        String authToken = prefs.getString("auth_token", null);

        if (autoConnect && serverUrl != null && deviceId != null) {
            Log.i(TAG, "Auto-connecting to " + serverUrl);

            Intent serviceIntent = new Intent(context, ConnectionService.class);
            serviceIntent.putExtra("serverUrl", serverUrl);
            serviceIntent.putExtra("deviceId", deviceId);
            serviceIntent.putExtra("authToken", authToken);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        }
    }
}
