import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const userId = "clkeeperuser0000000000001";
const householdId = "clkeeperhouse000000000001";
const assetId = "clkeeperasset0000000000001";
const usageMetricId = "clkeepermetric000000000001";
const maintenanceScheduleId = "clkeeperschedule000000001";
const maintenanceLogId = "clkeeperlog00000000000001";
const presetProfileId = "clkeeperpreset000000000001";

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { clerkUserId: "dev_clerk_user_primary" },
    update: {
      email: "demo@lifekeeper.app",
      displayName: "LifeKeeper Demo"
    },
    create: {
      id: userId,
      clerkUserId: "dev_clerk_user_primary",
      email: "demo@lifekeeper.app",
      displayName: "LifeKeeper Demo"
    }
  });

  await prisma.household.upsert({
    where: { id: householdId },
    update: {
      name: "Demo Household",
      createdById: userId
    },
    create: {
      id: householdId,
      name: "Demo Household",
      createdById: userId
    }
  });

  await prisma.householdMember.upsert({
    where: {
      householdId_userId: {
        householdId,
        userId
      }
    },
    update: {
      role: "owner"
    },
    create: {
      householdId,
      userId,
      role: "owner"
    }
  });

  await prisma.asset.upsert({
    where: { id: assetId },
    update: {
      name: "Primary Vehicle",
      category: "vehicle",
      visibility: "shared",
      description: "Seeded demo asset for API verification"
    },
    create: {
      id: assetId,
      householdId,
      createdById: userId,
      name: "Primary Vehicle",
      category: "vehicle",
      visibility: "shared",
      description: "Seeded demo asset for API verification",
      manufacturer: "Ford",
      model: "F-150",
      customFields: {
        engine: "3.5L EcoBoost",
        odometer: 42500
      }
    }
  });

  await prisma.usageMetric.upsert({
    where: { id: usageMetricId },
    update: {
      currentValue: 42500,
      lastRecordedAt: new Date("2026-03-09T00:00:00.000Z")
    },
    create: {
      id: usageMetricId,
      assetId,
      name: "Odometer",
      unit: "miles",
      currentValue: 42500,
      lastRecordedAt: new Date("2026-03-09T00:00:00.000Z")
    }
  });

  await prisma.maintenanceSchedule.upsert({
    where: { id: maintenanceScheduleId },
    update: {
      metricId: usageMetricId,
      triggerType: "compound",
      triggerConfig: {
        type: "compound",
        intervalDays: 180,
        metricId: usageMetricId,
        intervalValue: 5000,
        logic: "whichever_first",
        leadTimeDays: 14,
        leadTimeValue: 250
      },
      notificationConfig: {
        channels: ["push", "digest"],
        sendAtDue: true,
        digest: true,
        upcomingLeadDays: 14,
        upcomingLeadValue: 250,
        overdueCadenceDays: 14,
        maxOverdueNotifications: 4
      },
      nextDueAt: new Date("2026-09-05T00:00:00.000Z"),
      nextDueMetricValue: 47500
    },
    create: {
      id: maintenanceScheduleId,
      assetId,
      metricId: usageMetricId,
      name: "Engine oil and filter",
      triggerType: "compound",
      triggerConfig: {
        type: "compound",
        intervalDays: 180,
        metricId: usageMetricId,
        intervalValue: 5000,
        logic: "whichever_first",
        leadTimeDays: 14,
        leadTimeValue: 250
      },
      notificationConfig: {
        channels: ["push", "digest"],
        sendAtDue: true,
        digest: true,
        upcomingLeadDays: 14,
        upcomingLeadValue: 250,
        overdueCadenceDays: 14,
        maxOverdueNotifications: 4
      },
      nextDueAt: new Date("2026-09-05T00:00:00.000Z"),
      nextDueMetricValue: 47500
    }
  });

  await prisma.presetProfile.upsert({
    where: {
      householdId_key: {
        householdId,
        key: "vehicle-owner-core"
      }
    },
    update: {
      name: "Vehicle Owner Core",
      description: "A user-defined household preset focused on the most common ownership tasks.",
      tags: ["vehicle", "custom"],
      customFieldTemplates: [
        { key: "insuranceProvider", label: "Insurance Provider", type: "string", required: false },
        { key: "preferredShop", label: "Preferred Shop", type: "string", required: false }
      ],
      metricTemplates: [
        { key: "odometer", name: "Odometer", unit: "miles", startingValue: 0, allowManualEntry: true }
      ],
      scheduleTemplates: [
        {
          key: "oil_change",
          name: "Oil and filter",
          triggerTemplate: {
            type: "compound",
            intervalDays: 180,
            metricKey: "odometer",
            intervalValue: 5000,
            logic: "whichever_first",
            leadTimeDays: 14,
            leadTimeValue: 250
          },
          notificationConfig: {
            channels: ["push", "digest"],
            sendAtDue: true,
            digest: true,
            upcomingLeadDays: 14,
            upcomingLeadValue: 250,
            overdueCadenceDays: 14,
            maxOverdueNotifications: 4
          },
          tags: ["oil"]
        }
      ]
    },
    create: {
      id: presetProfileId,
      householdId,
      createdById: userId,
      key: "vehicle-owner-core",
      name: "Vehicle Owner Core",
      category: "vehicle",
      description: "A user-defined household preset focused on the most common ownership tasks.",
      tags: ["vehicle", "custom"],
      customFieldTemplates: [
        { key: "insuranceProvider", label: "Insurance Provider", type: "string", required: false },
        { key: "preferredShop", label: "Preferred Shop", type: "string", required: false }
      ],
      metricTemplates: [
        { key: "odometer", name: "Odometer", unit: "miles", startingValue: 0, allowManualEntry: true }
      ],
      scheduleTemplates: [
        {
          key: "oil_change",
          name: "Oil and filter",
          triggerTemplate: {
            type: "compound",
            intervalDays: 180,
            metricKey: "odometer",
            intervalValue: 5000,
            logic: "whichever_first",
            leadTimeDays: 14,
            leadTimeValue: 250
          },
          notificationConfig: {
            channels: ["push", "digest"],
            sendAtDue: true,
            digest: true,
            upcomingLeadDays: 14,
            upcomingLeadValue: 250,
            overdueCadenceDays: 14,
            maxOverdueNotifications: 4
          },
          tags: ["oil"]
        }
      ]
    }
  });

  await prisma.maintenanceLog.upsert({
    where: { id: maintenanceLogId },
    update: {
      title: "Engine oil and filter",
      completedAt: new Date("2026-03-09T00:00:00.000Z"),
      usageValue: 42500,
      metadata: {
        source: "seed"
      }
    },
    create: {
      id: maintenanceLogId,
      assetId,
      scheduleId: maintenanceScheduleId,
      completedById: userId,
      title: "Engine oil and filter",
      completedAt: new Date("2026-03-09T00:00:00.000Z"),
      usageValue: 42500,
      metadata: {
        source: "seed"
      }
    }
  });

  console.log(JSON.stringify({ userId, householdId }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
