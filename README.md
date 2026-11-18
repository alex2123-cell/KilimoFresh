# KilimoFresh

Machakos produce sourcing hub connecting peri-urban farmers with institutional buyers.
ACS 355 Internet Applications Design and Development, Daystar University, September – December 2026.

A full-stack web application: a responsive multi-page front end, a Node.js/Express REST back end, a JSON data store, and its own public key infrastructure (HTTPS certificates, digitally signed receipts, signed admin sessions).

## Run it

Needs Node.js 18 or newer.

```bash
npm install
ADMIN_PASSWORD="choose-a-long-password" npm start      # macOS / Linux / Git Bash
```

Windows PowerShell:

```powershell
npm install
$env:ADMIN_PASSWORD="choose-a-long-password"; npm start
```

Open **https://localhost:3443**. (`http://localhost:3000` redirects there.)

- First start creates the certificates in `backend/pki/` and the admin account `admin@kilimofresh.co.ke`. If `ADMIN_PASSWORD` is not set, a random password is printed once in the terminal.
- The browser warns about the certificate until you trust the Root CA (see "Trusting the Root CA"). For a quick look, choose Advanced → Proceed.

### In GitHub Codespaces

```bash
npm install
ADMIN_PASSWORD="choose-a-long-password" npm start
```

The server sees it is in a Codespace and prints the address to open. You can also open the **Ports** tab, find port **3000**, and click the globe icon. Codespaces gives you an `https://…app.github.dev` address with GitHub's own certificate. Do not use the Live Server extension (port 5500): it only shows files and does not run the backend.

### Adding photos

Put images in `frontend/assets/images/` (drag them into that folder in the VS Code Explorer). See the README in that folder.

| Command | What it does |
| --- | --- |
| `npm start` | Start the server |
| `npm run dev` | Start and restart on file changes |
| `npm test` | Run the 7 API tests |
| `npm run pki` | Re-create all certificates and keys |
| `npm run admin -- <email> <password>` | Create an admin or change a password |

## Folder structure

```
kilimo-fresh/
├── package.json              scripts and the 3 dependencies (express, helmet, node-forge)
├── .env.example              settings you can change
├── backend/
│   ├── server.js             entry point: HTTPS server + HTTP redirect
│   ├── src/
│   │   ├── app.js            Express app: middleware → API → static files → errors
│   │   ├── config.js         ports, folders, admin email
│   │   ├── middleware/
│   │   │   └── security.js   security headers (CSP, HSTS), rate limit, admin check
│   │   ├── routes/
│   │   │   ├── public.js     catalog, zones, estimate, requisitions, growers, contact, PKI
│   │   │   └── admin.js      sign-in, orders inbox, catalog add/edit/delete
│   │   ├── services/
│   │   │   ├── store.js      JSON-file data layer
│   │   │   ├── validators.js server-side validation
│   │   │   ├── estimate.js   cost estimate + reference numbers
│   │   │   └── users.js      admin accounts (scrypt password hashes)
│   │   └── pki/
│   │       ├── ca.js         builds Root CA → server cert + signing cert
│   │       ├── keys.js       loads keys; sign, verify, describe the chain
│   │       └── jwt.js        RS256 admin session tokens
│   ├── data/
│   │   ├── produce.json      D1 produce catalog (22 listings)
│   │   └── zones.json        D3 delivery zones
│   │                         (requisitions, growers, messages, users are created at run time)
│   ├── scripts/              generate-pki.js, create-admin.js
│   └── tests/api.test.js
└── frontend/
    ├── index.html            Home
    ├── about.html            About Us
    ├── catalog.html          Harvest Catalog (products)
    ├── sourcing.html         Bulk Sourcing (requisition form)
    ├── grower.html           Partner as Grower
    ├── contact.html          Contact
    ├── trust.html            Trust & Security (PKI + architecture)
    ├── admin.html            Admin dashboard
    ├── 404.html
    ├── css/styles.css        tokens, base, layout, components, pages, print
    ├── assets/               logo, icon sprite, crop illustrations
    └── js/
        ├── config.js         WhatsApp number, social links, embed IDs
        ├── core/             dom.js, api.js, validate.js, format.js, history.js, pki.js
        ├── components/       layout.js, ui.js, produceCard.js, receipt.js, socialEmbed.js
        └── pages/            home, catalog, sourcing, forms, trust, admin, static
```

