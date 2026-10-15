import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";

export default function SafetyPage() {
  return (
    <LegalPageShell
      eyebrow="Safety"
      title="GrubX safety notice"
      intro="GrubX is a media discovery and playback interface. Some playback may be provided by third-party providers, and those providers may show ads or redirects GrubX does not control."
    >
      <LegalSection title="Third-party providers">
        <p>
          Some playback is loaded from third-party providers. These providers may change their pages, ad behavior,
          redirects, or availability without notice.
        </p>
      </LegalSection>
      <LegalSection title="Popups and ads">
        <p>
          Third-party providers may show popups, redirects, fake download buttons, or unexpected pages. GrubX does not
          control third-party provider advertisements.
        </p>
      </LegalSection>
      <LegalSection title="NSFW/adult content warning">
        <p>
          Some provider ads may contain adult or NSFW content. Do not continue to third-party playback if that risk is
          not acceptable for your environment.
        </p>
      </LegalSection>
      <LegalSection title="Drug/weed ad warning">
        <p>Some third-party ads may reference weed, drugs, or related products. GrubX does not create or endorse those ads.</p>
      </LegalSection>
      <LegalSection title="Dating/scam ad warning">
        <p>
          Some ads may be dating-related, scam-like, or ask for personal information. Do not enter personal information
          on third-party pages opened from a provider.
        </p>
      </LegalSection>
      <LegalSection title="Recommended protection">
        <ul className="grid gap-2">
          <li>Use a trusted ad blocker such as uBlock Origin.</li>
          <li>Do not click popups or fake download buttons.</li>
          <li>Do not enter personal information on third-party pages.</li>
          <li>Close any unexpected tabs.</li>
          <li>Report unsafe providers inside GrubX.</li>
          <li>Users under 13 should not use third-party playback.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Under-13 policy">
        <p>
          If you are under 13, you cannot use third-party playback features because providers may show unsafe ads,
          popups, or adult content.
        </p>
      </LegalSection>
      <LegalSection title="How to report unsafe providers">
        <p>
          Use the Report Provider button inside the player, or visit the Contact page and choose Provider report or
          Safety concern.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
