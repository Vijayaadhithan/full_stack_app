package com.doorstep.tn.provider.ui

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.auth.ui.AuthViewModel
import com.doorstep.tn.customer.ui.CustomerViewModel
import com.doorstep.tn.customer.ui.profile.ProfileScreen

@Composable
fun ProviderProfileScreen(
    authViewModel: AuthViewModel = hiltViewModel(),
    customerViewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToReviews: () -> Unit,
    onSwitchRole: ((String) -> Unit)? = null,
    onLogout: () -> Unit
) {
    ProfileScreen(
        authViewModel = authViewModel,
        customerViewModel = customerViewModel,
        profileTitle = "Provider Profile",
        reviewsLabel = "Provider Reviews",
        onNavigateBack = onNavigateBack,
        onNavigateToReviews = onNavigateToReviews,
        onSwitchRole = onSwitchRole,
        onLogout = onLogout
    )
}
