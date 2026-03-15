import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { rebuildSearchIndex } from "../src/lib/search-index.js";

const prisma = new PrismaClient();

const ownerUserId = "clkeeperuser0000000000001";
const memberUserId = "clkeeperuser0000000000002";
const householdId = "clkeeperhouse000000000001";
const assetId = "clkeeperasset0000000000001";
const personalAssetId = "clkeeperasset0000000000002";
const childAssetId = "clkeeperasset0000000000003";
const homeAssetId = "clkeeperasset0000000000004";
const usageMetricId = "clkeepermetric000000000001";
const maintenanceScheduleId = "clkeeperschedule000000001";
const overdueScheduleId = "clkeeperschedule000000002";
const maintenanceLogId = "clkeeperlog00000000000001";
const maintenanceLogFollowUpId = "clkeeperlog00000000000002";
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
    where: { id: { in: [maintenanceLogId, maintenanceLogFollowUpId] } },
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
        notes: item.notes
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
        notes: item.notes
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
          inventoryItemPainterTapeId
        ]
      }
    }
  });

  // ── Tier 2: Maintenance Log Part ──────────────────────────────────────────
  await prisma.maintenanceLogPart.deleteMany({
    where: { logId: { in: [maintenanceLogId, maintenanceLogFollowUpId] } }
  });
  await prisma.maintenanceLogPart.createMany({
    data: [
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

  await prisma.projectAsset.upsert({
    where: { projectId_assetId: { projectId, assetId: homeAssetId } },
    update: {
      role: "work area",
      notes: "Primary kitchen space undergoing phased layout and finish updates"
    },
    create: {
      projectId,
      assetId: homeAssetId,
      role: "work area",
      notes: "Primary kitchen space undergoing phased layout and finish updates"
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

  await rebuildSearchIndex(prisma, householdId);

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
