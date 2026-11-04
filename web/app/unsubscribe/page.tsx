import type { Metadata } from "next";
import UnsubscribeForm from "../../components/UnsubscribeForm";

export const metadata: Metadata = {
  title: "Leave the Owuja waitlist",
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return <UnsubscribeForm />;
}
