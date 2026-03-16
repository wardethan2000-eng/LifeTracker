const DEMO_USER_ID = "clkeeperuser0000000000001";
const DEMO_HOUSEHOLD_ID = "clkeeperhouse000000000001";

const webBaseUrl = process.env.BENCHMARK_WEB_URL ?? "http://127.0.0.1:3000";
const apiBaseUrl = process.env.LIFEKEEPER_API_BASE_URL ?? "http://127.0.0.1:4000";

type PageDefinition = {
  label: string;
  path: string;
};

type BenchmarkRun = {
  label: "cold" | "warm1" | "warm2";
  displayValue: string;
  durationMs: number | null;
};

type BenchmarkResult = {
  label: string;
  path: string;
  runs: [BenchmarkRun, BenchmarkRun, BenchmarkRun];
  avgWarmMs: number | null;
};

const buildUrl = (baseUrl: string, path: string): string => new URL(path, baseUrl).toString();

const formatDuration = (durationMs: number): string => durationMs.toFixed(1);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

const extractFirstId = (payload: unknown): string | null => {
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const first = payload[0];

  if (!isRecord(first) || typeof first.id !== "string") {
    return null;
  }

  return first.id;
};

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-dev-user-id": DEMO_USER_ID
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  return response.json();
};

const discoverAssetId = async (): Promise<string | null> => {
  const url = buildUrl(apiBaseUrl, `/v1/assets?householdId=${DEMO_HOUSEHOLD_ID}`);

  try {
    return extractFirstId(await fetchJson(url));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: could not discover an asset ID from ${url}: ${message}`);
    return null;
  }
};

const discoverProjectId = async (): Promise<string | null> => {
  const url = buildUrl(apiBaseUrl, `/v1/households/${DEMO_HOUSEHOLD_ID}/projects`);

  try {
    return extractFirstId(await fetchJson(url));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: could not discover a project ID from ${url}: ${message}`);
    return null;
  }
};

