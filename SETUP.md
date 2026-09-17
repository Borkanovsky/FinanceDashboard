# Setup Guide — Finance Dashboard

Complete instructions for getting this project running from scratch.

---

## Part 1: Install the Tools

### 1. Node.js

Download the **LTS** version from [nodejs.org](https://nodejs.org). Run the installer with default settings.

Verify in a terminal:
```
node --version
npm --version
```
Both should print version numbers. If not, restart your computer and check again.

### 2. Visual Studio Code

Download from [code.visualstudio.com](https://code.visualstudio.com).

Install these extensions (Extensions icon in the left sidebar):
- **ES7+ React/Redux/React-Native Snippets** — code shortcuts
- **Prettier - Code formatter** — auto-formats your code
- **GitLens** — better Git integration

### 3. Git

Download from [git-scm.com](https://git-scm.com). Install with default settings.

Verify:
```
git --version
```

**Windows only** — enable long path support to avoid errors later. Open Command Prompt **as Administrator** and run:
```
git config --system core.longpaths true
```

### 4. Expo Go (on your phone)

- **iPhone:** App Store → search "Expo Go" → Install
- **Android:** Google Play → search "Expo Go" → Install

This is how you preview the app on a real device.

---

## Part 2: Get an API Key

The app pulls financial data from Financial Modeling Prep.

1. Go to [financialmodelingprep.com](https://financialmodelingprep.com)
2. Create an account
3. Find your API key on the dashboard
4. Copy it somewhere safe

**Important:** FMP's free tier no longer covers financial statements, ratios, or historical prices. Those endpoints return `402 Payment Required`. You need a paid tier for the app to work fully. The free tier only supports search and company profile.

---

## Part 3: Set Up the Project

### Clone or create

If cloning this repo:
```
git clone https://github.com/YOUR_USERNAME/FinanceDashboard.git
cd FinanceDashboard
npm install
```

If starting fresh:
```
npx create-expo-app FinanceDashboard --template blank
cd FinanceDashboard
```
Then copy the `src/` folder and `App.js` into the project.

### Install dependencies

Run these one at a time, waiting for each to finish:

```
npx expo install react-native-chart-kit
npx expo install react-native-svg
npx expo install @react-navigation/native
npx expo install @react-navigation/native-stack
npx expo install @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context
npm install axios
```

### Add your API key

Open `src/constants/config.js` and replace the placeholder:

```javascript
const config = {
  FMP_BASE_URL: 'https://financialmodelingprep.com/stable',
  FMP_API_KEY: 'paste_your_key_here',
  FINANCIAL_YEARS: 5,
};

export default config;
```

Note the base URL is `/stable`, not `/api/v3`. FMP deprecated the v3 API in August 2025.

---

## Part 4: Run It

```
npx expo start --clear
```

A QR code appears in the terminal.

- **iPhone:** open the Camera app, point it at the QR code, tap the notification
- **Android:** open Expo Go, tap "Scan QR code"

Your phone and computer must be on the **same Wi-Fi network**. If they aren't, or if campus Wi-Fi blocks device-to-device connections, see the network section below.

---

## Project Structure

```
FinanceDashboard/
├── App.js                        navigation setup, app entry point
├── package.json                  dependencies
├── .gitignore                    files Git should ignore
└── src/
    ├── constants/
    │   ├── colors.js             color theme
    │   └── config.js             API key and base URL
    ├── services/
    │   └── api.js                all API calls
    ├── screens/
    │   ├── SearchScreen.js       ticker search with autocomplete
    │   ├── OverviewScreen.js     price, chart, company info
    │   ├── FinancialsScreen.js   income/balance/cash flow
    │   ├── RatiosScreen.js       20+ financial ratios
    │   └── DCFScreen.js          valuation calculator
    ├── components/
    │   ├── LoadingSpinner.js     loading indicator
    │   └── RatioCard.js          single ratio display
    └── utils/
        ├── formatters.js         number formatting
        └── dcfCalculator.js      DCF math
```

---

## Troubleshooting

### Network and connection

**"Request timed out" or app hangs while loading**

Your phone can't reach the dev server. Try in this order:

1. Restart with a cleared cache: `npx expo start --clear`
2. Force-close Expo Go on your phone and rescan
3. Confirm both devices are on the same Wi-Fi, with no VPN running
4. Use your phone's hotspot: enable Personal Hotspot, connect your computer to it, then `npx expo start --clear`

Avoid `--tunnel` on Windows. It depends on ngrok, which frequently fails to install correctly.

**Campus or dorm Wi-Fi**

These networks often isolate devices from each other, which breaks the connection. The hotspot method above is the reliable workaround.

### Build and bundling

**"Cannot resolve entry file"**

Check the `main` field in `package.json`. For a blank Expo template it should be `"node_modules/expo/AppEntry.js"`. Also confirm `App.js` exists in the project root, not inside a subfolder.

**"Unable to resolve module"**

A dependency is missing. Re-run the install commands from Part 3.

**Project is incompatible with this version of Expo Go**

Update Expo Go on your phone to the latest version. If that doesn't fix it, align your project:
```
npx expo install --fix
```

**Bundling fails with a syntax error**

Read the error. It names the file and line number. The most common causes are an unclosed brace, a duplicate import of the same function, or leftover code from an incomplete edit.

### API errors

| Error | Cause | Fix |
|---|---|---|
| `401` | Invalid or missing API key | Check `config.js` for typos, extra spaces, or nested quotes |
| `402` | Endpoint requires a paid plan | Upgrade your FMP tier |
| `403` | Rate limit exceeded | Wait, or upgrade |
| `404` | Wrong endpoint path | Verify the URL in a browser first |
| `Network Error` | Malformed URL or no connection | Log the URL and check for `undefined` in it |
| `Legacy Endpoint` | Using `/api/v3/` | Switch to `/stable/` in `config.js` |

**Debugging API problems:** add a temporary `console.log` of the constructed URL inside the failing function in `api.js`, then paste that exact URL into a browser. If it fails in the browser too, the problem is the endpoint or your key. If it works in the browser but not the app, the problem is in your code.

### Data showing "N/A"

FMP changed most field names when they moved from v3 to stable. If a value shows N/A, log the raw response to see the actual field names:

```javascript
console.log('FIELDS:', Object.keys(responseData));
```

Then update the field name in your screen to match.

Also test against a large, profitable company like AAPL before assuming it's a bug. Small or unprofitable companies legitimately return null for ratios like P/E and interest coverage.

### Git problems (Windows)

**"Filename too long" when running `git add`**

`node_modules` is being tracked. Confirm `.gitignore` exists in the project root and contains `node_modules/`. Create it from the terminal so Windows can't append a hidden `.txt` extension:
```
echo node_modules/ > .gitignore
echo .expo/ >> .gitignore
echo android/ >> .gitignore
echo ios/ >> .gitignore
echo src/constants/config.js >> .gitignore
```
Then `git reset` and check `git status` before adding again.

**Files still tracked after adding them to `.gitignore`**

`.gitignore` only affects untracked files. For anything already committed:
```
git rm -r --cached folder_name
```
The `--cached` flag removes it from Git but keeps it on disk.

**"remote origin already exists"**
```
git remote set-url origin https://github.com/YOUR_USERNAME/FinanceDashboard.git
```

**Push rejected, "fetch first"**

GitHub has commits you don't have locally:
```
git pull origin main --allow-unrelated-histories
git push
```

---

## Before Pushing to GitHub

Check that your API key isn't exposed:

```
git ls-files
```

If `src/constants/config.js` appears in that list, either remove it from tracking:
```
git rm --cached src/constants/config.js
```

Or replace your real key with `YOUR_API_KEY_HERE` in the file and commit that version, so people can see the structure without getting your key.

After pushing, open `src/constants/config.js` on the GitHub website and confirm no live key is visible.
