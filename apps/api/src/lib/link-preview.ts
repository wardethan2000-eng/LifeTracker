import * as cheerio from "cheerio";
import type { LinkPreviewField, LinkPreviewResponse } from "@lifekeeper/types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 10_000;

const RETAILER_MAP: Record<string, string> = {
  "amazon.com": "Amazon",
  "amazon.ca": "Amazon",
  "amazon.co.uk": "Amazon",
  "homedepot.com": "Home Depot",
  "lowes.com": "Lowes",
  "autozone.com": "AutoZone",
  "oreillys.com": "O'Reilly Auto Parts",
  "rockauto.com": "RockAuto",
  "walmart.com": "Walmart",
  "harborfreight.com": "Harbor Freight",
  "acehardware.com": "Ace Hardware",
  "tractorsupply.com": "Tractor Supply",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Product Name",
  price: "Price",
  currency: "Currency",
  brand: "Brand / Manufacturer",
  model: "Model",
  partNumber: "Part Number / MPN",
  sku: "SKU",
  upc: "UPC / Barcode",
  description: "Description",
  category: "Category",
  dimensions: "Dimensions",
  weight: "Weight",
  color: "Color / Finish",
  material: "Material",
  availability: "Availability",
  rating: "Rating",
  reviewCount: "Review Count",
};

function fieldKeyToLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
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
    .replace(/\s*[\|\-–—@]\s*(Home Depot|Amazon\.com?|Lowes\.com?|AutoZone|Walmart\.com?|Harbor Freight|Ace Hardware|Tractor Supply|O'Reilly Auto Parts|RockAuto).*$/i, "")
    .trim();
}

function resolveUrl(relative: string, base: string): string | null {
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

type FieldMap = Map<string, { value: string; confidence: LinkPreviewField["confidence"]; source: LinkPreviewField["source"] }>;

function setField(
  fields: FieldMap,
  key: string,
  value: string | null | undefined,
  confidence: LinkPreviewField["confidence"],
  source: LinkPreviewField["source"]
): void {
  if (!value || value.trim() === "") return;
  if (fields.has(key)) return;
  fields.set(key, { value: value.trim(), confidence, source });
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

export async function extractLinkPreview(url: string): Promise<LinkPreviewResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  let finalUrl: string;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`Fetch returned HTTP ${response.status} for ${url}`);
    }

    html = await response.text();
    finalUrl = response.url;
  } finally {
    clearTimeout(timeout);
  }

  const $ = cheerio.load(html);
  const fields: FieldMap = new Map();
  const imageUrls: string[] = [];
  const parsedUrl = new URL(finalUrl);
  const baseUrl = parsedUrl.origin;

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

  // Build canonical URL
  const canonicalHref = $('link[rel="canonical"]').attr("href") ?? null;
  const canonicalUrl = canonicalHref ? resolveUrl(canonicalHref, baseUrl) : null;

  // Retailer
  const retailer = detectRetailer(parsedUrl.hostname);

  // Raw title
  const rawTitle = $("title").first().text().trim() || null;

  // Build fields array — only include fields with non-null, non-empty values
  const fieldArray: LinkPreviewField[] = [];
  for (const [key, entry] of fields) {
    if (entry.value) {
      fieldArray.push({
        key,
        label: fieldKeyToLabel(key),
        value: entry.value,
        confidence: entry.confidence,
        source: entry.source,
      });
    }
  }

  // Deduplicate and limit images
  const uniqueImages = [...new Set(imageUrls)].slice(0, 5);

  return {
    url,
    canonicalUrl,
    retailer,
    fields: fieldArray,
    imageUrls: uniqueImages,
    rawTitle,
    fetchedAt: new Date().toISOString(),
  };
}
