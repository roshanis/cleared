import Link from "next/link";
import { Configured, LegalSection, Prose, UnconfiguredNotice } from "@/components/legal";
import { PageHeader } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata = {
  title: "Terms",
  description:
    "The terms for using Cleared, including the limits of an automated compliance review and who remains accountable for what ships.",
};

export default function TermsPage() {
  return (
    <div>
      <PageHeader
        title="Terms"
        subtitle="What this service does, what it does not do, and where responsibility sits."
      />
      <UnconfiguredNotice />
      <Prose>
        <p className="text-muted">
          Plain description of the agreement, not legal advice. Have a lawyer
          review this before relying on it.
        </p>

        <LegalSection heading="The service">
          <p>
            Cleared reviews customer-facing text against a compliance rubric,
            quotes the passages it objects to, and routes anything it cannot
            clear to a human reviewer. It is operated by{" "}
            <Configured value={site.legalEntity} as="NEXT_PUBLIC_LEGAL_ENTITY" />.
          </p>
        </LegalSection>

        <LegalSection heading="An automated review is not an approval">
          <p>
            This is the term that matters. The reviewers are language models
            working from a rubric. They miss things, and they flag things that
            are fine. A <strong>pass</strong> verdict means no rule in the
            configured rubric was triggered — it is not a legal opinion, not
            regulatory advice, and not a defence.
          </p>
          <p>
            Accountability for what you publish stays with you and your
            compliance function. The human decision step exists because the
            automated step is not sufficient on its own.
          </p>
        </LegalSection>

        <LegalSection heading="Your obligations">
          <p>
            Submit only material you are entitled to submit. Do not use the
            service to process personal data you have no lawful basis to share
            with a model provider — see the{" "}
            <Link href="/privacy" className="text-accent-strong underline decoration-line-strong underline-offset-2 hover:decoration-accent">privacy page</Link>{" "}
            for where text is sent. Do not attempt to reach documents, reviews,
            or decisions belonging to other users.
          </p>
        </LegalSection>

        <LegalSection heading="Availability and changes">
          <p>
            The service is provided as-is, without a warranty of availability
            or of fitness for a particular regulatory regime. The rubric,
            reviewers, and model versions change over time, so the same document
            may receive a different verdict on a different day; the audit record
            captures which rubric version produced each result.
          </p>
        </LegalSection>

        <LegalSection heading="Liability">
          <p>
            To the extent permitted by law, liability is limited to fees paid
            for the service. Nothing here limits liability that cannot lawfully
            be limited.
          </p>
        </LegalSection>

        <LegalSection heading="Governing law">
          <p>
            These terms are governed by the laws of{" "}
            <Configured
              value={site.jurisdiction}
              as="NEXT_PUBLIC_LEGAL_JURISDICTION"
            />
            . Questions go to{" "}
            <Configured
              value={site.contactEmail}
              as="NEXT_PUBLIC_CONTACT_EMAIL"
            />
            .
          </p>
        </LegalSection>
      </Prose>
    </div>
  );
}
