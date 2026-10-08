# OneDelivery Mobile App — Build Guide
## Generate APK, AAB & Publish to Stores

---

## Prerequisites

### Install tools
```bash
npm install -g eas-cli expo-cli
eas login  # Log in with your Expo account
```

### Create an Expo account
Sign up at https://expo.dev if you don't have one.

---

## Step 1 — Project Setup

```bash
cd onedelivery-mobile
npm install
```

### Configure your EAS project
```bash
eas init
# This sets your EAS project ID in app.json → extra.eas.projectId
```

### Set environment variables in .env
```env
EXPO_PUBLIC_API_URL=https://api.onedelivery.co.tz/api
EXPO_PUBLIC_SOCKET_URL=https://api.onedelivery.co.tz
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY=YOUR_ANDROID_KEY
EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY=YOUR_IOS_KEY
```

---

## Step 2 — Google Maps API Key

1. Go to https://console.cloud.google.com
2. Create a project or select existing
3. Enable APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Geocoding API
   - Places API
   - Directions API
4. Create two API keys (Android & iOS)
5. Restrict each key to its platform
6. Add both keys to `.env` and `app.json`

---

## Step 3 — Firebase Push Notifications

1. Go to https://console.firebase.google.com
2. Create project "onedelivery"
3. Add Android app (package: `com.yourcompany.onedelivery`)
4. Add iOS app (bundle ID: `com.yourcompany.onedelivery`)
5. Download `google-services.json` → place in project root
6. Download `GoogleService-Info.plist` → place in project root

These files are used automatically by EAS during the build.

---

## Step 4 — Android Signing (for Store)

### Generate a keystore (only once — NEVER lose this file)
```bash
keytool -genkey -v \
  -keystore onedelivery-release.keystore \
  -alias onedelivery \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### Store secrets in EAS
```bash
eas secret:create --scope project --name ANDROID_KEYSTORE --type file --value ./onedelivery-release.keystore
eas secret:create --scope project --name ANDROID_KEYSTORE_PASSWORD --value "your_password"
eas secret:create --scope project --name ANDROID_KEY_ALIAS --value "onedelivery"
eas secret:create --scope project --name ANDROID_KEY_PASSWORD --value "your_key_password"
```

### Update eas.json to reference keystore
```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle",
        "credentialsSource": "local"
      }
    }
  }
}
```

---

## Step 5 — Generate APK (for testing / direct install)

```bash
# Trigger APK build on EAS servers
eas build --platform android --profile preview

# Or build locally if you have Android SDK:
eas build --platform android --profile preview --local
```

**Download the APK** from the EAS dashboard or the link printed in the terminal.

**Install on device:**
```bash
adb install path/to/app.apk
```
Or transfer the `.apk` file to your phone and open it (enable "Install from unknown sources" in Settings).

---

## Step 6 — Generate AAB (for Google Play Store)

```bash
eas build --platform android --profile production
```

This creates a `.aab` file — the format required by Google Play.

**Download from:** https://expo.dev → your project → Builds

---

## Step 7 — iOS Build (for App Store / TestFlight)

### Requirements
- Apple Developer account ($99/year) — https://developer.apple.com
- Mac computer (for local builds) OR use EAS cloud build

```bash
eas build --platform ios --profile production
```

EAS will ask you to:
1. Log in to Apple Developer account
2. Create/select a Distribution Certificate
3. Create/select a Provisioning Profile

---

## Step 8 — Update app.json Before Building

Edit `app.json` — replace placeholder values:

```json
{
  "expo": {
    "name": "OneDelivery",
    "slug": "onedelivery",
    "version": "2.0.0",
    "ios": {
      "bundleIdentifier": "com.yourcompany.onedelivery"
    },
    "android": {
      "package": "com.yourcompany.onedelivery",
      "versionCode": 2
    },
    "extra": {
      "eas": {
        "projectId": "YOUR_EAS_PROJECT_ID"
      }
    }
  }
}
```

**Increment `versionCode`** for every Android update (must be higher than previous).
**Increment `version`** for every store update (e.g., 2.0.0 → 2.1.0).

---

## Step 9 — Submit to Google Play Store

### First-time setup
1. Create a Google Play Developer account ($25 one-time fee)
2. Create a new app in the Play Console
3. Set up your app listing (screenshots, description, etc.)
4. Download your service account JSON for automated uploads

```bash
# Automated submission via EAS
eas submit --platform android --profile production
```

Or manually upload the `.aab` file at https://play.google.com/console

### Review checklist
- [ ] App title, short description, full description
- [ ] At least 2 screenshots per device type
- [ ] App icon (512x512 PNG)
- [ ] Feature graphic (1024x500 PNG)
- [ ] Privacy policy URL
- [ ] Content rating questionnaire completed
- [ ] Data safety form completed (what data you collect)

---

## Step 10 — Submit to Apple App Store

```bash
eas submit --platform ios --profile production
```

Or use Transporter app (Mac) to upload the `.ipa` file.

### App Store review checklist
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] App screenshots for all device sizes
- [ ] App Store description
- [ ] Keywords (100 characters max)
- [ ] Age rating filled out

---

## Manual Actions Required Before Going Live

### 1. Google Maps API Keys
```
Replace "YOUR_GOOGLE_MAPS_ANDROID_KEY" and "YOUR_GOOGLE_MAPS_IOS_KEY"
in app.json and .env with your real keys from Google Cloud Console.
```

### 2. Firebase Config Files
```
Place google-services.json in the project root (for Android).
Place GoogleService-Info.plist in the project root (for iOS).
```

### 3. EAS Project ID
```
Run: eas init
Then copy the project ID printed into app.json → extra.eas.projectId
```

### 4. App Identifier
```
Change "com.yourcompany.onedelivery" to your actual company name:
- app.json → ios.bundleIdentifier
- app.json → android.package
```

### 5. Backend URL
```
Set EXPO_PUBLIC_API_URL=https://api.onedelivery.co.tz/api in .env
and in eas.json → build.production.env
```

### 6. Keystore Backup
```
Back up your onedelivery-release.keystore file SECURELY.
If you lose it, you CANNOT update the app on Google Play. Ever.
Store it encrypted in a password manager or secure cloud storage.
```

---

## Quick Build Commands Reference

```bash
# Development build (hot reload, dev tools)
eas build --platform android --profile development

