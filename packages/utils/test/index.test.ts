import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aggregateCostsByPeriod,
  bucketUsageRates,
  calculateNextDue,
  calculateScheduleStatus,
  calculateUsageRate,
  computeScheduleForecast,
  projectNextDueValue,
  correlateMetrics,
  detectUsageAnomaly
} from "../src/index.js";

describe("trigger calculations", () => {
  it("calculates interval due dates from the last completion", () => {
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

    expect(due.nextDueAt?.toISOString()).toBe("2026-02-14T00:00:00.000Z");
    expect(due.dueMetricValue).toBeUndefined();
  });

  it("rolls seasonal due dates into the next year when the reference date has passed", () => {
    const due = calculateNextDue(
      {
        type: "seasonal",
        month: 3,
        day: 1,
        leadTimeDays: 14
      },
      {
        referenceDate: new Date("2026-03-17T00:00:00.000Z")
      }
    );

    expect(due.nextDueAt?.toISOString()).toBe("2027-03-01T00:00:00.000Z");
  });

  it("projects next due dates from usage thresholds when the rate is positive", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-17T12:00:00.000Z"));

    const projected = projectNextDueValue(1000, 25, 1500);

    expect(projected?.toISOString()).toBe("2026-04-06T12:00:00.000Z");
    vi.useRealTimers();
  });

  it("returns a stable regression-based usage rate across irregular readings", () => {
    const rate = calculateUsageRate([
      { value: 0, date: new Date("2026-01-01T00:00:00.000Z") },
      { value: 60, date: new Date("2026-01-04T00:00:00.000Z") },
      { value: 140, date: new Date("2026-01-08T00:00:00.000Z") },
      { value: 220, date: new Date("2026-01-12T00:00:00.000Z") }
    ]);

    expect(rate).toBeCloseTo(20, 5);
  });
});

describe("schedule status", () => {
  it("marks whichever-first compound schedules overdue when either threshold is crossed", () => {
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

    expect(status).toBe("overdue");
  });

  it("keeps whichever-last compound schedules upcoming until both thresholds are reached", () => {
    const trigger = {
      type: "compound" as const,
      logic: "whichever_last" as const,
      intervalDays: 180,
      leadTimeDays: 7,
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
        now: new Date("2026-07-01T00:00:00.000Z"),
        currentUsageValue: 10050
      }
    );

    expect(status).toBe("upcoming");
  });
});

describe("cost analytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-17T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aggregates time-based and usage-based schedule costs", () => {
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

    expect(forecast.schedules).toHaveLength(2);
    expect(forecast.schedules.map((item) => ({ id: item.scheduleId, cost12m: item.cost12m }))).toEqual([
      { id: "interval-1", cost12m: 320 },
      { id: "usage-1", cost12m: 300 }
    ]);
    expect(forecast.totals.total12m).toBe(620);
  });

  it("aggregates rolling monthly costs for dashboard analytics", () => {
    const result = aggregateCostsByPeriod([
      { totalCost: 120, completedAt: new Date("2026-01-12T00:00:00.000Z") },
      { totalCost: 30, completedAt: new Date("2026-01-20T00:00:00.000Z") },
      { totalCost: 200, completedAt: new Date("2026-02-03T00:00:00.000Z") }
    ], "month");

    expect(result.periods).toEqual([
      { period: "2026-01", totalCost: 150, logCount: 2 },
      { period: "2026-02", totalCost: 200, logCount: 1 }
    ]);
    expect(result.rolling12MonthAverage).toBe(175);
  });
});

describe("analytics helpers", () => {
  it("flags rate spikes after bucketization", () => {
    const buckets = bucketUsageRates([
      { value: 0, date: new Date("2026-01-05T00:00:00.000Z") },
      { value: 10, date: new Date("2026-01-11T00:00:00.000Z") },
      { value: 10, date: new Date("2026-01-12T00:00:00.000Z") },
      { value: 20, date: new Date("2026-01-18T00:00:00.000Z") },
      { value: 20, date: new Date("2026-01-19T00:00:00.000Z") },
      { value: 60, date: new Date("2026-01-25T00:00:00.000Z") }
    ], "week");
    const anomaly = detectUsageAnomaly(buckets, 1.3);

    expect(anomaly.buckets).toHaveLength(3);
    expect(anomaly.buckets.filter((bucket) => bucket.isAnomaly)).toHaveLength(1);
    expect(anomaly.buckets[2]?.isAnomaly).toBe(true);
  });

  it("returns a strong positive Pearson correlation for aligned metrics", () => {
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

    expect(correlation.correlation).toBeGreaterThan(0.99);
    expect(correlation.divergenceTrend).toBe("stable");
    expect(correlation.ratioSeries.length).toBeGreaterThan(0);
  });
});
