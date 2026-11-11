import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { canonicalLink, plain } from './feeds.mjs';

const MONTHS = Object.freeze({
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
});

/** English source dates, interpreted at UTC noon to avoid timezone drift. */
export function listingDate(raw) {
  const match = String(raw || '').match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
  if (!match) return null;
  const day = Number(match[1]), month = MONTHS[match[2].toLowerCase()], year = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date.getTime();
}

/**
 * Resolve ordinary relative links using the approved listing URL, without
 * expanding the hostname or news path allowlist. No article pages are fetched.
 */
function articleLink(raw, source, stats) {
  const href = typeof raw === 'string' ? raw.trim() : '';
  if (!href) { stats.missingHref++; return null; }
  let resolved;
  try { resolved = new URL(href, source.feed); }
  catch { stats.malformedHref++; return null; }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) stats.relativeHref++;
  if (resolved.protocol !== 'https:') {
    stats.unsafeScheme++; return null;
  }
  if (resolved.hostname !== source.hostname || resolved.username ||
      resolved.password || resolved.port) {
    stats.externalHost++; return null;
  }
  const canonical = canonicalLink(resolved.toString(), source);
  if (!canonical || !new URL(canonical).pathname.startsWith(source.articlePath)) {
    stats.wrongArticlePath++; return null;
  }
  return canonical;
}

function readCard(card, fields, source, now, ageDays, stats) {
  const title = plain(fields.title(card), 200);
  const url = articleLink(fields.url(card), source, stats);
  const stamp = listingDate(fields.date(card));
  if (!title) { stats.invalidTitle++; return null; }
  if (!url) {
    stats.invalidLink++; return null;
  }
  if (stamp === null) { stats.invalidDate++; return null; }
  if (stamp < now - ageDays * 86400000 || stamp > now + 86400000) {
    stats.outsideWindow++; return null;
  }
  stats.accepted++;
  // RNIB's short listing description is used ONLY as an ephemeral relevance
  // signal: never copied into summary, CMS, preview output or monitor report.
  // HTML sources stay preview-only. Do not send excerpts to any LLM.
  const discoveryText=source.id==='rnib'&&typeof fields.description==='function'
    ? plain(fields.description(card),320) : '';
  return {
    title, url, summary: '', publishedAt: new Date(stamp).toISOString(),
    source: source.name, country: source.country, language: source.language,
    ...(discoveryText?{discoveryText}:{}),
    dedupeKey: createHash('sha256').update(url).digest('hex'),
  };
}

export function parseListing(body, source, now = Date.now(), ageDays = 45, stats = {}) {
  if (typeof body !== 'string' || body.length > 1300000) throw new Error('HTML listing too large');
  if (source.mode !== 'html' || source.previewOnly !== true)
    throw new Error('HTML listings must remain preview-only');
  Object.assign(stats, {detectedCards:0,invalidTitle:0,invalidLink:0,
    invalidDate:0,outsideWindow:0,accepted:0,missingHref:0,malformedHref:0,
    relativeHref:0,unsafeScheme:0,externalHost:0,wrongArticlePath:0,
    listingState:'no_cards'});
  const $ = load(body);
  const cards = [];
  const record = (card, fields) => {
    stats.detectedCards++;
    cards.push(readCard(card, fields, source, now, ageDays, stats));
  };
  if (source.id === 'rnib') {
    $('.listing__post').slice(0, 30).each((_, el) => {
      const card = $(el);
      record(card, {
        title: x => x.find('.small-image-card__title a').first().text(),
        url: x => x.find('.small-image-card__title a').first().attr('href'),
        date: x => x.find('.small-image-card__meta-item').first().text(),
        description: x => x.find('.small-image-card__description').first().text(),
      });
    });
  } else if (source.id === 'ibsa') {
    $('.tekup-blog-wrap').slice(0, 30).each((_, el) => {
      const card = $(el);
      record(card, {
        title: x => x.find('.tekup-blog-content h3').first().text(),
        url: x => x.find('.tekup-blog-content h3').first().closest('a').attr('href'),
        date: x => x.find('.tekup-blog-meta li').last().text(),
      });
    });
  } else {
    throw new Error('Unsupported HTML source: no custom parser');
  }
  stats.listingState = stats.detectedCards > 0 ? 'cards_detected' :
    (source.id === 'ibsa' && /Loading news(?:\.{3}|…)/i.test(body)
      ? 'client_render_pending' : 'no_cards');
  return cards.filter(Boolean);
}
