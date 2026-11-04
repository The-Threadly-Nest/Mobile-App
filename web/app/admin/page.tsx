import type { Metadata } from "next";
import WaitlistAdmin from "../../components/WaitlistAdmin";

export const metadata: Metadata = {
  title: "Owuja administration",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <WaitlistAdmin />;
}
