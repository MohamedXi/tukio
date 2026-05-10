'use strict';
// CJS mock for jwks-rsa — returns public key from nock-served JWKS
const https = require('https');
const http = require('http');

function JwksClient(options) {
  this.options = options;
}

JwksClient.prototype.getSigningKey = function (kid) {
  return new Promise((resolve, reject) => {
    const url = new URL(this.options.jwksUri);
    const client = url.protocol === 'https:' ? https : http;
    client
      .get(this.options.jwksUri, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const jwks = JSON.parse(data);
            const key = jwks.keys.find((k) => k.kid === kid);
            if (!key) return reject(new Error(`No key found for kid: ${kid}`));
            // Convert JWK to PEM using Node.js crypto
            const crypto = require('crypto');
            const pubKey = crypto.createPublicKey({ key, format: 'jwk' });
            resolve({
              getPublicKey: () =>
                pubKey.export({ type: 'spki', format: 'pem' }),
            });
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
};

function createJwksClient(options) {
  return new JwksClient(options);
}

module.exports = createJwksClient;
module.exports.default = createJwksClient;
