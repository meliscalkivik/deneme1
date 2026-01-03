# Simple Checklist + Notes (Mobile App)

This is a tiny, mobile-friendly checklist + notes app packaged as a **mobile app** using **Capacitor** (Android/iOS).

## Features

- Check/uncheck items
- Add/delete checklist items
- Notes box: tap to type (mobile keyboard opens), **Done** dismisses keyboard
- Saves checklist + notes in `localStorage` (persists on this device)

## Run (web preview)

Serve the web assets locally:

```bash
python3 -m http.server 8000 --directory web
```

Then open `http://localhost:8000`.

## Mobile (Capacitor)

Install dependencies:

```bash
npm install
```

Generate native projects:

```bash
npx cap add android
# iOS project can be generated too, but you need macOS + Xcode to build/run it:
# npx cap add ios
```

Sync web assets into native projects:

```bash
npx cap sync
```

Open Android Studio:

```bash
npx cap open android
```

