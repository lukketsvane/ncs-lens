# Vipps Login – Oppsettsinstruksjonar

Denne guiden forklarar korleis du set opp Vipps Login for NCS Lens.

---

## 1. Vipps-portalen (portal.vippsmobilepay.com)

### Oppdater Redirect URI

**VIKTIG: Du MÅ endre redirect URI frå placeholder til den faktiske URL-en.**

1. Gå til [portal.vippsmobilepay.com](https://portal.vippsmobilepay.com)
2. Vel salsstad **finne koder** (MSN: 1070068)
3. Gå til **Utviklar** → **Logg inn**
4. Under **Redirect URIs**, fjern `https://example.com?redirect`
5. Legg til den faktiske callback-URL-en:

```
https://ncs.iverfinne.no/api/vipps/callback
```

> **NB:** URI-en må stemme EKSAKT – inkludert store/små bokstavar, trailing slash og URL-encoding. Ingen trailing `/` etter `callback`.

### Verifiser innstillingar

Sjekk at desse innstillingane er korrekte i portalen:

| Innstilling | Verdi |
|---|---|
| Auth method | `client_secret_basic` |
| ID-token | `user_info` (Id-token with user info) |
| Plan | BASIC (fullt namn, telefon, e-post, adresse) |

### Hent API-nøklar

Frå portalen, gå til **Utviklar** → **Vis nøklar** og noter:

- **Client ID** – OAuth client ID
- **Client Secret** – OAuth client secret
- **Ocp-Apim-Subscription-Key** – API-abonnementsnøkkel
- **MSN** (Merchant Serial Number) – `1070068`

---

## 2. Vercel – Miljøvariablar

Legg til desse miljøvariablane i Vercel-prosjektet:

**Settings → Environment Variables**

| Variabel | Verdi | Kommentar |
|---|---|---|
| `VIPPS_CLIENT_ID` | (frå portalen) | OAuth client ID |
| `VIPPS_CLIENT_SECRET` | (frå portalen) | OAuth client secret |
| `VIPPS_SUBSCRIPTION_KEY` | (frå portalen) | Ocp-Apim-Subscription-Key |
| `VIPPS_MSN` | `1070068` | Merchant Serial Number |
| `VIPPS_API_URL` | `https://api.vipps.no` | Produksjons-API |

> **For testing:** Bruk `https://apitest.vipps.no` som `VIPPS_API_URL` og testnøklar frå Vipps test-miljøet.

Sjekk også at desse allereie er satt:

| Variabel | Kommentar |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `GEMINI_API_KEY` | Google Gemini API key |

---

## 3. Supabase-konfigurasjon

### Site URL

1. Gå til [Supabase Dashboard](https://supabase.com/dashboard)
2. Vel prosjektet ditt
3. Gå til **Authentication** → **URL Configuration**
4. Set **Site URL** til:

```
https://ncs.iverfinne.no
```

### Redirect URLs

Under same side, legg til desse under **Redirect URLs**:

```
https://ncs.iverfinne.no/**
```

Dette sikrar at magic link-verifisering og auth-callbacks fungerer korrekt.

### Email Templates (valfritt)

Supabase brukar magic links internt for Vipps-innlogging. Brukaren ser ikkje e-posten – den prosesserast automatisk. Ingen endring naudsynt.

---

## 4. Database (SQL) – Ingen ekstra SQL naudsynt

Vipps Login brukar dei eksisterande tabellane:

- **`auth.users`** – Supabase admin API opprettar brukarar automatisk
- **`profiles`** – Profil opprettast automatisk ved ny brukar
- **`subscriptions`** – Eksisterande tabell for abonnement

Alle naudsynte tabellar og RLS-policy-ar er allereie på plass. **Du treng ikkje køyre SQL-kommandoar.**

---

## 5. Korleis det fungerer (teknisk flyt)

```
Brukar klikkar "Logg inn med Vipps"
        ↓
GET /api/vipps/login
        ↓
Redirect til Vipps autorisering
(api.vipps.no/access-management-1.0/access/oauth2/auth)
        ↓
Brukar autentiserer i Vipps-appen
        ↓
Vipps redirectar til /api/vipps/callback?code=...&state=...
        ↓
Server validerer state (CSRF)
        ↓
Server byter code mot tokens (client_secret_basic)
        ↓
Server hentar brukarinfo frå Vipps (namn, e-post, telefon)
        ↓
Server opprettar/finn brukar i Supabase
        ↓
Server genererer magic link → hentar token_hash
        ↓
Redirect til /?token_hash=...&type=magiclink
        ↓
Klient kallar supabase.auth.verifyOtp({ token_hash })
        ↓
Brukar er innlogga! ✓
```

---

## 6. Sjekkliste

- [ ] **Vipps-portal:** Redirect URI oppdatert til `https://ncs.iverfinne.no/api/vipps/callback`
- [ ] **Vercel:** `VIPPS_CLIENT_ID` satt
- [ ] **Vercel:** `VIPPS_CLIENT_SECRET` satt
- [ ] **Vercel:** `VIPPS_SUBSCRIPTION_KEY` satt
- [ ] **Vercel:** `VIPPS_MSN` satt til `1070068`
- [ ] **Vercel:** `VIPPS_API_URL` satt til `https://api.vipps.no`
- [ ] **Supabase:** Site URL satt til app-URL-en
- [ ] **Supabase:** Redirect URLs inkluderer `https://ncs.iverfinne.no/**`
- [ ] **Deploy:** Ny deploy etter env-variablar er lagt til
- [ ] **Test:** Klikk "Logg inn med Vipps" og verifiser full flyt

---

## 7. Feilsøking

### "Logg inn med Vipps" gir feil

- Sjekk at `VIPPS_CLIENT_ID` er satt i Vercel
- Sjekk browser-konsollen for feilmeldingar

### Redirect URI-feil frå Vipps

- URI-en i portalen må stemme EKSAKT med `https://ncs.iverfinne.no/api/vipps/callback`
- Ingen trailing slash, ikkje URL-encoded

### Token exchange feilar (502)

- Sjekk at `VIPPS_CLIENT_SECRET` og `VIPPS_SUBSCRIPTION_KEY` er korrekte
- Sjekk Vercel function logs for detaljert feilmelding

### Brukar vert ikkje innlogga etter Vipps

- Sjekk at Supabase **Site URL** er satt korrekt
- Sjekk at Supabase **Redirect URLs** inkluderer app-URL-en
- Sjekk at `SUPABASE_SERVICE_ROLE_KEY` er satt (naudsynt for admin API)

### Vipps test-miljø

For å teste utan ekte Vipps-brukarar:
1. Bruk test-nøklar frå Vipps test-miljøet
2. Set `VIPPS_API_URL=https://apitest.vipps.no`
3. Bruk Vipps test-appen (MT)

---

## 8. Filstruktur

```
src/routes/api/vipps/
├── login/+server.ts          # Startar Vipps OAuth-flyt
├── callback/+server.ts       # Handterer Vipps callback → opprettar sesjon
├── subscribe/+server.ts      # Startar Vipps-betaling (Pro-abonnement)
└── subscribe/callback/+server.ts  # Handterer betalingsbekreftelse

src/routes/auth/
└── callback/+server.ts       # Supabase auth callback (PKCE fallback)

src/routes/+page.svelte       # Handterer token_hash og auth-callbacks
```
