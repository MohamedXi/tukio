<#import "template.ftl" as layout>
<@layout.registrationLayout; section>
  <#if section = "header">
    <img src="${url.resourcesPath}/img/tukio-logo.svg" alt="Tukio" class="login-pf-brand" height="40">
    <h1 id="kc-page-title">${msg("registerTitle")}</h1>
  <#elseif section = "form">
    <form id="kc-register-form" class="${properties.kcFormClass!}" action="${url.registrationAction}" method="post">
      <div class="${properties.kcFormGroupClass!} ${messagesPerField.printIfExists('firstName',properties.kcFormGroupErrorClass!)}">
        <label for="firstName" class="${properties.kcLabelClass!}">${msg("firstName")}</label>
        <input type="text" id="firstName" class="${properties.kcInputClass!}" name="firstName"
          value="${(register.formData.firstName!'')}" autocomplete="given-name"/>
        <#if messagesPerField.existsError('firstName')>
          <span class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
            ${kcSanitize(messagesPerField.get('firstName'))?no_esc}
          </span>
        </#if>
      </div>
      <div class="${properties.kcFormGroupClass!} ${messagesPerField.printIfExists('lastName',properties.kcFormGroupErrorClass!)}">
        <label for="lastName" class="${properties.kcLabelClass!}">${msg("lastName")}</label>
        <input type="text" id="lastName" class="${properties.kcInputClass!}" name="lastName"
          value="${(register.formData.lastName!'')}" autocomplete="family-name"/>
        <#if messagesPerField.existsError('lastName')>
          <span class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
            ${kcSanitize(messagesPerField.get('lastName'))?no_esc}
          </span>
        </#if>
      </div>
      <div class="${properties.kcFormGroupClass!} ${messagesPerField.printIfExists('email',properties.kcFormGroupErrorClass!)}">
        <label for="email" class="${properties.kcLabelClass!}">${msg("email")}</label>
        <input type="email" id="email" class="${properties.kcInputClass!}" name="email"
          value="${(register.formData.email!'')}" autocomplete="email"/>
        <#if messagesPerField.existsError('email')>
          <span class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
            ${kcSanitize(messagesPerField.get('email'))?no_esc}
          </span>
        </#if>
      </div>
      <#if !realm.registrationEmailAsUsername>
        <div class="${properties.kcFormGroupClass!} ${messagesPerField.printIfExists('username',properties.kcFormGroupErrorClass!)}">
          <label for="username" class="${properties.kcLabelClass!}">${msg("username")}</label>
          <input type="text" id="username" class="${properties.kcInputClass!}" name="username"
            value="${(register.formData.username!'')}" autocomplete="username"/>
        </div>
      </#if>
      <div class="${properties.kcFormGroupClass!} ${messagesPerField.printIfExists('password',properties.kcFormGroupErrorClass!)}">
        <label for="password" class="${properties.kcLabelClass!}">${msg("password")}</label>
        <div class="${properties.kcInputGroup!}">
          <input type="password" id="password" class="${properties.kcInputClass!}" name="password"
            autocomplete="new-password"/>
          <button class="${properties.kcFormPasswordVisibilityButtonClass!}" type="button"
            aria-label="${msg('showPassword')}" aria-controls="password" data-password-toggle>
            <span class="${properties.kcFormPasswordVisibilityIconShow!}" aria-hidden="true"></span>
            <span class="${properties.kcFormPasswordVisibilityIconHide!}" aria-hidden="true"></span>
          </button>
        </div>
        <#if messagesPerField.existsError('password')>
          <span class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
            ${kcSanitize(messagesPerField.get('password'))?no_esc}
          </span>
        </#if>
      </div>
      <div class="${properties.kcFormGroupClass!} ${messagesPerField.printIfExists('password-confirm',properties.kcFormGroupErrorClass!)}">
        <label for="password-confirm" class="${properties.kcLabelClass!}">${msg("passwordConfirm")}</label>
        <div class="${properties.kcInputGroup!}">
          <input type="password" id="password-confirm" class="${properties.kcInputClass!}" name="password-confirm"
            autocomplete="new-password"/>
          <button class="${properties.kcFormPasswordVisibilityButtonClass!}" type="button"
            aria-label="${msg('showPasswordConfirm')}" aria-controls="password-confirm" data-password-toggle>
            <span class="${properties.kcFormPasswordVisibilityIconShow!}" aria-hidden="true"></span>
            <span class="${properties.kcFormPasswordVisibilityIconHide!}" aria-hidden="true"></span>
          </button>
        </div>
        <#if messagesPerField.existsError('password-confirm')>
          <span class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
            ${kcSanitize(messagesPerField.get('password-confirm'))?no_esc}
          </span>
        </#if>
      </div>
      <div class="${properties.kcFormGroupClass!}">
        <div class="checkbox">
          <label for="marketing_consent">
            <input type="checkbox" id="marketing_consent" name="user.attributes.marketing_consent"
              value="true" <#if (register.formData['user.attributes.marketing_consent']!'') == 'true'>checked</#if>/>
            ${msg("marketingConsent")}
          </label>
        </div>
      </div>
      <div class="${properties.kcFormGroupClass!}">
        <div class="${properties.kcFormGroupClass!}">
          <div id="kc-form-buttons" class="${properties.kcFormGroupClass!}">
            <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}"
              type="submit" value="${msg("doRegister")}"/>
          </div>
          <div id="kc-info-message">
            <span>${msg("backToLogin")} <a href="${url.loginUrl}">${msg("doLogIn")}</a></span>
          </div>
        </div>
      </div>
    </form>
  </#if>
</@layout.registrationLayout>
