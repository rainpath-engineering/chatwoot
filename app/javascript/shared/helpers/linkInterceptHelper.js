// Link interception lets the page embedding the widget handle clicks on links
// to its own origins (for example to navigate inside a single page app)
// instead of opening them in a new tab. The host opts in with
// `window.chatwootSettings.linkInterceptOrigins`.

const isAllowedProtocol = url =>
  url.protocol === 'https:' ||
  (url.protocol === 'http:' && url.hostname === 'localhost');

const parseOrigin = value => {
  if (typeof value !== 'string') return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!isAllowedProtocol(url)) return null;
  // An origin only: no credentials, path, query string or fragment.
  if (url.username || url.password) return null;
  if (url.pathname !== '/' || url.search || url.hash) return null;
  return url.origin;
};

/**
 * Keeps the valid origins of a `linkInterceptOrigins` setting: `https:`
 * origins, plus `http://localhost` on any port for local development.
 * Anything else is dropped. Returns a deduplicated list of normalized origins.
 */
export const sanitizeLinkInterceptOrigins = origins => {
  if (!Array.isArray(origins)) return [];
  return origins.reduce((result, value) => {
    const origin = parseOrigin(value);
    if (origin && !result.includes(origin)) result.push(origin);
    return result;
  }, []);
};

/**
 * Returns the absolute URL of `href` when its origin is one of `origins`,
 * otherwise null.
 */
export const getInterceptedUrl = (href, origins) => {
  if (typeof href !== 'string' || !origins?.length) return null;
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  return origins.includes(url.origin) ? url.href : null;
};
