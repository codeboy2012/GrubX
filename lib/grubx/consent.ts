export const AGE_GATE_STATUS_KEY = "grubx.ageGateStatus";
export const RISK_CONSENT_ACCEPTED_KEY = "grubx.riskConsentAccepted";
export const RISK_CONSENT_ACCEPTED_AT_KEY = "grubx.riskConsentAcceptedAt";
export const UNDER13_SUSPENDED_KEY = "grubx.under13Suspended";
export const UNDER13_SUSPENDED_AT_KEY = "grubx.under13SuspendedAt";

export type AgeGateStatus = "13plus" | "under13";

const canUseStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

export const getAgeGateStatus = (): AgeGateStatus | null => {
  if (!canUseStorage()) return null;
  const value = window.localStorage.getItem(AGE_GATE_STATUS_KEY);
  return value === "13plus" || value === "under13" ? value : null;
};

export const isUnder13Suspended = () => {
  if (!canUseStorage()) return false;
  return window.localStorage.getItem(UNDER13_SUSPENDED_KEY) === "true" || getAgeGateStatus() === "under13";
};

export const markAge13Plus = () => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(AGE_GATE_STATUS_KEY, "13plus");
  window.localStorage.removeItem(UNDER13_SUSPENDED_KEY);
  window.localStorage.removeItem(UNDER13_SUSPENDED_AT_KEY);
};

export const suspendUnder13 = () => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(AGE_GATE_STATUS_KEY, "under13");
  window.localStorage.setItem(UNDER13_SUSPENDED_KEY, "true");
  window.localStorage.setItem(UNDER13_SUSPENDED_AT_KEY, new Date().toISOString());
};

export const hasRiskConsent = () => {
  if (!canUseStorage()) return false;
  return window.localStorage.getItem(RISK_CONSENT_ACCEPTED_KEY) === "true";
};

export const acceptRiskConsent = () => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(RISK_CONSENT_ACCEPTED_KEY, "true");
  window.localStorage.setItem(RISK_CONSENT_ACCEPTED_AT_KEY, new Date().toISOString());
};

export const getRiskConsentAcceptedAt = () => {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(RISK_CONSENT_ACCEPTED_AT_KEY);
};

export const resetPlaybackSafetyConsent = () => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(AGE_GATE_STATUS_KEY);
  window.localStorage.removeItem(RISK_CONSENT_ACCEPTED_KEY);
  window.localStorage.removeItem(RISK_CONSENT_ACCEPTED_AT_KEY);
  window.localStorage.removeItem(UNDER13_SUSPENDED_KEY);
  window.localStorage.removeItem(UNDER13_SUSPENDED_AT_KEY);
};
