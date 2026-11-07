import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Owuja",
  description: "How Owuja handles waitlist information, launch emails, referrals and browser storage.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-[#453332]">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <a href="/" aria-label="Owuja home"><img src="/assets/logo.svg" alt="Owuja" className="h-7 w-auto" /></a>
        <a href="/" className="group inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#453332] px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#342625] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#453332] sm:px-5">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5"><path d="m10 6-6 6 6 6M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back to home
        </a>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <h1 className="font-['Hedvig_Letters_Serif'] text-4xl leading-tight sm:text-5xl">Privacy policy</h1>
        <p className="mt-3 text-sm text-[#746765]">Last updated: 7 November 2026</p>
        <p className="mt-6 text-base leading-7">This policy explains how Owuja handles information on www.owuja.com and its early-access waitlist. It covers early-access registration and related communications, not the unreleased mobile app or future marketplace features.</p>

        <div className="mt-9 space-y-8 text-base leading-7 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          <section aria-labelledby="owner">
            <h2 id="owner">1. Who handles your information</h2>
            <p>Owuja is responsible for deciding how your waitlist information is used (the data controller). For privacy questions or requests, email <a href="mailto:support@owuja.com">support@owuja.com</a>.</p>
          </section>
          <section aria-labelledby="collection">
            <h2 id="collection">2. What we collect</h2>
            <ul>
              <li>Your name, email address, selected role (shopper or designer), city and optional phone number.</li>
              <li>For designers, business name and team size; for shoppers, any fashion interests you select.</li>
              <li>Your referral code, any referring code in your signup link, signup and consent times, and registration, invitation, email-delivery and unsubscribe status.</li>
              <li>Technical request information used to deliver and protect the service, such as IP addresses or derived visitor identifiers, request paths, timestamps and response status. Our hosting and email providers also process service and delivery information.</li>
              <li>Information you choose to send when contacting support.</li>
            </ul>
            <p className="mt-3">Name, email, role and consent to waitlist communications are required to join. Designers must also provide a business name. Other fields help us understand interest in Owuja. Please do not submit sensitive information in these fields.</p>
          </section>
          <section aria-labelledby="purposes">
            <h2 id="purposes">3. Why we use it</h2>
            <p>We use your information to save your place, issue referral links, send welcome emails, launch updates and early-access invitations, understand shopper and designer interests, answer requests, and protect against spam, abuse and duplicate registrations. We display aggregate registration counts, not your registration details, publicly.</p>
            <p className="mt-3">We rely on your consent for waitlist updates and optional preferences. We rely on our legitimate interests in operating and securing the service for essential administration, duplicate prevention and abuse controls, taking your rights into account. We may also process information to meet applicable legal obligations. You can withdraw consent without affecting processing that took place before withdrawal.</p>
          </section>
          <section aria-labelledby="providers">
            <h2 id="providers">4. Who receives it</h2>
            <ul>
              <li>Cloud infrastructure and database providers that securely host our website, application services, and waitlist registration records.</li>
              <li>Transactional communication and email delivery providers that transmit welcome messages, early-access invitations, and service notifications on our behalf.</li>
              <li>Authorized personnel and administrators of Owuja who require access to administer waitlist registrations and provide customer support.</li>
              <li>Relevant authorities or third parties where required by applicable law, court order, or necessary to protect legal rights and prevent fraud or abuse.</li>
            </ul>
            <p className="mt-3">We do not sell your waitlist information or share it with third parties for targeted advertising. Our service providers operate under data protection obligations and may process data securely in cloud facilities located internationally. For questions regarding our data processors, contact us at <a href="mailto:support@owuja.com">support@owuja.com</a>.</p>
          </section>
          <section aria-labelledby="storage">
            <h2 id="storage">5. Browser storage and external links</h2>
            <p>After signup, we store a receipt in your browser under <code className="break-all rounded bg-[#453332]/5 px-1 text-sm">owuja.waitlist.receipt.v1</code>. It contains a version number and, where available, your referral code, not your name, email or unsubscribe token. This helps us remember that you joined and show your referral link. It uses local storage, not an advertising cookie, and has no automatic expiry. You can remove it by clearing this site’s browser data; doing so does not delete your registration.</p>
            <p className="mt-3">The current landing page does not embed advertising pixels, third-party analytics or social-media widgets. Share buttons open external services only when you choose them. Those services apply their own privacy policies. Your referral link contains a code, not your name or email, and anyone you share it with can see that code.</p>
          </section>
          <section aria-labelledby="retention">
            <h2 id="retention">6. Retention and security</h2>
            <p>Waitlist records currently have no automatic deletion deadline. We keep them to administer the waitlist and invitations until they are no longer needed or a valid deletion request is fulfilled, subject to legal obligations and limited records needed to honor opt-outs or prevent abuse. Unsubscribing stops waitlist updates but does not automatically delete your record. Provider logs and backups follow the relevant provider’s retention arrangements.</p>
            <p className="mt-3">We use access controls and other technical safeguards to protect information. No online service or transmission method can be guaranteed completely secure.</p>
          </section>
          <section aria-labelledby="rights">
            <h2 id="rights">7. Your choices and rights</h2>
            <p>Use the unsubscribe link in a waitlist email to stop updates, or contact <a href="mailto:support@owuja.com">support@owuja.com</a>. Depending on applicable law, you can request access, correction, deletion, restriction, portability, or object to certain processing. We may need to verify your identity before acting. If a request cannot be fulfilled in full, we will explain why.</p>
            <p className="mt-3">You can also complain to the <a href="https://ndpc.gov.ng/" rel="noreferrer">Nigeria Data Protection Commission</a> or another competent data-protection authority. This policy does not limit your statutory rights.</p>
          </section>
          <section aria-labelledby="children">
            <h2 id="children">8. Children</h2>
            <p>The waitlist is not directed at children. If you believe a child has submitted information without appropriate authorization, contact us so we can review and address it.</p>
          </section>
          <section aria-labelledby="changes">
            <h2 id="changes">9. Changes to this policy</h2>
            <p>We will update this page when our practices change and revise the date above. Where required, we will provide additional notice or request consent before using information for a new purpose. The mobile app and marketplace will need updated privacy information before their launch.</p>
          </section>
        </div>
        <footer className="mt-12 border-t border-[#453332]/15 pt-6 text-sm text-[#746765]">Owuja · <a href="mailto:support@owuja.com" className="underline underline-offset-4">support@owuja.com</a></footer>
      </main>
    </div>
  );
}
