// Feature flags are controlled by environment variables. Set to "false" to
// disable; any other value (or absent) means enabled by default.
//
// Available flags:
//   FEATURE_SPACES   — spatial item mapping, QR code scans, space analytics
//   FEATURE_WEBHOOKS — outbound webhook delivery and domain-event dispatch

const parseFlag = (value: string | undefined, defaultEnabled: boolean): boolean => {
  if (value === undefined) return defaultEnabled;
  return value !== "false" && value !== "0" && value !== "off" && value !== "no";
};

export const isFeatureEnabled = (flag: string): boolean => {
  switch (flag) {
    case "FEATURE_SPACES":
      return parseFlag(process.env.FEATURE_SPACES, true);
    case "FEATURE_WEBHOOKS":
      return parseFlag(process.env.FEATURE_WEBHOOKS, true);
    default:
      return true;
  }
};
