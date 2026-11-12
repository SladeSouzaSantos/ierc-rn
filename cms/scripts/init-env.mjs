import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--prod')) {
  console.error('Uso: node cms/scripts/init-env.mjs [--prod]');
  process.exit(2);
}
const isProd = args[0] === '--prod';
const filename = isProd ? '.env.prod' : '.env';
const path = resolve(root, filename);
if (existsSync(path)) {
  console.log('cms/' + filename + ' ja existe; credenciais preservadas. Nenhum arquivo foi sobrescrito.');
  process.exit(0);
}
const secret = (n = 32) => randomBytes(n).toString('hex');
const values = {
  NODE_ENV: 'production',
  HOST: '0.0.0.0',
  PORT: '1337',
  DATABASE_HOST: 'db',
  DATABASE_PORT: '5432',
  DATABASE_NAME: isProd ? 'ierc_cms_prod' : 'ierc_cms',
  DATABASE_USERNAME: isProd ? 'ierc_cms_prod' : 'ierc_cms',
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
console.log('cms/' + filename + ' criado com segredos aleatorios (modo 0600). Nao envie ao GitHub.');
if (isProd) {
  console.log('PROD preparada, mas NAO iniciada. Antes do deploy, valide dominio, HTTPS, backups, permissões e conteúdo.');
  console.log('A instância PROD local, se ativada, usará http://localhost:1338/admin');
} else {
  console.log('DEV existente: http://localhost:1337/admin (banco e volume preservados).');
}