# Test APK (shareable link, no Play Store needed)
eas build --platform android --profile preview

# Production AAB (for Play Store)
eas build --platform android --profile production

# iOS build (for App Store / TestFlight)
eas build --platform ios --profile production

# Both platforms at once
eas build --platform all --profile production

# Check build status
eas build:list

# Submit to stores
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

---

## 500+ Users Scaling Strategy

The mobile app itself is stateless — it just calls the API. Scaling is done entirely on the backend. Follow this progression:

### Current (0–500 users)
- Single VPS (8GB RAM, 4 CPU)
- MySQL + Redis on the same server
- PM2 cluster mode (uses all CPU cores)
- **Estimated capacity:** 500 concurrent users

### Growth (500–5,000 users)
- Upgrade Hostinger VPS to 16GB RAM, 6 CPU
- Move MySQL to dedicated DB server
- Increase PM2 instances and DB pool
- Add Nginx caching for product listings
- **Expected:** 5,000 concurrent users

### Scale (5,000–50,000 users)
- 2–3 app servers behind load balancer
- MySQL → PlanetScale or AWS RDS
- Redis → Upstash or Redis Cloud
- CDN for images (already on Cloudinary)
- **Expected:** 50,000+ concurrent users

### Enterprise (50,000+ users)
- Kubernetes or Docker Swarm
- Database read replicas
- Message queue (RabbitMQ/SQS) for notifications
- Separate WebSocket servers (Socket.io Redis adapter)

### App-side performance settings
The app uses:
- React Query with 30s staleTime → reduces API calls by 70%
- Socket.io for real-time → no polling
- expo-image with automatic caching
- FlatList/ScrollView with proper key extraction
- Deferred search values → no API call per keystroke

---

## Troubleshooting

### Build fails: "Missing google-services.json"
Place the file from Firebase Console in your project root.

### Maps don't show (blank white screen)
Your Google Maps API key is not set or not enabled for the right API.
Enable "Maps SDK for Android" and "Maps SDK for iOS" in Google Cloud Console.

### Push notifications not working
1. Ensure Firebase is configured
2. Ensure the `expo-notifications` plugin is in app.json
3. Ensure FCM token is sent to backend on login (handled by useNotifications hook)
4. Physical device required (simulators don't support push notifications)

### Socket.io connection fails
Check:
1. Backend WebSocket proxy is enabled in Nginx (`/socket.io/` location block)
2. `EXPO_PUBLIC_SOCKET_URL` points to `https://api.onedelivery.co.tz` (no `/api`)
3. JWT token is valid

### "Network error" on all API calls
The app can't reach the backend. Check:
1. Backend is running: `pm2 status`
2. SSL is valid: visit `https://api.onedelivery.co.tz/api/health` in browser
3. Firewall allows port 443: `ufw status`
