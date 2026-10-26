/**
 * Media Service — Real-world royalty-free educational image integration
 * Queries Wikimedia Commons API for verified public-domain and Creative Commons images
 * with captions and creator attributions.
 */

export interface LessonImage {
  url: string;
  caption: string;
  source: string;
  author?: string;
  license?: string;
}

function stripHtml(input?: string): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>?/gm, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.svg', '.webp', '.gif'];

export function cleanImageUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    // Remove unnecessary tracking query parameters (utm_*, etc.)
    const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'];
    for (const key of trackingKeys) {
      parsed.searchParams.delete(key);
    }
    const query = parsed.searchParams.toString();
    return query ? `${parsed.origin}${parsed.pathname}?${query}` : `${parsed.origin}${parsed.pathname}`;
  } catch {
    // If URL parsing fails, strip utm params via regex
    return rawUrl.replace(/([?&])utm_[^&]+(&|$)/gi, '$1').replace(/[?&]$/, '');
  }
}

export async function searchWikimediaImages(query: string, limit = 2): Promise<LessonImage[]> {
  try {
    const cleanQuery = query.trim().replace(/[^\w\s-]/g, ' ');
    if (!cleanQuery) return [];

    // Request 800px width thumbnail for bandwidth efficiency and stable display
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      cleanQuery
    )}&gsrnamespace=6&gsrlimit=${Math.max(limit * 2, 4)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&format=json&origin=*`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MindlyEducationalPlatform/1.5 (educational@mindly.internal; open-source search)',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Wikimedia Search] HTTP ${response.status} for query: "${cleanQuery}"`);
      return [];
    }

    const data: any = await response.json();
    const pages = data?.query?.pages;
    if (!pages || typeof pages !== 'object') {
      return [];
    }

    const images: LessonImage[] = [];

    for (const key of Object.keys(pages)) {
      const page = pages[key];
      const info = page?.imageinfo?.[0];
      if (!info) continue;

      // Prefer appropriately sized thumbnail URL, falling back to original URL
      const rawUrl: string = info.thumburl || info.url;
      if (!rawUrl) continue;

      const lowerUrl = rawUrl.toLowerCase().split('?')[0];
      const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => lowerUrl.endsWith(ext));
      if (!hasValidExt) continue;

      // Strip unnecessary tracking parameters like utm_source while preserving resource path
      const cleanedUrl = cleanImageUrl(rawUrl);

      const meta = info.extmetadata || {};
      const rawDesc = meta.ImageDescription?.value || meta.ObjectName?.value || page.title?.replace(/^File:/, '') || cleanQuery;
      let caption = stripHtml(rawDesc);
      if (/cropped from file/i.test(caption) || /^file:/i.test(caption) || /\.(svg|png|jpg|jpeg|gif)$/i.test(caption)) {
        caption = `${cleanQuery} illustration`;
      }
      if (caption.length > 140) {
        caption = caption.slice(0, 137).trim() + '...';
      }
      if (!caption || caption.length < 5) {
        caption = `${cleanQuery} educational reference`;
      }

      const author = stripHtml(meta.Artist?.value || meta.Credit?.value || 'Wikimedia Commons');
      const license = stripHtml(meta.LicenseShortName?.value || meta.UsageTerms?.value || 'Creative Commons');
      const cleanAuthor = author.length > 50 ? author.slice(0, 47) + '...' : author;

      images.push({
        url: cleanedUrl,
        caption,
        author: cleanAuthor || 'Wikimedia Commons Contributor',
        license: license || 'Public Domain / CC',
        source: `Wikimedia Commons (${license || 'CC'} · ${cleanAuthor || 'Contributor'})`,
      });

      if (images.length >= limit) break;
    }

    return images;
  } catch (err: any) {
    console.warn(`[Wikimedia Search Error] query="${query}":`, err.message);
    return [];
  }
}

/**
 * High-level image retrieval for a lesson: queries 1-2 search terms and deduplicates
 */
export async function fetchLessonImages(searchTerms: string[]): Promise<LessonImage[]> {
  if (!Array.isArray(searchTerms) || searchTerms.length === 0) {
    return [];
  }

  const collected: LessonImage[] = [];
  const seenUrls = new Set<string>();

  for (const term of searchTerms.slice(0, 2)) {
    if (!term || term.trim().length < 3) continue;
    const results = await searchWikimediaImages(term.trim(), 2);
    for (const img of results) {
      if (!seenUrls.has(img.url)) {
        seenUrls.add(img.url);
        collected.push(img);
      }
      if (collected.length >= 2) break;
    }
    if (collected.length >= 2) break;
  }

  return collected;
}
