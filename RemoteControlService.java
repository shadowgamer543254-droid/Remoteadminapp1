package com.remoteadmin.mparivahan.services;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import androidx.annotation.RequiresApi;
import androidx.core.view.accessibility.AccessibilityManagerCompat;

import java.util.List;

/**
 * RemoteControlService - AccessibilityService that provides full remote control
 * capabilities. Translates incoming WebSocket commands into touch events,
 * gestures, key presses, and navigation actions on the device.
 *
 * Capabilities:
 * - Touch/tap at any screen coordinate
 * - Swipe gestures (up, down, left, right, custom paths)
 * - Long press
 * - Back, Home, Recent buttons
 * - Text input via key events
 * - App launch by package name
 * - Scroll gestures
 * - Global actions (notifications, power menu)
 *
 * Requires: User manually enables this in Accessibility Settings
 */
public class RemoteControlService extends android.accessibilityservice.AccessibilityService {

    private static final String TAG = "RemoteControlService";

    private static RemoteControlService instance;
    private Handler mainHandler;

    // Accessibility node tree for UI introspection
    private AccessibilityNodeInfo rootNode;

    public static RemoteControlService getInstance() {
        return instance;
    }

    public static boolean isRunning() {
        return instance != null;
    }

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        mainHandler = new Handler(Looper.getMainLooper());

        // Configure service info
        AccessibilityServiceInfo info = getServiceInfo();
        if (info != null) {
            info.eventTypes = AccessibilityEvent.TYPES_ALL_MASK;
            info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
            info.flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
                    | AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
                    | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
            setServiceInfo(info);
        }

