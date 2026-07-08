package com.remoteadmin.mparivahan.ui;

import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;

/**
 * MainActivity — Minimal activity referenced by foreground service notifications.
 *
 * When a user taps a foreground service notification (screen capture, camera,
 * microphone, location, connection status), Android opens this activity.
 * It immediately finishes so the user returns to what they were doing.
 *
 * The actual launcher is SetupActivity which handles the permission wizard.
 */
public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // This activity is only opened from notification taps.
        // Immediately finish so the user returns to their previous context.
        finish();
    }
}
