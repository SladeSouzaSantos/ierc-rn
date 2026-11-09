import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = resolve(root, '.env');
if (existsSync(path)) {
  console.log('cms/.env ja existe; credenciais preservadas. Nenhum arquivo foi sobrescrito.');
  process.exit(0);
}
const secret = (n = 32) => randomBytes(n).toString('hex');
const values = {
  NODE_ENV: 'production',
  HOST: '0.0.0.0',
  PORT: '1337',
  DATABASE_HOST: 'db',
  DATABASE_PORT: '5432',
  DATABASE_NAME: 'ierc_cms',
  DATABASE_USERNAME: 'ierc_cms',
  DATABASE_PASSWORD: secret(),
  DATABASE_SSL: 'false',
  APP_KEYS: Array.from({ length: 4 }, () => secret()).join(','),
  API_TOKEN_SALT: secret(),
  ADMIN_JWT_SECRET: secret(),
  ENCRYPTION_KEY: secret(),
  TRANSFER_TOKEN_SALT: secret(),
  JWT_SECRET: secret(),
};
mkdirSync(root, { recursive: true });
writeFileSync(path, Object.entries(values).map(([k,v]) => k + '=' + v).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
console.log('cms/.env criado com segredos aleatorios (modo 0600). Nao envie ao GitHub.');
console.log('Acesse http://localhost:1337/admin depois de iniciar o Docker.');
