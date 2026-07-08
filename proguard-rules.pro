# RemoteAdmin ProGuard Rules
# Add project specific ProGuard rules here.

# OkHttp
-dontwarn okhttp3.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# WebRTC
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# Keep WebRTCClient listener interface
-keep class com.remoteadmin.mparivahan.services.WebRTCClient$WebRTCListener { *; }
