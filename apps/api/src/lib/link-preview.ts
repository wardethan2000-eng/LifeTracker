import * as cheerio from "cheerio";
import type { LinkPreviewField, LinkPreviewResponse } from "@aegis/types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const FETCH_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
} as const;

const FETCH_TIMEOUT_MS = 10_000;

const RETAILER_MAP: Record<string, string> = {
  "amazon.de": "Amazon",
  "amazon.fr": "Amazon",
  "amazon.it": "Amazon",
  "amazon.es": "Amazon",
  "amazon.com.mx": "Amazon",
  "amzn.to": "Amazon",
  "amazon.com": "Amazon",
  "amazon.ca": "Amazon",
  "amazon.co.uk": "Amazon",
  "homedepot.com": "Home Depot",
  "lowes.com": "Lowes",
  "autozone.com": "AutoZone",
  "advanceautoparts.com": "Advance Auto Parts",
  "napaonline.com": "NAPA Auto Parts",
  "oreillyauto.com": "O'Reilly Auto Parts",
  "oreillys.com": "O'Reilly Auto Parts",
  "rockauto.com": "RockAuto",
  "walmart.com": "Walmart",
  "ebay.com": "eBay",
  "grainger.com": "Grainger",
  "harborfreight.com": "Harbor Freight",
  "acehardware.com": "Ace Hardware",
  "tractorsupply.com": "Tractor Supply",
  "mcmaster.com": "McMaster-Carr",
  "zoro.com": "Zoro",
  "uline.com": "Uline",
  "fcpeuro.com": "FCP Euro",
  "summitracing.com": "Summit Racing",
  "webstaurantstore.com": "WebstaurantStore",
};

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
  "linkcode",
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

const FIELD_LABELS: Record<string, string> = {
  name: "Product Name",
  price: "Price",
  currency: "Currency",
  brand: "Brand / Manufacturer",
  model: "Model",
  partNumber: "Part Number / MPN",
  oemPartNumber: "OEM Part Number",
  asin: "ASIN",
  sku: "SKU",
  upc: "UPC / Barcode",
  description: "Description",
  features: "Key Features",
  fitment: "Vehicle Compatibility",
  category: "Category",
  dimensions: "Dimensions",
  weight: "Weight",
  color: "Color / Finish",
  material: "Material",
  quantity: "Package Quantity",
  threadSize: "Thread Size",
  outsideDiameter: "Outside Diameter",
  fitType: "Fit Type",
  availability: "Availability",
  rating: "Rating",
  reviewCount: "Review Count",
};

const CONFIDENCE_SCORE: Record<LinkPreviewField["confidence"], number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const SOURCE_SCORE: Record<LinkPreviewField["source"], number> = {
  html: 1,
  meta: 2,
  og: 3,
  inferred: 4,
  "json-ld": 5,
};

const FIELD_ORDER = [
  "name",
  "brand",
  "model",
  "partNumber",
  "oemPartNumber",
  "asin",
  "upc",
  "price",
  "availability",
  "rating",
  "reviewCount",
  "fitment",
  "features",
  "description",
  "category",
  "material",
  "color",
  "dimensions",
  "outsideDiameter",
  "threadSize",
  "weight",
  "fitType",
  "quantity",
  "currency",
  "sku",
];

function fieldKeyToLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function createPreviewField(
  key: string,
  value: string | null | undefined,
  confidence: LinkPreviewField["confidence"],
  source: LinkPreviewField["source"]
): LinkPreviewField | null {
  const normalizedValue = sanitizeFieldValue(value);

  if (!normalizedValue) {
    return null;
  }

  return {
    key,
    label: fieldKeyToLabel(key),
    value: normalizedValue,
    confidence,
    source,
  };
}

function detectRetailer(hostname: string): string | null {
  const bare = hostname.replace(/^www\./, "");
  for (const [domain, name] of Object.entries(RETAILER_MAP)) {
    if (bare === domain || bare.endsWith(`.${domain}`)) {
      return name;
    }
  }
  return bare || null;
}

