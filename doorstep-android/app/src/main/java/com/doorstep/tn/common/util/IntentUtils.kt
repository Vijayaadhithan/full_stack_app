package com.doorstep.tn.common.util

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Starts intents defensively to avoid ActivityNotFound crashes.
 */
fun Context.launchIntentSafely(intent: Intent): Boolean {
    return try {
        if (intent.resolveActivity(packageManager) == null) {
            false
        } else {
            startActivity(intent)
            true
        }
    } catch (_: ActivityNotFoundException) {
        false
    } catch (_: SecurityException) {
        false
    }
}

fun Context.openUriSafely(uri: Uri, targetPackage: String? = null): Boolean {
    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
        if (!targetPackage.isNullOrBlank()) {
            `package` = targetPackage
        }
    }
    return launchIntentSafely(intent)
}
