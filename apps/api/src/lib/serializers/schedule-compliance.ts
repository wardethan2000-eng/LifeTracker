import { scheduleComplianceDashboardSchema } from "@aegis/types";

export const toScheduleComplianceDashboardResponse = (value: unknown) => scheduleComplianceDashboardSchema.parse(value);