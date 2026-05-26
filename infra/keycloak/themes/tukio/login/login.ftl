<!DOCTYPE html>
<html lang="${locale.currentLanguageTag!'fr'}" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${msg("loginTitle")}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { min-height: 100vh; display: flex; font-family: system-ui, -apple-system, sans-serif; background: #faf7f2; }

    /* ── Layout ── */
    .auth-shell { display: flex; min-height: 100vh; width: 100%; }

    /* ── Editorial column (left) ── */
    .editorial {
      flex: 1;
      background: linear-gradient(135deg, #5c2008 0%, #7a2a09 50%, #9a340a 100%);
      color: #faf7f2;
      padding: 64px;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }
    .editorial-content { margin-top: auto; max-width: 480px; position: relative; z-index: 1; }
    .editorial-kicker {
      font-family: ui-monospace, 'Courier New', monospace;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #f1b996;
      margin-bottom: 16px;
    }
    .editorial-quote {
      font-size: 34px;
      line-height: 1.2;
      font-weight: 500;
      letter-spacing: -0.01em;
      color: #faf7f2;
      margin-bottom: 24px;
    }
    .editorial-author { display: flex; align-items: center; gap: 12px; }
    .editorial-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: #c2410c; color: #faf7f2;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 600; flex-shrink: 0;
    }
    .editorial-author-name { font-size: 14px; font-weight: 500; }
    .editorial-author-role { font-size: 12px; opacity: 0.7; margin-top: 2px; }

    /* ── Form column (right) ── */
    .form-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 48px 80px;
      background: #faf7f2;
    }
    .form-inner {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      max-width: 440px;
      width: 100%;
      margin: 0 auto;
      padding: 40px 0;
    }

    /* ── Logo ── */
    .logo { display: flex; align-items: baseline; gap: 0; margin-bottom: 40px; text-decoration: none; }
    .logo-text { font-size: 20px; font-weight: 500; color: #14130f; letter-spacing: -0.025em; font-family: Georgia, serif; }
    .logo-dot { width: 5px; height: 5px; border-radius: 50%; background: #c2410c; display: inline-block; margin: 0 1px 4px; }
    .logo-one { font-size: 20px; font-weight: 500; color: #9a340a; font-style: italic; font-family: Georgia, serif; }

    /* ── Kicker ── */
    .kicker {
      font-family: ui-monospace, 'Courier New', monospace;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #7a2a09;
      margin-bottom: 12px;
    }

    /* ── Heading ── */
    h1 { font-size: 30px; line-height: 1.1; color: #14130f; font-weight: 500; letter-spacing: -0.01em; margin-bottom: 12px; font-family: Georgia, serif; }
    .subtitle { font-size: 15px; color: #4a453a; line-height: 1.55; margin-bottom: 32px; }

    /* ── Form ── */
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .field-row { display: flex; justify-content: space-between; align-items: center; }
    label { font-size: 13px; font-weight: 500; color: #2f2c25; }
    input[type="email"], input[type="text"], input[type="password"] {
      width: 100%;
      height: 40px;
      padding: 0 12px;
      border: 1px solid #ddd4c2;
      border-radius: 6px;
      background: #fff;
      font-size: 14px;
      color: #1f1d18;
      outline: none;
      transition: border-color 0.15s;
    }
    input[type="email"]:focus, input[type="text"]:focus, input[type="password"]:focus {
      border-color: #c2410c;
      box-shadow: 0 0 0 3px rgba(194, 65, 12, 0.12);
    }
    input[type="email"].error, input[type="password"].error { border-color: #dc2626; }

    /* ── Forgot password ── */
    .forgot { font-size: 12px; color: #7a2a09; font-weight: 500; text-decoration: none; }
    .forgot:hover { text-decoration: underline; }

    /* ── Checkbox row ── */
    .check-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #4a453a; margin-bottom: 16px; }
    .check-row input { width: 14px; height: 14px; accent-color: #c2410c; flex-shrink: 0; }

    /* ── Primary button ── */
    .btn-primary {
      width: 100%;
      height: 44px;
      background: #c2410c;
      color: #faf7f2;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
      margin-top: 8px;
      margin-bottom: 16px;
    }
    .btn-primary:hover { background: #9a340a; }
    .btn-primary:active { background: #7a2a09; }

    /* ── Error alert ── */
    .alert-error {
      padding: 10px 14px;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 6px;
      font-size: 13px;
      color: #991b1b;
      margin-bottom: 16px;
    }
    .field-error { font-size: 12px; color: #dc2626; margin-top: 4px; }

    /* ── Register link ── */
    .register-link { font-size: 13px; color: #4a453a; text-align: center; }
    .register-link a { color: #7a2a09; font-weight: 500; text-decoration: none; }
    .register-link a:hover { text-decoration: underline; }

    /* ── Footer ── */
    .form-footer {
      font-size: 12px;
      color: #6b6657;
      display: flex;
      gap: 16px;
      margin-top: auto;
    }
    .form-footer a { color: #6b6657; text-decoration: none; }
    .form-footer a:hover { text-decoration: underline; }
    .form-footer .copyright { margin-left: auto; }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .editorial { display: none; }
      .form-col { padding: 32px 24px; }
    }
  </style>
</head>
<body>
<div class="auth-shell">

  <!-- Editorial column — left -->
  <div class="editorial">
    <div class="editorial-content">
      <div class="editorial-kicker">${msg("editorialKicker")}</div>
      <p class="editorial-quote">${msg("editorialQuote")}</p>
      <div class="editorial-author">
        <div class="editorial-avatar">${msg("editorialAvatarInitials")}</div>
        <div>
          <div class="editorial-author-name">${msg("editorialAuthorName")}</div>
          <div class="editorial-author-role">${msg("editorialAuthorRole")}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Form column — right -->
  <div class="form-col">
    <a href="${properties.kcLoginPageUrl!'/'}" class="logo" aria-label="tukio">
      <span class="logo-text">tukio</span><span class="logo-dot"></span><span class="logo-one">one</span>
    </a>

    <div class="form-inner">
      <div class="kicker">${msg("loginKicker")}</div>
      <h1>${msg("loginHeading")}</h1>
      <p class="subtitle">${msg("loginSubtitle")}</p>

      <#if message?has_content && message.type == 'error'>
        <div class="alert-error">${kcSanitize(message.summary)?no_esc}</div>
      </#if>

      <#if realm.password>
        <form id="kc-form-login" action="${url.loginAction}" method="post">

          <div class="field">
            <label for="username">${msg("email")}</label>
            <input
              id="username"
              name="username"
              type="email"
              value="${(login.username!'')}"
              autocomplete="email"
              autofocus
              class="${messagesPerField.existsError('username','password')?then('error', '')}"
            />
            <#if messagesPerField.existsError('username','password')>
              <span class="field-error">${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</span>
            </#if>
          </div>

          <div class="field">
            <div class="field-row">
              <label for="password">${msg("password")}</label>
              <#if realm.resetPasswordAllowed>
                <a class="forgot" href="${url.loginResetCredentialsUrl}">${msg("doForgotPassword")}</a>
              </#if>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              class="${messagesPerField.existsError('username','password')?then('error', '')}"
            />
          </div>

          <#if realm.rememberMe && !usernameEditDisabled??>
            <div class="check-row">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                <#if login.rememberMe??>checked</#if>
              />
              <label for="rememberMe">${msg("rememberMe")}</label>
            </div>
          </#if>

          <input type="hidden" id="id-hidden-input" name="credentialId"
            <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if> />

          <button class="btn-primary" name="login" id="kc-login" type="submit">
            ${msg("doLogIn")}
          </button>

        </form>
      </#if>

      <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
        <div class="register-link">
          ${msg("noAccount")} <a href="${url.registrationUrl}">${msg("doRegister")}</a>
        </div>
      </#if>
    </div>

    <div class="form-footer">
      <#-- Story 0.19 — actual paths: /fr/legal/terms and /en/legal/terms -->
      <a href="https://tukio.one/${locale.currentLanguageTag!'fr'}/legal/terms">${msg("termsTitle")}</a>
      <a href="https://tukio.one/${locale.currentLanguageTag!'fr'}/legal/privacy">${msg("privacyPolicy")}</a>
      <span class="copyright">© tukio.one · 2026</span>
    </div>
  </div>

</div>
</body>
</html>