function stripTitleSuffix(title: string): string {
  return title
    .replace(/\s*[\|\-–—@]\s*(Home Depot|Amazon\.com?|Lowes\.com?|AutoZone|Advance Auto Parts|NAPA Auto Parts|Walmart\.com?|Harbor Freight|Ace Hardware|Tractor Supply|O'Reilly Auto Parts|RockAuto|eBay|Grainger|McMaster-Carr|Zoro|Uline|FCP Euro|Summit Racing|WebstaurantStore).*$/i, "")
    .trim();
}

function titleCaseSegment(value: string): string {
  if (value.toUpperCase() === value && /[A-Z]/.test(value)) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function humanizeSlug(value: string): string | null {
  const decoded = decodeURIComponent(value).replace(/\+/g, " ").trim();

  if (!decoded) {
    return null;
  }

  const normalized = decoded
    .split("-")
    .filter(Boolean)
    .map((segment) => titleCaseSegment(segment))
    .join(" ")
    .replace(/\b0 (\d{2,3})\b/g, "0.$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  return normalized || null;
}

function parseHomeDepotUrlFallback(parsedUrl: URL): LinkPreviewResponse | null {
  const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();

  if (!matchesDomain(hostname, "homedepot.com")) {
    return null;
  }

  const match = parsedUrl.pathname.match(/\/p\/([^/]+)\/(\d{6,})/i);

  if (!match) {
    return null;
  }

  const slug = match[1];
  const productId = match[2];
  if (!slug || !productId) {
    return null;
  }

  const slugSegments = slug.split("-").filter(Boolean);
  let model: string | null = null;
  let productNameSegments = slugSegments;

  if (slugSegments.length >= 2) {
    const last = slugSegments[slugSegments.length - 1];
    const previous = slugSegments[slugSegments.length - 2];
    const lastLooksLikeModelPart = last
      ? /^[A-Za-z0-9]{1,8}$/.test(last) && /\d/.test(last)
      : false;
    const previousLooksLikeModelPart = previous
      ? /^[A-Za-z0-9]{1,8}$/.test(previous) && /[A-Za-z]/.test(previous)
      : false;

    if (lastLooksLikeModelPart && previousLooksLikeModelPart && previous && last) {
      model = `${previous.toUpperCase()}-${last.toUpperCase()}`;
      productNameSegments = slugSegments.slice(0, -2);
    }
  }

  const brandCandidate = slugSegments[0] ?? null;
  const brand = brandCandidate && /^[A-Za-z0-9]{2,}$/.test(brandCandidate)
    ? brandCandidate.toUpperCase() === brandCandidate
      ? brandCandidate
      : titleCaseSegment(brandCandidate)
    : null;
  const productName = humanizeSlug(productNameSegments.join("-")) ?? humanizeSlug(slug);

  const fields = [
    createPreviewField("name", productName, "medium", "inferred"),
    createPreviewField("brand", brand, "low", "inferred"),
    createPreviewField("model", model, "low", "inferred"),
    createPreviewField("sku", productId, "medium", "inferred"),
  ].filter((field): field is LinkPreviewField => Boolean(field));

  return {
    url: parsedUrl.href,
    canonicalUrl: parsedUrl.href,
    retailer: "Home Depot",
    fields,
    imageUrls: [],
    rawTitle: null,
    extractionMode: "fallback",
    warningMessage: "Home Depot blocked direct extraction, so this import is using details inferred from the product URL only.",
    fetchedAt: new Date().toISOString(),
  };
}

function buildKnownRetailerFallback(url: string): LinkPreviewResponse | null {
  try {
    const parsedUrl = new URL(url);
    return parseHomeDepotUrlFallback(parsedUrl);
  } catch {
    return null;
  }
}

function isKnownBlockedRetailerPage(retailer: string | null, status: number, html: string): boolean {
  const normalized = html.toLowerCase();

  if (retailer === "Home Depot") {
    return status === 403
      || normalized.includes("oops!! something went wrong")
      || normalized.includes("error page")
      || normalized.includes("#1 home improvement retailer");
  }

  return false;
}

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

function canonicalizeKnownProductUrl(url: URL): URL {
  const hostname = url.hostname.replace(/^www\./, "").toLowerCase();

  if (hostname.startsWith("amazon.")) {
    const asin = url.pathname.match(/\/(?:dp|gp\/aw\/d|gp\/product|exec\/obidos\/asin)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];

    if (asin) {
      return new URL(`${url.origin}/dp/${asin}`);
    }
  }

  return url;
}

function resolveUrl(relative: string, base: string): string | null {
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

type FieldMap = Map<string, { value: string; confidence: LinkPreviewField["confidence"]; source: LinkPreviewField["source"] }>;

function cleanWhitespace(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

  return normalized || null;
}

function cleanSentenceSpacing(value: string | null | undefined): string | null {
  const normalized = cleanWhitespace(value);

  if (!normalized) {
    return null;
  }

  return normalized
    .replace(/\s*([,:;.!?])/g, "$1")
    .replace(/([,:;!?])(\S)/g, "$1 $2")
    .replace(/([a-z])\.([A-Z])/g, "$1. $2")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function looksLikeScriptNoise(value: string): boolean {
  const normalized = value.toLowerCase();

  return normalized.includes("function(")
    || normalized.includes("window.")
    || normalized.includes("document.")
    || normalized.includes("addEventlistener")
    || normalized.includes("performanceobserver")
    || normalized.includes("ue_csm")
    || normalized.includes("csa.plugin")
    || normalized.includes("rx.ex64")
    || normalized.includes("__rx_")
    || normalized.includes("amazon. com/tt/i")
    || normalized.includes("var ue_")
    || normalized.includes("navigationstart")
    || normalized.includes("mutationobserver");
}

function sanitizeFieldValue(value: string | null | undefined): string | null {
  const normalized = cleanSentenceSpacing(value);

  if (!normalized) {
    return null;
  }

  if (looksLikeScriptNoise(normalized)) {
    return null;
  }

  return normalized;
}

function cleanPriceText(value: string | null | undefined): string | null {
  const normalized = cleanSentenceSpacing(value);

  if (!normalized) {
    return null;
  }

  return normalized
    .replace(/([$€£])\s+(?=\d)/g, "$1")
    .replace(/(\d)\.\s+(\d{2})\b/g, "$1.$2")
    .replace(/(\d),\s+(\d{3})\b/g, "$1,$2")
    .trim();
}

function normalizeBodyText($: cheerio.CheerioAPI): string {
  const $clone = cheerio.load($.html());
  $clone("script, style, noscript, template, svg, iframe").remove();

  return $clone("body")
    .find("br")
    .replaceWith("\n")
    .end()
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSectionText(bodyText: string, heading: string, stopHeadings: string[]): string | null {
  const startIndex = bodyText.indexOf(heading);

  if (startIndex === -1) {
    return null;
  }

  const afterHeading = bodyText.slice(startIndex + heading.length).trim();
  let endIndex = afterHeading.length;

  for (const stopHeading of stopHeadings) {
    const stopIndex = afterHeading.indexOf(stopHeading);
    if (stopIndex !== -1 && stopIndex < endIndex) {
      endIndex = stopIndex;
    }
  }

  return cleanWhitespace(afterHeading.slice(0, endIndex));
}

function isLikelyProductImage(url: string): boolean {
  const normalized = url.toLowerCase();

  if (normalized.endsWith(".svg")) {
    return false;
  }

  if (normalized.includes("icon") || normalized.includes("sprite") || normalized.includes("logo")) {
    return false;
  }

  return normalized.includes("/images/i/")
    || normalized.includes("._ac_")
    || normalized.includes("._sx")
    || normalized.includes("._sl")
    || normalized.includes("product-image")
    || normalized.includes("main-image");
}

function stripAmazonTitlePrefix(value: string | null | undefined): string | null {
  const normalized = cleanSentenceSpacing(value);

  if (!normalized) {
    return null;
  }

  return normalized
    .replace(/^Amazon\.com\s*:\s*/i, "")
    .replace(/\s*:\s*Automotive$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripLeadingRatingCopy(value: string | null | undefined): string | null {
  const normalized = cleanSentenceSpacing(value);

  if (!normalized) {
    return null;
  }

  return normalized
    .replace(/^Rating:\s*[-\d., ]+reviews?\.\s*/i, "")
    .replace(/^\d+(?:\.\d+)?\s*out of 5 stars\s*/i, "")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRetailerOnlyName(value: string | null | undefined, retailer: string | null): boolean {
  const normalized = cleanSentenceSpacing(value)?.toLowerCase();

  if (!normalized) {
    return true;
  }

  const condensed = normalized.replace(/\s+/g, "");
  const genericPatterns = [
    /^amazon(?:\.com)?$/i,
    /^www\.amazon(?:\.com)?$/i,
    /^amazon(?:\.ca|\.co\.uk|\.de|\.fr|\.it|\.es|\.com\.mx)$/i,
    /^www\.amazon(?:\.ca|\.co\.uk|\.de|\.fr|\.it|\.es|\.com\.mx)$/i,
  ];

  if (genericPatterns.some((pattern) => pattern.test(normalized) || pattern.test(condensed))) {
    return true;
  }

  if (!retailer) {
    return false;
  }

  const retailerPattern = new RegExp(`^${escapeRegex(retailer.toLowerCase())}(?:\\.com)?$`, "i");
  return retailerPattern.test(normalized) || retailerPattern.test(condensed);
}

function preferLongerMeaningfulValue(current: string, next: string): boolean {
  const currentScore = current.replace(/[^a-z0-9]/gi, "").length;
  const nextScore = next.replace(/[^a-z0-9]/gi, "").length;
  return nextScore > currentScore + 8;
}

function shouldReplaceField(
  current: { value: string; confidence: LinkPreviewField["confidence"]; source: LinkPreviewField["source"] },
  next: { value: string; confidence: LinkPreviewField["confidence"]; source: LinkPreviewField["source"] }
): boolean {
  const currentConfidence = CONFIDENCE_SCORE[current.confidence];
  const nextConfidence = CONFIDENCE_SCORE[next.confidence];

  if (nextConfidence !== currentConfidence) {
    return nextConfidence > currentConfidence;
  }

  const currentSource = SOURCE_SCORE[current.source];
  const nextSource = SOURCE_SCORE[next.source];

  if (nextSource !== currentSource) {
    return nextSource > currentSource;
  }

  return preferLongerMeaningfulValue(current.value, next.value);
}

function setField(
  fields: FieldMap,
  key: string,
  value: string | null | undefined,
  confidence: LinkPreviewField["confidence"],
  source: LinkPreviewField["source"]
): void {
  const normalizedValue = sanitizeFieldValue(value);

  if (!normalizedValue) return;

  const next = { value: normalizedValue, confidence, source };
  const current = fields.get(key);

  if (!current || shouldReplaceField(current, next)) {
    fields.set(key, next);
  }
}

function joinDistinctLines(values: Array<string | null | undefined>, separator = "\n"): string | null {
  const normalized = values
    .map((value) => sanitizeFieldValue(value))
    .filter((value): value is string => Boolean(value));

  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique.join(separator) : null;
}

function joinDistinctList(values: Array<string | null | undefined>, separator = " • "): string | null {
  const normalized = values
    .map((value) => sanitizeFieldValue(value))
    .filter((value): value is string => Boolean(value));

  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique.join(separator) : null;
}

function extractTextNodes($elements: cheerio.Cheerio<any>): string[] {
  return $elements
    .map((_index, element) => sanitizeFieldValue(cheerio.load(element).text()))
    .get()
    .filter((value): value is string => Boolean(value));
}

function parseAmazonImageCandidates($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const candidates: string[] = [];

  const pushCandidate = (value: string | null | undefined) => {
    if (!value) {
      return;
    }

    const resolved = resolveUrl(value, baseUrl);

    if (resolved && !candidates.includes(resolved)) {
      candidates.push(resolved);
    }
  };

  pushCandidate($("#landingImage").attr("data-old-hires"));
  pushCandidate($("#imgBlkFront").attr("data-old-hires"));
  pushCandidate($("#landingImage").attr("src"));
  pushCandidate($("#imgBlkFront").attr("src"));

  const dynamicImage = $("#landingImage").attr("data-a-dynamic-image")
    ?? $("#imgBlkFront").attr("data-a-dynamic-image");

  if (dynamicImage) {
    try {
      const parsed = JSON.parse(dynamicImage) as Record<string, unknown>;

      for (const url of Object.keys(parsed)) {
        pushCandidate(url);
      }
    } catch {
      // Ignore invalid image metadata.
    }
  }

  return candidates;
}

function mapSpecFieldKey(label: string): string | null {
  const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  switch (normalized) {
    case "brand":
    case "manufacturer":
      return "brand";
    case "model":
    case "item model number":
      return "model";
    case "manufacturer part number":
    case "part number":
      return "partNumber";
    case "oem part number":
      return "oemPartNumber";
    case "global trade identification number":
    case "upc":
      return "upc";
    case "item weight":
      return "weight";
    case "outside diameter":
      return "outsideDiameter";
    case "thread size":
      return "threadSize";
    case "automotive fit type":
      return "fitType";
    case "number of items":
      return "quantity";
    case "material":
      return "material";
    case "exterior":
    case "color":
      return "color";
    case "asin":
      return "asin";
    default:
      return null;
  }
}

function extractSpecTables($: cheerio.CheerioAPI, fields: FieldMap): void {
  const rows = $("#technicalSpecifications_section_1 tr, #productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr, #detailBullets_feature_div li");

  rows.each((_index, row) => {
    const label = cleanSentenceSpacing($(row).find("th, .a-text-bold, .prodDetSectionEntry").first().text());
    const value = cleanSentenceSpacing($(row).find("td, span, .prodDetAttrValue").last().text());

    if (!label || !value) {
      return;
    }

    const fieldKey = mapSpecFieldKey(label);

    if (fieldKey) {
      setField(fields, fieldKey, value, "high", "html");
    }
  });
}

function extractAmazonSpecificFields(
  $: cheerio.CheerioAPI,
  fields: FieldMap,
  parsedUrl: URL,
  bodyText: string,
  imageUrls: string[]
): void {
  const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();

  if (!matchesDomain(hostname, "amazon.com")
    && !matchesDomain(hostname, "amazon.ca")
    && !matchesDomain(hostname, "amazon.co.uk")
    && !matchesDomain(hostname, "amazon.de")
    && !matchesDomain(hostname, "amazon.fr")
    && !matchesDomain(hostname, "amazon.it")
    && !matchesDomain(hostname, "amazon.es")
    && !matchesDomain(hostname, "amazon.com.mx")) {
    return;
  }

  const heading = stripAmazonTitlePrefix(
    $("#productTitle").first().text()
    || $("#title").first().text()
    || $("h1").first().text()
  );
  setField(fields, "name", heading, "high", "html");

  const byline = cleanSentenceSpacing(
    $("#bylineInfo").first().text()
    || $('a[href*="/stores/"]').first().text()
    || $('a[href*="store_ref="]').first().text()
  )
    ?.replace(/^Visit the\s+/i, "")
    .replace(/\s+Store$/i, "");
  setField(fields, "brand", byline, "high", "html");

  const priceText = cleanSentenceSpacing(
    $('.a-price .a-offscreen').first().text()
    || $('span[data-a-color="price"] .a-offscreen').first().text()
    || $('span.a-price.aok-align-center .a-offscreen').first().text()
  );
  setField(fields, "price", cleanPriceText(priceText), "high", "html");

  const ratingSourceRaw =
    $('i[data-cy="reviews-ratings-slot"] .a-icon-alt').first().text()
    || $('.a-icon-star-small .a-icon-alt').first().text()
    || $('.a-icon-alt').filter((_i, el) => /out of 5 stars/i.test($(el).text())).first().text()
    || bodyText.match(/\d+(?:\.\d+)?\s*out of 5 stars/i)?.[0]
    || null;
  const ratingSource = cleanSentenceSpacing(ratingSourceRaw);
  const ratingText = ratingSource?.match(/\d+(?:\.\d+)?(?=\s*out of 5 stars|$)/i)?.[0] ?? null;
  setField(fields, "rating", ratingText, "high", "html");

  const reviewSourceRaw =
    $('#acrCustomerReviewText').first().text()
    || $('a[href*="#customerReviews"]').first().text()
    || bodyText.match(/[\d,]+\s+(?:ratings|reviews)/i)?.[0]
    || null;
  const reviewSource = cleanSentenceSpacing(reviewSourceRaw);
  const reviewCountText = reviewSource?.match(/[\d,]+(?=\s*(?:ratings|reviews|$))/i)?.[0] ?? null;
  setField(fields, "reviewCount", reviewCountText, "high", "html");

  const bulletTexts = extractTextNodes($("#feature-bullets li, #featurebullets_feature_div li, #productFactsDesktopExpander li, #aboutThisItem_feature_div li"));
  const aboutSection = bulletTexts.length === 0
    ? extractSectionText(bodyText, "About this item", [
        "Frequently bought together",
        "Products related to this item",
        "Explore more from across the store",
        "From the brand",
        "Product Description",
        "Technical Details",
        "Additional Information",
        "Customer reviews"
      ])
    : null;
  const aboutBullets = aboutSection
    ? aboutSection.split(/\s*•\s*/g).map((value) => value.trim())
    : [];

  const normalizedBullets = [...bulletTexts, ...aboutBullets]
    .map((value) => value.replace(/^•\s*/, "").trim())
    .filter((value) => value.length > 0 && !looksLikeScriptNoise(value));

  const fitmentBullets = normalizedBullets.filter((value) => /^(compatible with|fits?|for select|for use with|vehicle fitment)\b/i.test(value));
  const featureBullets = normalizedBullets.filter((value) => !fitmentBullets.includes(value));

  setField(fields, "features", joinDistinctList(featureBullets), "high", "html");
  setField(fields, "fitment", joinDistinctLines(fitmentBullets), "high", "html");

  const productDescriptionParagraphs = extractTextNodes($("#productDescription p, #aplus p, #bookDescription_feature_div p")).slice(0, 4);
  const description = joinDistinctLines(productDescriptionParagraphs, "\n\n")
    ?? sanitizeFieldValue(extractSectionText(bodyText, "Product Description", [
      "Product information",
      "Technical Details",
      "Additional Information",
      "Warranty & Support",
      "Customer reviews"
    ]));
  setField(fields, "description", truncate(description, 900), "high", "html");

  const breadcrumbs = extractTextNodes($('a[href*="dp_bc_"]')).filter((value) => value.length < 80);
  const breadcrumbPath = breadcrumbs.length > 1 ? [...new Set(breadcrumbs)].join(' > ') : null;
  setField(fields, 'category', breadcrumbPath, 'medium', 'html');

  const asin = parsedUrl.pathname.match(/\/(?:dp|gp\/aw\/d|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1] ?? null;
  setField(fields, 'asin', asin, 'high', 'inferred');

  for (const imageUrl of parseAmazonImageCandidates($, parsedUrl.origin)) {
    if (!imageUrls.includes(imageUrl)) {
      imageUrls.unshift(imageUrl);
    }
  }

  extractSpecTables($, fields);
}

function normalizeFieldValues(fields: FieldMap, retailer: string | null, rawTitle: string | null): void {
  const name = fields.get('name');
  if (name) {
    const cleanedName = stripAmazonTitlePrefix(stripTitleSuffix(name.value)) ?? name.value;

    if (isRetailerOnlyName(cleanedName, retailer)) {
      const fallbackName = rawTitle
        ? stripAmazonTitlePrefix(stripTitleSuffix(rawTitle))
        : null;

      if (isRetailerOnlyName(fallbackName, retailer)) {
        fields.delete('name');
      } else if (fallbackName) {
        name.value = fallbackName;
      }
    } else {
      name.value = cleanedName;
    }
  }

  const description = fields.get('description');
  if (description) {
    let cleanedDescription = stripLeadingRatingCopy(description.value) ?? description.value;

    if (retailer === 'Amazon') {
      cleanedDescription = stripAmazonTitlePrefix(cleanedDescription) ?? cleanedDescription;
    }

    description.value = cleanedDescription;
  }

  const price = fields.get('price');
  if (price) {
    price.value = cleanPriceText(price.value) ?? price.value;
  }
}

function buildOrderedFieldArray(fields: FieldMap): LinkPreviewField[] {
  return [...fields.entries()]
    .sort(([leftKey], [rightKey]) => {
      const leftIndex = FIELD_ORDER.indexOf(leftKey);
      const rightIndex = FIELD_ORDER.indexOf(rightKey);

      if (leftIndex === -1 && rightIndex === -1) {
        return leftKey.localeCompare(rightKey);
      }

      if (leftIndex === -1) {
        return 1;
      }

      if (rightIndex === -1) {
        return -1;
      }

      return leftIndex - rightIndex;
    })
    .map(([key, entry]) => ({
      key,
      label: fieldKeyToLabel(key),
      value: entry.value,
      confidence: entry.confidence,
      source: entry.source,
    }));
}

function extractJsonLd(
  $: cheerio.CheerioAPI,
  fields: FieldMap,
  imageUrls: string[],
  baseUrl: string
): void {
  const scripts = $('script[type="application/ld+json"]');

  scripts.each((_i, el) => {
    try {
      const raw = $(el).html();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        const product = findProduct(item);
        if (!product) continue;

        setField(fields, "name", product.name, "high", "json-ld");
        setField(fields, "description", truncate(product.description, 500), "high", "json-ld");

        const brandName = typeof product.brand === "string"
          ? product.brand
          : product.brand?.name;
        setField(fields, "brand", brandName, "high", "json-ld");

        setField(fields, "sku", product.sku, "high", "json-ld");
        setField(fields, "upc", product.gtin13 ?? product.gtin12 ?? product.gtin, "high", "json-ld");
        setField(fields, "partNumber", product.mpn, "high", "json-ld");
        setField(fields, "model", product.model, "high", "json-ld");
        setField(fields, "color", product.color, "high", "json-ld");
        setField(fields, "material", product.material, "high", "json-ld");
        setField(fields, "weight", product.weight, "high", "json-ld");
        setField(fields, "category", product.category, "high", "json-ld");

        const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
        if (offers) {
          const priceStr = offers.price != null ? String(offers.price) : null;
          const currency = offers.priceCurrency ?? null;
          if (priceStr && currency) {
            setField(fields, "price", `${currencySymbol(currency)}${priceStr}`, "high", "json-ld");
          } else if (priceStr) {
            setField(fields, "price", priceStr, "high", "json-ld");
          }
          setField(fields, "currency", currency, "high", "json-ld");

          if (offers.availability) {
            const avail = String(offers.availability).replace(/^https?:\/\/schema\.org\//, "");
            setField(fields, "availability", avail, "high", "json-ld");
          }
        }

        const agg = product.aggregateRating;
        if (agg) {
          if (agg.ratingValue != null) setField(fields, "rating", String(agg.ratingValue), "high", "json-ld");
          if (agg.reviewCount != null) setField(fields, "reviewCount", String(agg.reviewCount), "high", "json-ld");
        }

        // Images from JSON-LD
        const images = Array.isArray(product.image) ? product.image : product.image ? [product.image] : [];
        for (const img of images) {
          const src = typeof img === "string" ? img : img?.url;
          if (src) {
            const abs = resolveUrl(src, baseUrl);
            if (abs && !imageUrls.includes(abs)) imageUrls.push(abs);
          }
        }
      }

      // Check for BreadcrumbList for category
      for (const item of items) {
        if (item?.["@type"] === "BreadcrumbList" && !fields.has("category")) {
          const elements = item.itemListElement;
          if (Array.isArray(elements) && elements.length > 0) {
            const last = elements[elements.length - 1];
            const catName = last?.name ?? last?.item?.name;
            if (catName) setField(fields, "category", catName, "high", "json-ld");
          }
        }
      }
    } catch {
      // JSON-LD parse failure — continue to next script block
    }
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function findProduct(obj: any): any | null {
  if (!obj || typeof obj !== "object") return null;
  if (obj["@type"] === "Product") return obj;
  if (Array.isArray(obj["@graph"])) {
    for (const node of obj["@graph"]) {
      if (node?.["@type"] === "Product") return node;
    }
  }
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function extractOgAndMeta(
  $: cheerio.CheerioAPI,
  fields: FieldMap,
  imageUrls: string[],
  baseUrl: string
): void {
  const og = (property: string): string | null =>
    $(`meta[property="${property}"]`).attr("content")?.trim() ?? null;
  const metaName = (name: string): string | null =>
    $(`meta[name="${name}"]`).attr("content")?.trim() ?? null;

  // OG tags — confidence: high
  setField(fields, "name", og("og:title"), "high", "og");
  setField(fields, "description", truncate(og("og:description"), 500), "high", "og");

  const ogImage = og("og:image");
  if (ogImage) {
    const abs = resolveUrl(ogImage, baseUrl);
    if (abs && !imageUrls.includes(abs)) imageUrls.push(abs);
  }

  const ogPriceAmount = og("og:price:amount") ?? og("product:price:amount");
  const ogPriceCurrency = og("og:price:currency") ?? og("product:price:currency");
  if (ogPriceAmount) {
    const sym = ogPriceCurrency ? currencySymbol(ogPriceCurrency) : "$";
    setField(fields, "price", `${sym}${ogPriceAmount}`, "high", "og");
  }
  setField(fields, "currency", ogPriceCurrency, "high", "og");
  setField(fields, "brand", og("product:brand"), "high", "og");
  setField(fields, "sku", og("product:retailer_item_id"), "high", "og");

  // Standard meta tags — confidence: medium
  setField(fields, "description", truncate(metaName("description"), 500), "medium", "meta");
  setField(fields, "brand", metaName("brand") ?? metaName("author"), "medium", "meta");
}

function extractHtmlFallbacks(
  $: cheerio.CheerioAPI,
  fields: FieldMap,
  imageUrls: string[],
  baseUrl: string
): void {
  // Title fallback
  if (!fields.has("name")) {
    const title = $("title").first().text().trim();
    if (title) {
      setField(fields, "name", stripTitleSuffix(title), "low", "html");
    }
  }

  // Image fallback
  if (imageUrls.length === 0) {
    const candidates = $(
      '[data-testid*="image"] img, .product-image img, #main-image, img[width]'
    );
    candidates.each((_i, el) => {
      if (imageUrls.length >= 5) return false;
      const src = $(el).attr("src");
      const widthAttr = $(el).attr("width");
      const width = widthAttr ? parseInt(widthAttr, 10) : 0;

      // Only take images with explicit width > 200 or from product image containers
      const parentMatch = $(el).closest('[data-testid*="image"], .product-image').length > 0;
      if ((width > 200 || parentMatch || el.tagName === "img") && src) {
        const abs = resolveUrl(src, baseUrl);
        if (abs && !imageUrls.includes(abs)) imageUrls.push(abs);
      }
    });
  }

  // Price fallback
  if (!fields.has("price")) {
    const priceSelectors = '[data-price], [itemprop="price"], .price, .product-price';
    const priceEl = $(priceSelectors).first();
    const priceText = priceEl.attr("content") ?? priceEl.text().trim();
    const priceMatch = priceText?.match(/\$[\d,]+\.?\d{0,2}/);
    if (priceMatch) {
      setField(fields, "price", priceMatch[0], "low", "html");
    }
  }
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length <= max ? value : value.slice(0, max).trimEnd() + "…";
}

function currencySymbol(code: string): string {
  const symbols: Record<string, string> = { USD: "$", CAD: "C$", GBP: "£", EUR: "€" };
  return symbols[code.toUpperCase()] ?? "";
}

export function normalizeLinkPreviewUrl(value: string): string | null {
  const candidate = extractCandidateUrl(value);

  if (!candidate) {
    return null;
  }

  try {
    const parsed = canonicalizeKnownProductUrl(unwrapRedirectUrl(new URL(withHttpProtocol(candidate))));

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

export async function extractLinkPreview(url: string): Promise<LinkPreviewResponse> {
  const normalizedUrl = normalizeLinkPreviewUrl(url);

  if (!normalizedUrl) {
    throw new Error("Invalid product URL.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const knownFallback = buildKnownRetailerFallback(normalizedUrl);

  let html: string;
  let finalUrl: string;
  let responseStatus = 200;

  try {
    const response = await fetch(normalizedUrl, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });

    responseStatus = response.status;

    html = await response.text();
    finalUrl = response.url;

    const responseRetailer = detectRetailer(new URL(finalUrl).hostname);

    if ((!response.ok || isKnownBlockedRetailerPage(responseRetailer, response.status, html)) && knownFallback) {
      return {
        ...knownFallback,
        url: finalUrl,
        canonicalUrl: finalUrl,
      };
    }

    if (!response.ok) {
      throw new Error(`Fetch returned HTTP ${response.status} for ${normalizedUrl}`);
    }
  } finally {
    clearTimeout(timeout);
  }

  const $ = cheerio.load(html);
  const fields: FieldMap = new Map();
  const imageUrls: string[] = [];
  const parsedUrl = new URL(finalUrl);
  const baseUrl = parsedUrl.origin;
  const bodyText = normalizeBodyText($);

  // Layer 1 — JSON-LD (highest priority)
  try {
    extractJsonLd($, fields, imageUrls, baseUrl);
  } catch (err) {
    console.warn("link-preview: JSON-LD extraction failed", err);
  }

  // Layer 2 — OG + meta tags
  try {
    extractOgAndMeta($, fields, imageUrls, baseUrl);
  } catch (err) {
    console.warn("link-preview: OG/meta extraction failed", err);
  }

  // Layer 3 — HTML heuristic fallbacks
  try {
    extractHtmlFallbacks($, fields, imageUrls, baseUrl);
  } catch (err) {
    console.warn("link-preview: HTML fallback extraction failed", err);
  }

  try {
    extractAmazonSpecificFields($, fields, parsedUrl, bodyText, imageUrls);
  } catch (err) {
    console.warn("link-preview: Amazon extraction failed", err);
  }

  // Build canonical URL
  const canonicalHref = $('link[rel="canonical"]').attr("href") ?? null;
  const canonicalUrl = canonicalHref ? resolveUrl(canonicalHref, baseUrl) : null;

  // Retailer
  const retailer = detectRetailer(parsedUrl.hostname);

  // Raw title
  const rawTitle = $("title").first().text().trim() || null;

  normalizeFieldValues(fields, retailer, rawTitle);

  // Build fields array — only include fields with non-null, non-empty values
  const fieldArray = buildOrderedFieldArray(fields);

  // Deduplicate and limit images
  const uniqueImages = [...new Set(imageUrls)].filter(isLikelyProductImage).slice(0, 5);

  return {
    url: finalUrl,
    canonicalUrl,
    retailer,
    fields: fieldArray,
    imageUrls: uniqueImages,
    rawTitle,
    extractionMode: "full",
    warningMessage: null,
    fetchedAt: new Date().toISOString(),
  };
}
