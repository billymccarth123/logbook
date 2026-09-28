# TRUCOST

An Irish car marketplace that shows the yearly running cost of every car, including an insurance quote priced for each signed-up buyer.

## Product

Every listing shows three yearly costs:

1. **Petrol:** yearly km × litres per 100 km for the engine size band × petrol price per litre (`lib/costs.ts`).
2. **NCT:** €55 spread over the years between tests. Free under 4 years, every 2 years until 10, then yearly (`lib/costs.ts`).
3. **Insurance:** a quote for this buyer and this car. **Only signed-up users see it.** Logged-out visitors see petrol and NCT, with sign-up prompts where the quote would be.

Fuel, NCT and engine size figures are placeholder estimates. Check them before launch.

### Sign-up (quote details)

Sign-up asks what Irish insurers ask before a quote. It's based on Aviva's published [Private Motor Question Set](https://static.aviva.io/content/dam/aviva-public/ie/pdfs/car-insurance-question-set.pdf). The fields and validation live in `lib/driver-profile.ts`:

- **About you:** name, email, phone, date of birth, county where the car is kept overnight, occupation
- **Licence:** type, date obtained, penalty points
- **History:** no claims bonus years, claims in the last 3 years, motoring convictions
- **Use:** km per year, use class, overnight parking, other drivers
- **Cover:** comprehensive or third party, fire and theft; excess of €125, €300 or €600

**Never ask for or price by sex.** EU law (the Test-Achats ruling) has banned it since December 2012. Contact details are never sent to the AI or used in pricing.

Some insurer questions are left out because they don't vary much between marketplace buyers or need a specific car: registration number, modifications, alarms and trackers, medical conditions, and insurance history such as refusals.

### How quotes are priced

Quotes are built in two layers:

1. **Rating model** (`lib/insurance.ts`): a multiplicative model, the same shape insurers use. The base is the average premium for the driver's age, scaled by their county. It then applies one multiplier for each factor: experience and NCD relative to what's typical for that age, penalty points, claims, convictions, occupation, mileage, use, parking, cover, excess, named drivers, engine size and car value. The age, county and experience averages come from the [Chill Car Insurance Pricing Index](https://www.chill.ie/blog/car-insurance-pricing-index/) (July 2026). The NCD and penalty point loadings follow published Irish ranges. The other multipliers are assumptions, marked in the code.
2. **AI adjustment** (`lib/ai-quotes.ts`): one Claude Opus 5 call per user prices every car they haven't been quoted for yet. It is grounded in the rating model's figure and adjusts for things the model can't see: model-specific insurance group, theft risk, repair costs, imports, and how the car interacts with the driver. The server limits each price to between −25% and +30% of the rating model, and caches it per driver details and listing. Quotes start generating in the background at sign-up (`after()`), so browsing is usually instant.

Without `ANTHROPIC_API_KEY` in `.env.local`, or if the call fails, quotes fall back to the rating model on its own. The UI labels which one was used. Quotes are estimates, not binding offers from an insurer. Say so wherever a quote appears, and credit Chill.

### Accounts

Real accounts are stored in SQLite using Node's built-in driver (`node:sqlite`), in `data/trucost.db`. The database file is git-ignored because it holds personal data.

- **Sign-up** (`/signup`): name, email, password (10+ characters) and the quote questions, all in one form. It creates the user and logs them in.
- **Log in and out** (`/login`, the Log out button on `/profile`): sessions last 30 days. The cookie holds a random token, and the database stores only its SHA-256 hash. After 5 failed logins an email is locked for 15 minutes (in memory).
- **Passwords:** hashed with scrypt, using a salt per user. Changing a password on `/profile` signs out every other device.
- **Selling** (`/sell`) requires an account. Browsing and valuations don't.
- **Admins:** anyone whose email is in `ADMIN_EMAILS` becomes an admin when they sign up or log in. Admins can also make other users admins. `/admin` shows user stats, search, suspend and reactivate, make and remove admin, delete (with confirmation), and a CSV download at `/admin/users.csv`. Non-admins get a 404. Admins can't change their own account there, so there's always at least one admin.
- **Code:** `lib/db.ts` (schema and connection), `lib/auth.ts` (passwords, sessions, users, admin queries), `app/actions.ts` (sign up, log in, update details, change password), `app/admin/`.

Not built yet: password reset and email verification. Both need an email service, e.g. Resend or Postmark. Before deploying, move from SQLite to a hosted database such as Postgres, because a single file doesn't survive serverless hosting or multiple servers.

### Car valuations

`/value` gives a free valuation. There are two layers:

1. **Market value:** what a typical example of that make, model, year and fuel is advertised for in Ireland, at a typical mileage. It comes from the **market database**, `data/market-values.json`, which `/values` lets people browse.
2. **This car** (`lib/valuation.ts`, pure): transparent adjustments for mileage against typical, condition, service history, owners and NCT. The result is a suggested asking price, a likely private sale price (6% off asking), a rough trade-in (20% off asking) and a range. The adjustment rates are assumptions.

How a valuation finds its market value (`lib/ai-valuation.ts`):

1. An exact database entry less than 14 days old.
2. **With** `ANTHROPIC_API_KEY`: Claude Opus 5 researches the market live with web search and saves the result.
3. **Without** a key, or if that fails: an older exact entry, or an estimate from the same model's researched years (`estimateFromNearby`). It interpolates between years, or extends up to 4 years at 10% depreciation a year.
4. Otherwise the user sees "We don't have market data for that car yet".

Makes and models match loosely: "VW" = Volkswagen, and "3-Series" = "3 Series".

**Don't scrape marketplaces.** DoneDeal blocks automated access, and Carzone and CarsIreland disallow crawling their search pages in robots.txt. Never fetch their pages directly or build a crawler. Use web search results only.

#### Refreshing market data with Claude Code (no API key needed)

When asked to "refresh market values" or "add market data for <model>", Claude Code does the research in the session and edits `data/market-values.json`. The site then needs no API key. Steps:

1. **Search** once per model, year and fuel with the WebSearch tool, e.g. `2019 Volkswagen Golf for sale Ireland DoneDeal price km`. Research anchor years about 3 years apart (e.g. 2016, 2019, 2022). The site estimates the years in between.
2. **Collect comparables** only from listings that appear in the results: title, asking price in euro, km (convert miles × 1.609), and URL. Use the listing's own URL when the results give one; otherwise use the year page, e.g. `https://www.donedeal.ie/cars/Volkswagen/Golf/2019`. Skip UK prices, commercials, crashed or parts cars, and performance versions (GTI, R, ST, vRS, M) unless the model is only sold that way. Never invent a listing.
3. **Work out the entry:** `referenceValue` is the median asking price of the comparables, `typicalKm` their median km, and `low` and `high` the lowest and highest prices seen. `confidence` is `high` for 5+ comparables with km, `medium` for 3–4, and `low` for 1–2. `fuel` is the fuel most listings share: record separate entries when petrol and diesel prices differ a lot. `notes` is one sentence on what drives the price, ending with "Researched from DoneDeal search results on <date>." `updatedAt` is today's date in ISO format.
4. **Write** each entry to `data/market-values.json` in the `MarketEntry` shape (`lib/valuation.ts`). Keys are recomputed on load, so `key` can be any string. Replace an existing entry for the same make, model, year and fuel rather than duplicating it.
5. **Check:** `/values` lists the new rows, and `/value` returns a valuation for that car.

Researched so far (28 September 2026): Toyota Corolla, Yaris; Volkswagen Golf, Polo; Hyundai Tucson; Skoda Octavia; Nissan Qashqai; Ford Focus, Fiesta; Kia Sportage; BMW 3 Series; Audi A4. Next up from `lib/popular-models.ts`: Mercedes-Benz C-Class and A-Class, Tesla Model 3 and Model Y, Nissan Leaf, Volkswagen Tiguan and ID.4, Skoda Superb and Fabia, Hyundai i30 and Kona, Kia Ceed and Niro, Peugeot 3008 and 208, Toyota C-HR and RAV4, Dacia Duster.

With an API key, the same research can run automatically: `POST /api/market/refresh?limit=5&from=2016&to=2024` with `Authorization: Bearer $MARKET_REFRESH_TOKEN`. Each entry is one paid Claude call, so run it in small chunks.

### Photos

`public/cars/<id>.jpg` holds freely licensed Wikimedia Commons photos (CC BY-SA). Each needs its author and licence shown. The credits live in `lib/photos.ts` and appear on the listing page. They're illustrative, not the actual car. Listings without a photo get a coloured placeholder.

### Pages

| Route | Purpose |
| --- | --- |
| `/` | Hero, how costs are worked out, three cheapest cars to run |
| `/cars` | Browse with filters and sorting (state lives in search params), sign-up banner when logged out |
| `/cars/[id]` | Photo, specs, cost breakdown, and quote with "How we priced this" |
| `/sell` | Create-listing form with a petrol and NCT preview |
| `/value` | Car valuation form and result, with a "List it at €X" link that fills in `/sell` |
| `/values` | Market database: typical price by model and year, searchable |
| `/signup` | Create an account with quote details, then return to the page that sent the user there (`?returnTo=`) |
| `/login` | Log in, then return to `?returnTo=` |
| `/profile` | Edit quote details (quotes are recalculated), change password, log out |
| `/admin` | Admin only: manage users, CSV export |

### Later

- Password reset and email verification (needs an email service)
- A hosted database for users and listings (listings are still in memory)
- Photo uploads for sellers
- Diesel, hybrid and EV fuel costs, and motor tax
- Calibrating the rating model against real quotes from an insurer or broker partner

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4 (via `@tailwindcss/postcss`, config lives in `app/globals.css`)
- ESLint 9 with `eslint-config-next`

## Environment

Set these in `.env.local` (ignored by git):

- `ANTHROPIC_API_KEY` (optional): turns on live AI quotes and live market research. Without it, quotes use the rating model, and valuations use the market database (kept up to date by Claude Code, see above).
- `ADMIN_EMAILS`: comma-separated emails that become admins when they sign up or log in.
- `MARKET_REFRESH_TOKEN`: any long random string, needed to call the bulk refresh endpoint.

## Commands

- `npm run dev`: start the dev server at http://localhost:3000
- `npm run build`: production build
- `npm run lint`: run ESLint

## Structure

- `app/`: routes, layouts, and global styles (App Router)
- `app/actions.ts`: Server Actions (save quote details, sign out, create listing)
- `app/components/`: shared UI (header, listing card, car image, cost breakdown, quote form)
- `lib/costs.ts`: petrol and NCT figures and formulas (pure, safe to use in client components)
- `lib/counties.ts`: the 26 counties and their average premiums
- `lib/driver-profile.ts`: quote questions, their options, and validation (pure)
- `lib/insurance.ts`: the rating model (pure)
- `lib/ai-quotes.ts`: the Claude pricing layer, cache and fallback (server only)
- `lib/listings.ts`: mock listings stored in memory, so new listings disappear when the server restarts
- `lib/photos.ts`: photo credits
- `lib/valuation.ts`: valuation options, validation and adjustments (pure)
- `lib/ai-valuation.ts`: market research with Claude web search (server only)
- `lib/market-data.ts`: the market database, a JSON file in `data/`
- `lib/popular-models.ts`: popular Irish models for suggestions and bulk refresh
- `lib/anthropic.ts`: shared Claude client (null without an API key)
- `app/api/market/refresh/route.ts`: token-protected bulk refresh of market values
- `lib/profile.ts`: the signed-in user's quote details
- `lib/db.ts`, `lib/auth.ts`: accounts database, passwords, sessions, admin queries
- `lib/password-rules.ts`: password length rule shared with the form
- `app/admin/`: admin page, actions and CSV export
- `public/`: static assets
- Import alias: `@/*` maps to the repo root

## Conventions

- Style with Tailwind utility classes; support dark mode with `dark:` variants.
- Prefer Server Components; add `"use client"` only when a component needs state or browser APIs.

## Next.js rules

The rules below come from `AGENTS.md`, which `next dev` generates and rewrites. Edit this file, not `AGENTS.md`.

@AGENTS.md
