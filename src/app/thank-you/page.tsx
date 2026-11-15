import Link from "next/link";
import { Card, buttonClass } from "@/components/ui";

export const metadata = {
  title: "You're signed out",
  description: "Confirmation that your Cleared session has ended.",
  // A confirmation page has nothing to offer a search engine, and landing on
  // one cold is confusing.
  robots: { index: false, follow: false },
};

const reasons = {
  "signed-out": {
    title: "You're signed out.",
    body: "Your session cookie has been removed from this browser. Anything you submitted stays on its document's history and in the audit log.",
    action: { href: "/login", label: "Sign back in" },
  },
  default: {
    title: "Thanks — that's done.",
    body: "We've recorded it. There's nothing else for you to do here.",
    action: { href: "/", label: "Back to the start" },
  },
} as const;

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ for?: string }>;
}) {
  const { for: reason } = await searchParams;
  const copy =
    reason && reason in reasons
      ? reasons[reason as keyof typeof reasons]
      : reasons.default;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center sm:py-16">
      <Card className="flex w-full flex-col items-center gap-3 px-6 py-12">
        <span
          aria-hidden
          className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-pass-soft"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-5 w-5 text-pass"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13.5 4.5 6.4 11.6 2.5 7.7" />
          </svg>
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="max-w-md text-sm leading-6 text-muted">{copy.body}</p>
        <Link href={copy.action.href} className={`${buttonClass("primary")} mt-4`}>
          {copy.action.label}
        </Link>
      </Card>
    </div>
  );
}