## Core components of the web application

| Tier | In this project | Files |
| --- | --- | --- |
| Client (presentation) | HTML5 pages, CSS, ES modules running in the browser | `frontend/` |
| Web server | Node.js + Express; serves pages, TLS, security headers | `backend/server.js`, `src/app.js`, `src/middleware/` |
| Application logic (REST API) | Validation, estimates, references, signing, sessions | `src/routes/`, `src/services/` |
| Data store | JSON collections D1, D2, D3 + growers, messages, users | `src/services/store.js`, `backend/data/` |
| Security (cuts across all tiers) | PKI, HTTPS, signed receipts and sessions, CSP | `src/pki/`, `frontend/js/core/pki.js` |

A request travels: browser → HTTPS → Express middleware → route → service → JSON file, and the JSON response comes back the same way. The Trust page shows this diagram live.

### REST API

| Method and path | Purpose | DFD |
| --- | --- | --- |
| `GET /api/produce?q=&category=&location=&maxPrice=&inStock=` | Catalog with filters | 2.0 |
| `GET /api/produce/:id`, `GET /api/zones`, `GET /api/stats` | One listing, delivery zones, home figures | |
| `POST /api/estimate` | Quantity × price + delivery fee, MOQ warning | 3.0 |
| `POST /api/requisitions` | Validate, save, return reference + signed receipt | 4.0 |
| `GET /api/requisitions/:ref/receipt` | Signed receipt (no contact details) | 4.0 |
| `POST /api/growers`, `POST /api/contact` | Grower application, contact message | 5.0 |
| `GET /api/pki/certificate`, `GET /api/pki/ca.crt` | Certificate chain + public key, Root CA download | |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Admin session | |
| `GET /api/admin/summary`, `/requisitions`, `/growers`, `/messages` | Admin inbox | |
| `PATCH /api/admin/requisitions/:ref` | Change order status | |
| `POST`, `PUT`, `DELETE /api/admin/produce[/:id]` | Publish the catalog | 1.0 |

## Public key infrastructure

`backend/src/pki/ca.js` builds a three-certificate chain, all RSA-2048, signed with SHA-256:

```
KilimoFresh Root CA  (self-signed trust anchor, 10 years)
├── Server certificate   CN=localhost   → HTTPS / TLS
└── Signing certificate  CN=KilimoFresh Receipt Signing → receipts + admin tokens
```

The keys are used in three places:

1. **HTTPS.** `server.js` serves the site with the server certificate, so data is encrypted in transit. HSTS tells browsers to stay on HTTPS.
2. **Digitally signed receipts.** When a requisition is accepted, `routes/public.js` signs the exact receipt text with the signing **private** key. In the browser, `frontend/js/core/pki.js` fetches the **public** key and checks the signature with the Web Crypto API. The Trust page lets you edit the receipt text and watch the check fail.
3. **Signed admin sessions.** `pki/jwt.js` issues an RS256 token after sign-in, stored in an HttpOnly, SameSite=Strict cookie. A token with an edited payload is rejected (there is a test for this).

`GET /api/pki/certificate` also re-checks the chain on every call: each certificate must be signed by the Root CA's key and be inside its validity period.

Private keys stay in `backend/pki/`, which is in `.gitignore`. Never commit them.

### Trusting the Root CA (removes the browser warning locally)

- **Windows:** double-click `backend/pki/ca.cert.pem` renamed to `.crt` (or download it from the Trust page) → Install Certificate → Current User → "Trusted Root Certification Authorities". Restart the browser.
- **macOS:** open it in Keychain Access → set "Always Trust".
- **Firefox:** Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import.

Remove it again after the project. Anyone holding `ca.key.pem` could issue certificates your machine would trust.

## Document Object Model

The pages hold only the static structure. Everything dynamic is built with DOM calls, never with HTML strings, so text typed by a user cannot run as code.

