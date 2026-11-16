# Eva Mobile — online store

Production-shaped storefront for **Eva Mobile** (Megenagna, Addis Ababa) with a real
order API, staff dashboard, and a sandbox payment flow for Telebirr / CBE Birr.

Tagline: *Smart Choice... Better Life*

---

## What's inside

| Piece | Files | What it does |
| --- | --- | --- |
| Storefront | `index.html`, `style.css`, `app.js`, `api.js` | Catalogue, search, category filters, cart, checkout, order tracking |
| Payment page | `pay.html`, `pay.js` | Sandbox Telebirr / CBE checkout with PIN entry and receipt |
| Staff dashboard | `admin.html`, `admin.js` | Orders, product catalogue + photos, editable site text |
| Offline catalogue | `data/products.json` | Fallback list when the API is not running |
| Backend API | `backend/` (Spring Boot 3, Java 17) | Products, orders, stock, payments, admin endpoints |
| Database | H2 file at `backend/data/` | Zero-install persistence; MySQL profile included |

The storefront is copied into the Spring Boot build, so **one command** serves the
site and the API together at `http://localhost:8080`.

---

## Quick start

```bat
cd backend
mvn spring-boot:run
```

Then open **http://localhost:8080**.

First run compiles and seeds the catalogue (15 products: phones + accessories).
Data is stored in `backend/data/evamobile.mv.db` and survives restarts.

### Also works through XAMPP

1. Start the API on port 8080 (`mvn spring-boot:run`, or double-click `start-eva.bat`).
2. Open `http://localhost/EVA%20MOBILE.html/` through Apache.

`api.js` detects a static host on port 80 and points API calls at
`http://localhost:8080/api` automatically.

### Try the full flow

1. Add a phone to the cart → **Checkout**.
2. Fill name, phone (`09xxxxxxxx` or `+2519xxxxxxxx`), address, choose Telebirr or CBE.
3. On the payment page enter the demo PIN **`1234`**.
4. You receive a reference like `EVA-7H9P95`; use **Track order** or
   `index.html?track=EVA-7H9P95` to see its status.
5. Open **Staff dashboard** (`admin.html`) and sign in with the local admin key
   **`eva-admin-demo-key`** (change `eva.admin.key` in
   `backend/src/main/resources/application.properties`).

Cancel a payment on purpose to see the order go to `FAILED` and the stock returned.

### Managing products in the dashboard

Sign in, then open the **Products** tab.