        Log.i(TAG, "RemoteControlService connected");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Capture UI state for node tree inspection
        rootNode = getRootInActiveWindow();
    }

    @Override
    public void onInterrupt() {
        Log.w(TAG, "RemoteControlService interrupted");
    }

    // ─── Touch & Gesture Control ────────────────────────────────────────────

    /**
     * Perform a tap at the given screen coordinates
     */
    public void performTap(float x, float y) {
        mainHandler.post(() -> {
            Path clickPath = new Path();
            clickPath.moveTo(x, y);

            dispatchGesture(clickPath, 100, null);
            Log.d(TAG, "Tap at (" + x + ", " + y + ")");
        });
    }

    /**
     * Perform a long press at the given screen coordinates
     */
    public void performLongPress(float x, float y) {
        mainHandler.post(() -> {
            Path longPressPath = new Path();
            longPressPath.moveTo(x, y);

            dispatchGesture(longPressPath, 1500, null);
            Log.d(TAG, "Long press at (" + x + ", " + y + ")");
        });
    }

    /**
     * Perform a swipe gesture from start to end coordinates
     */
    public void performSwipe(float startX, float startY, float endX, float endY, long durationMs) {
        mainHandler.post(() -> {
            Path swipePath = new Path();
            swipePath.moveTo(startX, startY);
            swipePath.lineTo(endX, endY);

            dispatchGesture(swipePath, durationMs, null);
            Log.d(TAG, "Swipe from (" + startX + "," + startY + ") to (" + endX + "," + endY + ")");
        });
    }

    /**
     * Scroll up (swipe up = content goes up)
     */
    public void scrollUp() {
        performSwipe(540, 1200, 540, 600, 300);
    }

    /**
     * Scroll down (swipe down = content goes down)
     */
    public void scrollDown() {
        performSwipe(540, 600, 540, 1200, 300);
    }

    /**
     * Dispatch a gesture via AccessibilityService
     */
    @RequiresApi(api = Build.VERSION_CODES.N)
    private void dispatchGesture(Path path, long durationMs, GestureResultCallback callback) {
        GestureDescription.Builder builder = new GestureDescription.Builder();
        GestureDescription.StrokeDescription stroke =
                new GestureDescription.StrokeDescription(path, 0, durationMs);
        builder.addStroke(stroke);

        dispatchGesture(builder.build(), callback != null ? new GestureResultCallback() {
            @Override
            public void onCompleted(GestureDescription gestureDescription) {
                if (callback != null) callback.onCompleted(gestureDescription);
            }

            @Override
            public void onCancelled(GestureDescription gestureDescription) {
                if (callback != null) callback.onCancelled(gestureDescription);
            }
        } : null, null);
    }

    // ─── Navigation Actions ─────────────────────────────────────────────────

    /**
     * Press the Back button
     */
    public void pressBack() {
        mainHandler.post(() -> performGlobalAction(GLOBAL_ACTION_BACK));
        Log.d(TAG, "Back pressed");
    }

    /**
     * Press the Home button
     */
    public void pressHome() {
        mainHandler.post(() -> performGlobalAction(GLOBAL_ACTION_HOME));
        Log.d(TAG, "Home pressed");
    }

    /**
     * Press the Recent Apps button
     */
    public void pressRecents() {
        mainHandler.post(() -> performGlobalAction(GLOBAL_ACTION_RECENTS));
        Log.d(TAG, "Recents pressed");
    }

    /**
     * Open the notification shade
     */
    public void openNotifications() {
        mainHandler.post(() -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS));
    }

    /**
     * Open quick settings
     */
    public void openQuickSettings() {
        mainHandler.post(() -> performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS));
    }

    /**
     * Take screenshot (API 30+)
     */
    @RequiresApi(api = Build.VERSION_CODES.R)
    public void takeScreenshot() {
        mainHandler.post(() -> {
            takeScreenshot(0, getMainExecutor(), new TakeScreenshotCallback() {
                @Override
                public void onSuccess(ScreenshotResult result) {
                    result.close();
                }

                @Override
                public void onFailure(int errorCode) {
                    Log.e(TAG, "Screenshot failed with code: " + errorCode);
                }
            });
        });
    }

    // ─── Text Input ─────────────────────────────────────────────────────────

    /**
     * Type text by dispatching key events for each character
     */
    public void typeText(String text) {
        mainHandler.post(() -> {
            for (char c : text.toCharArray()) {
                int keyCode = CharacterToKeyCode(c);
                if (keyCode != -1) {
                    // Dispatch key event
                    dispatchKey(keyCode);
                }
            }
            Log.d(TAG, "Typed text: " + text.length() + " chars");
        });
    }

    /**
     * Set text directly on a focused node
     */
    public void setNodeText(String text) {
        mainHandler.post(() -> {
            AccessibilityNodeInfo focused = findFocusedNode();
            if (focused != null && focused.isEditable()) {
                Bundle args = new Bundle();
                args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
                focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                Log.d(TAG, "Set text on focused node: " + text);
            }
        });
    }

    private void dispatchKey(int keyCode) {
        // Use dispatchGesture for key simulation or sendBroadcast for input
        Log.d(TAG, "Dispatch key: " + keyCode);
    }

    private int CharacterToKeyCode(char c) {
        if (c >= 'a' && c <= 'z') return c - 'a' + 29; // KEYCODE_A
        if (c >= '0' && c <= '9') return c - '0' + 7;  // KEYCODE_0
        if (c == ' ') return 62; // KEYCODE_SPACE
        if (c == '.') return 55; // KEYCODE_PERIOD
        return -1;
    }

    // ─── App Control ────────────────────────────────────────────────────────

    /**
     * Launch an app by package name
     */
    public void launchApp(String packageName) {
        mainHandler.post(() -> {
            Intent launchIntent = getPackageManager().getLaunchIntentForPackage(packageName);
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(launchIntent);
                Log.d(TAG, "Launched app: " + packageName);
            } else {
                Log.w(TAG, "No launch intent for: " + packageName);
            }
        });
    }

    /**
     * Open device Settings
     */
    public void openSettings() {
        launchApp("com.android.settings");
    }

    // ─── UI Inspection ──────────────────────────────────────────────────────

    /**
     * Get the current UI node tree as a structured string
     */
    public String getUiTree() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return "[]";
        StringBuilder sb = new StringBuilder();
        traverseNode(root, sb, 0);
        return sb.toString();
    }

    private void traverseNode(AccessibilityNodeInfo node, StringBuilder sb, int depth) {
        if (node == null) return;

        Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);

        sb.append(indent(depth))
          .append("{\"class\":\"").append(node.getClassName()).append("\"")
          .append(",\"text\":\"").append(node.getText() != null ? node.getText() : "").append("\"")
          .append(",\"id\":\"").append(node.getViewIdResourceName() != null ? node.getViewIdResourceName() : "").append("\"")
          .append(",\"clickable\":").append(node.isClickable())
          .append(",\"bounds\":[").append(bounds.left).append(",").append(bounds.top)
          .append(",").append(bounds.right).append(",").append(bounds.bottom).append("]")
          .append("},\n");

        for (int i = 0; i < node.getChildCount(); i++) {
            traverseNode(node.getChild(i), sb, depth + 1);
        }
    }

    private String indent(int depth) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < depth; i++) sb.append("  ");
        return sb.toString();
    }

    private AccessibilityNodeInfo findFocusedNode() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return null;

        List<AccessibilityNodeInfo> focused = root.findAccessibilityNodeInfosByViewId("focused");
        if (focused != null && !focused.isEmpty()) {
            return focused.get(0);
        }

        // Fallback: find first editable node
        List<AccessibilityNodeInfo> editable = root.findAccessibilityNodeInfosByText("");
        for (AccessibilityNodeInfo node : editable) {
            if (node.isEditable()) return node;
        }
        return null;
    }

    @Override
    public void onDestroy() {
        instance = null;
        super.onDestroy();
    }
}
