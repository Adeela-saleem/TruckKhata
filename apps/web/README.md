# Truck Khata (web)

Urdu and English khata for one transport company: Ada Register, brokers and parties, trips
(outward and return as one case), Bill Book, truck insurance and reports, all linked by Case #.

This is the web version of the earlier Expo app in `../mobile`. The business logic in
`src/core` is the same code; only the screens are new.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production files in dist/, servable by any static host
```

## Where the data lives

There is no server. The database is SQLite running in the browser (sql.js) and is saved to the
browser's IndexedDB shortly after every change. That means:

- Data belongs to one browser on one computer. Another computer or browser starts empty.
- Clearing the browser's site data deletes it. Use **Settings > Backup and restore** to download
  a backup file regularly, and to move the data to another computer.
- Several tabs can be open at once; when one saves, the others reload.

## Accounts

The first visit asks you to create an account; after that the app opens on the sign-in page.
Accounts are kept in the same browser storage as the data, and passwords are stored only as a
salted PBKDF2 hash. This keeps casual users of a shared computer out of the khata, but it is not
server-grade security: anyone with full access to the computer's browser storage can still read
the data. All accounts on a computer share the same company data.

## Printing and PDF

Every record and every list has **Print or PDF**. It opens the browser's print dialog; choose
"Save as PDF" to get a file. Pages carry the company name, contact line and logo watermark set in
Settings.

## Checks

```bash
npm test               # calculations, data rules, print and translations (sql.js engine)
npm run typecheck
```

## Where things live

| Path | Holds |
|---|---|
| `src/core/domain/calc.ts` | Every money formula |
| `src/core/repo/` | Data rules for each module; no UI |
| `src/core/db/schema.ts` | Tables. Add new migrations at the end; never edit a shipped one |
| `src/core/print/` | Print documents and CSV |
| `src/core/i18n/` | English and Urdu text (`web/` holds text added for the web screens) |
| `src/platform/` | Browser specifics: database storage, files, printing |
| `src/app/` | App state, data loading, dialogs |
| `src/ui/` | Shared screen parts (page frame, fields, tables, history) |
| `src/theme.css` | Colours, cards, fields and pills for light and dark |
| `src/components/` | Small shared widgets (modal, badges, charts helpers) |
| `src/pages/` | Screens |
| `scripts/seed.ts` | Builds a demo database for testing (`npx vite-node scripts/seed.ts -- demo.db`) |
