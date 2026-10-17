import Link from "next/link";
import { Configured, LegalSection, Prose, UnconfiguredNotice } from "@/components/legal";
import { PageHeader } from "@/components/ui";
import { site, usesThirdPartyModel } from "@/lib/site";

export const metadata = {
  title: "Privacy",
  description:
    "What Cleared stores when you submit a document for review, the one cookie it sets, and who else sees your text.",
};

export default function PrivacyPage() {
  const thirdPartyModel = usesThirdPartyModel();
  return (
    <div>
      <PageHeader
        title="Privacy"
        subtitle="What this service stores, why, and who else can see it."
      />
      <UnconfiguredNotice />
      <Prose>
        <p className="text-muted">
          This describes how the software actually behaves. It is not legal
          advice, and a deployment handling real customer documents should have
          it reviewed before publishing.
        </p>

        <LegalSection heading="Who operates this service">
          <p>
            <Configured value={site.legalEntity} as="NEXT_PUBLIC_LEGAL_ENTITY" />
            , at{" "}
            <Configured
              value={site.postalAddress}
              as="NEXT_PUBLIC_CONTACT_ADDRESS"
            />
            . Privacy questions go to{" "}
            <Configured
              value={site.privacyEmail}
              as="NEXT_PUBLIC_PRIVACY_EMAIL"
            />
            .
          </p>
        </LegalSection>

        <LegalSection heading="Cookies">
          <p>
            One: <code className="font-mono text-sm">cleared_session</code>. It
            holds your signed-in identity and role, signed so it cannot be
            edited in the browser. It is strictly necessary — without it there
            is no way to keep you signed in — so it is set without asking, and
            it is removed when you sign out.
          </p>
          <p className="text-muted">
            No advertising, profiling, or cross-site tracking cookies are set.
            If a deployment turns on analytics that stores anything on your
            device, a consent banner appears and nothing is loaded until you
            accept.
          </p>
        </LegalSection>

        <LegalSection heading="What you submit">
          <p>
            The document text you paste is stored, along with every version,
            every review result with its quoted findings, and every human
            decision and note. That trail is the point of the product: a
            compliance record has to show what was said, what the reviewers
            found, and who signed it off.
          </p>
          <p>
            Documents are capped at 50,000 characters. Your name and role are
            attached to the documents you submit and the decisions you record.
          </p>
        </LegalSection>

        <LegalSection heading="Where your text goes">
          {thirdPartyModel ? (
            <p>
              This deployment is configured with an OpenAI API key, so the text
              of each submitted document is sent to OpenAI to be reviewed and,
              when you ask for fixes, rewritten. Do not paste anything into it
              that you are not permitted to send to a third-party model
              provider.
            </p>
          ) : (
            <p>
              This deployment has no model provider configured, so reviews run
              on a local deterministic reviewer and document text is not sent
              anywhere outside this service.
            </p>
          )}
          <p className="text-muted">
            Which of the two is running is shown on the submit page before you
            send anything — &ldquo;Model reviewers&rdquo; or &ldquo;Demo
            reviewer&rdquo;.
          </p>
        </LegalSection>

        <LegalSection heading="Retention, and a limitation worth knowing">
          <p>
            Review history and decisions are kept for as long as the deployment
            keeps its database. The software currently ships{" "}
            <strong>no automatic retention limit and no self-service
            deletion</strong>: removing a document or an account means an
            operator acting directly on the database.
          </p>
          <p className="text-muted">
            If you need erasure, or a copy of what is held about you, write to{" "}
            <Configured
              value={site.privacyEmail}
              as="NEXT_PUBLIC_PRIVACY_EMAIL"
            />
            . Be aware that deleting an audit record may conflict with the
            retention duties the record exists to satisfy.
          </p>
        </LegalSection>

        <LegalSection heading="Demo mode">
          <p>
            When the public demo is running, the four personas and the seeded
            documents are synthetic. Anything you submit while signed in as a
            demo persona is visible to anyone else using the demo, and may be
            wiped whenever the demo data is reset. Do not put real customer
            material into it.
          </p>
        </LegalSection>

        <p className="border-t border-line pt-6 text-sm text-muted">
          See also the <Link href="/terms" className="text-accent-strong underline decoration-line-strong underline-offset-2 hover:decoration-accent">terms</Link>.
        </p>
      </Prose>
    </div>
  );
}
