import {
  assetDetailResponseSchema,
  assetSchema,
  barcodeLookupResultSchema,
  devFixtureIds,
  type Asset,
  type AssetDetailResponse,
  type BarcodeLookupResult
} from "@lifekeeper/types";

type Schema<T> = {
  parse: (value: unknown) => T;
};

export class MobileApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MobileApiError";
  }
}

const apiBaseUrl = (
  process.env.EXPO_PUBLIC_LIFEKEEPER_API_BASE_URL?.trim()
  || process.env.EXPO_PUBLIC_API_BASE_URL?.trim()
  || "http://127.0.0.1:4000"
).replace(/\/+$/, "");

const devUserId = process.env.EXPO_PUBLIC_LIFEKEEPER_DEV_USER_ID?.trim()
  || process.env.EXPO_PUBLIC_DEV_USER_ID?.trim()
  || devFixtureIds.ownerUserId;

const parseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const request = async <T>(path: string, schema: Schema<T>, options?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options?.method ?? "GET",
      headers: {
        "content-type": "application/json",
        "x-dev-user-id": devUserId
      },
      ...(options?.body === undefined ? {} : { body: JSON.stringify(options.body) })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error.";
    throw new MobileApiError(`Unable to reach the API at ${apiBaseUrl}. ${message}`, 503);
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Request failed with status ${response.status}.`;

    throw new MobileApiError(message, response.status);
  }

  return schema.parse(payload);
};

export const lookupAssetByTagMobile = async (tag: string): Promise<Asset> => {
  const query = new URLSearchParams({ tag });
  return request(`/v1/assets/lookup?${query.toString()}`, assetSchema);
};

export const getAssetDetailMobile = async (assetId: string): Promise<AssetDetailResponse> => request(
  `/v1/assets/${assetId}`,
  assetDetailResponseSchema
);

export const lookupBarcodeMobile = async (barcode: string, barcodeFormat?: string): Promise<BarcodeLookupResult> => request(
  "/v1/barcode/lookup",
  barcodeLookupResultSchema,
  {
    method: "POST",
    body: {
      barcode,
      ...(barcodeFormat ? { barcodeFormat } : {})
    }
  }
);