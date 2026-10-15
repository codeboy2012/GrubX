/**
 * GrubX official distribution-identity registry.
 *
 * Single source of truth for what counts as an official GrubX channel.
 *  - github.com/CodeBoy2012/GrubX is the official fork-revival repository,
 *    publicly published and verified reachable (HTTP 200) on 2026-10-15; the
 *    intended dpdns.org / xx.kg domains intentionally do not resolve yet —
 *    DNS/TLS comes online only after the repository is cloned to the Linux
 *    server and the Cloudflare Tunnel is configured. That pending state is by
 *    design, NOT a deployment failure; no domain is presented as official
 *    until it is actually serving and verified. Lineage and license: original
 *    project by SRGuyYT, MIT license (LICENSE.md) preserved intact.
 *
 * Third-party APK/IPA mirrors are never listed here, on purpose.
 */

import type { OfficialDomain } from "@/types/officialDomains";

export type { DomainStatus } from "@/types/officialDomains";

export const OFFICIAL_REPO_URL = "https://github.com/CodeBoy2012/GrubX";
export const OFFICIAL_RELEASES_URL = `${OFFICIAL_REPO_URL}/releases`;
export const OFFICIAL_RELEASES_LATEST_URL = `${OFFICIAL_REPO_URL}/releases/latest`;
export const OFFICIAL_SECURITY_NOTICE_LAST_VERIFIED = "2026-10-15";

export const INTENDED_OFFICIAL_DOMAINS: OfficialDomain[] = [
  {
    url: "https://grubx.dpdns.org",
    kind: "main",
    status: "pending-configuration",
    note: "Intended main website, pending deployment: its Cloudflare Tunnel goes online after the Linux server is set up. Until DNS, TLS, and routing are verified post-deployment, prefer the GitHub releases page.",
  },
  {
    url: "https://mobile.grubx.dpdns.org",
    kind: "mobile",
    status: "pending-configuration",
    note: "Mobile website pending deployment; routes to the dedicated mobile shell once the main tunnel is live and the subdomain is configured.",
  },
  {
    url: "https://grubx.xx.kg",
    kind: "main",
    status: "pending-configuration",
    note: "Secondary domain, currently unavailable with no known restoration date.",
  },
  {
    url: "https://mobile.grubx.xx.kg",
    kind: "mobile",
    status: "pending-configuration",
    note: "Unavailable until its parent domain is restored and configured.",
  },
];

/**
 * The deployment origin the developer infra currently documents (manage.sh,
 * EAS profiles). Its public resolvability on 2026-10-15 could not be confirmed
 * from the available networks, so it is recorded as the developer deployment,
 * not as a user-facing official domain.
 */
export const DEVELOPER_DEPLOYMENT_URL = "https://grub.sky0cloud.dpdns.org";

export const DOWNLOADABLE_ARTIFACTS = [
  {
    platform: "Android phone / tablet + Android TV",
    filePattern: "grubx-<version>-android-universal-release.apk",
    checksumFile: "SHA256SUMS.txt",
    note: "One universal APK contains both the phone/tablet launcher and the Android TV leanback launcher; the UI adapts at runtime.",
  },
] as const;