| DOM technique | Where |
| --- | --- |
| `createElement`, `append`, `replaceChildren` (the `el()` and `render()` helpers) | `core/dom.js`, used by every component |
| `querySelector` / `querySelectorAll` | `$` and `$$` in `core/dom.js` |
| `DocumentFragment` to add 22 cards in one step | `pages/catalog.js` |
| Event delegation (one listener for all Estimate buttons and tabs) | `pages/catalog.js`, `pages/admin.js` |
| `input`, `change`, `focusout`, `submit`, `keydown` events | `core/validate.js`, `components/layout.js` |
| `classList`, `dataset`, ARIA attributes (`aria-invalid`, `aria-expanded`, `aria-selected`) | validation, mobile menu, admin tabs |
| Native `<dialog>` with `showModal()` | `components/ui.js` (estimate, admin forms) |
| `FormData`, `form.elements`, `URLSearchParams`, `location` | filters, prefilled order form |
| `localStorage` (`kf.requisitions`) | `core/history.js` |
| `createElementNS` for SVG icons | `core/dom.js` |
| `fetch`, Web Crypto `crypto.subtle` | `core/api.js`, `core/pki.js` |

## How it meets the requirements

**ACS 355 guidelines**

| Guideline | Where |
| --- | --- |
| Home, About, Products, Contact pages | `index`, `about`, `catalog`, `contact` |
| Contact form with validation | `contact.html` (live in the browser, repeated on the server) |
| Two or more social platforms | Footer links (Facebook, YouTube, Instagram, WhatsApp); YouTube + Facebook embeds on Home |
| Responsive | Layouts at 375, 768 and 1200 px; tested with no horizontal scrolling |
| Consistent visual design | Design tokens at the top of `css/styles.css` |
| Optional: login, dashboard, interactivity | Admin sign-in and dashboard; advisories on the Grower page |
| Back end | Node.js + Express REST API |

**Proposal (FR-01 to FR-12)**

| ID | Status | Notes |
| --- | --- | --- |
| FR-01, FR-02 | Done | Home and About |
| FR-03, FR-04 | Done | Cards; instant search and filters; filters can also come from the address |
| FR-05 | Done | Estimate modal with delivery fee and MOQ warning |
| FR-06 | Done | Bad phone, past date, quantity below MOQ, missing consent all rejected |
| FR-07 | Changed | Orders go to the admin dashboard inbox instead of a form-service email; the buyer gets a reference and a signed receipt |
| FR-08 | Done | Prefilled WhatsApp message from the modal, the form and the receipt |
| FR-09 | Done | History on the device with Re-order |
| FR-10 | Done | Grower form |
| FR-11 | Done | See "Before you submit" for the embed IDs |
| FR-12 | Changed | Admin edits the catalog in the dashboard (it still lives in `produce.json`) |

Non-functional: security headers and CSP, consent recorded with a timestamp, personal data files kept out of Git, visible focus, labels, skip link, reduced-motion support, 44 px touch targets.

## Before you submit

1. **`frontend/js/config.js`**: set the real WhatsApp number, phone, email and social links. The Facebook and YouTube links currently point to FAO's public pages as stand-ins. Put a YouTube video ID in `youtubeVideoId` to turn the YouTube card into an in-page player.
2. **Sample content**: listings, prices, cooperatives, delivery fees, grades and desk hours are realistic samples, not real data.
3. **Email**: nothing is emailed. To add it, call a mail library such as Nodemailer at the end of `POST /api/requisitions`.

## Deploying

Netlify, Vercel static hosting and GitHub Pages only host static files, so they cannot run this Express server. Use a Node host such as Render:

1. Push to GitHub (the `.gitignore` already excludes keys and personal data).
2. Render → New Web Service → build `npm install`, start `npm start`.
3. Environment: `ADMIN_PASSWORD=<long password>`. The server sees it is on Render and runs behind Render's own HTTPS certificate (you can also set `HTTPS=off` to be explicit).

On a free plan the disk is reset on each restart, so orders and catalog edits made on the live site are lost then, and the signing key is regenerated (older receipts stop verifying). For the demo that is fine; for real use, attach a persistent disk and set `DATA_DIR` and `PKI_DIR` to it, or move the store to a database.

The guidelines name GitHub Pages, Netlify and Vercel as examples of approved platforms, so check with the lecturer that a Node host is acceptable.
