

# Preskocit MFA pro prihlaseni pres Apple

## Co se zmeni

Upravim komponentu `ProtectedRoute.tsx` tak, aby pri prihlaseni pres Apple (OAuth provider) automaticky preskocila kontrolu MFA a povazovala uzivatele za overeneho.

Apple Sign-In uz sam o sobe poskytuje silne overeni (Face ID, Touch ID, heslo zarizeni), takze dalsi 2FA neni nutne.

## Technicke detaily

### Soubor: `src/components/ProtectedRoute.tsx`

V metode `checkMfa` pridam detekci OAuth providera. Pokud uzivatel pouzil Apple prihlaseni (`user.app_metadata.provider === 'apple'`), MFA se preskoci a uzivatel bude rovnou vpusten do aplikace.

Logika:
1. Zkontrolovat `user.app_metadata.provider` nebo `user.app_metadata.providers` 
2. Pokud obsahuje `"apple"`, nastavit `mfaVerified = true` a `mfaChecking = false`
3. Jinak pokracovat se standardni MFA kontrolou

### Soubor: `src/pages/MfaSetup.tsx`

Pridam stejnou kontrolu - pokud je uzivatel prihlasen pres Apple, presmeruji ho rovnou na hlavni stranku misto vynuceni nastaveni MFA.