const ensureWebServerReachable = async (): Promise<void> => {
  try {
    const response = await fetch(buildUrl(webBaseUrl, "/"), {
      headers: {
        cookie: `__dev_user_id=${DEMO_USER_ID}`
      }
    });

    await response.text();

    if (!response.ok) {
      throw new Error(`Received status ${response.status}.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Web app is not reachable at ${webBaseUrl}. Run pnpm --filter @lifekeeper/web build && pnpm --filter @lifekeeper/web start first. (${message})`);
    process.exit(1);
  }
};

const benchmarkRequest = async (url: string, runLabel: BenchmarkRun["label"]): Promise<BenchmarkRun> => {
  const start = performance.now();

  try {
    const response = await fetch(url, {
      headers: {
        cookie: `__dev_user_id=${DEMO_USER_ID}`
      }
    });

    await response.text();
    const durationMs = performance.now() - start;

    if (!response.ok) {
      return {
        label: runLabel,
        displayValue: String(response.status),
        durationMs: null
      };
    }

    return {
      label: runLabel,
      displayValue: formatDuration(durationMs),
      durationMs
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: request to ${url} failed during ${runLabel}: ${message}`);
    return {
      label: runLabel,
      displayValue: "ERR",
      durationMs: null
    };
  }
};

const averageWarmRuns = (runs: [BenchmarkRun, BenchmarkRun, BenchmarkRun]): number | null => {
  const warmRuns = [runs[1], runs[2]].filter((run) => run.durationMs !== null);

  if (warmRuns.length === 0) {
    return null;
  }

  const total = warmRuns.reduce((sum, run) => sum + (run.durationMs ?? 0), 0);
  return total / warmRuns.length;
};

const benchmarkPage = async (page: PageDefinition): Promise<BenchmarkResult> => {
  const url = buildUrl(webBaseUrl, page.path);
  const cold = await benchmarkRequest(url, "cold");
  const warm1 = await benchmarkRequest(url, "warm1");
  const warm2 = await benchmarkRequest(url, "warm2");
  const runs: [BenchmarkRun, BenchmarkRun, BenchmarkRun] = [cold, warm1, warm2];

  return {
    label: page.label,
    path: page.path,
    runs,
    avgWarmMs: averageWarmRuns(runs)
  };
};

const printTable = (results: BenchmarkResult[]): void => {
  const headers = {
    page: "Page label",
    cold: "Cold (ms)",
    warm1: "Warm 1 (ms)",
    warm2: "Warm 2 (ms)",
    avgWarm: "Avg Warm (ms)"
  };

  const avgValues = results.map((result) => result.avgWarmMs === null ? "n/a" : formatDuration(result.avgWarmMs));
  const pageWidth = Math.max(headers.page.length, ...results.map((result) => result.label.length));
  const coldWidth = Math.max(headers.cold.length, ...results.map((result) => result.runs[0].displayValue.length));
  const warm1Width = Math.max(headers.warm1.length, ...results.map((result) => result.runs[1].displayValue.length));
  const warm2Width = Math.max(headers.warm2.length, ...results.map((result) => result.runs[2].displayValue.length));
  const avgWarmWidth = Math.max(headers.avgWarm.length, ...avgValues.map((value) => value.length));

  const divider = [
    "-".repeat(pageWidth),
    "-".repeat(coldWidth),
    "-".repeat(warm1Width),
    "-".repeat(warm2Width),
    "-".repeat(avgWarmWidth)
  ].join("  ");

  console.log([
    headers.page.padEnd(pageWidth),
    headers.cold.padStart(coldWidth),
    headers.warm1.padStart(warm1Width),
    headers.warm2.padStart(warm2Width),
    headers.avgWarm.padStart(avgWarmWidth)
  ].join("  "));
  console.log(divider);

  for (const result of results) {
    console.log([
      result.label.padEnd(pageWidth),
      result.runs[0].displayValue.padStart(coldWidth),
      result.runs[1].displayValue.padStart(warm1Width),
      result.runs[2].displayValue.padStart(warm2Width),
      (result.avgWarmMs === null ? "n/a" : formatDuration(result.avgWarmMs)).padStart(avgWarmWidth)
    ].join("  "));
  }
};

const printSummary = (results: BenchmarkResult[]): void => {
  const numericResults = results.filter((result) => result.avgWarmMs !== null);
  const fastest = [...numericResults].sort((left, right) => (left.avgWarmMs ?? Infinity) - (right.avgWarmMs ?? Infinity))[0] ?? null;
  const slowest = [...numericResults].sort((left, right) => (right.avgWarmMs ?? -1) - (left.avgWarmMs ?? -1))[0] ?? null;
  const warningPages = numericResults.filter((result) => (result.avgWarmMs ?? 0) > 1000);
  const criticalPages = numericResults.filter((result) => (result.avgWarmMs ?? 0) > 2000);

  console.log("");
  console.log("Summary");
  console.log(`Total pages benchmarked: ${results.length}`);
  console.log(
    fastest
      ? `Fastest warm average: ${fastest.label} (${formatDuration(fastest.avgWarmMs ?? 0)} ms)`
      : "Fastest warm average: n/a"
  );
  console.log(
    slowest
      ? `Slowest warm average: ${slowest.label} (${formatDuration(slowest.avgWarmMs ?? 0)} ms)`
      : "Slowest warm average: n/a"
  );

  if (warningPages.length > 0) {
    console.log("Pages over 1000ms warm average:");
    for (const result of warningPages) {
      console.log(`WARNING: ${result.label} (${formatDuration(result.avgWarmMs ?? 0)} ms)`);
    }
  } else {
    console.log("Pages over 1000ms warm average: none");
  }

  if (criticalPages.length > 0) {
    console.log("Pages over 2000ms warm average:");
    for (const result of criticalPages) {
      console.log(`CRITICAL: ${result.label} (${formatDuration(result.avgWarmMs ?? 0)} ms)`);
    }
  } else {
    console.log("Pages over 2000ms warm average: none");
  }
};

async function main(): Promise<void> {
  await ensureWebServerReachable();

  const [assetId, projectId] = await Promise.all([
    discoverAssetId(),
    discoverProjectId()
  ]);

  const pages: PageDefinition[] = [
    { label: "Dashboard", path: "/" },
    { label: "Dashboard (with householdId)", path: `/?householdId=${DEMO_HOUSEHOLD_ID}` },
    { label: "Assets list", path: "/assets" },
    { label: "Maintenance queue", path: "/maintenance" },
    { label: "Notifications", path: "/notifications" },
    { label: "Projects list", path: "/projects" },
    { label: "Inventory", path: `/inventory?householdId=${DEMO_HOUSEHOLD_ID}` },
    { label: "Cost analytics", path: "/costs" },
    { label: "Activity log", path: "/activity" },
    { label: "Add asset", path: "/assets/new" }
  ];

  if (assetId) {
    pages.splice(3, 0,
      { label: "Asset detail (overview tab)", path: `/assets/${assetId}` },
      { label: "Asset detail (maintenance tab)", path: `/assets/${assetId}/maintenance` },
      { label: "Asset detail (costs tab)", path: `/assets/${assetId}/costs` },
      { label: "Asset detail (settings tab)", path: `/assets/${assetId}/settings` },
      { label: "Asset detail (metrics tab)", path: `/assets/${assetId}/metrics` },
      { label: "Asset detail (comments tab)", path: `/assets/${assetId}/comments` },
      { label: "Asset detail (history tab)", path: `/assets/${assetId}/history` }
    );
  } else {
    console.warn("Warning: no asset found for the seeded household. Skipping asset detail benchmarks.");
  }

  if (projectId) {
    const inventoryIndex = pages.findIndex((page) => page.label === "Inventory");
    const projectDetailPage = {
      label: "Project detail",
      path: `/projects/${projectId}?householdId=${DEMO_HOUSEHOLD_ID}`
    };

    if (inventoryIndex >= 0) {
      pages.splice(inventoryIndex, 0, projectDetailPage);
    } else {
      pages.push(projectDetailPage);
    }
  } else {
    console.warn("Warning: no project found for the seeded household. Skipping project detail benchmark.");
  }

  console.log(`Benchmarking ${pages.length} pages against ${webBaseUrl}`);
  console.log("");

  const results: BenchmarkResult[] = [];

  for (const page of pages) {
    console.log(`Running ${page.label} (${page.path})`);
    results.push(await benchmarkPage(page));
  }

  const sortedResults = [...results].sort((left, right) => {
    const leftValue = left.avgWarmMs ?? -1;
    const rightValue = right.avgWarmMs ?? -1;
    return rightValue - leftValue;
  });

  console.log("");
  printTable(sortedResults);
  printSummary(sortedResults);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Benchmark failed: ${message}`);
  process.exit(1);
});
