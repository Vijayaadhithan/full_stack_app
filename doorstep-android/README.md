# Native Android App - DoorStep TN

A native Android application for the DoorStep TN marketplace platform built with Kotlin and Jetpack Compose.

## Tech Stack

- **Language**: Kotlin
- **UI**: Jetpack Compose + Material 3
- **Architecture**: MVVM + Clean Architecture
- **Networking**: Retrofit + OkHttp + Moshi
- **Local Storage**: Room Database + DataStore
- **DI**: Hilt (Dagger)
- **Auth**: Firebase Phone Auth

## Project Structure

```
app/
├── src/main/java/com/doorstep/tn/
│   ├── DoorStepApp.kt          # Application class
│   ├── MainActivity.kt         # Single activity
│   ├── core/                   # Core utilities
│   ├── auth/                   # Authentication feature
│   ├── customer/               # Customer feature
│   ├── shop/                   # Shop owner feature
│   ├── provider/               # Provider feature
│   └── common/                 # Shared components
└── src/main/res/
    ├── values/strings.xml      # English strings
    └── values-ta/strings.xml   # Tamil strings
```

## Build & Run

```bash
# Build debug APK
./gradlew assembleDebug

# Install on device
./gradlew installDebug

# Run tests
./gradlew test
```

## Release Build (Play Store)

Release tasks now validate required config up front. Set these before running `bundleRelease` or `assembleRelease`:

```bash
export VERSION_CODE=2
export VERSION_NAME=1.0.1
export API_CERT_PINS="sha256/your_pin_1,sha256/your_pin_2"
export RELEASE_KEYSTORE_FILE="/absolute/path/to/upload-keystore.jks"
export RELEASE_KEYSTORE_PASSWORD="your_store_password"
export RELEASE_KEY_ALIAS="your_key_alias"
export RELEASE_KEY_PASSWORD="your_key_password"
```

Then build:

```bash
./gradlew bundleRelease
```

## API Configuration

The app connects to:
- **Production**: https://doorsteptn.in
- **Development**: http://10.0.2.2:5000 (Android emulator localhost)
