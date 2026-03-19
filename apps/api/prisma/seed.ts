import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { devFixtureIds } from "@lifekeeper/types";
import { nanoid } from "nanoid";
import { rebuildSearchIndex } from "../src/lib/search-index.js";

const prisma = new PrismaClient();

const ownerUserId = devFixtureIds.ownerUserId;
const memberUserId = devFixtureIds.memberUserId;
const householdId = devFixtureIds.householdId;
const assetId = "clkeeperasset0000000000001";
const personalAssetId = "clkeeperasset0000000000002";
const childAssetId = "clkeeperasset0000000000003";
const homeAssetId = "clkeeperasset0000000000004";
const usageMetricId = "clkeepermetric000000000001";
const maintenanceScheduleId = "clkeeperschedule000000001";
const overdueScheduleId = "clkeeperschedule000000002";
const maintenanceLogId = "clkeeperlog00000000000001";
const maintenanceLogFollowUpId = "clkeeperlog00000000000002";
const maintenanceLogHistoryOilSpringId = "clkeeperlog00000000000003";
const maintenanceLogHistoryOilFallId = "clkeeperlog00000000000004";
const maintenanceLogHistoryTireSummerId = "clkeeperlog00000000000005";
const maintenanceLogHistoryTireWinterId = "clkeeperlog00000000000006";
const timelineEntryRustSpotId = "clkeepertimeline00000001";
const timelineEntryStormFenceId = "clkeepertimeline00000002";
const timelineEntryCeramicCoatId = "clkeepertimeline00000003";
const timelineEntryTaxAssessmentId = "clkeepertimeline00000004";
const timelineEntryWinterizeId = "clkeepertimeline00000005";
const timelineEntryWeatherStripId = "clkeepertimeline00000006";
const timelineEntryPanelInspectId = "clkeepertimeline00000007";
const presetProfileId = "clkeeperpreset000000000001";
const serviceProviderId = "clkeeperprovider0000000001";
const renovationProviderId = "clkeeperprovider0000000002";
const projectId = "clkeeperproject0000000001";
const invitationId = "clkeeperinvite00000000001";
const acceptedInvitationId = "clkeeperinvite00000000002";
const inventoryItemOilFilterId = "clkeeperinventory000000001";
const inventoryItemOilId = "clkeeperinventory000000002";
const inventoryItemCabinFilterId = "clkeeperinventory000000003";
const inventoryItemWheelWeightId = "clkeeperinventory000000004";
const inventoryItemShopTowelId = "clkeeperinventory000000005";
const inventoryItemRosinPaperId = "clkeeperinventory000000006";
const inventoryItemPainterTapeId = "clkeeperinventory000000007";
const inventoryItemMultimeterId = "clkeeperinventory000000008";
const inventoryItemDrillId = "clkeeperinventory000000009";
const phasePlanningId = "clkeeperphase000000000001";
const phaseDemolitionId = "clkeeperphase000000000002";
const phaseInstallationId = "clkeeperphase000000000003";
const budgetDesignId = "clkeeperbudget00000000001";
const budgetCabinetryId = "clkeeperbudget00000000002";
const budgetElectricalId = "clkeeperbudget00000000003";
const supplyProtectionId = "clkeepersupply00000000001";
const supplyCabinetHardwareId = "clkeepersupply00000000002";
const supplyPendantLightsId = "clkeepersupply00000000003";

const subProjectId = "clkeepersubproj000000000001";

