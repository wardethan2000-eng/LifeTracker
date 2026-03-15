const TRACKING_PARAM_PREFIXES = [
  "utm_",
  "ga_",
  "gs_",
  "mkt_",
  "mc_",
  "sc_",
  "trk",
  "tracking"
] as const;

const TRACKING_PARAM_NAMES = new Set([
  "aaxitk",
  "ascsubtag",
  "camp",
  "clickid",
  "content-id",
  "creative",
  "dib",
  "dib_tag",
  "fbclid",
  "gad_source",
  "gclid",
  "gclsrc",
  "hsa_acc",
  "hsa_ad",
  "hsa_cam",
  "hsa_grp",
  "hsa_kw",
  "hsa_mt",
  "hsa_net",
  "hsa_src",
  "hsa_tgt",
  "hsa_ver",
  "irclickid",
  "linkCode",
  "msclkid",
  "pd_rd_i",
  "psc",
  "qid",
  "ref",
  "ref_",
  "srsltid",
  "sr",
  "tag",
  "variant"
]);

const REDIRECT_PARAM_CANDIDATES = [
  "url",
  "u",
  "target",
  "dest",
  "destination",
  "redirect",
  "redirect_url",
  "redirect_uri",
  "redir",
  "r",
  "to"
] as const;

const PRODUCT_HOSTS_TO_STRIP_QUERY = [
  "amazon.com",
  "amazon.ca",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.com.mx",
  "autozone.com",
  "advanceautoparts.com",
  "oreillyauto.com",
  "oreillyauto.parts",
  "oreillys.com",
  "napaonline.com",
  "rockauto.com",
  "fcpeuro.com",
  "summitracing.com",
  "homedepot.com",
  "lowes.com",
  "harborfreight.com",
  "acehardware.com",
  "tractorsupply.com",
  "walmart.com",
  "ebay.com",
  "grainger.com",
  "zoro.com",
  "mcmaster.com",
  "uline.com",
  "webstaurantstore.com"
] as const;

function extractCandidateUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const explicitMatch = trimmed.match(/https?:\/\/\S+/i);

  if (explicitMatch) {
    return explicitMatch[0];
  }

  const domainMatch = trimmed.match(/(?:[a-z0-9-]+\.)+[a-z]{2,}\S*/i);

  if (domainMatch) {
    return domainMatch[0];
  }

  return trimmed;
}

function withHttpProtocol(value: string): string {
  if (/^[a-z][a-z\d+\-.]*:/i.test(value)) {
    return value;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  return `https://${value}`;
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function unwrapRedirectUrl(url: URL): URL {
  let current = url;

  for (let depth = 0; depth < 3; depth += 1) {
    let nextValue: string | null = null;

    for (const key of REDIRECT_PARAM_CANDIDATES) {
      const candidate = current.searchParams.get(key);

      if (candidate && /^(https?:)?\/\//i.test(candidate.trim())) {
        nextValue = candidate.trim();
        break;
      }
    }

    if (!nextValue) {
      if ((matchesDomain(current.hostname, "google.com") || matchesDomain(current.hostname, "bing.com")) && current.pathname === "/url") {
        nextValue = current.searchParams.get("q")?.trim() ?? null;
      } else if (matchesDomain(current.hostname, "l.facebook.com") || matchesDomain(current.hostname, "lm.facebook.com")) {
        nextValue = current.searchParams.get("u")?.trim() ?? null;
      }
    }

    if (!nextValue) {
      break;
    }

    try {
      const parsed = new URL(withHttpProtocol(nextValue));

      if (!isHttpUrl(parsed)) {
        break;
      }

      current = parsed;
    } catch {
      break;
    }
  }

  return current;
}

function stripTrackingParams(url: URL): void {
  const keys = [...url.searchParams.keys()];

  for (const key of keys) {
    const normalizedKey = key.toLowerCase();
    const shouldDelete = TRACKING_PARAM_NAMES.has(normalizedKey)
      || TRACKING_PARAM_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))
      || normalizedKey.startsWith("pd_rd_")
      || normalizedKey.startsWith("pf_rd_");

    if (shouldDelete) {
      url.searchParams.delete(key);
    }
  }
}

function shouldStripEntireQuery(url: URL): boolean {
  const hostname = url.hostname.replace(/^www\./, "").toLowerCase();

  if (!PRODUCT_HOSTS_TO_STRIP_QUERY.some((domain) => matchesDomain(hostname, domain))) {
    return false;
  }

  const pathname = url.pathname.toLowerCase();

  return [
    "/dp/",
    "/gp/",
    "/ip/",
    "/p/",
    "/product/",
    "/products/",
    "/pd/",
    "/itm/",
    "/parts/",
    "/sku/",
    "/item/"
  ].some((segment) => pathname.includes(segment));
}

export function normalizeExternalUrl(value: string): string | null {
  const candidate = extractCandidateUrl(value);

  if (!candidate) {
    return null;
  }

  try {
    const parsed = unwrapRedirectUrl(new URL(withHttpProtocol(candidate)));

    if (!isHttpUrl(parsed)) {
      return null;
    }

    parsed.username = "";
    parsed.password = "";
    parsed.hash = "";
    stripTrackingParams(parsed);

    if (shouldStripEntireQuery(parsed)) {
      parsed.search = "";
    }

    return parsed.href;
  } catch {
    return null;
  }
}