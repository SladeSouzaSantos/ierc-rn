import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { models } from '../schemas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Strapi local upload provider requires this directory even before first upload.
mkdirSync(resolve(root, 'public/uploads'), { recursive: true });
// A neutral provisional 1px PNG avoids a 500 on /favicon.ico.
// Replace with the institution's licensed identity during branding approval.
writeFileSync(resolve(root, 'favicon.png'), Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9BZD72wAAAABJRU5ErkJggg==',
  'base64',
));

function put(path, contents) {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, 'utf8');
}
const factory = { controllers: 'createCoreController', routes: 'createCoreRouter', services: 'createCoreService' };
for (const [name, schema] of Object.entries(models)) {
  const prefix = 'src/api/' + name;
  put(prefix + '/content-types/' + name + '/schema.json', JSON.stringify(schema, null, 2) + '\n');
  for (const [type, method] of Object.entries(factory)) {
    put(prefix + '/' + type + '/' + name + '.js',
      "'use strict';\nconst { factories } = require('@strapi/strapi');\nmodule.exports = factories." +
      method + "('api::" + name + '.' + name + "');\n");
  }
}
put('config/server.js', `module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: { keys: env.array('APP_KEYS') },
});
`);
put('config/admin.js', `module.exports = ({ env }) => ({
  auth: { secret: env('ADMIN_JWT_SECRET') },
  apiToken: { salt: env('API_TOKEN_SALT') },
  secrets: { encryptionKey: env('ENCRYPTION_KEY') },
  transfer: { token: { salt: env('TRANSFER_TOKEN_SALT') } },
  flags: { nps: false, promoteEE: false },
});
`);
put('config/database.js', `module.exports = ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST', 'db'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'ierc_cms'),
      user: env('DATABASE_USERNAME', 'ierc_cms'),
      password: env('DATABASE_PASSWORD'),
      ssl: env.bool('DATABASE_SSL', false),
    },
    pool: { min: 0, max: 5 },
    acquireConnectionTimeout: 60000,
  },
});
`);
put('config/middlewares.js', `// Local diagnostic only, disabled unless BOTH independent flags are set.
const allowLocalCspEval =
  process.env.CMS_INSTANCE_KIND === 'dev' &&
  process.env.CMS_DIAGNOSTIC_UNSAFE_EVAL === 'true';
if (allowLocalCspEval) {
  console.warn('[IERC CMS] CSP unsafe-eval TEMPORARILY enabled in isolated DEV for diagnosis only.');
}
module.exports = [
  'strapi::logger',
  'strapi::errors',
  allowLocalCspEval ? {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: { 'script-src': ["'self'", "'unsafe-eval'"] },
      },
    },
  } : 'strapi::security',
  'strapi::cors',
  'global::private-api-gate',
  'strapi::poweredBy',
  'strapi::query',
  { name: 'strapi::body', config: {
    formLimit: '10mb', jsonLimit: '2mb', textLimit: '2mb',
    formidable: { maxFileSize: 10 * 1024 * 1024 },
  } },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
`);
put('config/plugins.js', `module.exports = () => ({
  upload: { config: { sizeLimit: 10 * 1024 * 1024 } },
});
`);
put('config/api.js', `module.exports = {
  rest: { defaultLimit: 20, maxLimit: 50, withCount: true },
};
`);
put('src/middlewares/private-api-gate.js', `// Public REST endpoints require a token. The admin panel retains Strapi auth.
module.exports = () => async (ctx, next) => {
  const path = ctx.path || '';
  if (path.startsWith('/api/') && !ctx.get('authorization')) {
    ctx.status = 401;
    ctx.body = { data: null, error: {
      status: 401, name: 'UnauthorizedError', message: 'Token de leitura obrigatorio',
    } };
    return;
  }
  await next();
};
`);
put('src/index.js', `module.exports = {
  register() {},
  bootstrap() {
    // No automatic administrators or public API permissions.
    // The first admin is created at http://localhost:1337/admin.
  },
};
`);
put('src/admin/tsconfig.json', JSON.stringify({
  extends: '@strapi/typescript-utils/tsconfigs/admin',
  include: ['../plugins/**/admin/src/**/*', './'],
  exclude: ['node_modules/', 'build/', 'dist/', '**/*.test.ts'],
}, null, 2) + '\n');
put('src/admin/app.js', `export default {
  config: { locales: ['pt-BR'] },
  bootstrap() {},
};
`);
console.log('Schemas e configuracoes do Strapi gerados para ' + Object.keys(models).length + ' colecoes.');
