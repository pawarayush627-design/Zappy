package com.zappyfun.app;

import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        // Set status bar & navigation bar to pitch cinema dark (#050505 and #08090D)
        window.setStatusBarColor(0xFF050505);
        window.setNavigationBarColor(0xFF08090D);

        // Ensure white/bright system icons on dark bars
        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(window, window.getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(false);
            insetsController.setAppearanceLightNavigationBars(false);
        }

        // Set root decor view background to pure black
        window.getDecorView().setBackgroundColor(0xFF050505);

        // Tag the native Android APK WebView user-agent so the web bundle knows 100% it is inside the APK
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                String ua = settings.getUserAgentString();
                if (ua != null && !ua.contains("ZappyFunNativeApp")) {
                    settings.setUserAgentString(ua + " ZappyFunNativeApp/1.0");
                }
            }
        } catch (Exception ignored) {
        }
    }
}
