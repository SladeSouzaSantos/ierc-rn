/**
 * IERC-RN / Sprint 3.1 — modelos editoriais declarativos.
 * Strapi gera as coleções e os CRUDs a partir destes schemas.
 * Nada aqui cria usuários, chaves, URLs de agendamento ou conteúdo fictício.
 */
export const str = (required = false) => ({ type: 'string', ...(required ? { required: true } : {}) });
export const text = (required = false) => ({ type: 'text', ...(required ? { required: true } : {}) });
const uid = (field) => ({ type: 'uid', targetField: field, required: true });
const common = {
  editorialStatus: { type: 'enumeration', enum: ['em_preparacao', 'em_revisao', 'aprovado'], default: 'em_preparacao', required: true },
  approvalReference: str(),
  approvalNote: text(),
  sourceName: str(),
  sourceUrl: str(),
};
const portrait = {
  image: { type: 'media', multiple: false, allowedTypes: ['images'] },
  imageAlt: text(),
  imageCredit: str(),
  imageRightsStatus: { type: 'enumeration', enum: ['pendente', 'autorizado', 'restrito'], default: 'pendente', required: true },
  imageRightsProof: text(),
};
function make(singular, plural, title, description, attributes, kind = 'collectionType') {
  return {
    kind,
    collectionName: 'ierc_' + plural.replaceAll('-', '_'),
    info: { singularName: singular, pluralName: plural, displayName: title, description },
    options: { draftAndPublish: true },
    attributes: { ...attributes, ...common },
  };
}
export const models = {
  'news-article': make('news-article', 'news-articles', 'Notícias', 'Notícias verificadas do IERC-RN.', {
    title: str(true), slug: uid('title'), summary: text(true), body: { type: 'richtext' },
    category: str(), date: { type: 'datetime' },
    originType: { type: 'enumeration', enum: ['institucional', 'externa'], default: 'institucional' },
    scope: { type: 'enumeration', enum: ['local', 'brasil', 'internacional'], default: 'local' },
    country: str(), sourceLanguage: str(), originalTitle: str(),
    originalPublishedAt: { type: 'datetime' },
    whyItMatters: text(), aiAssisted: { type: 'boolean', default: false },
    dedupeKey: { type: 'string', unique: true },
    ...portrait,
  }),
  event: make('event', 'events', 'Eventos', 'Agenda aprovada pela instituição.', {
    title: str(true), slug: uid('title'), summary: text(true),
    location: str(), startsAt: { type: 'datetime', required: true },
    endsAt: { type: 'datetime' }, registrationUrl: str(), ...portrait,
  }),
  activity: make('activity', 'activities', 'Atividades', 'Serviços atuais sujeitos à revisão institucional.', {
    title: str(true), slug: uid('title'), summary: text(true),
    description: { type: 'richtext' }, category: str(),
    scheduleInfo: text(), enrollmentInfo: text(), ...portrait,
  }),
  athlete: make('athlete', 'athletes', 'Trajetórias de atletas', 'Vínculos e biografias com fontes documentais.', {
    name: str(true), slug: uid('name'), summary: text(true),
    discipline: str(), connectionToIerc: text(true), connectionPeriod: str(),
    biography: { type: 'richtext' }, sourceYear: { type: 'integer' }, ...portrait,
  }),
  gallery: make('gallery', 'galleries', 'Galerias', 'Álbuns formados por mídias com autoria e autorização.', {
    title: str(true), slug: uid('title'), summary: text(),
    photos: { type: 'relation', relation: 'manyToMany', target: 'api::media-record.media-record' },
  }),
  'media-record': make('media-record', 'media-records', 'Registros de mídia', 'Uma autorização individual por arquivo.', {
    title: str(true),
    file: { type: 'media', multiple: false, required: true, allowedTypes: ['images', 'videos'] },
    altText: text(true), credit: str(true), caption: text(),
    licenseType: { type: 'enumeration', enum: ['cessao_institucional', 'licenca_explicita', 'dominio_publico', 'outro'], required: true },
    licenseEvidence: text(true),
    consentConfirmed: { type: 'boolean', default: false, required: true },
    signedConsentReference: str(),
    imageRightsStatus: { type: 'enumeration', enum: ['pendente', 'autorizado', 'restrito'], default: 'pendente', required: true },
  }),
  'site-setting': make('site-setting', 'site-settings', 'Configurações institucionais', 'Dados oficiais para homologação.', {
    siteName: str(true), mission: text(),
    phone: str(), email: { type: 'email' }, businessHours: text(), visitBookingUrl: str(),
  }, 'singleType'),
};
