package com.doorstep.tn.customer.ui.search

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.doorstep.tn.common.theme.*
import com.doorstep.tn.core.network.SearchResult
import com.doorstep.tn.customer.ui.CustomerViewModel
import kotlinx.coroutines.delay

/**
 * Universal Search Screen - Impressive search experience matching web functionality
 * Searches across products, services, and shops from a single search bar
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UniversalSearchScreen(
    viewModel: CustomerViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onNavigateToService: (Int) -> Unit,
    onNavigateToProduct: (Int, Int) -> Unit,  // shopId, productId
    onNavigateToShop: (Int) -> Unit
) {
    val searchResults by viewModel.searchResults.collectAsState()
    val isSearching by viewModel.isSearching.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    
    var localQuery by remember { mutableStateOf("") }
    val focusRequester = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current
    val focusManager = LocalFocusManager.current
    
    // Auto-focus search field on launch
    LaunchedEffect(Unit) {
        delay(100)
        focusRequester.requestFocus()
    }
    
    // Debounced search
    LaunchedEffect(localQuery) {
        if (localQuery.length >= 2) {
            delay(300) // Debounce 300ms
            viewModel.performSearch(localQuery)
        } else if (localQuery.isEmpty()) {
            viewModel.clearSearch()
        }
    }
    
    Scaffold(
        containerColor = SlateDarker
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search Header with Gradient
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(SlateBackground, SlateDarker)
                        )
                    )
                    .padding(16.dp)
            ) {
                Column {
                    // Back button and title
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onNavigateBack) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = WhiteText
                            )
                        }
                        Text(
                            text = "Search Everything",
                            style = MaterialTheme.typography.titleLarge,
                            color = WhiteText,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    // Premium Search Bar
                    OutlinedTextField(
                        value = localQuery,
                        onValueChange = { localQuery = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .focusRequester(focusRequester),
                        placeholder = {
                            Text(
                                "Search services, products, shops...",
                                color = WhiteTextMuted
                            )
                        },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = null,
                                tint = if (localQuery.isNotEmpty()) OrangePrimary else WhiteTextMuted
                            )
                        },
                        trailingIcon = {
                            AnimatedVisibility(
                                visible = localQuery.isNotEmpty(),
                                enter = fadeIn(),
                                exit = fadeOut()
                            ) {
                                IconButton(onClick = { 
                                    localQuery = ""
                                    viewModel.clearSearch()
                                }) {
                                    Icon(
                                        imageVector = Icons.Default.Clear,
                                        contentDescription = "Clear",
                                        tint = WhiteTextMuted
                                    )
                                }
                            }
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(
                            onSearch = {
                                keyboardController?.hide()
                                focusManager.clearFocus()
                                if (localQuery.length >= 2) {
                                    viewModel.performSearch(localQuery)
                                }
                            }
                        ),
                        shape = RoundedCornerShape(16.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = WhiteText,
                            unfocusedTextColor = WhiteTextMuted,
                            focusedBorderColor = OrangePrimary,
                            unfocusedBorderColor = GlassWhite,
                            focusedContainerColor = SlateCard,
                            unfocusedContainerColor = SlateCard,
                            cursorColor = OrangePrimary
                        )
                    )
                    
                    // Quick Categories
                    Spacer(modifier = Modifier.height(16.dp))
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item {
                            QuickCategoryChip(
                                label = "Services",
                                icon = Icons.Default.Handshake,
                                color = ProviderBlue,
                                onClick = { localQuery = "services" }
                            )
                        }
                        item {
                            QuickCategoryChip(
                                label = "Products",
                                icon = Icons.Default.ShoppingBag,
                                color = OrangePrimary,
                                onClick = { localQuery = "products" }
                            )
                        }
                        item {
                            QuickCategoryChip(
                                label = "Shops",
                                icon = Icons.Default.Store,
                                color = SuccessGreen,
                                onClick = { localQuery = "shops" }
                            )
                        }
                        item {
                            QuickCategoryChip(
                                label = "Nearby",
                                icon = Icons.Default.NearMe,
                                color = Color(0xFF9C27B0),
                                onClick = { localQuery = "nearby" }
                            )
                        }
                    }
                }
            }
            
            // Results Section
            when {
                isSearching -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = OrangePrimary)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Searching...", color = WhiteTextMuted)
                        }
                    }
                }
                localQuery.isEmpty() -> {
                    // Empty state with suggestions
                    EmptySearchState()
                }
                searchResults.isEmpty() && localQuery.length >= 2 -> {
                    // No results
                    NoResultsState(query = searchQuery)
                }
                else -> {
                    // Results grouped by type
                    SearchResultsList(
                        results = searchResults,
                        onServiceClick = onNavigateToService,
                        onProductClick = onNavigateToProduct,
                        onShopClick = onNavigateToShop
                    )
                }
            }
        }
    }
}

@Composable
private fun QuickCategoryChip(
    label: String,
    icon: ImageVector,
    color: Color,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(20.dp),
        color = color.copy(alpha = 0.15f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = label,
                color = color,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun EmptySearchState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Animated search icon
        val scale by animateFloatAsState(
            targetValue = 1f,
            label = "scale"
        )
        
        Box(
            modifier = Modifier
                .size(100.dp)
                .scale(scale)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            OrangePrimary.copy(alpha = 0.2f),
                            SlateCard
                        )
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                tint = OrangePrimary,
                modifier = Modifier.size(48.dp)
            )
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Text(
            text = "What are you looking for?",
            style = MaterialTheme.typography.titleMedium,
            color = WhiteText,
            fontWeight = FontWeight.SemiBold
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Text(
            text = "Search for services, products, or shops",
            style = MaterialTheme.typography.bodyMedium,
            color = WhiteTextMuted
        )
        
        Spacer(modifier = Modifier.height(32.dp))
        
        // Popular searches
        Text(
            text = "Popular searches",
            style = MaterialTheme.typography.labelMedium,
            color = WhiteTextMuted
        )
        
        Spacer(modifier = Modifier.height(12.dp))
        
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf("Groceries", "Plumber", "Electronics").forEach { term ->
                SuggestionChip(
                    onClick = { /* TODO: Set search term */ },
                    label = { Text(term, color = WhiteTextMuted) },
                    colors = SuggestionChipDefaults.suggestionChipColors(
                        containerColor = SlateCard
                    ),
                    border = SuggestionChipDefaults.suggestionChipBorder(
                        enabled = true,
                        borderColor = GlassWhite
                    )
                )
            }
        }
    }
}

