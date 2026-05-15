<#macro emailLayout title>
<!DOCTYPE html>
<html lang="${locale!'fr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #faf7f2; font-family: 'Inter', Arial, sans-serif; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; border: 1px solid #cdc9bc; overflow: hidden; }
    .header { background-color: #c2410c; padding: 32px 40px; text-align: center; }
    .header-logo { font-family: Georgia, serif; font-size: 28px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px; }
    .body { padding: 40px; }
    .body h2 { font-family: Georgia, serif; font-weight: 500; color: #14130f; margin-top: 0; }
    .body p { color: #1f1d18; line-height: 1.6; }
    .button { display: inline-block; background-color: #c2410c; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 500; margin: 20px 0; }
    .footer { padding: 20px 40px; border-top: 1px solid #cdc9bc; text-align: center; font-size: 12px; color: #4a453a; }
    a { color: #c2410c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">tukio</div>
    </div>
    <div class="body">
      <#nested>
    </div>
    <div class="footer">
      <p>Tukio — Marketplace événementielle • <a href="https://tukio.one">tukio.one</a></p>
    </div>
  </div>
</body>
</html>
</#macro>
