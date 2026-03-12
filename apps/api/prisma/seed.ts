import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const ownerUserId = "clkeeperuser0000000000001";
const memberUserId = "clkeeperuser0000000000002";
const householdId = "clkeeperhouse000000000001";
const assetId = "clkeeperasset0000000000001";
const personalAssetId = "clkeeperasset0000000000002";
const usageMetricId = "clkeepermetric000000000001";
const maintenanceScheduleId = "clkeeperschedule000000001";
const overdueScheduleId = "clkeeperschedule000000002";
const maintenanceLogId = "clkeeperlog00000000000001";
const presetProfileId = "clkeeperpreset000000000001";
const serviceProviderId = "clkeeperprovider0000000001";
const projectId = "clkeeperproject0000000001";
const invitationId = "clkeeperinvite00000000001";

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { clerkUserId: "dev_clerk_user_primary" },
    update: {
      email: "demo@lifekeeper.app",
      displayName: "LifeKeeper Demo",
      notificationPreferences: {
        pauseAll: false,
        enabledChannels: ["push", "digest"],
        preferDigest: false
      }
    },
    create: {
      id: ownerUserId,
      clerkUserId: "dev_clerk_user_primary",
      email: "demo@lifekeeper.app",
      displayName: "LifeKeeper Demo",
      notificationPreferences: {
        pauseAll: false,
        enabledChannels: ["push", "digest"],
        preferDigest: false
      }
    }
  });

  await prisma.user.upsert({
    where: { clerkUserId: "dev_clerk_user_member" },
    update: {
      email: "member@lifekeeper.app",
      displayName: "Household Member",
      notificationPreferences: {
        pauseAll: false,
        enabledChannels: ["push"],
        preferDigest: false
      }
    },
    create: {
      id: memberUserId,
      clerkUserId: "dev_clerk_user_member",
      email: "member@lifekeeper.app",
      displayName: "Household Member",
      notificationPreferences: {
        pauseAll: false,
        enabledChannels: ["push"],
        preferDigest: false
      }
    }
  });

  await prisma.household.upsert({
    where: { id: householdId },
    update: {
      name: "Demo Household",
      createdById: ownerUserId
    },
    create: {
      id: householdId,
      name: "Demo Household",
      createdById: ownerUserId
    }
  });

  await prisma.householdMember.upsert({
    where: {
      householdId_userId: {
        householdId,
        userId: ownerUserId
      }
    },
    update: {
      role: "owner"
    },
    create: {
      householdId,
      userId: ownerUserId,
      role: "owner"
    }
  });

  await prisma.householdMember.upsert({
    where: {
      householdId_userId: {
        householdId,
        userId: memberUserId
      }
    },
    update: {
      role: "member"
    },
    create: {
      householdId,
      userId: memberUserId,
      role: "member"
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
      createdById: ownerUserId,
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

  await prisma.asset.upsert({
    where: { id: personalAssetId },
    update: {
      name: "Private Workshop Printer",
      category: "workshop",
      visibility: "personal",
      description: "Seeded private asset for access-control verification",
      createdById: ownerUserId
    },
    create: {
      id: personalAssetId,
      householdId,
      createdById: ownerUserId,
      name: "Private Workshop Printer",
      category: "workshop",
      visibility: "personal",
      description: "Seeded private asset for access-control verification",
      manufacturer: "Prusa",
      model: "MK4",
      customFields: {
        nozzle: "0.4mm",
        enclosure: true
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

  await prisma.maintenanceSchedule.upsert({
    where: { id: overdueScheduleId },
    update: {
      triggerType: "interval",
      triggerConfig: {
        type: "interval",
        intervalDays: 90,
        leadTimeDays: 10
      },
      notificationConfig: {
        channels: ["push"],
        sendAtDue: true,
        digest: false,
        upcomingLeadDays: 10,
        overdueCadenceDays: 7,
        maxOverdueNotifications: 3
      },
      lastCompletedAt: new Date("2025-11-15T00:00:00.000Z"),
      nextDueAt: new Date("2026-02-13T00:00:00.000Z"),
      nextDueMetricValue: null
    },
    create: {
      id: overdueScheduleId,
      assetId,
      name: "Rotate tires",
      triggerType: "interval",
      triggerConfig: {
        type: "interval",
        intervalDays: 90,
        leadTimeDays: 10
      },
      notificationConfig: {
        channels: ["push"],
        sendAtDue: true,
        digest: false,
        upcomingLeadDays: 10,
        overdueCadenceDays: 7,
        maxOverdueNotifications: 3
      },
      lastCompletedAt: new Date("2025-11-15T00:00:00.000Z"),
      nextDueAt: new Date("2026-02-13T00:00:00.000Z"),
      nextDueMetricValue: null
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
      createdById: ownerUserId,
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
      completedById: ownerUserId,
      title: "Engine oil and filter",
      completedAt: new Date("2026-03-09T00:00:00.000Z"),
      usageValue: 42500,
      metadata: {
        source: "seed"
      }
    }
  });

  // ── Tier 2: Service Provider ──────────────────────────────────────────────
  await prisma.serviceProvider.upsert({
    where: { id: serviceProviderId },
    update: {
      name: "Quick Lube Express",
      specialty: "oil change",
      phone: "555-0100",
      rating: 4
    },
    create: {
      id: serviceProviderId,
      householdId,
      name: "Quick Lube Express",
      specialty: "oil change",
      phone: "555-0100",
      email: "service@quicklube.example",
      rating: 4,
      notes: "Fast service, open on weekends"
    }
  });

  // ── Tier 2: Maintenance Log Part ──────────────────────────────────────────
  await prisma.maintenanceLogPart.deleteMany({
    where: { logId: maintenanceLogId }
  });
  await prisma.maintenanceLogPart.create({
    data: {
      logId: maintenanceLogId,
      name: "Motorcraft FL-500S Oil Filter",
      partNumber: "FL-500S",
      quantity: 1,
      unitCost: 8.97,
      supplier: "AutoZone"
    }
  });

  // ── Tier 2: Project ───────────────────────────────────────────────────────
  await prisma.project.upsert({
    where: { id: projectId },
    update: {
      name: "Spring Vehicle Maintenance",
      status: "active"
    },
    create: {
      id: projectId,
      householdId,
      name: "Spring Vehicle Maintenance",
      description: "Complete set of spring maintenance tasks for 2026",
      status: "active",
      budgetAmount: 800,
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      targetEndDate: new Date("2026-04-30T00:00:00.000Z")
    }
  });

  // Link the primary vehicle asset to the project
  await prisma.projectAsset.upsert({
    where: {
      projectId_assetId: { projectId, assetId }
    },
    update: {},
    create: {
      projectId,
      assetId
    }
  });

  // Project tasks
  const taskIds = [
    "clkeepertask00000000000001",
    "clkeepertask00000000000002",
    "clkeepertask00000000000003"
  ];
  const tasks = [
    { id: taskIds[0], title: "Oil change", description: "Full synthetic 5W-30", status: "completed" as const, assignedToId: memberUserId },
    { id: taskIds[1], title: "Brake inspection", description: "Check pads and rotors", status: "in_progress" as const, assignedToId: ownerUserId },
    { id: taskIds[2], title: "Cabin air filter", description: "Replace cabin filter", status: "not_started" as const, assignedToId: null }
  ];

  for (const task of tasks) {
    await prisma.projectTask.upsert({
      where: { id: task.id! },
      update: {
        title: task.title,
        status: task.status,
        assignedToId: task.assignedToId
      },
      create: {
        id: task.id!,
        projectId,
        title: task.title,
        description: task.description,
        status: task.status,
        assignedToId: task.assignedToId
      }
    });
  }

  // Project expenses
  const expenseIds = [
    "clkeeperexpense000000000001",
    "clkeeperexpense000000000002"
  ];
  await prisma.projectExpense.upsert({
    where: { id: expenseIds[0]! },
    update: { amount: 65.0 },
    create: {
      id: expenseIds[0]!,
      projectId,
      description: "Oil change supplies",
      amount: 65.0,
      date: new Date("2026-03-10T00:00:00.000Z"),
      serviceProviderId
    }
  });
  await prisma.projectExpense.upsert({
    where: { id: expenseIds[1]! },
    update: { amount: 12.99 },
    create: {
      id: expenseIds[1]!,
      projectId,
      description: "Cabin air filter",
      amount: 12.99,
      date: new Date("2026-03-11T00:00:00.000Z")
    }
  });

  // ── Tier 2: Household Invitation ──────────────────────────────────────────
  await prisma.householdInvitation.upsert({
    where: { id: invitationId },
    update: { status: "pending" },
    create: {
      id: invitationId,
      householdId,
      invitedByUserId: ownerUserId,
      email: "invited@lifekeeper.app",
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "pending"
    }
  });

  // ── Tier 2: Activity Log Entries ──────────────────────────────────────────
  // Seed a few representative activity log entries
  await prisma.activityLog.deleteMany({ where: { householdId } });
  const activityEntries = [
    { action: "asset.created", entityType: "asset", entityId: assetId, userId: ownerUserId, metadata: { name: "Primary Vehicle" } },
    { action: "schedule.created", entityType: "schedule", entityId: maintenanceScheduleId, userId: ownerUserId, metadata: { name: "Engine oil and filter" } },
    { action: "project.created", entityType: "project", entityId: projectId, userId: ownerUserId, metadata: { name: "Spring Vehicle Maintenance" } },
    { action: "member.invited", entityType: "household", entityId: householdId, userId: ownerUserId, metadata: { email: "invited@lifekeeper.app" } }
  ];
  for (const entry of activityEntries) {
    await prisma.activityLog.create({
      data: {
        householdId,
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata
      }
    });
  }

  // ── Tier 2: Task Assignment on schedule ───────────────────────────────────
  await prisma.maintenanceSchedule.update({
    where: { id: maintenanceScheduleId },
    data: { assignedToId: memberUserId }
  });

  // ── Tier 2: Comments ──────────────────────────────────────────────────────
  await prisma.comment.deleteMany({ where: { assetId } });
  const rootComment = await prisma.comment.create({
    data: {
      assetId,
      authorId: ownerUserId,
      body: "The oil light flickered briefly last week — worth watching."
    }
  });
  await prisma.comment.create({
    data: {
      assetId,
      authorId: memberUserId,
      parentCommentId: rootComment.id,
      body: "I noticed that too. It might just be the sensor, but let's check the level after the next oil change."
    }
  });

  console.log(JSON.stringify({
    ownerUserId,
    memberUserId,
    householdId,
    sharedAssetId: assetId,
    personalAssetId,
    overdueScheduleId,
    serviceProviderId,
    projectId,
    invitationId
  }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
