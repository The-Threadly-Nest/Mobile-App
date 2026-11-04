import type { Metadata } from "next";
import WaitlistAdmin from "../../components/WaitlistAdmin";

export const metadata: Metadata = {
  title: "Owuja",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <WaitlistAdmin />;
}
