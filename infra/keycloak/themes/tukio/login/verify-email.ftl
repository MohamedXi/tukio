<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=true; section>
  <#if section = "header">
    <img src="${url.resourcesPath}/img/tukio-logo.svg" alt="Tukio" class="login-pf-brand" height="40">
    <h1 id="kc-page-title">${msg("emailVerifyTitle")}</h1>
  <#elseif section = "form">
    <p class="instruction">${msg("emailVerifyInstruction1", user.email)}</p>
    <p class="instruction">${msg("emailVerifyInstruction2")}</p>
  <#elseif section = "info">
    <p class="instruction">
      ${msg("emailVerifyInstruction3", url.loginAction)}
    </p>
  </#if>
</@layout.registrationLayout>
