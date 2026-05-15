<#include "_layout.ftl">
<@emailLayout title=msg("passwordResetSubject")>
  <h2>${msg("passwordResetSubject")}</h2>
  <p>${msg("passwordResetBody", (user.firstName)!'', link, linkExpiration)?no_esc}</p>
  <a href="${link}" class="button">${msg("doConfirm")}</a>
  <p><small>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${link}">${link}</a></small></p>
</@emailLayout>
