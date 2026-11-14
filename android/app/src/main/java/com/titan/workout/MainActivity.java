package com.titan.workout;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
    private WebView webView;
    private static final int REQUEST_INSTALL_PERM = 1234;
    private String pendingApkUrl = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen on during workout sessions
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.setBackgroundColor(0xFF121214);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient());

        // Add JavaScript interface for native bridge
        webView.addJavascriptInterface(new WebAppInterface(this), "TitanNative");

        webView.loadUrl("file:///android_asset/index.html");
    }

    public void runOnUiThreadJs(final String script) {
        runOnUiThread(new JsTask(webView, script));
    }

    public void showToast(final String message) {
        runOnUiThread(new ToastTask(this, message));
    }

    public static class JsTask implements Runnable {
        private final WebView wv;
        private final String script;

        public JsTask(WebView wv, String script) {
            this.wv = wv;
            this.script = script;
        }

        @Override
        public void run() {
            if (wv != null) {
                wv.evaluateJavascript(script, null);
            }
        }
    }

    public static class ToastTask implements Runnable {
        private final Activity act;
        private final String msg;

        public ToastTask(Activity act, String msg) {
            this.act = act;
            this.msg = msg;
        }

        @Override
        public void run() {
            if (act != null) {
                Toast.makeText(act, msg, Toast.LENGTH_SHORT).show();
            }
        }
    }

    public static class WebAppInterface {
        private final MainActivity activity;

        public WebAppInterface(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public String getVersionName() {
            try {
                PackageInfo pInfo = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
                return pInfo.versionName;
            } catch (Exception e) {
                return "1.4.1";
            }
        }

        @JavascriptInterface
        public int getVersionCode() {
            try {
                PackageInfo pInfo = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
                return pInfo.versionCode;
            } catch (Exception e) {
                return 10;
            }
        }

        @JavascriptInterface
        public void checkForUpdates(final boolean isManual) {
            activity.checkGitHubReleases(isManual);
        }

        @JavascriptInterface
        public void startUpdateDownload(final String apkUrl) {
            activity.downloadAndInstallApk(apkUrl);
        }
    }

    public void checkGitHubReleases(final boolean isManual) {
        new Thread(new CheckUpdateTask(this, isManual)).start();
    }

    public static class CheckUpdateTask implements Runnable {
        private final MainActivity activity;
        private final boolean isManual;

        public CheckUpdateTask(MainActivity activity, boolean isManual) {
            this.activity = activity;
            this.isManual = isManual;
        }

        @Override
        public void run() {
            try {
                URL url = new URL("https://api.github.com/repos/Dzonii006/titan-calisthenics/releases/latest");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestProperty("User-Agent", "TitanCalisthenicsApp");
                conn.setRequestProperty("Accept", "application/vnd.github.v3+json");
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.connect();

                int code = conn.getResponseCode();
                if (code == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();

                    JSONObject release = new JSONObject(sb.toString());
                    String tagName = release.optString("tag_name", "");
                    String body = release.optString("body", "");
                    String downloadUrl = "";

                    JSONArray assets = release.optJSONArray("assets");
                    if (assets != null) {
                        for (int i = 0; i < assets.length(); i++) {
                            JSONObject asset = assets.getJSONObject(i);
                            String name = asset.optString("name", "");
                            if (name.endsWith(".apk")) {
                                downloadUrl = asset.optString("browser_download_url", "");
                                break;
                            }
                        }
                    }

                    JSONObject result = new JSONObject();
                    result.put("tagName", tagName);
                    result.put("releaseNotes", body);
                    result.put("downloadUrl", downloadUrl);
                    result.put("isManual", isManual);

                    activity.runOnUiThreadJs("if (window.onUpdateCheckResult) window.onUpdateCheckResult(" + result.toString() + ");");
                } else {
                    activity.runOnUiThreadJs("if (window.onUpdateCheckError) window.onUpdateCheckError('HTTP " + code + "', " + isManual + ");");
                }
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage().replace("'", "\\'") : "Network error";
                activity.runOnUiThreadJs("if (window.onUpdateCheckError) window.onUpdateCheckError('" + msg + "', " + isManual + ");");
            }
        }
    }

    public void downloadAndInstallApk(final String apkUrl) {
        pendingApkUrl = apkUrl;

        // Check if unknown app install permission is required
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!getPackageManager().canRequestPackageInstalls()) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivityForResult(intent, REQUEST_INSTALL_PERM);
                showToast("Please enable 'Allow from this source', then tap Update.");
                runOnUiThreadJs("if (window.onUpdatePermissionPrompted) window.onUpdatePermissionPrompted();");
                return;
            }
        }

        new Thread(new DownloadTask(this, apkUrl)).start();
    }

    public static class DownloadTask implements Runnable {
        private final MainActivity activity;
        private final String apkUrl;

        public DownloadTask(MainActivity activity, String apkUrl) {
            this.activity = activity;
            this.apkUrl = apkUrl;
        }

        @Override
        public void run() {
            try {
                activity.runOnUiThreadJs("if (window.onUpdateDownloadProgress) window.onUpdateDownloadProgress(0);");

                URL url = new URL(apkUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setRequestProperty("User-Agent", "TitanCalisthenicsApp");
                conn.connect();

                // Handle redirects manually if needed
                int status = conn.getResponseCode();
                if (status == HttpURLConnection.HTTP_MOVED_TEMP || status == HttpURLConnection.HTTP_MOVED_PERM || status == 307 || status == 308) {
                    String newUrl = conn.getHeaderField("Location");
                    conn = (HttpURLConnection) new URL(newUrl).openConnection();
                    conn.setRequestProperty("User-Agent", "TitanCalisthenicsApp");
                    conn.connect();
                }

                int fileLength = conn.getContentLength();
                File cacheDir = activity.getCacheDir();
                File outputFile = new File(cacheDir, "TitanCalisthenics.apk");
                if (outputFile.exists()) {
                    outputFile.delete();
                }

                InputStream is = conn.getInputStream();
                FileOutputStream fos = new FileOutputStream(outputFile);
                byte[] buffer = new byte[8192];
                int count;
                long total = 0;
                long lastProgressTime = 0;

                while ((count = is.read(buffer)) != -1) {
                    total += count;
                    fos.write(buffer, 0, count);
                    if (fileLength > 0) {
                        int progress = (int) (total * 100 / fileLength);
                        long now = System.currentTimeMillis();
                        if (now - lastProgressTime > 150) {
                            lastProgressTime = now;
                            activity.runOnUiThreadJs("if (window.onUpdateDownloadProgress) window.onUpdateDownloadProgress(" + progress + ");");
                        }
                    }
                }
                fos.flush();
                fos.close();
                is.close();

                activity.runOnUiThreadJs("if (window.onUpdateDownloadProgress) window.onUpdateDownloadProgress(100);");
                activity.installApk(outputFile);

            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage().replace("'", "\\'") : "Download error";
                activity.showToast("Update failed: " + msg);
                activity.runOnUiThreadJs("if (window.onUpdateDownloadError) window.onUpdateDownloadError('" + msg + "');");
            }
        }
    }

    public void installApk(final File file) {
        runOnUiThread(new InstallTask(this, file));
    }

    public static class InstallTask implements Runnable {
        private final MainActivity activity;
        private final File file;

        public InstallTask(MainActivity activity, File file) {
            this.activity = activity;
            this.file = file;
        }

        @Override
        public void run() {
            try {
                Uri apkUri = Uri.parse("content://com.titan.workout.fileprovider/" + file.getName());
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            } catch (Exception e) {
                activity.showToast("Could not open installer: " + e.getMessage());
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_INSTALL_PERM) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (getPackageManager().canRequestPackageInstalls() && pendingApkUrl != null) {
                    downloadAndInstallApk(pendingApkUrl);
                }
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }
}
