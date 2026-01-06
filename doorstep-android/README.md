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

## API Configuration

The app connects to:
- **Production**: https://doorsteptn.in
- **Development**: http://10.0.2.2:5000 (Android emulator localhost)