@Composable
private fun NoResultsState(query: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.SearchOff,
            contentDescription = null,
            tint = WhiteTextMuted,
            modifier = Modifier.size(64.dp)
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Text(
            text = "No results for \"$query\"",
            style = MaterialTheme.typography.titleMedium,
            color = WhiteText
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Text(
            text = "Try searching with different keywords",
            style = MaterialTheme.typography.bodyMedium,
            color = WhiteTextMuted
        )
    }
}

@Composable
private fun SearchResultsList(
    results: List<SearchResult>,
    onServiceClick: (Int) -> Unit,
    onProductClick: (Int, Int) -> Unit,
    onShopClick: (Int) -> Unit
) {
    val services = results.filter { it.type == "service" }
    val products = results.filter { it.type == "product" }
    val shops = results.filter { it.type == "shop" }
    
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Services Section
        if (services.isNotEmpty()) {
            item {
                SectionHeader(
                    title = "Services",
                    count = services.size,
                    icon = Icons.Default.Handshake,
                    color = ProviderBlue
                )
            }
            items(services.take(5)) { result ->
                SearchResultCard(
                    result = result,
                    onClick = { onServiceClick(result.id) }
                )
            }
        }
        
        // Products Section
        if (products.isNotEmpty()) {
            item {
                SectionHeader(
                    title = "Products",
                    count = products.size,
                    icon = Icons.Default.ShoppingBag,
                    color = OrangePrimary
                )
            }
            items(products.take(5)) { result ->
                SearchResultCard(
                    result = result,
                    onClick = { 
                        // For products, we need shopId - using id as fallback
                        onProductClick(result.id, result.id) 
                    }
                )
            }
        }
        
        // Shops Section
        if (shops.isNotEmpty()) {
            item {
                SectionHeader(
                    title = "Shops",
                    count = shops.size,
                    icon = Icons.Default.Store,
                    color = SuccessGreen
                )
            }
            items(shops.take(5)) { result ->
                SearchResultCard(
                    result = result,
                    onClick = { onShopClick(result.id) }
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    count: Int,
    icon: ImageVector,
    color: Color
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(color.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(18.dp)
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = WhiteText,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.width(8.dp))
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = color.copy(alpha = 0.15f)
        ) {
            Text(
                text = count.toString(),
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                style = MaterialTheme.typography.labelSmall,
                color = color
            )
        }
    }
}

@Composable
private fun SearchResultCard(
    result: SearchResult,
    onClick: () -> Unit
) {
    val (icon, color) = when (result.type) {
        "service" -> Icons.Default.Handshake to ProviderBlue
        "product" -> Icons.Default.ShoppingBag to OrangePrimary
        "shop" -> Icons.Default.Store to SuccessGreen
        else -> Icons.Default.Search to WhiteTextMuted
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SlateCard)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Icon
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(color.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(24.dp)
                )
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            // Content
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = result.name,
                    style = MaterialTheme.typography.titleSmall,
                    color = WhiteText,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                result.description?.let { desc ->
                    Text(
                        text = desc,
                        style = MaterialTheme.typography.bodySmall,
                        color = WhiteTextMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                
                // Metadata row
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    result.category?.let { cat ->
                        Text(
                            text = cat,
                            style = MaterialTheme.typography.labelSmall,
                            color = color.copy(alpha = 0.8f)
                        )
                    }
                    
                    result.distance?.let { dist ->
                        Text(
                            text = "${String.format("%.1f", dist)} km",
                            style = MaterialTheme.typography.labelSmall,
                            color = WhiteTextMuted
                        )
                    }
                }
            }
            
            // Price if available
            result.price?.let { price ->
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "₹$price",
                        style = MaterialTheme.typography.titleSmall,
                        color = OrangePrimary,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
            
            Spacer(modifier = Modifier.width(8.dp))
            
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = WhiteTextMuted,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}
