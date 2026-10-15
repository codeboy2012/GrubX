import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Terms"
      title="Terms of Service"
      intro="These terms explain the basic rules for using GrubX and its third-party playback features."
    >
      {[
        ["Acceptance of terms", "By using GrubX, you agree to use the app responsibly and follow these terms."],
        ["Age requirement", "You must be 13 or older to use third-party playback features. If you are under 13, do not use third-party playback."],
        ["Third-party provider warning", "Third-party providers may show unsafe, adult, drug-related, dating, gambling-like, scam-like, or otherwise inappropriate ads."],
        ["No control over third-party ads", "GrubX does not create, control, or endorse third-party ads, redirects, popups, or provider pages."],
        ["User responsibility", "By continuing to playback, you acknowledge these risks and should use a trusted ad blocker."],
        ["Prohibited use", "Do not use GrubX to harass others, bypass safety gates, automate abuse, or submit false reports."],
        ["Content availability", "Content and providers may change, fail, or disappear without notice."],
        ["Reports and moderation", "Provider reports and feedback may be reviewed by the GrubX team to improve safety and reliability."],
        ["Changes to terms", "These terms may be updated as GrubX changes. Continued use means you accept the updated terms."],
        ["Contact", "Use the Contact page to send safety concerns, provider reports, bugs, feature requests, or other feedback."],
      ].map(([title, body]) => (
        <LegalSection key={title} title={title}>
          <p>{body}</p>
        </LegalSection>
      ))}
    </LegalPageShell>
  );
}
