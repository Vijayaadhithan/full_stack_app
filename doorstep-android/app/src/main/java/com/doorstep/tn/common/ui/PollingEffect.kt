package com.doorstep.tn.common.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
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
    val lifecycleOwner = LocalLifecycleOwner.current
    var isStarted by remember(lifecycleOwner) {
        mutableStateOf(
            lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)
        )
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            isStarted = when (event) {
                Lifecycle.Event.ON_START,
                Lifecycle.Event.ON_RESUME -> true

                Lifecycle.Event.ON_PAUSE,
                Lifecycle.Event.ON_STOP,
                Lifecycle.Event.ON_DESTROY -> false

                else -> isStarted
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LaunchedEffect(intervalMs, enabled, immediate, isStarted) {
        if (!enabled || !isStarted) return@LaunchedEffect
        if (immediate) {
            latestOnPoll()
        }
        while (isActive && isStarted) {
            delay(intervalMs)
            if (!isStarted) break
            latestOnPoll()
        }
    }
}
