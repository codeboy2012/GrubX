export type DomainStatus = "not-resolving" | "pending-configuration" | "operational-verified";

export type OfficialDomain = {
  url: string;
  kind: "main" | "mobile";
  status: DomainStatus;
  note: string;
};
