# Chrome browser QA

Menu Man's browser QA uses `@playwright/test` with the installed Google Chrome channel. It does not download Chromium. The default target is the Menu Man staging alias; override `PLAYWRIGHT_BASE_URL` only with `http://localhost:3000` or that staging hostname. The Playwright config rejects other hosts so the standard commands cannot target production by accident.

Run the public Super Tacos smoke test at all configured viewports:

```bash
npm run qa:staging
```

Run it with a visible Chrome window, or only at 320px:

```bash
npm run qa:staging:headed
npm run qa:staging:small
```

For a local app, start `npm run dev` and run `PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run qa:staging` (PowerShell: `$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'; npm run qa:staging`). The smoke test visits the Super Tacos home, menu, and location routes; exercises navigation and menu search; captures home/menu screenshots; reports console errors; checks uncaught browser exceptions and horizontal overflow.

Test results, screenshots, traces, and the HTML report are written under `.playwright/`, which is ignored by Git. Open the report with `npx playwright show-report .playwright/html-report`.

## Management pages

For an owner-authorized staging check, open a temporary Chrome session directly on the protected route and sign in manually:

```bash
npm run qa:open:staging
```

Complete the existing staging login in that browser, then inspect the page. The browser context is temporary; close it to discard its cookies. Do not pass credentials on the command line, add automated login credentials, or use `--save-storage`. If a future test needs reusable authentication state, store it only under ignored `.playwright/` storage after an explicit need is established, and never commit it.

The standard smoke spec is public-only and does not access management pages, modify data, or submit forms.
