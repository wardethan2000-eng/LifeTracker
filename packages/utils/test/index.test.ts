import assert from "node:assert/strict";
import test from "node:test";
import {
  bucketUsageRates,
  calculateNextDue,
  calculateScheduleStatus,
  computeScheduleForecast,
  correlateMetrics,
  detectUsageAnomaly
} from "../src/index.js";

test("calculateNextDue computes interval dates from the last completion", () => {
  const due = calculateNextDue(
    {
      type: "interval",
      intervalDays: 30,
      leadTimeDays: 5
    },
    {
      lastCompletedAt: new Date("2026-01-15T00:00:00.000Z")
    }
  );

  assert.equal(due.nextDueAt?.toISOString(), "2026-02-14T00:00:00.000Z");
  assert.equal(due.dueMetricValue, undefined);
});

test("calculateScheduleStatus marks whichever-first compound schedules overdue when either threshold is crossed", () => {
  const trigger = {
    type: "compound" as const,
    logic: "whichever_first" as const,
    intervalDays: 180,
    leadTimeDays: 14,
    metricId: "metric-1",
    intervalValue: 5000,
    leadTimeValue: 250
  };

  const status = calculateScheduleStatus(
    trigger,
    {
      nextDueAt: new Date("2026-08-01T00:00:00.000Z"),
      dueMetricValue: 10000
    },
    {
      now: new Date("2026-06-01T00:00:00.000Z"),
      currentUsageValue: 10001
    }
  );

  assert.equal(status, "overdue");
});

test("computeScheduleForecast aggregates time-based and usage-based schedule costs", () => {
  const forecast = computeScheduleForecast([
    {
      scheduleId: "interval-1",
      scheduleName: "Oil change",
      estimatedCost: 80,
      historicalAverageCost: null,
      nextDueAt: new Date("2026-04-01T00:00:00.000Z"),
      nextDueMetricValue: null,
      ratePerDay: null,
      triggerType: "interval",
      intervalDays: 90
    },
    {
      scheduleId: "usage-1",
      scheduleName: "Filter replacement",
      estimatedCost: null,
      historicalAverageCost: 50,
      nextDueAt: null,
      nextDueMetricValue: 1200,
      ratePerDay: 20,
      triggerType: "usage",
      intervalDays: null
    }
  ]);

  assert.equal(forecast.schedules.length, 2);
  assert.deepEqual(
    forecast.schedules.map((item) => ({ id: item.scheduleId, cost12m: item.cost12m })),
    [
      { id: "interval-1", cost12m: 320 },
      { id: "usage-1", cost12m: 300 }
    ]
  );
  assert.equal(forecast.totals.total12m, 620);
});

test("detectUsageAnomaly flags rate spikes after bucketization", () => {
  const buckets = bucketUsageRates([
    { value: 0, date: new Date("2026-01-05T00:00:00.000Z") },
    { value: 10, date: new Date("2026-01-11T00:00:00.000Z") },
    { value: 10, date: new Date("2026-01-12T00:00:00.000Z") },
    { value: 20, date: new Date("2026-01-18T00:00:00.000Z") },
    { value: 20, date: new Date("2026-01-19T00:00:00.000Z") },
    { value: 60, date: new Date("2026-01-25T00:00:00.000Z") }
  ], "week");
  const anomaly = detectUsageAnomaly(buckets, 1.3);

  assert.equal(anomaly.buckets.length, 3);
  assert.equal(anomaly.buckets.filter((bucket) => bucket.isAnomaly).length, 1);
  assert.equal(anomaly.buckets[2]?.isAnomaly, true);
});

test("correlateMetrics returns a strong positive Pearson correlation for aligned metrics", () => {
  const correlation = correlateMetrics(
    [
      { value: 100, date: new Date("2026-01-01T00:00:00.000Z") },
      { value: 120, date: new Date("2026-01-08T00:00:00.000Z") },
      { value: 140, date: new Date("2026-01-15T00:00:00.000Z") },
      { value: 160, date: new Date("2026-01-22T00:00:00.000Z") }
    ],
    [
      { value: 10, date: new Date("2026-01-01T00:00:00.000Z") },
      { value: 12, date: new Date("2026-01-08T00:00:00.000Z") },
      { value: 14, date: new Date("2026-01-15T00:00:00.000Z") },
      { value: 16, date: new Date("2026-01-22T00:00:00.000Z") }
    ]
  );

  assert.ok(correlation.correlation > 0.99);
  assert.equal(correlation.divergenceTrend, "stable");
  assert.ok(correlation.ratioSeries.length > 0);
});
