<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=true; section>
  <#if section = "header">
    <img src="${url.resourcesPath}/img/tukio-logo.svg" alt="Tukio" class="login-pf-brand" height="40">
    <h1 id="kc-page-title">${msg("emailForgotTitle")}</h1>
  <#elseif section = "form">
    <form id="kc-reset-password-form" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">
      <div class="${properties.kcFormGroupClass!} ${messagesPerField.printIfExists('username',properties.kcFormGroupErrorClass!)}">
        <label for="username" class="${properties.kcLabelClass!}">${msg("email")}</label>
        <input type="email" id="username" name="username" class="${properties.kcInputClass!}"
          autofocus value="${(auth.attemptedUsername!'')}" autocomplete="email"/>
        <#if messagesPerField.existsError('username')>
          <span class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
            ${kcSanitize(messagesPerField.get('username'))?no_esc}
          </span>
        </#if>
      </div>
      <div class="${properties.kcFormGroupClass!}">
        <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
          <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}"
            type="submit" value="${msg("doSubmit")}"/>
        </div>
        <div id="kc-info-message">
          <span><a href="${url.loginUrl}">${msg("backToLogin")}</a></span>
        </div>
      </div>
    </form>
  <#elseif section = "info">
    <p class="instruction">${msg("emailForgotInstruction")}</p>
  </#if>
</@layout.registrationLayout>
