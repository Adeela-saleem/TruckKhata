# Truck Khata

Urdu and English khata app for one transport company. It records the Ada Register,
brokers and parties, truck trips, insurance and shop bills, all linked by Case #.
Data lives on the phone (SQLite), with no server.

## Run it

```bash
npm install
npx expo start        # scan the QR code with Expo Go on an Android phone
npx expo start --web  # browser preview on this computer
```

## Checks

```bash
npm test              # calculations, data rules, print and translations
npm run typecheck
npx expo lint
```

## Build an Android APK

Needs a free Expo account: `npx eas-cli@latest login`, then:

```bash
npx eas-cli@latest build --platform android --profile preview
```

## Where things live

| Path | Holds |
|---|---|
| `src/domain/calc.ts` | Every money formula |
| `src/domain/rules.ts` | Business decisions awaiting the owner's confirmation |
| `src/repo/` | Data rules for each module; no UI |
| `src/db/schema.ts` | Tables. Add new migrations at the end; never edit a shipped one |
| `src/print/` | Print documents and CSV |
| `src/i18n/` | English and Urdu text |
| `src/app/` | Screens (Expo Router) |
| `src/ui/` | Shared components and theme |

The browser preview is for development. Reminders, sharing and attachments need a phone.
