package com.doorstep.tn

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.doorstep.tn.common.theme.DoorStepTheme
import com.doorstep.tn.navigation.DoorStepNavHost
import dagger.hilt.android.AndroidEntryPoint

/**
 * Main activity for the DoorStep TN app.
 * Uses single-activity architecture with Compose navigation.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        
        setContent {
            DoorStepTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    DoorStepNavHost()
                }
            }
        }
    }
}
