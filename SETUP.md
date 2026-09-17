# Finance Dashboard - Setup Instructions

## Prerequisites (install these first, in order)

### 1. Install Node.js
- Go to https://nodejs.org
- Download the **LTS** version (not "Current")
- Run the installer, accept all defaults
- Verify: open terminal, run `node --version` (should show v18+ or v20+)
- Verify: `npm --version` (should show 9+ or 10+)

### 2. Install VS Code
- Go to https://code.visualstudio.com
- Download and install
- Open VS Code, install these extensions:
  - ES7+ React/Redux/React-Native Snippets
  - Prettier - Code formatter

### 3. Install Expo Go on Your Phone
- iPhone: App Store, search "Expo Go"
- Android: Google Play Store, search "Expo Go"

### 4. Get Your API Key
- Go to https://financialmodelingprep.com
- Sign up for a free account
- Go to Dashboard, copy your API key
- Open `src/constants/config.js` and replace `YOUR_API_KEY_HERE` with your key

## Project Setup

### 5. Create the Expo project
```bash
npx create-expo-app FinanceDashboard --template blank
cd FinanceDashboard
```

### 6. Copy the source files
Copy all files from this download into your FinanceDashboard folder, overwriting App.js and adding the src/ directory.

### 7. Install dependencies
Run each command one at a time. Wait for each to finish before running the next.

```bash
npx expo install react-native-chart-kit
npx expo install react-native-svg
npx expo install @react-navigation/native
npx expo install @react-navigation/native-stack
npx expo install @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context
npx expo install @react-native-community/slider
npm install axios
```

### 8. Start the app
```bash
npx expo start --clear
```

Scan the QR code with Expo Go on your phone. The app should load.

## Common Errors

**"Cannot resolve entry file"**
Your package.json `main` field is wrong. It should be `"node_modules/expo/AppEntry.js"` for a blank template.

**"Unable to resolve module"**
You missed installing a dependency. Re-run the install commands from step 7.

**"Network Error" when fetching data**
Your phone and computer must be on the same Wi-Fi network. Campus Wi-Fi sometimes blocks local connections. Use your phone's hotspot temporarily.

**"401 Unauthorized" from API**
Your API key in config.js is wrong or missing. Double-check it.

**"403 Forbidden" from API**
You've exceeded 250 daily requests. Wait until tomorrow or upgrade your plan.

**Blank screen after search**
Check the console for errors. The ticker might not exist in FMP's database, or the API response format might have changed.
