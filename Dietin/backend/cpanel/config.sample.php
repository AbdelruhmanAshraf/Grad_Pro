<?php
// Copy this file to a secure location OUTSIDE public_html, e.g. /home/USER/secure/config.php
// Then update paypal, firebase, and smtp settings.

return [
  'paypal' => [
    'client_id' => 'YOUR_PAYPAL_CLIENT_ID',
    'secret' => 'YOUR_PAYPAL_SECRET',
    'webhook_id' => 'YOUR_PAYPAL_WEBHOOK_ID',
    'api_base' => 'https://api-m.sandbox.paypal.com', // or https://api-m.paypal.com for production
  ],
  'firebase' => [
    // Absolute path to your service account JSON
    'service_account' => '/path/to/secure/service-account.json',
    'project_id' => 'YOUR_FIREBASE_PROJECT_ID'
  ],
  'smtp' => [
    'host' => 'smtp.yourdomain.com',
    'port' => 465,
    'secure' => 'ssl', // ssl or tls
    'username' => 'billing@yourdomain.com',
    'password' => 'YOUR_SMTP_PASSWORD',
    'from_email' => 'billing@yourdomain.com',
    'from_name' => 'Dietin Billing'
  ]
];