// Hobby seed IDs
const hobbyId = "clkeeperhobby000000000001";
const hobbyRecipeApaId = "clkeeperrecipe00000000001";
const hobbyRecipeStoutId = "clkeeperrecipe00000000002";
const hobbySessionBatch1Id = "clkeepersession0000000001";
const hobbySessionBatch2Id = "clkeepersession0000000002";
const hobbySessionBatch3Id = "clkeepersession0000000003";
const hobbyMetricOgId = "clkeeperhmetric0000000001";
const hobbyMetricFgId = "clkeeperhmetric0000000002";
const hobbyMetricPhId = "clkeeperhmetric0000000003";
const hobbyMetricFermTempId = "clkeeperhmetric0000000004";
const hobbyMetricBatchVolId = "clkeeperhmetric0000000005";
const hobbyMetricPreBoilId = "clkeeperhmetric0000000006";
const hobbyMetricMashTempId = "clkeeperhmetric0000000007";
const hobbyPipelinePlannedId = "clkeeperpipeline000000001";
const hobbyPipelineBrewDayId = "clkeeperpipeline000000002";
const hobbyPipelinePrimaryId = "clkeeperpipeline000000003";
const hobbyPipelineSecondaryId = "clkeeperpipeline000000004";
const hobbyPipelineCarbId = "clkeeperpipeline000000005";
const hobbyPipelineCondId = "clkeeperpipeline000000006";
const hobbyPipelinePackageId = "clkeeperpipeline000000007";
const hobbyPipelineTastingId = "clkeeperpipeline000000008";
const hobbyPipelineCompletedId = "clkeeperpipeline000000009";
const hobbyInvPaleMaltId = "clkeeperinventory000000010";
const hobbyInvCascadeHopsId = "clkeeperinventory000000011";
const hobbyInvUs05YeastId = "clkeeperinventory000000012";
const hobbyInvCrystal40Id = "clkeeperinventory000000013";
const hobbyInvIrishMossId = "clkeeperinventory000000014";
const hobbyInvStarSanId = "clkeeperinventory000000015";
const hobbyInvPrimingSugarId = "clkeeperinventory000000016";
const hobbyInvFlakedOatsId = "clkeeperinventory000000017";

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
      assetTag: "LK-00000001",
      name: "Primary Vehicle",
      category: "vehicle",
      visibility: "shared",
      description: "Seeded demo asset for API verification",
      purchaseDetails: {
        price: 36500,
        vendor: "Northside Ford",
        condition: "used",
        financing: "60-month auto loan",
        receiptRef: "receipt://vehicle/purchase/2024-03"
      },
      warrantyDetails: {
        provider: "Ford Protect",
        policyNumber: "FORD-ESP-2024-001",
        startDate: "2024-03-01T00:00:00.000Z",
        endDate: "2029-03-01T00:00:00.000Z",
        coverageType: "powertrain",
        notes: "Seeded extended warranty"
      }
    },
    create: {
      id: assetId,
      assetTag: "LK-00000001",
      householdId,
      createdById: ownerUserId,
      ownerId: ownerUserId,
      name: "Primary Vehicle",
      category: "vehicle",
      visibility: "shared",
      description: "Seeded demo asset for API verification",
      manufacturer: "Ford",
      model: "F-150",
      purchaseDetails: {
        price: 36500,
        vendor: "Northside Ford",
        condition: "used",
        financing: "60-month auto loan",
        receiptRef: "receipt://vehicle/purchase/2024-03"
      },
      warrantyDetails: {
        provider: "Ford Protect",
        policyNumber: "FORD-ESP-2024-001",
        startDate: "2024-03-01T00:00:00.000Z",
        endDate: "2029-03-01T00:00:00.000Z",
        coverageType: "powertrain",
        notes: "Seeded extended warranty"
      },
      customFields: {
        engine: "3.5L EcoBoost",
        odometer: 42500
      }
    }
  });

  await prisma.asset.upsert({
    where: { id: personalAssetId },
    update: {
      assetTag: "LK-00000002",
      name: "Private Workshop Printer",
      category: "workshop",
      visibility: "personal",
      description: "Seeded private asset for access-control verification",
      createdById: ownerUserId
    },
    create: {
      id: personalAssetId,
      assetTag: "LK-00000002",
      householdId,
      createdById: ownerUserId,
      ownerId: ownerUserId,
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

  await prisma.asset.upsert({
    where: { id: childAssetId },
    update: {
      assetTag: "LK-00000003",
      householdId,
      createdById: ownerUserId,
      parentAssetId: assetId,
      name: "Primary Vehicle Battery",
      category: "vehicle",
      visibility: "shared",
      description: "Seeded child asset for hierarchy verification",
      manufacturer: "Motorcraft",
      model: "AGM-48"
    },
    create: {
      id: childAssetId,
      assetTag: "LK-00000003",
      householdId,
      createdById: ownerUserId,
      ownerId: ownerUserId,
      parentAssetId: assetId,
      name: "Primary Vehicle Battery",
      category: "vehicle",
      visibility: "shared",
      description: "Seeded child asset for hierarchy verification",
      manufacturer: "Motorcraft",
      model: "AGM-48",
      customFields: {
        coldCrankingAmps: 760
      }
    }
  });

  await prisma.asset.upsert({
    where: { id: homeAssetId },
    update: {
      assetTag: "LK-00000004",
      householdId,
      createdById: ownerUserId,
      ownerId: ownerUserId,
      name: "Main Floor Kitchen",
      category: "home",
      visibility: "shared",
      description: "Seeded shared home asset used for project planning and phased renovation demos",
      manufacturer: "Builder Grade",
      model: "2012 Layout",
      locationDetails: {
        zone: "Main floor",
        room: "Kitchen",
        notes: "Open-concept kitchen with peninsula and pantry wall"
      },
      customFields: {
        squareFeet: 210,
        currentPainPoints: ["poor lighting", "worn laminate counters", "limited drawer storage"]
      }
    },
    create: {
      id: homeAssetId,
      assetTag: "LK-00000004",
      householdId,
      createdById: ownerUserId,
      ownerId: ownerUserId,
      name: "Main Floor Kitchen",
      category: "home",
      visibility: "shared",
      description: "Seeded shared home asset used for project planning and phased renovation demos",
      manufacturer: "Builder Grade",
      model: "2012 Layout",
      locationDetails: {
        zone: "Main floor",
        room: "Kitchen",
        notes: "Open-concept kitchen with peninsula and pantry wall"
      },
      customFields: {
        squareFeet: 210,
        currentPainPoints: ["poor lighting", "worn laminate counters", "limited drawer storage"]
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

  await prisma.usageMetricEntry.deleteMany({
    where: { metricId: usageMetricId }
  });

  await prisma.usageMetricEntry.createMany({
    data: [
      {
        metricId: usageMetricId,
        value: 41750,
        recordedAt: new Date("2026-02-01T00:00:00.000Z"),
        source: "manual",
        notes: "Monthly odometer check"
      },
      {
        metricId: usageMetricId,
        value: 42125,
        recordedAt: new Date("2026-02-20T00:00:00.000Z"),
        source: "manual",
        notes: "Road trip return"
      },
      {
        metricId: usageMetricId,
        value: 42500,
        recordedAt: new Date("2026-03-09T00:00:00.000Z"),
        source: "manual",
        notes: "Current seeded reading"
      }
    ]
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
      assignedToId: null,
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
      assignedToId: null,
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
      cost: 72.5,
      laborHours: 1.25,
      laborRate: 0,
      difficultyRating: 2,
      performedBy: "self",
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
      cost: 72.5,
      laborHours: 1.25,
      laborRate: 0,
      difficultyRating: 2,
      performedBy: "self",
      metadata: {
        source: "seed"
      }
    }
  });

  await prisma.maintenanceLog.upsert({
    where: { id: maintenanceLogFollowUpId },
    update: {
      title: "Tire rotation and balance",
      completedAt: new Date("2026-02-18T00:00:00.000Z"),
      cost: 49.99,
      laborHours: 0.75,
      laborRate: 65,
      difficultyRating: 3,
      performedBy: "Quick Lube Express",
      metadata: {
        source: "seed",
        visitType: "shop-service"
      }
    },
    create: {
      id: maintenanceLogFollowUpId,
      assetId,
      scheduleId: overdueScheduleId,
      completedById: ownerUserId,
      title: "Tire rotation and balance",
      completedAt: new Date("2026-02-18T00:00:00.000Z"),
      cost: 49.99,
      laborHours: 0.75,
      laborRate: 65,
      difficultyRating: 3,
      performedBy: "Quick Lube Express",
      metadata: {
        source: "seed",
        visitType: "shop-service"
      }
    }
  });

  const historicalComplianceLogs = [
    {
      id: maintenanceLogHistoryOilSpringId,
      assetId,
      scheduleId: maintenanceScheduleId,
      completedById: ownerUserId,
      title: "[Seed] Engine oil and filter - spring cycle",
      completedAt: new Date("2025-04-12T00:00:00.000Z"),
      usageValue: 28640,
      cost: 68.25,
      laborHours: 1.1,
      laborRate: 0,
      difficultyRating: 2,
      performedBy: "self",
      metadata: {
        source: "seed",
        cycle: "spring-2025"
      }
    },
    {
      id: maintenanceLogHistoryOilFallId,
      assetId,
      scheduleId: maintenanceScheduleId,
      completedById: memberUserId,
      title: "[Seed] Engine oil and filter - fall cycle",
      completedAt: new Date("2025-10-10T00:00:00.000Z"),
      usageValue: 35890,
      cost: 79.4,
      laborHours: 1.35,
      laborRate: 0,
      difficultyRating: 2,
      performedBy: "Household garage day",
      metadata: {
        source: "seed",
        cycle: "fall-2025"
      }
    },
    {
      id: maintenanceLogHistoryTireSummerId,
      assetId,
      scheduleId: overdueScheduleId,
      completedById: memberUserId,
      title: "[Seed] Tire rotation and balance - summer",
      completedAt: new Date("2025-08-28T00:00:00.000Z"),
      cost: 44.5,
      laborHours: 0.7,
      laborRate: 60,
      difficultyRating: 3,
      performedBy: "Quick Lube Express",
      metadata: {
        source: "seed",
        visitType: "shop-service",
        cycle: "summer-2025"
      }
    },
    {
      id: maintenanceLogHistoryTireWinterId,
      assetId,
      scheduleId: overdueScheduleId,
      completedById: ownerUserId,
      title: "[Seed] Tire rotation and balance - winter",
      completedAt: new Date("2025-11-15T00:00:00.000Z"),
      cost: 47.25,
      laborHours: 0.75,
      laborRate: 62,
      difficultyRating: 3,
      performedBy: "Quick Lube Express",
      metadata: {
        source: "seed",
        visitType: "shop-service",
        cycle: "winter-2025"
      }
    }
  ] as const;

  for (const log of historicalComplianceLogs) {
    await prisma.maintenanceLog.upsert({
      where: { id: log.id },
      update: log,
      create: log
    });
  }

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

  await prisma.serviceProvider.upsert({
    where: { id: renovationProviderId },
    update: {
      name: "Northline Home Studio",
      specialty: "kitchen renovation",
      phone: "555-0144",
      rating: 5
    },
    create: {
      id: renovationProviderId,
      householdId,
      name: "Northline Home Studio",
      specialty: "kitchen renovation",
      phone: "555-0144",
      email: "hello@northline.example",
      rating: 5,
      notes: "Handles cabinet design, electrical coordination, and final punch review"
    }
  });

  await prisma.maintenanceLog.updateMany({
    where: {
      id: {
        in: [
          maintenanceLogId,
          maintenanceLogFollowUpId,
          maintenanceLogHistoryTireSummerId,
          maintenanceLogHistoryTireWinterId
        ]
      }
    },
    data: { serviceProviderId }
  });

  // ── Inventory ─────────────────────────────────────────────────────────────
  const inventoryItems = [
    {
      id: inventoryItemOilFilterId,
      name: "Motorcraft FL-500S Oil Filter",
      partNumber: "FL-500S",
      category: "filters",
      manufacturer: "Motorcraft",
      quantityOnHand: 2,
      unit: "each",
      reorderThreshold: 2,
      reorderQuantity: 4,
      preferredSupplier: "AutoZone",
      supplierUrl: "https://example.com/motorcraft-fl-500s",
      unitCost: 8.97,
      storageLocation: "Garage shelf 2",
      notes: "Fits the seeded F-150 oil-change schedule"
    },
    {
      id: inventoryItemOilId,
      name: "Full Synthetic 5W-30 Oil",
      partNumber: "SYN-5W30",
      category: "lubricants",
      manufacturer: "Mobil 1",
      quantityOnHand: 8,
      unit: "quarts",
      reorderThreshold: 6,
      reorderQuantity: 6,
      preferredSupplier: "AutoZone",
      supplierUrl: "https://example.com/full-synthetic-5w30",
      unitCost: 6.49,
      storageLocation: "Garage cabinet",
      notes: "Shared stock for both scheduled and ad-hoc oil changes"
    },
    {
      id: inventoryItemCabinFilterId,
      name: "Cabin Air Filter",
      partNumber: "CAF-1138",
      category: "filters",
      manufacturer: "WIX",
      quantityOnHand: 1,
      unit: "each",
      reorderThreshold: 2,
      reorderQuantity: 2,
      preferredSupplier: "RockAuto",
      supplierUrl: "https://example.com/cabin-air-filter",
      unitCost: 12.99,
      storageLocation: "Garage shelf 1",
      notes: "Low-stock example for reorder shopping list"
    },
    {
      id: inventoryItemWheelWeightId,
      name: "Wheel Weights",
      partNumber: "WW-025",
      category: "tire-service",
      manufacturer: null,
      quantityOnHand: 0,
      unit: "packs",
      reorderThreshold: 1,
      reorderQuantity: 2,
      preferredSupplier: "Quick Lube Express",
      supplierUrl: null,
      unitCost: 3.5,
      storageLocation: "Workshop bin A",
      notes: "Consumed during balancing work"
    },
    {
      id: inventoryItemShopTowelId,
      name: "Shop Towels",
      partNumber: "TWL-ROLL",
      category: "consumables",
      manufacturer: "Scott",
      quantityOnHand: 3,
      unit: "rolls",
      reorderThreshold: 2,
      reorderQuantity: 4,
      preferredSupplier: "Home Depot",
      supplierUrl: "https://example.com/shop-towels",
      unitCost: 4.25,
      storageLocation: "Workshop wall rack",
      notes: "Standalone household supply"
    },
    {
      id: inventoryItemRosinPaperId,
      name: "Rosin Paper Floor Protection",
      partNumber: "RP-36IN",
      category: "renovation-protection",
      manufacturer: "Trimaco",
      quantityOnHand: 2,
      unit: "rolls",
      reorderThreshold: 1,
      reorderQuantity: 2,
      preferredSupplier: "Home Depot",
      supplierUrl: "https://example.com/rosin-paper",
      unitCost: 18.5,
      storageLocation: "Basement project rack",
      notes: "Used to protect hardwood floors during kitchen demolition and install"
    },
    {
      id: inventoryItemPainterTapeId,
      name: "Painter's Tape Multipack",
      partNumber: "PT-3PK",
      category: "renovation-consumables",
      manufacturer: "3M",
      quantityOnHand: 4,
      unit: "rolls",
      reorderThreshold: 2,
      reorderQuantity: 4,
      preferredSupplier: "Lowe's",
      supplierUrl: "https://example.com/painters-tape",
      unitCost: 7.25,
      storageLocation: "Basement project rack",
      notes: "Used for layout marks, dust-control seams, and finish protection"
    },
    {
      id: inventoryItemMultimeterId,
      name: "Digital Multimeter",
      partNumber: "DMM-200",
      category: "Tools & Consumables",
      manufacturer: "Fluke",
      quantityOnHand: 1,
      unit: "each",
      reorderThreshold: null,
      reorderQuantity: null,
      preferredSupplier: "Home Depot",
      supplierUrl: "https://example.com/fluke-dmm",
      unitCost: 89.99,
      storageLocation: "Workshop tool drawer",
      notes: "General purpose multimeter for household electrical checks",
      itemType: "equipment" as const,
      conditionStatus: "good"
    },
    {
      id: inventoryItemDrillId,
      name: "Cordless Drill/Driver",
      partNumber: "DCD-780",
      category: "Tools & Consumables",
      manufacturer: "DeWalt",
      quantityOnHand: 1,
      unit: "each",
      reorderThreshold: null,
      reorderQuantity: null,
      preferredSupplier: "Lowe's",
      supplierUrl: "https://example.com/dewalt-drill",
      unitCost: 129.0,
      storageLocation: "Garage tool wall",
      notes: "20V MAX drill, shared across all household projects",
      itemType: "equipment" as const,
      conditionStatus: "good"
    }
  ] as const;

  for (const item of inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: { id: item.id },
      update: {
        householdId,
        name: item.name,
        partNumber: item.partNumber,
        description: item.notes,
        category: item.category,
        manufacturer: item.manufacturer,
        quantityOnHand: item.quantityOnHand,
        unit: item.unit,
        reorderThreshold: item.reorderThreshold,
        reorderQuantity: item.reorderQuantity,
        preferredSupplier: item.preferredSupplier,
        supplierUrl: item.supplierUrl,
        unitCost: item.unitCost,
        storageLocation: item.storageLocation,
        notes: item.notes,
        itemType: "itemType" in item ? item.itemType : "consumable",
        conditionStatus: "conditionStatus" in item ? item.conditionStatus : null
      },
      create: {
        id: item.id,
        householdId,
        name: item.name,
        partNumber: item.partNumber,
        description: item.notes,
        category: item.category,
        manufacturer: item.manufacturer,
        quantityOnHand: item.quantityOnHand,
        unit: item.unit,
        reorderThreshold: item.reorderThreshold,
        reorderQuantity: item.reorderQuantity,
        preferredSupplier: item.preferredSupplier,
        supplierUrl: item.supplierUrl,
        unitCost: item.unitCost,
        storageLocation: item.storageLocation,
        notes: item.notes,
        itemType: "itemType" in item ? item.itemType : "consumable",
        conditionStatus: "conditionStatus" in item ? item.conditionStatus : null
      }
    });
  }

  await prisma.assetInventoryItem.deleteMany({
    where: {
      assetId: { in: [assetId, childAssetId, homeAssetId] }
    }
  });

  await prisma.projectInventoryItem.deleteMany({
    where: { projectId }
  });

  await prisma.inventoryTransaction.deleteMany({
    where: {
      inventoryItemId: {
        in: [
          inventoryItemOilFilterId,
          inventoryItemOilId,
          inventoryItemCabinFilterId,
          inventoryItemWheelWeightId,
          inventoryItemShopTowelId,
          inventoryItemRosinPaperId,
          inventoryItemPainterTapeId,
          inventoryItemMultimeterId,
          inventoryItemDrillId
        ]
      }
    }
  });

  // ── Tier 2: Maintenance Log Part ──────────────────────────────────────────
  await prisma.maintenanceLogPart.deleteMany({
    where: {
      logId: {
        in: [
          maintenanceLogId,
          maintenanceLogFollowUpId,
          maintenanceLogHistoryOilSpringId,
          maintenanceLogHistoryOilFallId,
          maintenanceLogHistoryTireWinterId
        ]
      }
    }
  });
  await prisma.maintenanceLogPart.createMany({
    data: [
      {
        logId: maintenanceLogHistoryOilSpringId,
        inventoryItemId: inventoryItemOilFilterId,
        name: "Motorcraft FL-500S Oil Filter",
        partNumber: "FL-500S",
        quantity: 1,
        unitCost: 8.49,
        supplier: "AutoZone"
      },
      {
        logId: maintenanceLogHistoryOilSpringId,
        inventoryItemId: inventoryItemOilId,
        name: "Full Synthetic 5W-30 Oil",
        partNumber: "SYN-5W30",
        quantity: 6,
        unitCost: 6.15,
        supplier: "AutoZone"
      },
      {
        logId: maintenanceLogHistoryOilFallId,
        inventoryItemId: inventoryItemOilFilterId,
        name: "Motorcraft FL-500S Oil Filter",
        partNumber: "FL-500S",
        quantity: 1,
        unitCost: 8.97,
        supplier: "NAPA"
      },
      {
        logId: maintenanceLogHistoryOilFallId,
        inventoryItemId: inventoryItemOilId,
        name: "Full Synthetic 5W-30 Oil",
        partNumber: "SYN-5W30",
        quantity: 6,
        unitCost: 6.72,
        supplier: "NAPA"
      },
      {
        logId: maintenanceLogId,
        inventoryItemId: inventoryItemOilFilterId,
        name: "Motorcraft FL-500S Oil Filter",
        partNumber: "FL-500S",
        quantity: 1,
        unitCost: 8.97,
        supplier: "AutoZone"
      },
      {
        logId: maintenanceLogId,
        inventoryItemId: inventoryItemOilId,
        name: "Full Synthetic 5W-30 Oil",
        partNumber: "SYN-5W30",
        quantity: 6,
        unitCost: 6.49,
        supplier: "AutoZone"
      },
      {
        logId: maintenanceLogFollowUpId,
        inventoryItemId: inventoryItemWheelWeightId,
        name: "Wheel Weights",
        partNumber: "WW-025",
        quantity: 1,
        unitCost: 3.5,
        supplier: "Quick Lube Express"
      },
      {
        logId: maintenanceLogHistoryTireWinterId,
        inventoryItemId: inventoryItemWheelWeightId,
        name: "Wheel Weights",
        partNumber: "WW-025",
        quantity: 1,
        unitCost: 3.25,
        supplier: "Quick Lube Express"
      }
    ]
  });

  // ── Tier 2: Project ───────────────────────────────────────────────────────
  await prisma.projectPhaseSupply.deleteMany({
    where: {
      phase: {
        projectId
      }
    }
  });

  await prisma.projectPhaseChecklistItem.deleteMany({
    where: {
      phase: {
        projectId
      }
    }
  });

  await prisma.projectTaskChecklistItem.deleteMany({
    where: {
      task: {
        projectId
      }
    }
  });

  await prisma.projectExpense.deleteMany({
    where: { projectId }
  });

  await prisma.projectTask.deleteMany({
    where: { projectId }
  });

  await prisma.projectBudgetCategory.deleteMany({
    where: { projectId }
  });

  await prisma.projectPhase.deleteMany({
    where: { projectId }
  });

  await prisma.project.upsert({
    where: { id: projectId },
    update: {
      name: "Kitchen Refresh 2026",
      description: "A phased kitchen refresh with design planning, demolition prep, cabinet installation, and lighting upgrades.",
      status: "active",
      budgetAmount: 14250,
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      targetEndDate: new Date("2026-05-15T00:00:00.000Z")
    },
    create: {
      id: projectId,
      householdId,
      name: "Kitchen Refresh 2026",
      description: "A phased kitchen refresh with design planning, demolition prep, cabinet installation, and lighting upgrades.",
      status: "active",
      budgetAmount: 14250,
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      targetEndDate: new Date("2026-05-15T00:00:00.000Z")
    }
  });

  await prisma.project.upsert({
    where: { id: subProjectId },
    update: {
      name: "Cabinet Hardware Selection",
      parentProjectId: projectId,
      depth: 1,
      status: "active",
      budgetAmount: 650,
      description: "Research, compare, and procure cabinet hardware for all new cabinetry in the kitchen refresh.",
      startDate: new Date("2026-03-10T00:00:00.000Z"),
      targetEndDate: new Date("2026-04-01T00:00:00.000Z")
    },
    create: {
      id: subProjectId,
      householdId,
      parentProjectId: projectId,
      depth: 1,
      name: "Cabinet Hardware Selection",
      description: "Research, compare, and procure cabinet hardware for all new cabinetry in the kitchen refresh.",
      status: "active",
      budgetAmount: 650,
      startDate: new Date("2026-03-10T00:00:00.000Z"),
      targetEndDate: new Date("2026-04-01T00:00:00.000Z")
    }
  });

  await prisma.assetInventoryItem.createMany({
    data: [
      {
        assetId,
        inventoryItemId: inventoryItemOilFilterId,
        notes: "OEM recommended filter",
        recommendedQuantity: 2
      },
      {
        assetId,
        inventoryItemId: inventoryItemOilId,
        notes: "Keep enough oil for a full change plus top-offs",
        recommendedQuantity: 6
      },
      {
        assetId,
        inventoryItemId: inventoryItemCabinFilterId,
        notes: "Seasonal air-quality replacement item",
        recommendedQuantity: 1
      },
      {
        assetId: homeAssetId,
        inventoryItemId: inventoryItemRosinPaperId,
        notes: "Reusable kitchen floor protection stock for remodels and appliance swaps",
        recommendedQuantity: 2
      },
      {
        assetId: homeAssetId,
        inventoryItemId: inventoryItemPainterTapeId,
        notes: "Consumable stock for finish protection and layout work",
        recommendedQuantity: 4
      },
      {
        assetId: homeAssetId,
        inventoryItemId: inventoryItemShopTowelId,
        notes: "Cleanup and dust-control consumable for renovation work",
        recommendedQuantity: 4
      }
    ],
    skipDuplicates: true
  });

  const existingOilFilterScheduleLink = await prisma.scheduleInventoryItem.findUnique({
    where: {
      scheduleId_inventoryItemId: {
        scheduleId: maintenanceScheduleId,
        inventoryItemId: inventoryItemOilFilterId
      }
    }
  });

  if (!existingOilFilterScheduleLink) {
    await prisma.scheduleInventoryItem.create({
      data: {
        scheduleId: maintenanceScheduleId,
        inventoryItemId: inventoryItemOilFilterId,
        quantityPerService: 1
      }
    });
  }

  const existingOilScheduleLink = await prisma.scheduleInventoryItem.findUnique({
    where: {
      scheduleId_inventoryItemId: {
        scheduleId: maintenanceScheduleId,
        inventoryItemId: inventoryItemOilId
      }
    }
  });

  if (!existingOilScheduleLink) {
    await prisma.scheduleInventoryItem.create({
      data: {
        scheduleId: maintenanceScheduleId,
        inventoryItemId: inventoryItemOilId,
        quantityPerService: 6
      }
    });
  }

  await prisma.projectAsset.upsert({
    where: { projectId_assetId: { projectId, assetId: homeAssetId } },
    update: {
      relationship: "target",
      role: "Primary kitchen space undergoing phased renovation",
      notes: "Primary kitchen space undergoing phased layout and finish updates"
    },
    create: {
      projectId,
      assetId: homeAssetId,
      relationship: "target",
      role: "Primary kitchen space undergoing phased renovation",
      notes: "Primary kitchen space undergoing phased layout and finish updates"
    }
  });

  await prisma.projectAsset.upsert({
    where: { projectId_assetId: { projectId, assetId } },
    update: {
      relationship: "supports",
      role: "Used to transport materials and haul demolition debris",
      notes: "F-150 used for supply runs and debris removal during renovation phases"
    },
    create: {
      projectId,
      assetId,
      relationship: "supports",
      role: "Used to transport materials and haul demolition debris",
      notes: "F-150 used for supply runs and debris removal during renovation phases"
    }
  });

  await prisma.projectInventoryItem.createMany({
    data: [
      {
        projectId,
        inventoryItemId: inventoryItemRosinPaperId,
        quantityNeeded: 2,
        quantityAllocated: 1,
        budgetedUnitCost: 18.5,
        notes: "Protect hardwood paths during demolition and install"
      },
      {
        projectId,
        inventoryItemId: inventoryItemPainterTapeId,
        quantityNeeded: 4,
        quantityAllocated: 0,
        budgetedUnitCost: 7.25,
        notes: "Layout marking and finish masking stock"
      },
      {
        projectId,
        inventoryItemId: inventoryItemShopTowelId,
        quantityNeeded: 4,
        quantityAllocated: 0,
        budgetedUnitCost: 4.25,
        notes: "Cleanup consumables for punch list and staging"
      }
    ]
  });

  const inventoryTransactions = [
    {
      id: "clkeeperinvtxn0000000001",
      inventoryItemId: inventoryItemOilFilterId,
      type: "purchase",
      quantity: 6,
      quantityAfter: 6,
      referenceType: "manual",
      referenceId: inventoryItemOilFilterId,
      unitCost: 8.97,
      notes: "Bought filters during spring sale",
      userId: ownerUserId,
      createdAt: new Date("2026-02-15T09:00:00.000Z")
    },
    {
      id: "clkeeperinvtxn0000000002",
      inventoryItemId: inventoryItemOilFilterId,
      type: "consume",
      quantity: -4,
      quantityAfter: 2,
      referenceType: "maintenance_log",
      referenceId: maintenanceLogId,
      unitCost: 8.97,
      notes: "Seeded historical consumption rollup",
      userId: ownerUserId,
      createdAt: new Date("2026-03-09T10:00:00.000Z")
    },
    {
      id: "clkeeperinvtxn0000000003",
      inventoryItemId: inventoryItemOilId,
      type: "purchase",
      quantity: 12,
      quantityAfter: 12,
      referenceType: "manual",
      referenceId: inventoryItemOilId,
      unitCost: 6.49,
      notes: "Case of oil for home service",
      userId: ownerUserId,
      createdAt: new Date("2026-02-15T09:05:00.000Z")
    },
    {
      id: "clkeeperinvtxn0000000004",
      inventoryItemId: inventoryItemOilId,
      type: "consume",
      quantity: -4,
      quantityAfter: 8,
      referenceType: "maintenance_log",
      referenceId: maintenanceLogId,
      unitCost: 6.49,
      notes: "Oil used across recent service events",
      userId: ownerUserId,
      createdAt: new Date("2026-03-09T10:02:00.000Z")
    },
    {
      id: "clkeeperinvtxn0000000005",
      inventoryItemId: inventoryItemCabinFilterId,
      type: "purchase",
      quantity: 2,
      quantityAfter: 2,
      referenceType: "manual",
      referenceId: inventoryItemCabinFilterId,
      unitCost: 12.99,
      notes: "Picked up two cabin filters",
      userId: ownerUserId,
      createdAt: new Date("2026-02-20T12:00:00.000Z")
    },
    {
      id: "clkeeperinvtxn0000000006",
      inventoryItemId: inventoryItemCabinFilterId,
      type: "consume",
      quantity: -1,
      quantityAfter: 1,
      referenceType: "maintenance_log",
      referenceId: maintenanceLogId,
      unitCost: 12.99,
      notes: "Seeded historical cabin filter replacement",
      userId: ownerUserId,
      createdAt: new Date("2026-03-01T14:00:00.000Z")
    },
    {
      id: "clkeeperinvtxn0000000007",
      inventoryItemId: inventoryItemWheelWeightId,
      type: "purchase",
      quantity: 1,
      quantityAfter: 1,
      referenceType: "manual",
      referenceId: inventoryItemWheelWeightId,
      unitCost: 3.5,
      notes: "Emergency tire-balance stock",
      userId: ownerUserId,
      createdAt: new Date("2026-02-17T08:00:00.000Z")
    },
    {
      id: "clkeeperinvtxn0000000008",
      inventoryItemId: inventoryItemWheelWeightId,
      type: "consume",
      quantity: -1,
      quantityAfter: 0,
      referenceType: "maintenance_log",
      referenceId: maintenanceLogFollowUpId,
      unitCost: 3.5,
      notes: "Wheel balancing service used the last pack",
      userId: ownerUserId,
      createdAt: new Date("2026-02-18T09:00:00.000Z")
    },
    {
      id: "clkeeperinvtxn0000000009",
      inventoryItemId: inventoryItemShopTowelId,
      type: "adjust",
      quantity: 3,
      quantityAfter: 3,
      referenceType: "manual",
      referenceId: inventoryItemShopTowelId,
      unitCost: 4.25,
      notes: "Initial counted stock",
      userId: ownerUserId,
      createdAt: new Date("2026-02-10T08:30:00.000Z")
    },
    {
      id: "clkeeperinvtxn0000000010",
      inventoryItemId: inventoryItemRosinPaperId,
      type: "purchase",
      quantity: 3,
      quantityAfter: 3,
      referenceType: "manual",
      referenceId: inventoryItemRosinPaperId,
      unitCost: 18.5,
      notes: "Picked up floor protection ahead of the kitchen refresh",
      userId: ownerUserId,
      createdAt: new Date("2026-03-01T17:00:00.000Z")
    },
    {
      id: "clkeeperinvtxn0000000011",
      inventoryItemId: inventoryItemRosinPaperId,
      type: "project_supply_allocation",
      quantity: -1,
      quantityAfter: 2,
      referenceType: "project_phase_supply",
      referenceId: supplyProtectionId,
      unitCost: 18.5,
      notes: "Allocated one roll to the demolition and protection phase",
      userId: ownerUserId,
      createdAt: new Date("2026-03-05T08:15:00.000Z")
    },
    {
      id: "clkeeperinvtxn0000000012",
      inventoryItemId: inventoryItemPainterTapeId,
      type: "purchase",
      quantity: 6,
      quantityAfter: 6,
      referenceType: "manual",
      referenceId: inventoryItemPainterTapeId,
      unitCost: 7.25,
      notes: "Consumable stock for layout, masking, and finish protection",
      userId: ownerUserId,
      createdAt: new Date("2026-03-03T11:45:00.000Z")
    }
  ] as const;

  for (const transaction of inventoryTransactions) {
    await prisma.inventoryTransaction.upsert({
      where: { id: transaction.id },
      update: transaction,
      create: transaction
    });
  }

  await prisma.projectBudgetCategory.createMany({
    data: [
      {
        id: budgetDesignId,
        projectId,
        name: "Design + Planning",
        budgetAmount: 1450,
        sortOrder: 1,
        notes: "Measurements, drawings, permits, and contingency for prework"
      },
      {
        id: budgetCabinetryId,
        projectId,
        name: "Cabinetry + Finish Materials",
        budgetAmount: 9600,
        sortOrder: 2,
        notes: "Cabinet order, hardware, trim, backsplash, and paint"
      },
      {
        id: budgetElectricalId,
        projectId,
        name: "Electrical + Lighting",
        budgetAmount: 3200,
        sortOrder: 3,
        notes: "New fixtures, outlets, dimmers, and electrician support"
      }
    ]
  });

  await prisma.projectPhase.createMany({
    data: [
      {
        id: phasePlanningId,
        projectId,
        name: "Planning and Measurements",
        description: "Finalize scope, verify cabinet lead times, and lock electrical changes before teardown.",
        status: "completed",
        sortOrder: 1,
        startDate: new Date("2026-03-01T00:00:00.000Z"),
        targetEndDate: new Date("2026-03-07T00:00:00.000Z"),
        actualEndDate: new Date("2026-03-06T00:00:00.000Z"),
        budgetAmount: 1500,
        notes: "Measurements complete and permit-free scope confirmed"
      },
      {
        id: phaseDemolitionId,
        projectId,
        name: "Demolition and Prep",
        description: "Protect adjacent floors, remove worn finishes, and prep utilities for cabinet delivery.",
        status: "in_progress",
        sortOrder: 2,
        startDate: new Date("2026-03-08T00:00:00.000Z"),
        targetEndDate: new Date("2026-03-20T00:00:00.000Z"),
        budgetAmount: 2450,
        notes: "Floor protection is staged; old backsplash removal is underway"
      },
      {
        id: phaseInstallationId,
        projectId,
        name: "Cabinet Install and Lighting",
        description: "Install the new cabinet run, hang pendant lights, and close out finish carpentry.",
        status: "pending",
        sortOrder: 3,
        startDate: new Date("2026-03-21T00:00:00.000Z"),
        targetEndDate: new Date("2026-05-15T00:00:00.000Z"),
        budgetAmount: 10300,
        notes: "Waiting on cabinet hardware and pendant lead times"
      }
    ]
  });

  await prisma.projectPhaseChecklistItem.createMany({
    data: [
      {
        id: "clkeeperphasecheck000000001",
        phaseId: phasePlanningId,
        title: "Capture final measurements for every wall run",
        isCompleted: true,
        completedAt: new Date("2026-03-02T09:30:00.000Z"),
        sortOrder: 1
      },
      {
        id: "clkeeperphasecheck000000002",
        phaseId: phasePlanningId,
        title: "Confirm appliance specs and outlet locations",
        isCompleted: true,
        completedAt: new Date("2026-03-04T18:10:00.000Z"),
        sortOrder: 2
      },
      {
        id: "clkeeperphasecheck000000003",
        phaseId: phaseDemolitionId,
        title: "Protect hardwood path from entry to kitchen",
        isCompleted: true,
        completedAt: new Date("2026-03-08T08:20:00.000Z"),
        sortOrder: 1
      },
      {
        id: "clkeeperphasecheck000000004",
        phaseId: phaseDemolitionId,
        title: "Shut off disposal circuit and label temporary outlets",
        isCompleted: false,
        sortOrder: 2
      },
      {
        id: "clkeeperphasecheck000000005",
        phaseId: phaseInstallationId,
        title: "Schedule electrician for pendant and under-cabinet rough-in",
        isCompleted: false,
        sortOrder: 1
      }
    ]
  });

  const taskIds = [
    "clkeepertask00000000000001",
    "clkeepertask00000000000002",
    "clkeepertask00000000000003",
    "clkeepertask00000000000004"
  ] as const;

  await prisma.projectTask.createMany({
    data: [
      {
        id: taskIds[0],
        projectId,
        phaseId: phasePlanningId,
        title: "Finalize cabinet layout",
        description: "Lock filler widths, drawer stack sizes, and appliance clearances with the design packet.",
        status: "completed",
        taskType: "full",
        isCompleted: false,
        assignedToId: ownerUserId,
        dueDate: new Date("2026-03-05T00:00:00.000Z"),
        completedAt: new Date("2026-03-05T16:45:00.000Z"),
        estimatedCost: 350,
        actualCost: 275,
        sortOrder: 1
      },
      {
        id: taskIds[1],
        projectId,
        phaseId: phaseDemolitionId,
        title: "Remove backsplash and inspect drywall",
        description: "Open the wall behind the sink run and document any repair work before cabinetry arrives.",
        status: "in_progress",
        taskType: "full",
        isCompleted: false,
        assignedToId: memberUserId,
        dueDate: new Date("2026-03-14T00:00:00.000Z"),
        estimatedCost: 420,
        actualCost: 130,
        sortOrder: 1
      },
      {
        id: taskIds[2],
        projectId,
        phaseId: phaseInstallationId,
        title: "Install pendant lights over peninsula",
        description: "Coordinate box placement, dimmer swap, and final fixture hang after paint cures.",
        status: "pending",
        taskType: "full",
        isCompleted: false,
        assignedToId: ownerUserId,
        dueDate: new Date("2026-04-18T00:00:00.000Z"),
        estimatedCost: 780,
        sortOrder: 1
      },
      {
        id: taskIds[3],
        projectId,
        title: "Collect finish samples and sign-off photos",
        description: "Store backsplash, paint, and hardware references for closeout and future repairs.",
        status: "pending",
        taskType: "full",
        isCompleted: false,
        assignedToId: null,
        dueDate: new Date("2026-05-10T00:00:00.000Z"),
        estimatedCost: 80,
        sortOrder: 99
      }
    ]
  });

  await prisma.projectTaskChecklistItem.createMany({
    data: [
      {
        id: "clkeepertaskcheck000000001",
        taskId: taskIds[0],
        title: "Verify refrigerator door swing against panel return",
        isCompleted: true,
        completedAt: new Date("2026-03-03T12:15:00.000Z"),
        sortOrder: 1
      },
      {
        id: "clkeepertaskcheck000000002",
        taskId: taskIds[0],
        title: "Confirm sink base width with plumbing offset",
        isCompleted: true,
        completedAt: new Date("2026-03-05T15:55:00.000Z"),
        sortOrder: 2
      },
      {
        id: "clkeepertaskcheck000000003",
        taskId: taskIds[1],
        title: "Photograph any hidden electrical before patching",
        isCompleted: true,
        completedAt: new Date("2026-03-11T10:20:00.000Z"),
        sortOrder: 1
      },
      {
        id: "clkeepertaskcheck000000004",
        taskId: taskIds[1],
        title: "Patch soft drywall behind removed tile",
        isCompleted: false,
        sortOrder: 2
      },
      {
        id: "clkeepertaskcheck000000005",
        taskId: taskIds[2],
        title: "Confirm pendants are on-site before electrician visit",
        isCompleted: false,
        sortOrder: 1
      }
    ]
  });

  // Quick to-dos for Kitchen Refresh 2026
  await prisma.projectTask.createMany({
    data: [
      {
        id: "clkeeperquicktodo0000001",
        projectId,
        phaseId: phasePlanningId,
        title: "Pick up cabinet hardware samples from Rejuvenation",
        status: "pending",
        taskType: "quick",
        isCompleted: false,
        sortOrder: 1
      },
      {
        id: "clkeeperquicktodo0000002",
        projectId,
        phaseId: phaseInstallationId,
        title: "Confirm pendant light lead time with Lumens",
        status: "pending",
        taskType: "quick",
        isCompleted: false,
        sortOrder: 2
      },
      {
        id: "clkeeperquicktodo0000003",
        projectId,
        phaseId: phaseDemolitionId,
        title: "Return unused drywall compound to Home Depot",
        status: "completed",
        taskType: "quick",
        isCompleted: true,
        completedAt: new Date("2026-03-12T14:00:00.000Z"),
        sortOrder: 3
      },
      {
        id: "clkeeperquicktodo0000004",
        projectId,
        title: "Ask electrician about adding an outlet behind the fridge",
        status: "pending",
        taskType: "quick",
        isCompleted: false,
        sortOrder: 4
      }
    ]
  });

  await prisma.projectPhaseSupply.createMany({
    data: [
      {
        id: supplyProtectionId,
        phaseId: phaseDemolitionId,
        name: "Floor protection rolls",
        description: "Rosin paper to protect the hardwood path and adjacent dining area.",
        quantityNeeded: 2,
        quantityOnHand: 1,
        unit: "rolls",
        estimatedUnitCost: 18.5,
        actualUnitCost: 18.5,
        supplier: "Home Depot",
        supplierUrl: "https://example.com/rosin-paper",
        isProcured: true,
        procuredAt: new Date("2026-03-01T17:00:00.000Z"),
        isStaged: true,
        stagedAt: new Date("2026-03-08T08:00:00.000Z"),
        inventoryItemId: inventoryItemRosinPaperId,
        notes: "One roll allocated from inventory and one more still needed for appliance path coverage",
        sortOrder: 1
      },
      {
        id: supplyCabinetHardwareId,
        phaseId: phaseInstallationId,
        name: "Cabinet pull set",
        description: "Brushed brass pulls for drawers and doors.",
        quantityNeeded: 18,
        quantityOnHand: 0,
        unit: "pieces",
        estimatedUnitCost: 12,
        supplier: "Rejuvenation",
        supplierUrl: "https://example.com/brass-cabinet-pulls",
        isProcured: false,
        isStaged: false,
        notes: "Awaiting final finish sign-off before ordering",
        sortOrder: 1
      },
      {
        id: supplyPendantLightsId,
        phaseId: phaseInstallationId,
        name: "Pendant light fixtures",
        description: "Two matte-white pendants for the peninsula.",
        quantityNeeded: 2,
        quantityOnHand: 0,
        unit: "fixtures",
        estimatedUnitCost: 189,
        supplier: "Lumens",
        supplierUrl: "https://example.com/kitchen-pendants",
        isProcured: false,
        isStaged: false,
        notes: "Need finish confirmation after cabinet sample review",
        sortOrder: 2
      }
    ]
  });

  const expenseIds = [
    "clkeeperexpense000000000001",
    "clkeeperexpense000000000002",
    "clkeeperexpense000000000003"
  ] as const;

  await prisma.projectExpense.createMany({
    data: [
      {
        id: expenseIds[0],
        projectId,
        phaseId: phasePlanningId,
        budgetCategoryId: budgetDesignId,
        description: "Cabinet layout consultation",
        amount: 275,
        category: "design",
        date: new Date("2026-03-05T00:00:00.000Z"),
        serviceProviderId: renovationProviderId,
        notes: "Two-hour onsite design validation and measurement review"
      },
      {
        id: expenseIds[1],
        projectId,
        phaseId: phaseDemolitionId,
        budgetCategoryId: budgetCabinetryId,
        description: "Drywall patch materials and dust containment",
        amount: 186.45,
        category: "materials",
        date: new Date("2026-03-12T00:00:00.000Z"),
        notes: "Joint compound, sanding screens, zipper door, and cleanup consumables"
      },
      {
        id: expenseIds[2],
        projectId,
        phaseId: phaseInstallationId,
        budgetCategoryId: budgetElectricalId,
        description: "Lighting deposit",
        amount: 420,
        category: "fixtures",
        date: new Date("2026-03-18T00:00:00.000Z"),
        serviceProviderId: renovationProviderId,
        notes: "Deposit to reserve electrician and hold two pendant fixtures"
      }
    ]
  });

  // ── Project Notes ─────────────────────────────────────────────────────────
  const noteIds = [
    "clkeepernote00000000000001",
    "clkeepernote00000000000002",
    "clkeepernote00000000000003"
  ] as const;

  await prisma.projectNote.deleteMany({ where: { projectId } });

  await prisma.projectNote.createMany({
    data: [
      {
        id: noteIds[0],
        projectId,
        phaseId: phasePlanningId,
        title: "Cabinet hardware finish comparison",
        body: "## Finish Comparison\n\n**Brushed Brass**\n- Price: ~$12/pull\n- Lead time: 2–3 weeks\n- ✅ Recommended\n\n**Matte Black**\n- Price: ~$9/pull\n- Lead time: 1 week\n\n**Satin Nickel**\n- Price: ~$8/pull\n- Lead time: 1 week\n\nRecommendation: Brushed brass best matches the warm wood tones planned for the new cabinetry.",
        url: "https://example.com/hardware-comparison",
        category: "research",
        isPinned: true,
        createdById: ownerUserId
      },
      {
        id: noteIds[1],
        projectId,
        phaseId: null,
        title: "Decided against open shelving on the peninsula wall",
        body: "After discussing with the household, open shelving on the peninsula wall was ruled out. Primary concerns: visible clutter with young children, dust accumulation on rarely-used items, and the cost difference did not justify the aesthetic. Will proceed with full upper cabinet run on that wall.",
        category: "decision",
        isPinned: false,
        createdById: ownerUserId
      },
      {
        id: noteIds[2],
        projectId,
        phaseId: phaseDemolitionId,
        title: "Wall measurements after demo",
        body: "## Post-Demo Measurements\n\n- North wall run: 142.5 in\n- East wall (sink): 76 in\n- Peninsula wall: 98 in\n- Ceiling height: 108 in\n- Electrical box center (north): 34 in from floor\n- Pendant drop target: 66 in from floor",
        category: "measurement",
        isPinned: false,
        createdById: ownerUserId
      }
    ]
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

  await prisma.householdInvitation.upsert({
    where: { id: acceptedInvitationId },
    update: {
      status: "accepted",
      acceptedAt: new Date("2026-03-10T00:00:00.000Z"),
      acceptedByUserId: memberUserId
    },
    create: {
      id: acceptedInvitationId,
      householdId,
      invitedByUserId: ownerUserId,
      email: "member@lifekeeper.app",
      token: crypto.randomUUID(),
      expiresAt: new Date("2026-03-13T00:00:00.000Z"),
      status: "accepted",
      acceptedAt: new Date("2026-03-10T00:00:00.000Z"),
      acceptedByUserId: memberUserId
    }
  });

  // ── Tier 2: Activity Log Entries ──────────────────────────────────────────
  // Seed a few representative activity log entries
  await prisma.activityLog.deleteMany({ where: { householdId } });
  const activityEntries = [
    { action: "asset.created", entityType: "asset", entityId: assetId, userId: ownerUserId, metadata: { name: "Primary Vehicle" } },
    { action: "schedule.created", entityType: "schedule", entityId: maintenanceScheduleId, userId: ownerUserId, metadata: { name: "Engine oil and filter" } },
    { action: "project.created", entityType: "project", entityId: projectId, userId: ownerUserId, metadata: { name: "Kitchen Refresh 2026" } },
    { action: "project.phase.created", entityType: "project_phase", entityId: phasePlanningId, userId: ownerUserId, metadata: { projectId, name: "Planning and Measurements" } },
    { action: "project.phase.status_updated", entityType: "project_phase", entityId: phasePlanningId, userId: ownerUserId, metadata: { projectId, status: "completed" } },
    { action: "project.budget_category.created", entityType: "project_budget_category", entityId: budgetCabinetryId, userId: ownerUserId, metadata: { projectId, name: "Cabinetry + Finish Materials" } },
    { action: "project.supply.created", entityType: "project_phase_supply", entityId: supplyProtectionId, userId: ownerUserId, metadata: { projectId, phaseId: phaseDemolitionId, name: "Floor protection rolls" } },
    { action: "member.invited", entityType: "household", entityId: householdId, userId: ownerUserId, metadata: { email: "invited@lifekeeper.app" } },
    { action: "hobby.created", entityType: "hobby", entityId: hobbyId, userId: ownerUserId, metadata: { name: "Beer Brewing" } },
    { action: "hobby.session.created", entityType: "hobby_session", entityId: hobbySessionBatch1Id, userId: ownerUserId, metadata: { hobbyId, name: "Batch #1 — American Pale Ale" } },
    { action: "hobby.session.completed", entityType: "hobby_session", entityId: hobbySessionBatch1Id, userId: ownerUserId, metadata: { hobbyId, name: "Batch #1 — American Pale Ale" } },
    { action: "hobby.session.created", entityType: "hobby_session", entityId: hobbySessionBatch2Id, userId: ownerUserId, metadata: { hobbyId, name: "Batch #2 — Oatmeal Stout" } }
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
      householdId,
      entityType: "asset",
      entityId: assetId,
      assetId,
      authorId: ownerUserId,
      body: "The oil light flickered briefly last week — worth watching."
    }
  });
  await prisma.comment.create({
    data: {
      householdId,
      entityType: "asset",
      entityId: assetId,
      assetId,
      authorId: memberUserId,
      parentCommentId: rootComment.id,
      body: "I noticed that too. It might just be the sensor, but let's check the level after the next oil change."
    }
  });

  // ── Tier 2: Manual Asset Timeline Entries ───────────────────────────────
  const manualTimelineEntries = [
    {
      id: timelineEntryRustSpotId,
      assetId,
      createdById: ownerUserId,
      title: "Noticed minor rust spot on rear quarter panel",
      description: "Small bubble forming near the wheel arch. Took photos to track whether it spreads before fall detailing.",
      entryDate: new Date("2025-10-18T15:30:00.000Z"),
      category: "observation",
      cost: null,
      vendor: null,
      tags: ["body", "rust", "monitoring"],
      metadata: {
        severity: "low",
        location: "rear quarter panel"
      }
    },
    {
      id: timelineEntryStormFenceId,
      assetId: homeAssetId,
      createdById: memberUserId,
      title: "Neighbor's tree fell on fence near the AC unit — no damage to unit",
      description: "Fence section took the hit, but the condenser cabinet and lineset stayed clear. Logged it here in case we need to reference the storm later.",
      entryDate: new Date("2025-09-03T20:10:00.000Z"),
      category: "incident",
      cost: null,
      vendor: null,
      tags: ["storm", "fence", "hvac"],
      metadata: {
        followUpNeeded: false
      }
    },
    {
      id: timelineEntryCeramicCoatId,
      assetId,
      createdById: ownerUserId,
      title: "Applied ceramic coating to exterior",
      description: "Completed full wash, clay, and single-stage polish before applying the coating. Paint should be easier to maintain through winter.",
      entryDate: new Date("2025-11-09T18:45:00.000Z"),
      category: "modification",
      cost: 89.99,
      vendor: "Chemical Guys",
      tags: ["detailing", "paint", "protection"],
      metadata: {
        product: "HydroSlick",
        estimatedDurabilityMonths: 12
      }
    },
    {
      id: timelineEntryTaxAssessmentId,
      assetId: homeAssetId,
      createdById: ownerUserId,
      title: "Annual property tax assessment — noted home value increase",
      description: "Assessment letter came in higher than expected. Worth keeping in the property history alongside renovation planning notes.",
      entryDate: new Date("2026-01-22T14:00:00.000Z"),
      category: "note",
      cost: null,
      vendor: null,
      tags: ["tax", "valuation", "records"],
      metadata: {
        assessedValueChange: "increase"
      }
    },
    {
      id: timelineEntryWinterizeId,
      assetId: homeAssetId,
      createdById: memberUserId,
      title: "Winterized irrigation system before first freeze",
      description: "Shut off supply, blew out all zones, and tagged the controller so no one starts a cycle accidentally.",
      entryDate: new Date("2025-11-05T16:20:00.000Z"),
      category: "seasonal",
      cost: null,
      vendor: null,
      tags: ["irrigation", "winter", "preventive"],
      metadata: {
        zonesCleared: 6
      }
    },
    {
      id: timelineEntryWeatherStripId,
      assetId: homeAssetId,
      createdById: ownerUserId,
      title: "Replaced garage door weather stripping — bought at Home Depot",
      description: "Old seal had hardened and was letting in drafts. New bottom seal closed the gap on the driveway side.",
      entryDate: new Date("2025-12-14T17:05:00.000Z"),
      category: "repair",
      cost: 34.5,
      vendor: "Home Depot",
      tags: ["garage", "weatherproofing"],
      metadata: {
        material: "vinyl"
      }
    },
    {
      id: timelineEntryPanelInspectId,
      assetId: homeAssetId,
      createdById: ownerUserId,
      title: "Had electrician inspect panel after power surge",
      description: "No immediate damage found, but one breaker showed heat discoloration and should be watched during the next service visit.",
      entryDate: new Date("2026-02-27T13:40:00.000Z"),
      category: "inspection",
      cost: 150,
      vendor: "Ray's Electric",
      tags: ["electrical", "inspection", "surge"],
      metadata: {
        followUpWindowDays: 90
      }
    }
  ] as const;

  for (const entry of manualTimelineEntries) {
    await prisma.assetTimelineEntry.upsert({
      where: { id: entry.id },
      update: {
        assetId: entry.assetId,
        createdById: entry.createdById,
        title: entry.title,
        description: entry.description,
        entryDate: entry.entryDate,
        category: entry.category,
        cost: entry.cost,
        vendor: entry.vendor,
        tags: entry.tags,
        metadata: entry.metadata
      },
      create: entry
    });
  }

  // ── Tier 3: Hobby — Beer Brewing ─────────────────────────────────────────

  // Hobby
  await prisma.hobby.upsert({
    where: { id: hobbyId },
    update: {},
    create: {
      id: hobbyId,
      householdId,
      name: "Beer Brewing",
      description: "Homebrewing beer — extract and all-grain batches",
      status: "active",
      hobbyType: "beer-brewing",
      lifecycleMode: "pipeline",
      customFields: {
        brewingMethod: "All-Grain",
        defaultBatchSize: "5 gallons",
        fermentationVesselType: "Bucket",
        carbonationMethod: "Bottle Conditioning",
        waterSource: "Municipal (treated)",
        brewhouse: "Garage Setup",
      },
      fieldDefinitions: [
        { key: "brewingMethod", label: "Brewing Method", type: "select", options: ["All-Grain", "Extract", "Partial Mash", "BIAB"] },
        { key: "defaultBatchSize", label: "Default Batch Size", type: "string" },
        { key: "fermentationVesselType", label: "Fermentation Vessel Type", type: "select", options: ["Bucket", "Carboy", "Conical", "Keg"] },
        { key: "carbonationMethod", label: "Carbonation Method", type: "select", options: ["Bottle Conditioning", "Force Carbonation", "Spunding"] },
        { key: "waterSource", label: "Water Source", type: "string" },
        { key: "brewhouse", label: "Brewhouse / Setup Name", type: "string" },
      ],
      notes: "Started brewing in January 2026. Focused on pale ales and stouts.",
      createdById: ownerUserId,
    },
  });

  // Pipeline steps
  const pipelineSteps = [
    { id: hobbyPipelinePlannedId, label: "Planned", sortOrder: 0, color: "#94a3b8", isFinal: false },
    { id: hobbyPipelineBrewDayId, label: "Brew Day", sortOrder: 1, color: "#f59e0b", isFinal: false },
    { id: hobbyPipelinePrimaryId, label: "Primary Fermentation", sortOrder: 2, color: "#ef4444", isFinal: false },
    { id: hobbyPipelineSecondaryId, label: "Secondary / Dry Hop", sortOrder: 3, color: "#f97316", isFinal: false },
    { id: hobbyPipelineCarbId, label: "Carbonation", sortOrder: 4, color: "#eab308", isFinal: false },
    { id: hobbyPipelineCondId, label: "Conditioning", sortOrder: 5, color: "#22c55e", isFinal: false },
    { id: hobbyPipelinePackageId, label: "Packaging", sortOrder: 6, color: "#06b6d4", isFinal: false },
    { id: hobbyPipelineTastingId, label: "Tasting / Evaluation", sortOrder: 7, color: "#8b5cf6", isFinal: false },
    { id: hobbyPipelineCompletedId, label: "Completed", sortOrder: 8, color: "#10b981", isFinal: true },
  ];

  for (const step of pipelineSteps) {
    await prisma.hobbySessionStatusStep.upsert({
      where: { id: step.id },
      update: {},
      create: { ...step, hobbyId },
    });
  }

  // Metric definitions
  const metricDefs = [
    { id: hobbyMetricOgId, name: "Original Gravity", unit: "SG", metricType: "numeric", description: "Specific gravity before fermentation" },
    { id: hobbyMetricFgId, name: "Final Gravity", unit: "SG", metricType: "numeric", description: "Specific gravity after fermentation" },
    { id: hobbyMetricPhId, name: "Mash pH", unit: "pH", metricType: "numeric", description: "pH of the mash" },
    { id: hobbyMetricFermTempId, name: "Fermentation Temperature", unit: "°F", metricType: "numeric", description: "Temperature during primary fermentation" },
    { id: hobbyMetricBatchVolId, name: "Batch Volume", unit: "gal", metricType: "numeric", description: "Final volume into fermenter" },
    { id: hobbyMetricPreBoilId, name: "Pre-Boil Gravity", unit: "SG", metricType: "numeric", description: "Specific gravity before the boil" },
    { id: hobbyMetricMashTempId, name: "Mash Temperature", unit: "°F", metricType: "numeric", description: "Strike/rest temperature of the mash" },
  ];

  for (const m of metricDefs) {
    await prisma.hobbyMetricDefinition.upsert({
      where: { hobbyId_name: { hobbyId, name: m.name } },
      update: {},
      create: { ...m, hobbyId },
    });
  }

  // Inventory categories
  const invCategories = [
    "Base Malts", "Specialty Malts", "Hops", "Yeast", "Adjuncts",
    "Water Chemistry", "Fining Agents", "Priming / Carbonation",
    "Sanitizers", "Packaging",
  ];
  for (let i = 0; i < invCategories.length; i++) {
    const catName = invCategories[i]!;
    await prisma.hobbyInventoryCategory.upsert({
      where: { hobbyId_categoryName: { hobbyId, categoryName: catName } },
      update: {},
      create: { hobbyId, categoryName: catName, sortOrder: i },
    });
  }

  // Brewing inventory items
  const brewInvItems = [
    { id: hobbyInvPaleMaltId, name: "2-Row Pale Malt", unit: "lb", quantityOnHand: 25, itemType: "consumable" as const, reorderThreshold: 10 },
    { id: hobbyInvCascadeHopsId, name: "Cascade Hops", unit: "oz", quantityOnHand: 8, itemType: "consumable" as const, reorderThreshold: 4 },
    { id: hobbyInvUs05YeastId, name: "US-05 Yeast", unit: "pkt", quantityOnHand: 3, itemType: "consumable" as const, reorderThreshold: 2 },
    { id: hobbyInvCrystal40Id, name: "Crystal 40L", unit: "lb", quantityOnHand: 5, itemType: "consumable" as const, reorderThreshold: 2 },
    { id: hobbyInvIrishMossId, name: "Irish Moss", unit: "oz", quantityOnHand: 4, itemType: "consumable" as const, reorderThreshold: 2 },
    { id: hobbyInvStarSanId, name: "Star San", unit: "oz", quantityOnHand: 16, itemType: "equipment" as const, reorderThreshold: 8 },
    { id: hobbyInvPrimingSugarId, name: "Priming Sugar (Corn Sugar)", unit: "oz", quantityOnHand: 20, itemType: "consumable" as const, reorderThreshold: 5 },
    { id: hobbyInvFlakedOatsId, name: "Flaked Oats", unit: "lb", quantityOnHand: 3, itemType: "consumable" as const, reorderThreshold: 1 },
  ];

  for (const item of brewInvItems) {
    await prisma.inventoryItem.upsert({
      where: { id: item.id },
      update: { quantityOnHand: item.quantityOnHand },
      create: { ...item, householdId },
    });
    await prisma.hobbyInventoryItem.upsert({
      where: { hobbyId_inventoryItemId: { hobbyId, inventoryItemId: item.id } },
      update: {},
      create: { hobbyId, inventoryItemId: item.id },
    });
  }

  // Recipe 1: Simple American Pale Ale (preset recipe)
  await prisma.hobbyRecipe.upsert({
    where: { id: hobbyRecipeApaId },
    update: {},
    create: {
      id: hobbyRecipeApaId,
      hobbyId,
      name: "Simple American Pale Ale",
      description: "A clean, hop-forward American Pale Ale with Cascade and Centennial hops. Great starter recipe.",
      sourceType: "preset",
      styleCategory: "American Pale Ale",
      estimatedDuration: "240",
      estimatedCost: 32.0,
      yield: "5 gallons",
      notes: "Starter recipe from preset library.",
    },
  });

  // APA ingredients
  await prisma.hobbyRecipeIngredient.deleteMany({ where: { recipeId: hobbyRecipeApaId } });
  const apaIngredients = [
    { name: "2-Row Pale Malt", quantity: 9, unit: "lb", category: "Base Malts", sortOrder: 0, inventoryItemId: hobbyInvPaleMaltId },
    { name: "Crystal 40L", quantity: 0.75, unit: "lb", category: "Specialty Malts", sortOrder: 1, inventoryItemId: hobbyInvCrystal40Id },
    { name: "Cascade Hops (60 min)", quantity: 1, unit: "oz", category: "Hops", sortOrder: 2, inventoryItemId: hobbyInvCascadeHopsId },
    { name: "Cascade Hops (15 min)", quantity: 0.5, unit: "oz", category: "Hops", sortOrder: 3 },
    { name: "Cascade Hops (Flame Out)", quantity: 0.5, unit: "oz", category: "Hops", sortOrder: 4 },
    { name: "US-05 Yeast", quantity: 1, unit: "pkt", category: "Yeast", sortOrder: 5, inventoryItemId: hobbyInvUs05YeastId },
    { name: "Irish Moss", quantity: 1, unit: "tsp", category: "Fining Agents", sortOrder: 6 },
  ];

  for (const ing of apaIngredients) {
    await prisma.hobbyRecipeIngredient.create({
      data: { recipeId: hobbyRecipeApaId, ...ing },
    });
  }

  // APA steps
  const apaSteps = [
    { title: "Heat Strike Water", description: "Heat 4 gallons to 164°F", sortOrder: 0, durationMinutes: 30, stepType: "mash" },
    { title: "Mash In", description: "Add grains, target 152°F rest", sortOrder: 1, durationMinutes: 60, stepType: "mash" },
    { title: "Mash Out", description: "Raise to 168°F for 10 min", sortOrder: 2, durationMinutes: 10, stepType: "mash" },
    { title: "Sparge", description: "Sparge with 170°F water, collect 6.5 gal", sortOrder: 3, durationMinutes: 20, stepType: "sparge" },
    { title: "Bring to Boil", description: "Bring wort to rolling boil", sortOrder: 4, durationMinutes: 15, stepType: "boil" },
    { title: "60 min Hop Addition", description: "Add 1 oz Cascade", sortOrder: 5, durationMinutes: 45, stepType: "boil" },
    { title: "15 min Hop Addition", description: "Add 0.5 oz Cascade + Irish Moss", sortOrder: 6, durationMinutes: 14, stepType: "boil" },
    { title: "Flame Out Hops", description: "Add 0.5 oz Cascade at flame out", sortOrder: 7, durationMinutes: 1, stepType: "boil" },
    { title: "Chill Wort", description: "Cool to 65°F with immersion chiller", sortOrder: 8, durationMinutes: 20, stepType: "cool" },
    { title: "Transfer to Fermenter", description: "Transfer wort and pitch yeast", sortOrder: 9, durationMinutes: 10, stepType: "ferment" },
    { title: "Primary Fermentation", description: "Ferment at 66°F for 14 days", sortOrder: 10, durationMinutes: 20160, stepType: "ferment" },
    { title: "Bottle", description: "Prime with 4.5 oz corn sugar, bottle", sortOrder: 11, durationMinutes: 60, stepType: "package" },
    { title: "Carbonate / Condition", description: "Store at room temp 14 days", sortOrder: 12, durationMinutes: 20160, stepType: "condition" },
  ];

  // Delete existing recipe steps/ingredients before re-creating (idempotent)
  await prisma.hobbyRecipeStep.deleteMany({ where: { recipeId: hobbyRecipeApaId } });
  for (const step of apaSteps) {
    await prisma.hobbyRecipeStep.create({
      data: { recipeId: hobbyRecipeApaId, ...step },
    });
  }

  // Recipe 2: Oatmeal Stout (user recipe)
  await prisma.hobbyRecipe.upsert({
    where: { id: hobbyRecipeStoutId },
    update: {},
    create: {
      id: hobbyRecipeStoutId,
      hobbyId,
      name: "Oatmeal Stout",
      description: "A smooth, full-bodied stout with oatmeal for silky mouthfeel and roasted malt character.",
      sourceType: "user",
      styleCategory: "Oatmeal Stout",
      estimatedDuration: "240",
      estimatedCost: 35.0,
      yield: "5 gallons",
    },
  });

  // Stout ingredients
  const stoutIngredients = [
    { name: "2-Row Pale Malt", quantity: 8, unit: "lb", category: "Base Malts", sortOrder: 0, inventoryItemId: hobbyInvPaleMaltId },
    { name: "Flaked Oats", quantity: 1, unit: "lb", category: "Adjuncts", sortOrder: 1, inventoryItemId: hobbyInvFlakedOatsId },
    { name: "Crystal 40L", quantity: 0.5, unit: "lb", category: "Specialty Malts", sortOrder: 2, inventoryItemId: hobbyInvCrystal40Id },
    { name: "Roasted Barley", quantity: 0.75, unit: "lb", category: "Specialty Malts", sortOrder: 3 },
    { name: "Chocolate Malt", quantity: 0.5, unit: "lb", category: "Specialty Malts", sortOrder: 4 },
    { name: "East Kent Goldings (60 min)", quantity: 1.5, unit: "oz", category: "Hops", sortOrder: 5 },
    { name: "Fuggle (15 min)", quantity: 0.5, unit: "oz", category: "Hops", sortOrder: 6 },
    { name: "US-05 Yeast", quantity: 1, unit: "pkt", category: "Yeast", sortOrder: 7, inventoryItemId: hobbyInvUs05YeastId },
  ];

  await prisma.hobbyRecipeIngredient.deleteMany({ where: { recipeId: hobbyRecipeStoutId } });
  for (const ing of stoutIngredients) {
    await prisma.hobbyRecipeIngredient.create({
      data: { recipeId: hobbyRecipeStoutId, ...ing },
    });
  }

  // Stout steps
  const stoutSteps = [
    { title: "Heat Strike Water", sortOrder: 0, durationMinutes: 30, stepType: "mash" },
    { title: "Mash In", description: "Add grains, target 154°F", sortOrder: 1, durationMinutes: 60, stepType: "mash" },
    { title: "Sparge", sortOrder: 2, durationMinutes: 20, stepType: "sparge" },
    { title: "Boil with Hops", description: "60 min boil, add hops per schedule", sortOrder: 3, durationMinutes: 60, stepType: "boil" },
    { title: "Cool & Transfer", sortOrder: 4, durationMinutes: 30, stepType: "cool" },
    { title: "Pitch Yeast", sortOrder: 5, durationMinutes: 5, stepType: "ferment" },
    { title: "Primary Fermentation", description: "14 days at 64°F", sortOrder: 6, durationMinutes: 20160, stepType: "ferment" },
    { title: "Bottle & Carbonate", sortOrder: 7, durationMinutes: 20160, stepType: "package" },
  ];

  await prisma.hobbyRecipeStep.deleteMany({ where: { recipeId: hobbyRecipeStoutId } });
  for (const step of stoutSteps) {
    await prisma.hobbyRecipeStep.create({
      data: { recipeId: hobbyRecipeStoutId, ...step },
    });
  }

  // Session 1: Batch #1 — APA (completed)
  await prisma.hobbySession.upsert({
    where: { id: hobbySessionBatch1Id },
    update: {},
    create: {
      id: hobbySessionBatch1Id,
      hobbyId,
      recipeId: hobbyRecipeApaId,
      name: "Batch #1 — American Pale Ale",
      status: "completed",
      startDate: new Date("2026-02-01T09:00:00Z"),
      completedDate: new Date("2026-03-01T12:00:00Z"),
      pipelineStepId: hobbyPipelineCompletedId,
      totalCost: 28.50,
      rating: 4,
      notes: "First all-grain batch. Hit targets well. Slight chill haze but great flavor.",
    },
  });

  // Session 1 steps (all completed)
  await prisma.hobbySessionStep.deleteMany({ where: { sessionId: hobbySessionBatch1Id } });
  const batch1Steps = apaSteps.map((s, i) => ({
    sessionId: hobbySessionBatch1Id,
    title: s.title,
    description: s.description,
    sortOrder: i,
    durationMinutes: s.durationMinutes,
    isCompleted: true,
    completedAt: new Date(Date.UTC(2026, 1, 1, 9 + i, 0, 0)),
  }));
  for (const step of batch1Steps) {
    await prisma.hobbySessionStep.create({ data: step });
  }

  // Session 1 ingredients
  await prisma.hobbySessionIngredient.deleteMany({ where: { sessionId: hobbySessionBatch1Id } });
  for (const ing of apaIngredients) {
    await prisma.hobbySessionIngredient.create({
      data: {
        sessionId: hobbySessionBatch1Id,
        name: ing.name,
        quantityUsed: ing.quantity,
        unit: ing.unit,
        unitCost: ing.name.includes("Malt") ? 1.5 : ing.name.includes("Hops") ? 2.0 : 0.5,
        ...(ing.inventoryItemId ? { inventoryItemId: ing.inventoryItemId } : {}),
      },
    });
  }

  // Session 1 metric readings
  await prisma.hobbyMetricReading.deleteMany({ where: { sessionId: hobbySessionBatch1Id } });
  const batch1Readings = [
    { metricDefinitionId: hobbyMetricOgId, value: 1.052, readingDate: new Date("2026-02-01T14:00:00Z"), notes: "Hit target OG" },
    { metricDefinitionId: hobbyMetricFgId, value: 1.012, readingDate: new Date("2026-02-15T10:00:00Z"), notes: "Stable over 3 days" },
    { metricDefinitionId: hobbyMetricFermTempId, value: 66, readingDate: new Date("2026-02-03T08:00:00Z"), notes: "Holding steady" },
    { metricDefinitionId: hobbyMetricMashTempId, value: 152, readingDate: new Date("2026-02-01T10:30:00Z") },
    { metricDefinitionId: hobbyMetricBatchVolId, value: 5.25, readingDate: new Date("2026-02-01T15:00:00Z") },
  ];
  for (const r of batch1Readings) {
    await prisma.hobbyMetricReading.create({
      data: { ...r, sessionId: hobbySessionBatch1Id },
    });
  }

  // Session 1 journal entries
  await prisma.hobbyLog.deleteMany({ where: { sessionId: hobbySessionBatch1Id } });
  await prisma.hobbyLog.createMany({
    data: [
      {
        hobbyId,
        sessionId: hobbySessionBatch1Id,
        title: "Brew Day Notes",
        content: "Smooth brew day overall. Mash temp held well at 152°F. Pre-boil gravity was 1.044, right on target. Used immersion chiller — reached pitching temp in about 20 min. Wort looked crystal clear going into the fermenter.",
        logDate: new Date("2026-02-01T16:00:00Z"),
        logType: "progress",
      },
      {
        hobbyId,
        sessionId: hobbySessionBatch1Id,
        title: "Tasting Notes — 2 Weeks in Bottle",
        content: "Poured clear amber with a nice white head. Cascade aroma is prominent. Clean malt backbone with moderate bitterness. Slight chill haze when cold. Would bump up the flame-out hops to 1 oz next time for more aroma punch.",
        logDate: new Date("2026-03-01T18:00:00Z"),
        logType: "tasting",
      },
    ],
  });

  // Session 2: Batch #2 — Oatmeal Stout (active, in primary fermentation)
  await prisma.hobbySession.upsert({
    where: { id: hobbySessionBatch2Id },
    update: {},
    create: {
      id: hobbySessionBatch2Id,
      hobbyId,
      recipeId: hobbyRecipeStoutId,
      name: "Batch #2 — Oatmeal Stout",
      status: "active",
      startDate: new Date("2026-03-10T09:00:00Z"),
      pipelineStepId: hobbyPipelinePrimaryId,
      notes: "Second batch. Trying the oatmeal stout recipe.",
    },
  });

  // Session 2 steps (brew day completed, fermentation in progress)
  await prisma.hobbySessionStep.deleteMany({ where: { sessionId: hobbySessionBatch2Id } });
  for (let i = 0; i < stoutSteps.length; i++) {
    const s = stoutSteps[i]!;
    await prisma.hobbySessionStep.create({
      data: {
        sessionId: hobbySessionBatch2Id,
        title: s.title,
        description: s.description ?? null,
        sortOrder: i,
        durationMinutes: s.durationMinutes,
        isCompleted: i <= 5, // brew day steps completed
        ...(i <= 5 ? { completedAt: new Date(Date.UTC(2026, 2, 10, 9 + i, 0, 0)) } : {}),
      },
    });
  }

  // Session 2 ingredients
  await prisma.hobbySessionIngredient.deleteMany({ where: { sessionId: hobbySessionBatch2Id } });
  for (const ing of stoutIngredients) {
    await prisma.hobbySessionIngredient.create({
      data: {
        sessionId: hobbySessionBatch2Id,
        name: ing.name,
        quantityUsed: ing.quantity,
        unit: ing.unit,
        ...(ing.inventoryItemId ? { inventoryItemId: ing.inventoryItemId } : {}),
      },
    });
  }

  // Session 2 metric reading: OG
  await prisma.hobbyMetricReading.deleteMany({ where: { sessionId: hobbySessionBatch2Id } });
  await prisma.hobbyMetricReading.create({
    data: {
      metricDefinitionId: hobbyMetricOgId,
      sessionId: hobbySessionBatch2Id,
      value: 1.058,
      readingDate: new Date("2026-03-10T14:00:00Z"),
      notes: "Slightly above target — extra efficiency from fine crush",
    },
  });

  // Session 3: Batch #3 — West Coast IPA (planned, no recipe)
  await prisma.hobbySession.upsert({
    where: { id: hobbySessionBatch3Id },
    update: {},
    create: {
      id: hobbySessionBatch3Id,
      hobbyId,
      name: "Batch #3 — West Coast IPA",
      status: "planned",
      pipelineStepId: hobbyPipelinePlannedId,
      notes: "Planning a West Coast IPA. Need to develop the recipe first.",
    },
  });

  // General hobby journal entries (not scoped to a session)
  await prisma.hobbyLog.deleteMany({ where: { hobbyId, sessionId: null } });
  await prisma.hobbyLog.createMany({
    data: [
      {
        hobbyId,
        title: "Getting Started",
        content: "Ordered the basic all-grain setup. Going to start with extract kits and transition to all-grain once I have the process down.",
        logDate: new Date("2026-01-15T12:00:00Z"),
        logType: "note",
      },
      {
        hobbyId,
        title: "Equipment Arrived",
        content: "Brew kettle, fermenter, bottling bucket, auto-siphon, and hydrometer all arrived. Star San for sanitizing. Ready to brew!",
        logDate: new Date("2026-01-25T14:00:00Z"),
        logType: "progress",
      },
    ],
  });

  const existingForSaleShareLink = await prisma.shareLink.findFirst({
    where: {
      assetId,
      label: "For sale listing"
    }
  });

  if (!existingForSaleShareLink) {
    await prisma.shareLink.create({
      data: {
        householdId,
        assetId,
        createdById: ownerUserId,
        token: nanoid(32),
        label: "For sale listing"
      }
    });
  }

  const existingExpiredShareLink = await prisma.shareLink.findFirst({
    where: {
      assetId,
      label: "Insurance claim (expired)"
    }
  });

  if (!existingExpiredShareLink) {
    await prisma.shareLink.create({
      data: {
        householdId,
        assetId,
        createdById: ownerUserId,
        token: nanoid(32),
        label: "Insurance claim (expired)",
        expiresAt: new Date("2025-02-01T00:00:00.000Z")
      }
    });
  }

  await rebuildSearchIndex(prisma, householdId);

  // ── Built-in Note Templates ──────────────────────────────────────────
  const builtInTemplates = [
    {
      id: "clkeepertmpl0000000000001",
      name: "Decision Log",
      description: "Record a decision with context, options considered, and rationale.",
      bodyTemplate: `<h2>Context</h2><p>What situation or problem prompted this decision?</p><h2>Options Considered</h2><ol><li><strong>Option A</strong> — </li><li><strong>Option B</strong> — </li><li><strong>Option C</strong> — </li></ol><h2>Decision</h2><p>We decided to go with…</p><h2>Rationale</h2><p>Why this option was chosen over the others.</p><h2>Follow-up Actions</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false">Action item 1</li><li data-type="taskItem" data-checked="false">Action item 2</li></ul>`,
      entryType: "decision" as const,
      defaultTags: ["lk:template:decision-log"],
      defaultFlags: ["important"],
      sortOrder: 1
    },
    {
      id: "clkeepertmpl0000000000002",
      name: "Research Brief",
      description: "Summarize research findings with sources and key takeaways.",
      bodyTemplate: `<h2>Topic</h2><p>What are you researching?</p><h2>Key Findings</h2><ul><li></li><li></li><li></li></ul><h2>Sources</h2><ol><li><a href="">Source 1</a> — </li><li><a href="">Source 2</a> — </li></ol><h2>Recommendations</h2><p>Based on the findings above…</p><h2>Open Questions</h2><ul><li></li></ul>`,
      entryType: "reference" as const,
      defaultTags: ["lk:template:research-brief"],
      defaultFlags: [] as string[],
      sortOrder: 2
    },
    {
      id: "clkeepertmpl0000000000003",
      name: "Meeting Notes",
      description: "Capture attendees, agenda, discussion points, and action items.",
      bodyTemplate: `<h2>Meeting Details</h2><p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><p><strong>Purpose:</strong> </p><h2>Agenda</h2><ol><li></li><li></li><li></li></ol><h2>Discussion Notes</h2><p></p><h2>Decisions Made</h2><ul><li></li></ul><h2>Action Items</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false">[ Owner ] — Task description — Due: </li><li data-type="taskItem" data-checked="false">[ Owner ] — Task description — Due: </li></ul>`,
      entryType: "note" as const,
      defaultTags: ["lk:template:meeting-notes"],
      defaultFlags: [] as string[],
      sortOrder: 3
    },
    {
      id: "clkeepertmpl0000000000004",
      name: "Project Kickoff",
      description: "Define project goals, scope, timeline, and stakeholders.",
      bodyTemplate: `<h2>Project Overview</h2><p><strong>Project Name:</strong> </p><p><strong>Start Date:</strong> </p><p><strong>Target Completion:</strong> </p><h2>Goals &amp; Objectives</h2><ol><li></li><li></li></ol><h2>Scope</h2><h3>In Scope</h3><ul><li></li></ul><h3>Out of Scope</h3><ul><li></li></ul><h2>Key Stakeholders</h2><ul><li><strong>Owner:</strong> </li><li><strong>Contributors:</strong> </li></ul><h2>Risks &amp; Constraints</h2><ul><li></li></ul><h2>Success Criteria</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false">Criterion 1</li><li data-type="taskItem" data-checked="false">Criterion 2</li></ul>`,
      entryType: "milestone" as const,
      defaultTags: ["lk:template:project-kickoff"],
      defaultFlags: ["important"],
      sortOrder: 4
    },
    {
      id: "clkeepertmpl0000000000005",
      name: "Comparison Matrix",
      description: "Compare products, services, or approaches side by side.",
      bodyTemplate: `<h2>What Are You Comparing?</h2><p></p><h2>Criteria</h2><ol><li><strong>Price</strong></li><li><strong>Quality</strong></li><li><strong>Features</strong></li><li><strong>Availability</strong></li></ol><h2>Options</h2><h3>Option A</h3><ul><li>Price: </li><li>Quality: </li><li>Features: </li><li>Availability: </li></ul><h3>Option B</h3><ul><li>Price: </li><li>Quality: </li><li>Features: </li><li>Availability: </li></ul><h3>Option C</h3><ul><li>Price: </li><li>Quality: </li><li>Features: </li><li>Availability: </li></ul><h2>Winner &amp; Rationale</h2><p></p>`,
      entryType: "comparison" as const,
      defaultTags: ["lk:template:comparison-matrix"],
      defaultFlags: [] as string[],
      sortOrder: 5
    },
    {
      id: "clkeepertmpl0000000000006",
      name: "Quick Checklist",
      description: "A simple task list for tracking items to complete.",
      bodyTemplate: `<h2>Checklist</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false">Item 1</li><li data-type="taskItem" data-checked="false">Item 2</li><li data-type="taskItem" data-checked="false">Item 3</li><li data-type="taskItem" data-checked="false">Item 4</li><li data-type="taskItem" data-checked="false">Item 5</li></ul><h2>Notes</h2><p></p>`,
      entryType: "note" as const,
      defaultTags: ["lk:template:quick-checklist"],
      defaultFlags: ["actionable"],
      sortOrder: 6
    },
    {
      id: "clkeepertmpl0000000000007",
      name: "Measurement Log",
      description: "Record measurements, readings, or quantitative observations.",
      bodyTemplate: `<h2>What Are You Measuring?</h2><p></p><h2>Readings</h2><ul><li><strong>Date:</strong>  — <strong>Value:</strong>  — <strong>Unit:</strong> </li><li><strong>Date:</strong>  — <strong>Value:</strong>  — <strong>Unit:</strong> </li><li><strong>Date:</strong>  — <strong>Value:</strong>  — <strong>Unit:</strong> </li></ul><h2>Observations</h2><p></p><h2>Trends &amp; Notes</h2><p></p>`,
      entryType: "measurement" as const,
      defaultTags: ["lk:template:measurement-log"],
      defaultFlags: [] as string[],
      sortOrder: 7
    }
  ];

  for (const tmpl of builtInTemplates) {
    await prisma.noteTemplate.upsert({
      where: { id: tmpl.id },
      update: {
        name: tmpl.name,
        description: tmpl.description,
        bodyTemplate: tmpl.bodyTemplate,
        entryType: tmpl.entryType,
        defaultTags: tmpl.defaultTags,
        defaultFlags: tmpl.defaultFlags,
        isBuiltIn: true,
        sortOrder: tmpl.sortOrder
      },
      create: {
        id: tmpl.id,
        householdId,
        createdById: ownerUserId,
        name: tmpl.name,
        description: tmpl.description,
        bodyTemplate: tmpl.bodyTemplate,
        entryType: tmpl.entryType,
        defaultTags: tmpl.defaultTags,
        defaultFlags: tmpl.defaultFlags,
        isBuiltIn: true,
        sortOrder: tmpl.sortOrder
      }
    });
  }

  console.log(JSON.stringify({
    ownerUserId,
    memberUserId,
    householdId,
    sharedAssetId: assetId,
    personalAssetId,
    homeAssetId,
    overdueScheduleId,
    serviceProviderId,
    renovationProviderId,
    inventoryItemOilFilterId,
    inventoryItemCabinFilterId,
    projectId,
    invitationId,
    hobbyId
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
