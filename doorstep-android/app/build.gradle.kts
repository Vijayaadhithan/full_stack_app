plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.ksp)
    alias(libs.plugins.google.services)
}

val apiCertPins = (project.findProperty("API_CERT_PINS") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: System.getenv("API_CERT_PINS")?.trim()?.takeIf { it.isNotEmpty() }

val versionCodeOverride = (project.findProperty("VERSION_CODE") as String?)
    ?.trim()
    ?.toIntOrNull()
    ?: System.getenv("VERSION_CODE")?.trim()?.toIntOrNull()

val versionNameOverride = (project.findProperty("VERSION_NAME") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: System.getenv("VERSION_NAME")?.trim()?.takeIf { it.isNotEmpty() }

val releaseKeystoreFile = (project.findProperty("RELEASE_KEYSTORE_FILE") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: System.getenv("RELEASE_KEYSTORE_FILE")?.trim()?.takeIf { it.isNotEmpty() }

val releaseStorePassword = (project.findProperty("RELEASE_KEYSTORE_PASSWORD") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: System.getenv("RELEASE_KEYSTORE_PASSWORD")?.trim()?.takeIf { it.isNotEmpty() }

val releaseKeyAlias = (project.findProperty("RELEASE_KEY_ALIAS") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: System.getenv("RELEASE_KEY_ALIAS")?.trim()?.takeIf { it.isNotEmpty() }

val releaseKeyPassword = (project.findProperty("RELEASE_KEY_PASSWORD") as String?)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: System.getenv("RELEASE_KEY_PASSWORD")?.trim()?.takeIf { it.isNotEmpty() }

fun escapeBuildConfig(value: String): String {
    return value.replace("\\", "\\\\").replace("\"", "\\\"")
}

android {
    namespace = "com.doorstep.tn"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.doorstep.tn"
        minSdk = 26
        targetSdk = 35
        versionCode = versionCodeOverride ?: 1
        versionName = versionNameOverride ?: "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        
        // API Base URL
        buildConfigField("String", "API_BASE_URL", "\"https://api.doorsteptn.in\"")
        buildConfigField("String", "PRIVACY_POLICY_URL", "\"https://doorsteptn.in/privacy-policy\"")
        buildConfigField("String", "ACCOUNT_DELETION_URL", "\"https://doorsteptn.in/account-deletion\"")
        val resolvedPins = apiCertPins ?: ""
        val escapedPins = escapeBuildConfig(resolvedPins)
        buildConfigField("String", "API_CERT_PINS", "\"$escapedPins\"")
    }

    signingConfigs {
        create("release") {
            if (!releaseKeystoreFile.isNullOrBlank()) {
                storeFile = file(releaseKeystoreFile)
            }
            storePassword = releaseStorePassword
            keyAlias = releaseKeyAlias
            keyPassword = releaseKeyPassword
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            // For local development, use emulator-friendly URL
            buildConfigField("String", "API_BASE_URL", "\"https://api.doorsteptn.in\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            val releasePins = apiCertPins ?: ""
            val escapedPins = escapeBuildConfig(releasePins)
            buildConfigField("String", "API_BASE_URL", "\"https://api.doorsteptn.in\"")
            buildConfigField("String", "API_CERT_PINS", "\"$escapedPins\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

fun String.requiresReleaseConfigValidation(): Boolean {
    val lower = lowercase()
    val isAssembleRelease = lower.startsWith("assemble") && lower.endsWith("release")
    val isBundleRelease = lower.startsWith("bundle") && lower.endsWith("release")
    val isPublishRelease = lower.startsWith("publish") && lower.contains("release")
    val isPackageRelease = lower.startsWith("package") && lower.endsWith("release")
    return isAssembleRelease || isBundleRelease || isPublishRelease || isPackageRelease
}

fun validateReleaseBuildConfig() {
    if (versionCodeOverride == null) {
        throw GradleException("VERSION_CODE must be set for release builds (e.g., -PVERSION_CODE=2 or env VERSION_CODE=2).")
    }
    if (apiCertPins.isNullOrBlank()) {
        throw GradleException("API_CERT_PINS must be set for release builds.")
    }
    val missingSigningConfig = listOf(
        "RELEASE_KEYSTORE_FILE" to releaseKeystoreFile,
        "RELEASE_KEYSTORE_PASSWORD" to releaseStorePassword,
        "RELEASE_KEY_ALIAS" to releaseKeyAlias,
        "RELEASE_KEY_PASSWORD" to releaseKeyPassword
    ).filter { it.second.isNullOrBlank() }.map { it.first }
    if (missingSigningConfig.isNotEmpty()) {
        throw GradleException(
            "Release signing is not configured. Missing: ${missingSigningConfig.joinToString(", ")}"
        )
    }
    if (!file(releaseKeystoreFile!!).exists()) {
        throw GradleException("Release keystore file not found: $releaseKeystoreFile")
    }
}

gradle.taskGraph.whenReady {
    val requiresValidation = allTasks.any { it.name.requiresReleaseConfigValidation() }
    if (requiresValidation) {
        validateReleaseBuildConfig()
    }
}

dependencies {
    // Core Android
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    // Compose
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    // Navigation
    implementation(libs.androidx.navigation.compose)

    // Hilt Dependency Injection
    implementation(libs.hilt.android)
    ksp(libs.hilt.android.compiler)
    implementation(libs.hilt.navigation.compose)

    // Networking
    implementation(libs.retrofit)
    implementation(libs.retrofit.moshi)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.moshi)
    implementation(libs.moshi.kotlin)

    // Room Database
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // DataStore
    implementation(libs.datastore.preferences)

    // Security Crypto (EncryptedSharedPreferences)
    implementation(libs.androidx.security.crypto)

    // Image Loading
    implementation(libs.coil.compose)

    // Firebase
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth.ktx)
    implementation(libs.firebase.messaging.ktx)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)
    
    // Play Services Location (for GPS)
    implementation(libs.play.services.location)

    // Testing
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
}
