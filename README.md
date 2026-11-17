# Fee Management System

A lightweight, secure, and responsive student fee tracking and payment recording application built with PHP 8, MySQL, and vanilla JavaScript.

## Architecture

```
Fee_Structure/
├── database/            # schema.sql, seed.sql
├── config/              # outside the web root
│   ├── env.php          # tiny .env loader
│   └── db.php           # PDO singleton
├── src/                 # outside the web root
│   ├── auth.php         # session, rate-limiting & CSRF helpers
│   └── helpers.php      # json response, validation, require_login
└── public/              # the ONLY web-exposed folder
    ├── index.html       # login page
    ├── app.html         # single-page dashboard shell
    ├── css/style.css    # shared responsive stylesheet & print styles
    ├── js/
    │   ├── api.js       # fetch wrapper with CSRF injection
    │   └── app.js       # single-page app logic with safe DOM rendering
    └── api/             # RESTful JSON endpoints
        ├── auth.php, students.php, fees.php, payments.php, reports.php
```

## Quick Start (Run Steps)

1. Clone/copy this folder to your web server and configure `.env` (copy from `.env.example`).
2. Create and seed the MySQL database:
   ```bash
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/seed.sql
   ```
3. Start local development server pointing to `public/`:
   ```bash
   php -S 127.0.0.1:8000 -t public
   ```
4. Open your browser at `http://127.0.0.1:8000` and sign in.

## Default Credentials

- **Email:** `admin@feestructure.local`
- **Password:** `Admin@12345`

## Security Features

- **Isolated Web Root:** Only `public/` is exposed to the web. `config/`, `src/`, and `database/` sit outside with `.htaccess` deny rules.
- **Environment Variables:** Credentials loaded from `.env` (git-ignored); `.env.example` provides template keys.
- **100% Prepared Statements:** Parameterized queries via PDO protect against SQL injection (e.g., `' OR 1=1 --`).
- **Strict Error Shielding:** PDO error mode is set to Exception; raw errors are logged server-side and generic JSON errors are returned.
- **CSRF Protection:** Secure session-backed tokens required in `X-CSRF-Token` header on state-changing requests.
- **Session Hardening:** `HttpOnly`, `SameSite=Strict`, `Secure` over HTTPS, and `session_regenerate_id(true)` upon authentication.
- **Login Rate Limiting:** Locks accounts for 5 minutes after 5 consecutive failed attempts (HTTP 429).
- **Security Headers:** Every response includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`.
- **Output Escaping:** JS renders all dynamic and database fields using `textContent` and DOM nodes, preventing XSS.
- **Business Rule Enforcement:** Payments exceeding outstanding balance are strictly rejected on both client and server (HTTP 422).
