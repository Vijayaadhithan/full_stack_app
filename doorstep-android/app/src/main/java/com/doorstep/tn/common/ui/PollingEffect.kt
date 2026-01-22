package com.doorstep.tn.common.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
fun PollingEffect(
    intervalMs: Long,
    enabled: Boolean = true,
    immediate: Boolean = false,
    onPoll: suspend () -> Unit
) {
    val latestOnPoll by rememberUpdatedState(onPoll)

    LaunchedEffect(intervalMs, enabled, immediate) {
        if (!enabled) return@LaunchedEffect
        if (immediate) {
            latestOnPoll()
        }
        while (isActive) {
            delay(intervalMs)
            latestOnPoll()
        }
    }
}
