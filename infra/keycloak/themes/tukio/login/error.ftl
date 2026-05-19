<!DOCTYPE html>
<html lang="${locale.currentLanguageTag}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${msg("errorTitle")}</title>
  <link rel="stylesheet" href="${url.resourcesPath}/css/login.css">
</head>
<body class="login-pf">
  <div class="container-fluid">
    <div class="row">
      <div class="col-sm-12">
        <div id="kc-error-message" style="max-width:400px;margin:80px auto;padding:24px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.12);">
          <h1>${msg("errorTitle")}</h1>
          <p>
            <#if message?has_content>
              ${message.summary?no_esc}
            </#if>
          </p>
          <#if client?? && client.baseUrl?has_content>
            <p><a href="${client.baseUrl}">${msg("backToApplication")}</a></p>
          </#if>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
