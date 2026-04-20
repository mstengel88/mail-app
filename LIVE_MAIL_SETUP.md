# Live Mail Setup

This app uses a small local API bridge for IMAP/SMTP. Do not put mailbox credentials in `src/` or any frontend file because those values are bundled into the app.

## 1. Create Local Environment

Copy `.env.example` to `.env`, then fill in:

```bash
MAIL_USER=you@yourdomain.com
MAIL_PASSWORD=your-mailbox-password-or-app-password
MAIL_FROM_NAME=Your Name
```

The IONOS defaults are already included:

```bash
MAIL_IMAP_HOST=imap.ionos.com
MAIL_IMAP_PORT=993
MAIL_IMAP_SECURE=true
MAIL_SMTP_HOST=smtp.ionos.com
MAIL_SMTP_PORT=465
MAIL_SMTP_SECURE=true
```

## 2. Start the API

```bash
npm run server
```

The API listens on `http://localhost:8787` by default.

## Docker

Build and run the combined web app plus mail API:

```bash
docker compose up --build
```

The container serves the app and API on `http://localhost:8787`. Keep `.env` on the host; it is loaded by Compose and is not copied into the image.

## 3. Start the App

In another terminal:

```bash
npm run dev
```

For browser testing on the same Mac, keep:

```bash
VITE_MAIL_API_URL=http://localhost:8787
```

For iPhone testing, set `VITE_MAIL_API_URL` to your Mac's LAN IP address, for example:

```bash
VITE_MAIL_API_URL=http://192.168.1.50:8787
MAIL_API_ALLOWED_ORIGIN=capacitor://localhost
```

If you use Vite dev server from the phone instead of the built Capacitor app, set `MAIL_API_ALLOWED_ORIGIN` to that dev-server origin.

## 4. Current Live Features

- Load recent messages from IMAP.
- Mark messages read/unread.
- Star/unstar messages.
- Archive messages.
- Move messages to trash.
- Send plain-text email through SMTP.

Attachments and folder creation are still UI placeholders until we add persistence and attachment handling.
