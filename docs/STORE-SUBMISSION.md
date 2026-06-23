# App Store Connect — Submission Guide (GLP-1 Coach)

Everything in the codebase + backend is ready. This file lists exactly what YOU must
do in dashboards/accounts to upload and pass review. Copy-paste blocks are provided.

App ID (from eas.json): **6766065944** · Apple Team: **UH6SNYH4S8** · Bundle:
**com.glp1coach.app**

---

## 0. Secrets & backend (do first)

1. **Rotate the OpenAI key (CRITICAL).** The old key was committed to a public repo
   and must be considered compromised.
   - openai.com → API keys → revoke the old key → create a new one.
   - Supabase Dashboard → Project `glp1-coach` → Edge Functions → Manage secrets →
     set `OPENAI_API_KEY` = the NEW key. (This is the only place the key lives.)
2. **`SUPABASE_SERVICE_ROLE_KEY`** — used by the `delete-account` function. Supabase
   auto-injects this into Edge Functions, so normally **no action needed**. If account
   deletion returns "not configured", set it manually in the same Secrets screen.
3. **Make the GitHub repo private** (Settings → Change visibility) after your reviewer
   friend has what they need.

## 1. Supabase Auth settings (so login actually works for reviewers)

Supabase Dashboard → Authentication → Providers → Email:
- Either **enable a custom SMTP** sender, **or** turn **off** "Confirm email" for now
  so new sign-ups can log in immediately (the app already handles the confirm flow with
  a "resend" button, but Apple's reviewer must be able to log in without email access).
- Authentication → Policies/Settings → enable **"Leaked password protection"**
  (HaveIBeenPwned) — closes the remaining security advisor warning.

## 2. Build & upload

```bash
npx expo login                      # if not already
eas build -p ios --profile production
eas submit -p ios --latest          # uploads the build to App Store Connect
```
(`eas.json` already has the production build + submit profiles wired to your App ID.)

## 3. App Privacy "Nutrition Label" (App Store Connect → App Privacy)

Declare these data types. **None are used for tracking; none for third-party ads.**
Purpose for all = **App Functionality**. Mark "Linked to identity" = Yes for the
account-bound ones, "Used for tracking" = No for everything.

| Category | Data type | Linked to you | Tracking |
|---|---|---|---|
| Health & Fitness | Health (weight, body measurements, medication, symptoms) | Yes | No |
| Health & Fitness | Fitness (active energy / steps from HealthKit) | Yes | No |
| Contact Info | Email address | Yes | No |
| User Content | Photos (meal photos) | Yes | No |
| User Content | Other user content (community posts) | Yes | No |
| Identifiers | User ID | Yes | No |
| Diagnostics | Crash data + Performance (only if Sentry enabled) | No | No |

Note for the form: meal photos/text and coach messages are sent to **OpenAI** (a
third-party processor) solely to provide the requested AI feature.

## 4. HealthKit — Review Notes (paste into App Review "Notes")

> GLP-1 Coach reads weight, body composition, active energy, and heart rate from
> HealthKit / Apple Watch to display the user's progress and calories burned, and
> writes the weight the user logs back to HealthKit to keep their data in sync.
> HealthKit data is used only within the app for the user's own health tracking. It is
> not used for advertising, not shared with third parties, and not used for any other
> purpose. Health-data usage strings are declared in Info.plist
> (NSHealthShareUsageDescription / NSHealthUpdateUsageDescription).

## 5. Demo account (App Review → Sign-In required)

Provide a working test account so the reviewer can log in:
- Email: _<create a demo account in the app and put it here>_
- Password: _<...>_

(Make sure email-confirmation is satisfied for this account per §1.)

## 6. Encryption / export compliance
Already declared in app.config: `ITSAppUsesNonExemptEncryption = false` (standard
HTTPS only). Answer "No" to the export-compliance non-exempt-encryption question.

## 7. Required URLs (App Store Connect → App Information)
Host these two files somewhere public (e.g. GitHub Pages from `docs/`) and paste the
links:
- **Privacy Policy URL** → `docs/PRIVACY.md` (required; fill in support email first).
- **Terms of Use / EULA** → `docs/TERMS.md`.
- **Support URL** → any page/email where users can reach you.

## 8. Store listing assets (you create these)
- App name, subtitle, description, keywords (TR + EN).
- iPhone screenshots (6.7" + 6.5" + 5.5" as required) — and iPad only if you later set
  `supportsTablet: true` (currently false, so iPhone-only is fine).
- App icon is already in the project.

## 9. Health-app accuracy (Guideline 1.4.1)
The app shows a Medical Disclaimer on health-guidance screens, labels estimates as
"not a clinical measurement", and never recommends medication dosages. Keep that copy;
do not add specific dosage advice.

---

### Already handled in code/backend (no action needed)
- Real Supabase backend, Auth, owner-only RLS on all tables (migration applied).
- Hardened AI proxy (JWT + model whitelist + rate limit + token cap + timeout).
- Real server-side account+data deletion (`delete-account` function deployed).
- No secrets in the client; env-only config.
- Working email auth UX (confirm + resend, min-8 password); no dead third-party button.
- Truthful privacy/medical copy; no fabricated muscle-loss percentages.
- Tests (46), lint (extends expo, CI no longer fake-green), typecheck, clean iOS export.
