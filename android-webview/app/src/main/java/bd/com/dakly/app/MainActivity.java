package bd.com.dakly.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Dakly merchant app: a hardened, full-screen WebView around the Dakly web app.
 * Everything the merchant sees comes from the server, so new web features reach
 * the app without an app update. The native side handles the parts a browser
 * normally does: file picking (Excel/CSV import), the microphone (voice entry),
 * downloads, external links (WhatsApp, phone, Facebook), Facebook connect in the
 * real browser, App Links, offline and error screens, and the back button.
 */
public class MainActivity extends Activity {

    private static final int REQ_FILE = 41;
    private static final int REQ_MIC = 42;

    private WebView web;
    private ProgressBar progress;
    private View errorView;
    private TextView errorTitle;
    private TextView errorBody;

    private String baseUrl;
    private String host;

    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingPermission;
    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean mainFrameFailed;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        baseUrl = getString(R.string.app_url);
        host = getString(R.string.app_host);

        setContentView(R.layout.activity_main);
        web = findViewById(R.id.web);
        progress = findViewById(R.id.progress);
        errorView = findViewById(R.id.error);
        errorTitle = findViewById(R.id.error_title);
        errorBody = findViewById(R.id.error_body);
        Button retry = findViewById(R.id.retry);
        retry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                retry();
            }
        });

        setupInsets();
        setupWebView();

        if (savedInstanceState != null && web.restoreState(savedInstanceState) != null) {
            return;
        }
        String deepLink = urlFromIntent(getIntent());
        web.loadUrl(deepLink != null ? deepLink : baseUrl);
    }

    // ---------------------------------------------------------------- layout

    private void setupInsets() {
        final View root = findViewById(R.id.root);
        if (Build.VERSION.SDK_INT >= 30) {
            // Draw behind the system bars and pad the content ourselves, so the
            // keyboard never covers an input (Android 15 is always edge-to-edge).
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override
                public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                    Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    Insets ime = insets.getInsets(WindowInsets.Type.ime());
                    v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                    return WindowInsets.CONSUMED;
                }
            });
        }
    }

    private void setupWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(false);
        s.setUserAgentString(s.getUserAgentString() + " DaklyAndroid/" + versionName());
        if (Build.VERSION.SDK_INT >= 26) {
            s.setSafeBrowsingEnabled(true);
        }

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, false);

        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(debuggable);

        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebViewClient(new DaklyWebViewClient());
        web.setWebChromeClient(new DaklyChromeClient());
        web.setDownloadListener(new DaklyDownloads());
    }

    // ---------------------------------------------------------------- navigation

    /** Returns true when the URL was handled outside the WebView. */
    private boolean routeOutside(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);

        if (scheme.equals("https") || scheme.equals("http")) {
            if (isOurHost(uri)) {
                String path = uri.getPath() == null ? "" : uri.getPath();
                // Facebook blocks OAuth inside WebViews: hand off to the real browser.
                if (path.startsWith("/api/facebook/connect") && uri.getQueryParameter("handoff") != null) {
                    openExternal(uri);
                    return true;
                }
                return false;
            }
            openExternal(uri);
            return true;
        }

        if (scheme.equals("dakly")) {
            String target = urlFromDaklyScheme(uri);
            if (target != null) web.loadUrl(target);
            return true;
        }

        if (scheme.equals("intent")) {
            try {
                Intent intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
                intent.setComponent(null);
                intent.setSelector(null);
                try {
                    startActivity(intent);
                } catch (ActivityNotFoundException e) {
                    String fallback = intent.getStringExtra("browser_fallback_url");
                    if (fallback != null) openExternal(Uri.parse(fallback));
                    else toast(R.string.no_app);
                }
            } catch (URISyntaxException e) {
                toast(R.string.no_app);
            }
            return true;
        }

        if (scheme.equals("javascript") || scheme.equals("file") || scheme.equals("content") || scheme.equals("data") || scheme.equals("about") || scheme.equals("blob")) {
            return !scheme.equals("about") && !scheme.equals("blob") && !scheme.equals("data");
        }

        // tel:, mailto:, sms:, whatsapp:, fb:, market: and other app links
        openExternal(uri);
        return true;
    }

    private boolean isOurHost(Uri uri) {
        String h = uri.getHost();
        return h != null && h.equalsIgnoreCase(host) && "https".equalsIgnoreCase(uri.getScheme());
    }

    private void openExternal(Uri uri) {
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            toast(R.string.no_app);
        }
    }

    /** The URL to open for an App Link or dakly:// intent, or null. */
    private String urlFromIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return null;
        Uri data = intent.getData();
        if ("dakly".equalsIgnoreCase(data.getScheme())) return urlFromDaklyScheme(data);
        if (isOurHost(data)) return data.toString();
        return null;
    }

    private String urlFromDaklyScheme(Uri uri) {
        String path = uri.getQueryParameter("path");
        if (path == null || !path.startsWith("/") || path.startsWith("//") || path.contains("\\")) path = "/";
        return Uri.parse(baseUrl).buildUpon().encodedPath(Uri.parse(path).getEncodedPath())
                .encodedQuery(Uri.parse(path).getEncodedQuery()).build().toString();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String url = urlFromIntent(intent);
        if (url != null) {
            hideError();
            web.loadUrl(url);
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (errorView.getVisibility() == View.VISIBLE && web.canGoBack()) {
            hideError();
            web.goBack();
        } else if (errorView.getVisibility() != View.VISIBLE && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // ---------------------------------------------------------------- errors

    private void showError(boolean offline) {
        mainFrameFailed = true;
        errorTitle.setText(offline ? R.string.offline_title : R.string.error_title);
        errorBody.setText(offline ? R.string.offline_body : R.string.error_body);
        errorView.setVisibility(View.VISIBLE);
        progress.setVisibility(View.GONE);
        watchNetwork();
    }

    private void hideError() {
        errorView.setVisibility(View.GONE);
    }

    private void retry() {
        mainFrameFailed = false;
        hideError();
        String current = web.getUrl();
        if (current == null || current.startsWith("about:") || current.startsWith("data:")) web.loadUrl(baseUrl);
        else web.reload();
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return true;
        Network n = cm.getActiveNetwork();
        if (n == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(n);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    /** Retries automatically when the connection comes back while the error screen is up. */
    private void watchNetwork() {
        if (networkCallback != null) return;
        final ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return;
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                main.post(new Runnable() {
                    @Override
                    public void run() {
                        if (errorView.getVisibility() == View.VISIBLE) retry();
                    }
                });
            }
        };
        try {
            cm.registerDefaultNetworkCallback(networkCallback);
        } catch (RuntimeException e) {
            networkCallback = null;
        }
    }

    private void unwatchNetwork() {
        if (networkCallback == null) return;
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        try {
            if (cm != null) cm.unregisterNetworkCallback(networkCallback);
        } catch (RuntimeException ignored) {
        }
        networkCallback = null;
    }

    private class DaklyWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return routeOutside(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return routeOutside(Uri.parse(url));
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            mainFrameFailed = false;
            progress.setVisibility(View.VISIBLE);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progress.setVisibility(View.GONE);
            CookieManager.getInstance().flush();
            if (!mainFrameFailed) {
                hideError();
                unwatchNetwork();
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                view.stopLoading();
                showError(!isOnline());
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            int code = response.getStatusCode();
            // Proxy/gateway errors mean the server is down: show our own screen.
            if (request.isForMainFrame() && (code == 502 || code == 503 || code == 504)) {
                showError(false);
            }
        }

        @Override
        public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
            // The renderer crashed or was killed for memory: start fresh instead of crashing the app.
            recreate();
            return true;
        }
    }

    // ---------------------------------------------------------------- files, mic

    private class DaklyChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progress.setProgress(newProgress);
            progress.setVisibility(newProgress < 100 ? View.VISIBLE : View.GONE);
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;

            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("*/*");
            String[] mimes = mimeTypesFor(params.getAcceptTypes());
            if (mimes.length > 0) pick.putExtra(Intent.EXTRA_MIME_TYPES, mimes);
            if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            }
            try {
                startActivityForResult(Intent.createChooser(pick, getString(R.string.choose_file)), REQ_FILE);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                toast(R.string.no_app);
                return false;
            }
            return true;
        }

        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            main.post(new Runnable() {
                @Override
                public void run() {
                    handlePermission(request);
                }
            });
        }

        @Override
        public void onPermissionRequestCanceled(PermissionRequest request) {
            if (pendingPermission == request) pendingPermission = null;
        }
    }

    /** Turns accept="..." (extensions or MIME types) into MIME types for the system picker. */
    static String[] mimeTypesFor(String[] accept) {
        List<String> out = new ArrayList<>();
        if (accept == null) return new String[0];
        for (String group : accept) {
            if (group == null) continue;
            for (String raw : group.split(",")) {
                String a = raw.trim().toLowerCase(Locale.ROOT);
                if (a.isEmpty()) continue;
                if (a.equals(".xlsx")) {
                    out.add("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                } else if (a.equals(".xls")) {
                    out.add("application/vnd.ms-excel");
                } else if (a.equals(".csv")) {
                    out.addAll(Arrays.asList("text/csv", "text/comma-separated-values", "application/csv", "text/plain", "application/vnd.ms-excel"));
                } else if (a.startsWith(".")) {
                    return new String[0]; // unknown extension: allow everything
                } else if (a.contains("/")) {
                    out.add(a);
                }
            }
        }
        // Some file managers label spreadsheets as generic binary.
        if (!out.isEmpty()) out.add("application/octet-stream");
        return new ArrayList<>(new java.util.LinkedHashSet<>(out)).toArray(new String[0]);
    }

    private void handlePermission(PermissionRequest request) {
        Uri origin = request.getOrigin();
        if (origin == null || !host.equalsIgnoreCase(origin.getHost())) {
            request.deny();
            return;
        }
        List<String> allowed = new ArrayList<>();
        boolean needsMic = false;
        for (String r : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                allowed.add(r);
                needsMic = true;
            }
        }
        if (allowed.isEmpty()) {
            request.deny();
            return;
        }
        if (needsMic && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingPermission = request;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
            return;
        }
        request.grant(allowed.toArray(new String[0]));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != REQ_MIC || pendingPermission == null) return;
        PermissionRequest req = pendingPermission;
        pendingPermission = null;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            req.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            req.deny();
            toast(R.string.mic_denied);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                result = new Uri[n];
                for (int i = 0; i < n; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    // ---------------------------------------------------------------- downloads

    private class DaklyDownloads implements DownloadListener {
        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
            Uri uri = Uri.parse(url);
            if (!isOurHost(uri)) {
                openExternal(uri);
                return;
            }
            try {
                DownloadManager.Request req = new DownloadManager.Request(uri);
                String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                req.setMimeType(mimeType);
                req.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));
                req.addRequestHeader("User-Agent", userAgent);
                req.setTitle(name);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                dm.enqueue(req);
                toast(R.string.download_started);
            } catch (RuntimeException e) {
                openExternal(uri);
            }
        }
    }

    // ---------------------------------------------------------------- lifecycle

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        unwatchNetwork();
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (web != null) {
            web.stopLoading();
            web.setWebChromeClient(null);
            web.setWebViewClient(null);
            web.destroy();
        }
        super.onDestroy();
    }

    private String versionName() {
        try {
            String v = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            return v == null ? "1" : v;
        } catch (PackageManager.NameNotFoundException e) {
            return "1";
        }
    }

    private void toast(int res) {
        Toast.makeText(this, res, Toast.LENGTH_LONG).show();
    }
}
