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

function readCard(card, fields, source, now, ageDays) {
  const title = plain(fields.title(card), 200);
  const url = canonicalLink(fields.url(card), source);
  const stamp = listingDate(fields.date(card));
  if (!title || !url || !url.startsWith('https://' + source.hostname + source.articlePath) ||
      stamp === null || stamp < now - ageDays * 86400000 || stamp > now + 86400000)
    return null;
  // HTML listing is preview-only. Do not send excerpts to AI or republish third-party text.
  return {
    title, url, summary: '', publishedAt: new Date(stamp).toISOString(),
    source: source.name, country: source.country, language: source.language,
    dedupeKey: createHash('sha256').update(url).digest('hex'),
  };
}

export function parseListing(body, source, now = Date.now(), ageDays = 45) {
  if (typeof body !== 'string' || body.length > 1300000) throw new Error('HTML listing too large');
  if (source.mode !== 'html' || source.previewOnly !== true)
    throw new Error('HTML listings must remain preview-only');
  const $ = load(body);
  const cards = [];
  if (source.id === 'rnib') {
    $('.listing__post').slice(0, 30).each((_, el) => {
      const card = $(el);
      cards.push(readCard(card, {
        title: x => x.find('.small-image-card__title a').first().text(),
        url: x => x.find('.small-image-card__title a').first().attr('href'),
        date: x => x.find('.small-image-card__meta-item').first().text(),
      }, source, now, ageDays));
    });
  } else if (source.id === 'ibsa') {
    $('.tekup-blog-wrap').slice(0, 30).each((_, el) => {
      const card = $(el);
      cards.push(readCard(card, {
        title: x => x.find('.tekup-blog-content h3').first().text(),
        url: x => x.find('.tekup-blog-content h3').first().closest('a').attr('href'),
        date: x => x.find('.tekup-blog-meta li').last().text(),
      }, source, now, ageDays));
    });
  } else {
    throw new Error('Unsupported HTML source: no custom parser');
  }
  return cards.filter(Boolean);
}
