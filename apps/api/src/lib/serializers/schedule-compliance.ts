import { scheduleComplianceDashboardSchema } from "@lifekeeper/types";

export const toScheduleComplianceDashboardResponse = (value: unknown) => scheduleComplianceDashboardSchema.parse(value);