export interface ComplianceAuditPdfInput {
  householdName: string;
  generatedAt: Date;
  asset: {
    name: string;
    category: string;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    assetTag?: string | null;
  };
  dateRangeStart?: Date | null;
  dateRangeEnd?: Date | null;
  summary: {
    totalScheduledMaintenanceItems: number;
    completedOnTime: number;
    completedLate: number;
    missedOrOverdue: number;
    overallOnTimeRate: number;
    regulatorySchedulesTracked: number;
    regulatoryOnTimeRate: number;
    regulatoryBreakdown: Array<{
      scheduleName: string;
      onTimeRate: number;
      totalCycles: number;
    }>;
    supplementaryEvidence: {
      conditionAssessmentCount: number;
      usageReadingCount: number;
      latestConditionAssessments: Array<{
        assessedAt: string;
        score: number;
        notes?: string;
      }>;
      latestUsageReadings: Array<{
        metricName: string;
        value: number;
        unit: string;
        recordedAt: string;
        notes?: string | null;
      }>;
    };
  };
  schedules: Array<{
    scheduleName: string;
    category: string;
    triggerType: string;
    intervalLabel: string;
    isRegulatory: boolean;
    evidenceSummary?: string | null;
    records: Array<{
      dueDate: string | null;
      completedDate: string | null;
      deltaDays: number | null;
      status: "On Time" | "Late" | "Missed";
      cost: number | null;
      notes: string | null;
    }>;
  }>;
}

export interface AnnualCostPdfInput {
  householdName: string;
  year: number;
  generatedAt: Date;
  summary: {
    totalMaintenanceCost: number;
    totalProjectExpenses: number;
    totalInventoryPurchases: number;
    grandTotal: number;
    assetsMaintainedCount: number;
    maintenanceEventCount: number;
    averageCostPerMaintenanceEvent: number;
    yearOverYear?: {
      priorYear: number;
      deltaPercent: number;
      deltaAmount: number;
    } | null;
  };
  assetRows: Array<{
    assetName: string;
    category: string;
    maintenanceCost: number;
    projectCost: number;
    totalCost: number;
    percentOfGrandTotal: number;
  }>;
  monthlyRows: Array<{
    month: string;
    maintenanceCost: number;
    projectCost: number;
    inventoryCost: number;
    totalCost: number;
  }>;
  categoryRows: Array<{
    category: string;
    eventCount: number;
    totalCost: number;
    averageCost: number;
    percentOfMaintenanceTotal: number;
  }>;
  providerRows: Array<{
    providerName: string;
    eventCount: number;
    totalSpend: number;
    assetsServiced: string[];
  }>;
}

export interface InventoryValuationPdfInput {
  householdName: string;
  asOf: Date;
  generatedAt: Date;
  summary: {
    totalUniqueItems: number;
    totalQuantityOnHand: number;
    estimatedTotalValue: number;
    itemsBelowReorderPoint: number;
    categoriesTracked: number;
  };
  reorderAlerts: Array<{
    itemName: string;
    currentQuantity: number;
    reorderPoint: number;
    deficit: number;
  }>;
  categories: Array<{
    category: string;
    subtotalValue: number;
    items: Array<{
      itemName: string;
      quantity: number;
      unit: string;
      unitCost: number;
      totalValue: number;
      reorderPoint: number | null;
      status: "OK" | "Low" | "Out";
    }>;
  }>;
}