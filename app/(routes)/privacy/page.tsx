import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Privacy"
      title="Privacy and disclaimer"
      intro="GrubX is local-first, but third-party providers and admin feedback systems may involve separate data handling."
    >
      <LegalSection title="Local browser storage">
        <p>
          GrubX stores basic preferences locally in browser storage, including settings, watchlist, continue watching,
          age gate choices, and risk consent choices.
        </p>
      </LegalSection>
      <LegalSection title="Age gate and risk consent">
        <p>
          Age gate and risk consent choices are stored locally on your device using browser storage. Clearing site data
          resets those choices.
        </p>
      </LegalSection>
      <LegalSection title="Reports and feedback">
        <p>
          Reports and feedback may be sent to Matrix/admin chat through GrubX server-side API routes. Do not include
          private passwords, secrets, or sensitive personal information in reports.
        </p>
      </LegalSection>
      <LegalSection title="Third-party providers">
        <p>
          Third-party providers may have their own tracking, cookies, policies, ads, and redirects. GrubX does not
          control third-party provider privacy practices.
        </p>
      </LegalSection>
      <LegalSection title="Playback disclaimer">
        <p>
          Third-party playback may show unsafe ads or pages. Use a trusted ad blocker and avoid entering personal
          information on third-party pages.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
