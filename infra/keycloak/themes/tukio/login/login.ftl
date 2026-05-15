<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=social.displayInfo displayWide=(realm.password && social.providers??); section>
  <#if section = "header">
    <img src="${url.resourcesPath}/img/tukio-logo.svg" alt="Tukio" class="login-pf-brand" height="40">
    <h1 id="kc-page-title">${msg("loginTitle")}</h1>
  <#elseif section = "form">
    <#if realm.password>
      <form id="kc-form-login" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">
        <div class="${properties.kcFormGroupClass!}">
          <label for="username" class="${properties.kcLabelClass!}">${msg("usernameOrEmail")}</label>
          <input tabindex="1" id="username" class="${properties.kcInputClass!}" name="username"
            value="${(login.username!'')}" type="email" autofocus autocomplete="username email"
            aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>">
          <#if messagesPerField.existsError('username','password')>
            <span id="input-error" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
              ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
            </span>
          </#if>
        </div>
        <div class="${properties.kcFormGroupClass!}">
          <label for="password" class="${properties.kcLabelClass!}">${msg("password")}</label>
          <div class="${properties.kcInputGroup!}">
            <input tabindex="2" id="password" class="${properties.kcInputClass!}" name="password"
              type="password" autocomplete="current-password"
              aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>">
            <button class="${properties.kcFormPasswordVisibilityButtonClass!}" type="button"
              aria-label="${msg('showPassword')}" aria-controls="password"
              data-password-toggle tabindex="4">
              <span class="${properties.kcFormPasswordVisibilityIconShow!}" aria-hidden="true"></span>
              <span class="${properties.kcFormPasswordVisibilityIconHide!}" aria-hidden="true"></span>
            </button>
          </div>
        </div>
        <div class="${properties.kcFormGroupClass!} ${properties.kcFormSettingClass!}">
          <div id="kc-form-options">
            <#if realm.rememberMe && !usernameEditDisabled??>
              <div class="checkbox">
                <label>
                  <#if login.rememberMe??>
                    <input tabindex="3" id="rememberMe" name="rememberMe" type="checkbox" checked> ${msg("rememberMe")}
                  <#else>
                    <input tabindex="3" id="rememberMe" name="rememberMe" type="checkbox"> ${msg("rememberMe")}
                  </#if>
                </label>
              </div>
            </#if>
          </div>
          <div class="${properties.kcFormOptionsWrapperClass!}">
            <#if realm.resetPasswordAllowed>
              <span><a tabindex="5" href="${url.loginResetCredentialsUrl}">${msg("doForgotPassword")}</a></span>
            </#if>
          </div>
        </div>
        <div id="kc-form-buttons" class="${properties.kcFormGroupClass!}">
          <input type="hidden" id="id-hidden-input" name="credentialId"
            <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
          <input tabindex="4" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}"
            name="login" id="kc-login" type="submit" value="${msg("doLogIn")}"/>
        </div>
      </form>
    </#if>
  <#elseif section = "info">
    <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
      <div id="kc-registration-container">
        <div id="kc-registration">
          <span>
            ${msg("noAccount")}
            <a tabindex="6" href="${url.registrationUrl}">${msg("doRegister")}</a>
          </span>
        </div>
      </div>
    </#if>
  </#if>
</@layout.registrationLayout>
