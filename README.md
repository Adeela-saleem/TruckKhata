# Truck Khata

Urdu and English ledger (khata) for a transport company: Ada Register, brokers and parties,
trips (outward and return as one case), Bill Book, truck insurance and reports, all linked by Case #.

## Repository layout

```
apps/
  web/      React + Vite web app (SQLite in the browser via sql.js) — main app
  mobile/   Expo / React Native app (on-device SQLite)
```

Both apps share the same business logic in `src/core` (database, domain rules, i18n, printing).

## Getting started

### Web

```bash
cd apps/web
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
```

### Mobile

```bash
cd apps/mobile
npm install
npx expo start
```

See each app's README for details.
