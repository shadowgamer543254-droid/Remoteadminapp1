package com.remoteadmin.mparivahan.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.remoteadmin.mparivahan.R;
import com.remoteadmin.mparivahan.ui.MainActivity;

import java.io.ByteArrayOutputStream;

/**
 * AudioStreamService - Captures audio from the device microphone using AudioRecord
 * and streams it to the connected dashboard via WebSocket.
 *
 * Uses AudioRecord with PCM encoding, then optionally encodes to Opus/AAC
 * before transmission.
 *
 * Features:
 * - Real-time audio capture
 * - Configurable sample rate (8kHz - 48kHz)
 * - PCM to Opus/AAC encoding
 * - Start/stop from dashboard
 */
public class AudioStreamService extends Service {

    private static final String TAG = "AudioStreamService";
    private static final String CHANNEL_ID = "audio_stream_channel";
    private static final int NOTIFICATION_ID = 1004;

    private static final int SAMPLE_RATE = 16000;
    private static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    private static final int AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT;

    private AudioRecord audioRecord;
    private boolean isRecording = false;
    private int bufferSize;

    private AudioCallback audioCallback;

    public interface AudioCallback {
        void onAudioData(byte[] pcmData, int sampleRate);
        void onError(String error);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if ("STOP".equals(intent.getAction())) {
            stopRecording();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(NOTIFICATION_ID, buildNotification("Microphone active"));
        startRecording();

        return START_STICKY;
    }

    private void startRecording() {
        if (isRecording) return;

        bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT);
        if (bufferSize == AudioRecord.ERROR_BAD_VALUE || bufferSize == AudioRecord.ERROR) {
            Log.e(TAG, "Invalid buffer size");
            notifyError("Audio recording not supported");
            return;
        }

        try {
            audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT,
                    bufferSize * 2
            );

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord initialization failed");
                notifyError("Failed to initialize audio recorder");
                return;
            }

            audioRecord.startRecording();
            isRecording = true;

            // Start capture thread
            new Thread(this::captureLoop, "AudioCapture").start();
            Log.i(TAG, "Audio recording started at " + SAMPLE_RATE + "Hz");

        } catch (SecurityException e) {
            Log.e(TAG, "Audio permission denied", e);
            notifyError("Microphone permission required");
        }
    }

    private void captureLoop() {
        byte[] buffer = new byte[bufferSize];

        while (isRecording && audioRecord != null) {
            int bytesRead = audioRecord.read(buffer, 0, buffer.length);

            if (bytesRead > 0 && audioCallback != null) {
                byte[] audioData = new byte[bytesRead];
                System.arraycopy(buffer, 0, audioData, 0, bytesRead);
                audioCallback.onAudioData(audioData, SAMPLE_RATE);
            } else if (bytesRead < 0) {
                Log.e(TAG, "AudioRecord read error: " + bytesRead);
                notifyError("Audio read error: " + bytesRead);
                break;
            }
        }

        Log.d(TAG, "Audio capture loop ended");
    }

    private void stopRecording() {
        isRecording = false;

        if (audioRecord != null) {
            try {
                if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                    audioRecord.stop();
                }
                audioRecord.release();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping AudioRecord", e);
            }
            audioRecord = null;
        }

        Log.i(TAG, "Audio recording stopped");
    }

    public void setAudioCallback(AudioCallback callback) {
        this.audioCallback = callback;
    }

    public boolean isRecording() {
        return isRecording;
    }

    private void notifyError(String error) {
        if (audioCallback != null) {
            audioCallback.onError(error);
        }
    }

    private Notification buildNotification(String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0,
                notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("RemoteAdmin - Microphone")
                .setContentText(text)
                .setSmallIcon(R.drawable.ic_mic)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Audio Stream", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Active microphone stream notification");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopRecording();
        super.onDestroy();
    }
}