| Task | How |
| --- | --- |
| Change price, stock, name or description | **Edit** on the row → change the fields → **Save changes** |
| Upload a product photo | **Edit**/**Add** → **Choose photo** (JPG, PNG, WebP or GIF, max 5 MB) → **Save** |
| Use a photo hosted elsewhere | Paste its `https://…` link in **…or paste an image link** |
| Remove a photo | **Remove** in the editor → **Save** (the shop falls back to the branded SVG artwork) |
| Hide without deleting | Toggle the green **Visible** switch — hidden products disappear from the shop but stay in the dashboard |
| Add a new product | **+ Add product**, fill the form, **Add product** |
| Delete permanently | **Delete** on the row (past orders keep their product name and price) |

Changes go live immediately; refresh the storefront to see them. Uploaded files are
written to `backend/uploads/products/` and served from `/uploads/**`. The H2 row stores
only the path, so **back up `backend/uploads/` together with `backend/data/`**.

JPEG and PNG uploads are centre-cropped to the 4:3 shape of the product card and
resized to at most 1200 px wide, then re-encoded as JPEG — so phone photos straight
from a camera look right in the grid without manual editing. Images already uploaded
keep their original file; re-upload to apply the crop. GIF and WebP files are stored
as-is (ImageIO cannot read WebP on Java 17, and flattening a GIF would lose animation).

### Editing the homepage text

Open the **Site text** tab. Every field is pre-filled with what is currently live;
change what you need and press **Save text**, then refresh the storefront.

| Group | What you can change |
| --- | --- |
| Brand & hero | Tagline (logo + browser tab), hero eyebrow, the three headline lines, hero paragraph |
| Contact details | Both phone numbers, weekday/Sunday hours, top-bar address, full address, contact heading and paragraph |
| Footer | Footer address and footer text |

Phone numbers are stored as digits and displayed with spaces (`0912 159 265`);
`tel:` links update everywhere automatically. Blank a field to put its original
wording back, or use **Reset to defaults** to restore all of it at once. Overrides
live in the `site_settings` table, while the defaults stay in code, so a fresh
database still renders the full site.

---

## Configuration

`backend/src/main/resources/application.properties`

| Property | Meaning |
| --- | --- |
| `eva.admin.key` | Key required in the `X-Admin-Key` header for `/api/admin/**` |
| `eva.uploads.dir` | Where product photos are stored (default `./uploads`, i.e. `backend/uploads/`) |
| `spring.servlet.multipart.*` | Upload size limits (5 MB file / 6 MB request) |
| `eva.payments.mode` | `sandbox` (default) or `live` |
| `eva.payments.sandbox.pin` | Documented demo PIN (`1234`) |
| `eva.payments.telebirr.*` | App ID / key / short code / RSA keys / callback URLs |
| `eva.payments.cbe.*` | Merchant ID / key / base URL / callback URLs |

### MySQL instead of H2

```sql
CREATE DATABASE eva_mobile CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bat
mvn spring-boot:run -Dspring-boot.run.profiles=mysql
```

Credentials live in `application-mysql.properties` (default `root` / empty password).
If you move `backend/`, update `spring.datasource.url` accordingly.

---

## API reference

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/products?category=&q=` | `category` = `SMARTPHONE` \| `ACCESSORY` |
| `GET` | `/api/products/{id}` | Single product |
| `POST` | `/api/orders/checkout` | Creates order, reserves stock, returns `paymentUrl` |
| `GET` | `/api/orders/{reference}` | Customer order tracking |
| `POST` | `/api/payments/{reference}/confirm` | Sandbox only (`SUCCESS` / `FAILED`) |
| `POST` | `/api/payments/telebirr/callback` | Server-to-server webhook stub |
| `POST` | `/api/payments/cbe/callback` | Server-to-server webhook stub |
| `GET` | `/api/admin/orders?status=&page=&size=` | Requires `X-Admin-Key` |
| `GET` | `/api/admin/stats` | Totals, pending, paid, revenue |
| `PATCH` | `/api/admin/orders/{reference}/status` | Body: `{"status":"PAID"}` |
| `GET` | `/api/admin/products?q=` | Full catalogue including hidden products |
| `POST` | `/api/admin/products` | Create; body is the product form |
| `PUT` | `/api/admin/products/{id}` | Replace all editable fields |
| `PATCH` | `/api/admin/products/{id}/visibility` | Body: `{"active":false}` to hide |
| `POST` | `/api/admin/products/{id}/image` | `multipart/form-data` with `file`; returns new `imageUrl` |
| `DELETE` | `/api/admin/products/{id}` | Removes the product and its uploaded photo |
| `GET` | `/api/settings` | Public site text (tagline, hero, contact, footer) |
| `GET` | `/api/admin/settings` | Same map, requires `X-Admin-Key` |
| `GET` | `/api/admin/settings/defaults` | Original wording, for reference |
| `PUT` | `/api/admin/settings` | Partial update: send only the keys to change; `""` restores a default |
| `DELETE` | `/api/admin/settings` | Reset every site text override |

All `/api/admin/**` calls need `X-Admin-Key`. Product form body:

```json
{
  "name": "Samsung Galaxy A15",
  "brand": "Samsung",
  "category": "SMARTPHONE",
  "price": 28500,
  "stock": 10,
  "description": "6.5\" AMOLED, 50MP camera, 5000mAh.",
  "color": "#2f6fed",
  "featured": false,
  "active": true,
  "imageUrl": null
}
```

`price` must be 0–9,999,999, `stock` a whole number ≥ 0, `color` a hex value,
and `imageUrl` either `https://…` or a path returned by the image upload endpoint.

### Checkout payload

```json
{
  "customerName": "Abebe Kebede",
  "customerPhone": "0912159265",
  "deliveryAddress": "Bole, near Edna Mall, House 12",
  "note": "Call before delivery",
  "paymentMethod": "TELEBIRR",
  "items": [{ "productId": 1, "quantity": 1 }]
}
```

The client sends only product ids and quantities. **Prices, totals and stock are
always read from the database** — never trusted from the browser.

### Status model

```
PENDING_PAYMENT ──> PAID ──> DELIVERED
        │             └────> CANCELLED (releases stock)
        ├────> FAILED (releases stock)
        └────> CANCELLED
```

Failed and cancelled orders are terminal. Stock is reserved at checkout and
returned when a payment fails or an order is cancelled. Confirming a payment is
idempotent, so a retried callback cannot double-charge stock.

---

## Payment integration

The order service never talks to a provider directly. Each provider implements
`PaymentGateway`; Spring picks the right bean from `eva.payments.mode`.

```
service/payment/
├── PaymentGateway.java          contract
├── PaymentService.java          method → gateway routing
├── SandboxPaymentGateway.java   demo flow (active by default)
├── TelebirrGateway.java         live skeleton + integration steps
└── CbeGateway.java              live skeleton + integration steps
```

### Going live with Telebirr (H5 / Fabric)

1. Fill `eva.payments.telebirr.*` and set `eva.payments.mode=live`.
2. In `TelebirrGateway.initiate`: fetch a Fabric token with App ID + App Key,
   build the pre-order payload (`nonce`, `outTradeNo` = order reference,
   `totalAmount`, `returnUrl`, `notifyUrl`), RSA-sign with the merchant private
   key, encrypt with Telebirr's public key, POST to `preOrder`.
3. Return the `toPayUrl` in `PaymentInitiation.paymentUrl` — the storefront
   redirects there (absolute URLs are used as-is).
4. In `PaymentController.telebirrCallback`: verify the RSA signature/decryption,
   read `outTradeNo`, look up the order, then call
   `orderService.confirmPayment(reference, "SUCCESS", providerTxnId)`.
   Never mark an order paid from an unverified body.

### Going live with CBE Birr

Same shape: obtain the CBE merchant session URL in `CbeGateway.initiate`, then
verify the transaction in `/api/payments/cbe/callback` before confirming.

### Sandbox limitations (intentional)

- `/api/payments/{reference}/confirm` is open so the local page can report the
  simulated result. Remove or protect it in live mode.
- Webhook endpoints log payloads but do not verify signatures yet — that is the
  first thing to implement before production.
- The demo PIN is checked in the browser only; it is theatre, not security.

---

## Production checklist

- [ ] Change `eva.admin.key` and move admin auth to Spring Security with roles
      (the shared key is a stopgap for a single shop owner).
- [ ] Serve over HTTPS; gateways reject plain HTTP callbacks.
- [ ] Verify gateway signatures server-to-server, and reply fast with 200 while
      processing asynchronously if load grows.
- [ ] Put credentials in environment variables or a secret manager, not properties.
- [ ] Add rate limiting on checkout and admin endpoints.
- [ ] Use MySQL/PostgreSQL with backups instead of the H2 file.
- [ ] Back up `backend/data/` **and** `backend/uploads/` together; for scale, move
      photos to object storage (S3/Cloudflare R2) and serve via CDN.
- [ ] Add automated tests around order/stock transitions (see next section).
- [ ] Replace the sandbox confirm endpoint before switching `eva.payments.mode`.

## Tests

`backend/src/test` is ready for integration tests via `spring-boot-starter-test`.
The flow exercised manually (and repeatable):

1. Catalogue and filters return seeded data.
2. Invalid phone / address / payment method → `400` with field messages.
3. Checkout totals from the DB, reserves stock, returns a sandbox `paymentUrl`.
4. Payment success → `PAID`, idempotent replay, stock unchanged.
5. Payment failure → `FAILED`, stock restored.
6. Overselling → `409`.
7. Admin API rejects missing/wrong key; stats, filtering, pagination and status
   transitions behave; invalid transitions → `409`.
8. Product admin: create/update/validate, hide/show, image upload + serving,
   delete removes the file; non-image uploads → `400`; JPEG/PNG uploads are
   cropped to 4:3 and resized to ≤1200 px.
9. Site text: save/reset round-trip, unknown keys and over-long values → `400`,
   phone formatting and `tel:` links on the storefront.

---

## Project layout

```
EVA MOBILE.html/
├── index.html          storefront
├── style.css           all storefront + shared styles
├── app.js              catalogue, cart, checkout, tracking
├── api.js              API base detection, fetch wrapper, formatting, SVG art
├── pay.html / pay.js   sandbox Telebirr / CBE page
├── admin.html / admin.js
├── data/products.json  offline fallback catalogue
├── start-eva.bat       build (if needed) + run the API
└── backend/
    ├── pom.xml
    ├── uploads/        product photos uploaded from the dashboard
    └── src/main/java/com/evamobile/
        ├── domain/     Product, Order, OrderItem, SiteSetting, enums
        ├── repo/       Spring Data repositories
        ├── dto/        request/response records + validation
        ├── service/    OrderService, ProductService, SettingsService,
        │               ImageStorageService, payment gateways
        ├── web/        REST controllers + error handling
        ├── config/     CORS, admin key interceptor, /uploads static handler
        └── seed/       first-run catalogue
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Port 8080 was already in use` | Stop the other process, or change `server.port` |
| Storefront says "Live catalogue unreachable" | Start the API; the offline list still renders |
| Admin says key not accepted | Use `eva.admin.key` (default `eva-admin-demo-key`) |
| Want a clean database | Stop the API and delete `backend/data/` |
| CORS errors behind a domain | Add the origin to `WebConfig#addCorsMappings` |
