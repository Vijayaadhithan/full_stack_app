package com.doorstep.tn.common.ui

import android.annotation.SuppressLint
import android.net.Uri
import android.net.http.SslError
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.doorstep.tn.BuildConfig
import com.doorstep.tn.common.theme.ErrorRed
import com.doorstep.tn.common.theme.OrangePrimary
import com.doorstep.tn.common.theme.SlateBackground
import com.doorstep.tn.common.theme.SlateDarker
import com.doorstep.tn.common.theme.WhiteText

@OptIn(ExperimentalMaterial3Api::class)
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PrivacyPolicyScreen(
    onNavigateBack: () -> Unit
) {
    val url = BuildConfig.PRIVACY_POLICY_URL.trim()
    val allowedUri = remember(url) { runCatching { Uri.parse(url) }.getOrNull() }
    val allowedHost = allowedUri?.host?.lowercase()
    val canonicalUrl = allowedUri?.toString().orEmpty()
    val isValidUrl = allowedUri?.scheme.equals("https", ignoreCase = true) &&
        !allowedHost.isNullOrBlank()
    val isAllowedHost: (String?) -> Boolean = { host ->
        val normalizedHost = host?.lowercase()
        if (normalizedHost.isNullOrBlank() || allowedHost.isNullOrBlank()) {
            false
        } else {
            normalizedHost == allowedHost || normalizedHost.endsWith(".$allowedHost")
        }
    }

    var isLoading by remember { mutableStateOf(url.isNotBlank()) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    DisposableEffect(Unit) {
        onDispose {
            webViewRef?.destroy()
            webViewRef = null
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Privacy Policy", color = WhiteText) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = WhiteText
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SlateBackground)
            )
        },
        containerColor = SlateDarker
    ) { paddingValues ->
        if (url.isBlank()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Privacy policy URL is not configured.",
                    color = ErrorRed,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            return@Scaffold
        }

        if (!isValidUrl) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Privacy policy URL must use HTTPS.",
                    color = ErrorRed,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            verticalArrangement = Arrangement.Top
        ) {
            if (isLoading) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth(),
                    color = OrangePrimary,
                    trackColor = SlateBackground
                )
            }

            errorMessage?.let { message ->
                Text(
                    text = message,
                    color = ErrorRed,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }

            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        webViewRef = this
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.allowFileAccess = false
                        settings.allowContentAccess = false
                        settings.javaScriptCanOpenWindowsAutomatically = false
                        settings.setSupportMultipleWindows(false)
                        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                        settings.safeBrowsingEnabled = true
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(
                                view: WebView?,
                                request: WebResourceRequest?
                            ): Boolean {
                                val targetUri = request?.url ?: return true
                                val isAllowedTarget = targetUri.scheme.equals("https", ignoreCase = true) &&
                                    isAllowedHost(targetUri.host)
                                if (!isAllowedTarget) {
                                    errorMessage = "External links are blocked in this screen."
                                }
                                return !isAllowedTarget
                            }

                            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                                isLoading = true
                                errorMessage = null
                            }

                            override fun onPageFinished(view: WebView?, url: String?) {
                                isLoading = false
                            }

                            override fun onReceivedError(
                                view: WebView?,
                                request: WebResourceRequest?,
                                error: WebResourceError?
                            ) {
                                if (request?.isForMainFrame == true) {
                                    isLoading = false
                                    errorMessage = error?.description?.toString()
                                        ?: "Failed to load privacy policy."
                                }
                            }

                            override fun onReceivedSslError(
                                view: WebView?,
                                handler: SslErrorHandler?,
                                error: SslError?
                            ) {
                                handler?.cancel()
                                isLoading = false
                                errorMessage = "Secure connection error while loading privacy policy."
                            }
                        }
                        loadUrl(canonicalUrl)
                    }
                },
                update = { webView ->
                    val currentUri = runCatching { Uri.parse(webView.url) }.getOrNull()
                    val isCurrentAllowed = currentUri?.scheme.equals("https", ignoreCase = true) &&
                        isAllowedHost(currentUri?.host)
                    if (!isCurrentAllowed) {
                        webView.loadUrl(canonicalUrl)
                    }
                }
            )
        }
    }
}
