# Shifter

A monthly shift planner for two employees, with a Finnish UI. It auto-plans shifts, checks the scheduling rules, and exports to PDF, PNG and `.ics`. All data stays in the browser.

## Development

```sh
npm install
npm run dev
npm run test:run
```

Default settings are in [src/config/defaults.ts](src/config/defaults.ts).

Every push to `main` deploys the app to GitHub Pages.
