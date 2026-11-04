"use client";

import { useState, type FormEvent } from "react";
import { api, errorMessage } from "../lib/api";
import type { Audience, JoinWaitlistInput, MessageResponse, VerifyResponse } from "../lib/waitlist-types";

const SHOPPING_INTERESTS = [
  "Bridal",
  "Aso-Ebi",
  "Agbada",
  "Kaftan",
  "Senator Wear",
  "Everyday Tailoring",
];

const CITIES = [
  "Lagos",
  "Abuja",
  "Port Harcourt",
  "Ibadan",
  "Enugu",
  "Benin City",
  "Kaduna",
  "Other",
];

const TEAM_SIZES = ["Just me", "2-5 people", "6-10 people", "11+ people"];

function ChevronDownIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19.92 8.95L13.4 15.47C12.63 16.24 11.37 16.24 10.6 15.47L4.08 8.95"
        stroke="#453332"
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckCircleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.75 12L10.58 14.83L16.25 9.17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TickIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 12L10 17L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CallIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M21.97 18.33C21.97 18.69 21.89 19.06 21.72 19.42C21.55 19.78 21.33 20.12 21.04 20.44C20.55 20.98 20.01 21.37 19.4 21.62C18.8 21.87 18.15 22 17.45 22C16.43 22 15.34 21.76 14.19 21.27C13.04 20.78 11.89 20.12 10.75 19.29C9.6 18.45 8.51 17.52 7.47 16.49C6.44 15.45 5.51 14.36 4.68 13.22C3.86 12.08 3.2 10.94 2.72 9.81C2.24 8.67 2 7.58 2 6.54C2 5.86 2.12 5.21 2.36 4.61C2.6 4 2.98 3.44 3.51 2.94C4.15 2.31 4.85 2 5.59 2C5.87 2 6.15 2.06 6.4 2.18C6.66 2.3 6.89 2.48 7.07 2.74L9.39 6.01C9.57 6.26 9.7 6.49 9.79 6.71C9.88 6.92 9.93 7.13 9.93 7.32C9.93 7.56 9.86 7.8 9.72 8.03C9.59 8.26 9.4 8.5 9.16 8.74L8.41 9.51C8.3 9.62 8.24 9.75 8.24 9.91C8.24 10 8.26 10.09 8.3 10.18C8.34 10.27 8.39 10.36 8.44 10.46C8.86 11.23 9.44 12.06 10.19 12.94C10.95 13.82 11.81 14.65 12.78 15.44C12.99 15.61 13.19 15.77 13.38 15.91C13.48 15.98 13.58 16.03 13.68 16.07C13.78 16.11 13.87 16.13 13.97 16.13C14.15 16.13 14.3 16.05 14.42 15.91L15.13 15.11C15.38 14.84 15.63 14.64 15.86 14.51C16.1 14.37 16.33 14.3 16.57 14.3C16.76 14.3 16.96 14.35 17.18 14.45C17.41 14.55 17.65 14.7 17.91 14.89L21.26 17.27C21.52 17.46 21.7 17.67 21.81 17.91C21.91 18.15 21.97 18.33 21.97 18.33Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeMiterlimit="10"
      />
    </svg>
  );
}

const SHOWCASE_ITEMS = [
  {
    label: "Shopper",
    img: "/assets/showcase-shopper.png",
    heightClass: "h-[202px]",
    imgClass: "object-cover object-center",
  },
  {
    label: "Fashion House",
    img: "/assets/showcase-designer-mannequin.png",
    heightClass: "h-[220px]",
    imgClass: "object-cover object-[center_20%]",
  },
  {
    label: "Atelier Fitting",
    img: "/assets/showcase-designer-fitting.png",
    heightClass: "h-[220px]",
    imgClass: "object-cover object-[75%_center]",
  },
  {
    label: "Custom Fashion",
    img: "/assets/showcase-fashion-kimono.png",
    heightClass: "h-[202px]",
    imgClass: "object-cover object-[center_12%]",
  },
];

const SHOPPER_FEATURES = [
  {
    title: "Find your designer",
    description: "Browse designers you’ll love, message them directly and order custom pieces with confidence.",
  },
  {
    title: "Measurements, saved",
    description: "Your measurements stay on Owuja, so the next fitting is easier than the last.",
  },
  {
    title: "See every step",
    description: "Follow your order from in production to ready to ship to shipped.",
  },
];

const DESIGNER_FEATURES = [
  {
    title: "Be found",
    description: "List your work where shoppers are looking for custom fashion.",
  },
  {
    title: "Run it all in one place",
    description: "Manage orders, chats, measurements, staff, and invoices in one place, no app-juggling required.",
  },
  {
    title: "Get your time back",
    description: "Owuja takes on repeat work like resending images and hunting for lost chats.",
  },
];

const FAQS = [
  {
    question: "What does “Owuja” mean?",
    answer:
      "Owuja (pronounced oh-woo-jah) comes from two Yoruba words: owu (thread), the foundation of fabric and sewing, and oja (market), a place for trade and business. Put together, Owuja is a market built on thread—the place where thread meets the market.",
  },
  {
    question: "What is Owuja?",
    answer:
      "Owuja is a business suite and marketplace built for custom African fashion. For designers, it brings orders, chats, measurements, staff, and invoices into one place. For shoppers, it is a marketplace to discover designers, order bespoke pieces, and follow each order from production to delivery.",
  },
  {
    question: "Is joining the waitlist free?",
    answer:
      "Yes, joining the waitlist is 100% free with no commitment required. You get early access invites, launch updates, and founding member perks.",
  },
  {
    question: "When do you launch, and where?",
    answer:
      "We are opening first in Lagos and Abuja in early 2027 before expanding across Nigeria and Africa.",
  },
  {
    question: "I run a fashion business. How does Owuja help me?",
    answer:
      "Instead of juggling Instagram, WhatsApp, and separate tools, Owuja lets you list your collections, talk to customers, keep their measurements safe, manage staff, and send invoices all in one place—giving you your time back.",
  },
  {
    question: "How does Owuja work for shoppers?",
    answer:
      "You can discover designers you love, message them directly, and order custom fashion with confidence. Your measurements stay saved so fittings are seamless, and you can track your order timeline from production to delivery without chasing for updates.",
  },
  {
    question: "Can I join as both a customer and a fashion house owner?",
    answer:
      "Yes, you can register as both or toggle between shopping for custom pieces and managing your fashion business with separate profiles.",
  },
  {
    question: "How is my information used?",
    answer:
      "Only to contact you about Owuja early access and updates. We never sell your details, there is no spam, and you can unsubscribe at any time.",
  },
];

export default function WaitlistPage() {
  const [audience, setAudience] = useState<Audience>("customer");
  const [step, setStep] = useState<"join" | "verify" | "success">("join");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState<JoinWaitlistInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [referral, setReferral] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["Bridal", "Aso-Ebi"]);

  // Desktop - 2 state: Feature tab and FAQ accordion
  const [featuresAudience, setFeaturesAudience] = useState<"shoppers" | "designers">("shoppers");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(5);

  function toggleInterest(item: string) {
    setSelectedInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }

  function toggleFaq(index: number) {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  }

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");

    const data: JoinWaitlistInput = {
      name: value("name"),
      email: value("email"),
      audience,
      city: value("city"),
      phone: value("phone"),
      website: value("website"),
      consent: form.get("consent") === "on",
      ...(audience === "fashion_house"
        ? {
            businessName: value("businessName"),
            teamSize: value("teamSize"),
            interests: `Team: ${value("teamSize") || "Just me"}`,
          }
        : {
            interests: selectedInterests.join(", "),
          }),
      referredBy: new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("ref") || undefined,
    };

    try {
      await api<MessageResponse>("/api/waitlist", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setDetails(data);
      setEmail(data.email.trim().toLowerCase());
      setStep("verify");
      setResendAt(Date.now() + 60000);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    const code = new FormData(event.currentTarget).get("code");
    try {
      const result = await api<VerifyResponse>("/api/waitlist/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setReferral(`${window.location.origin}/?ref=${encodeURIComponent(result.referralCode)}`);
      setStep("success");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!details) return;
    if (Date.now() < resendAt) {
      setMessage("Please wait one minute before requesting another code.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api<MessageResponse>("/api/waitlist", {
        method: "POST",
        body: JSON.stringify(details),
      });
      setResendAt(Date.now() + 60000);
      setMessage("Check your email for your new code.");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const activeFeatures = featuresAudience === "shoppers" ? SHOPPER_FEATURES : DESIGNER_FEATURES;

  return (
    <div className="min-h-screen bg-white text-[#453332]">
      {/* Header with Official Logo */}
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-6 sm:px-12 lg:px-24">
        <a href="/" className="flex items-center gap-2">
          <img src="/assets/logo.svg" alt="Owuja" className="h-9 w-auto" />
        </a>
        <a
          href="#reserve"
          className="flex h-[48px] items-center justify-center rounded-[36px] bg-[#453332] px-[20px] py-[12px] font-['Instrument_Sans',sans-serif] text-[20px] font-medium text-white transition hover:bg-[#342625]"
        >
          Join waitlist
        </a>
      </header>

      {/* Main Hero & Form Grid Layout (Desktop - 1) */}
      <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-6 pb-20 pt-4 sm:px-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-24">
        {/* Left Section: Hero + Value Props + Gallery */}
        <section className="flex flex-col gap-9">
          <div className="flex flex-col gap-4">
            <p className="text-[13px] font-medium tracking-[1.3px] text-[#f96951] sm:text-[15px]">
              OPENING FIRST IN LAGOS &amp; ABUJA · EARLY 2027
            </p>
            <h1 className="font-['Hedvig_Letters_Serif',Georgia,serif] text-4xl font-semibold leading-[1.08] text-[#453332] sm:text-5xl lg:text-[54px]">
              Your fashion business, all in one place.
            </h1>
            <p className="text-[17px] leading-relaxed text-[#404040] sm:text-[19px]">
              Sell clothes, retain clients, and manage operations in one place with Owuja. Designers track orders, chats, measurements, staff, and invoices, while shoppers browse and order custom pieces.
            </p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-3">
            {["Free to join", "Early access invites", "Founding member perks"].map((perk) => (
              <span
                key={perk}
                className="rounded-[36px] border border-[#453332] px-4 py-2 text-[14px] font-medium text-[#453332]"
              >
                {perk}
              </span>
            ))}
          </div>

          {/* Progress / Spots Left */}
          <div className="flex flex-col gap-3 rounded-2xl bg-[#faf7f5] p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-['Hedvig_Letters_Serif',Georgia,serif] text-3xl font-semibold text-[#f96951]">
                  1,284
                </span>
                <span className="ml-2 text-[15px] text-[#404040]">people waiting</span>
              </div>
              <span className="text-[14px] font-medium text-[#746765]">
                716 founding spots left
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-[36px] bg-[#dfdfdf]">
              <div className="h-full w-[64%] rounded-[36px] bg-[#f96951] transition-all" />
            </div>
          </div>

          {/* Image Showcase Grid (Node 65:4831 / Group 14) - Desktop only */}
          <div className="hidden lg:grid grid-cols-2 gap-6">
            {SHOWCASE_ITEMS.map((item) => (
              <div
                key={item.img}
                className={`overflow-hidden rounded-[16px] bg-neutral-100 shadow-sm ${item.heightClass}`}
              >
                <img
                  src={item.img}
                  alt={item.label}
                  className={`h-full w-full transition-transform duration-300 hover:scale-105 ${item.imgClass}`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Right Section: Form Card (Node 52:3522 & 60:4254) */}
        <section id="reserve" className="flex flex-col">
          <div className="rounded-[16px] bg-transparent p-0 shadow-none lg:bg-[rgba(69,51,50,0.15)] lg:p-7 lg:shadow-sm">
            {step === "join" && (
              <>
                {/* Card Title & Intro */}
                <div className="mb-6 flex flex-col gap-2">
                  <div className="flex flex-col gap-1.5">
                    <h2 className="font-['Hedvig_Letters_Serif',Georgia,serif] text-2xl font-semibold text-[#453332]">
                      Reserve your spot
                    </h2>
                    <p className="text-[16px] text-[#404040]">
                      It takes about a minute. Choose how you’ll use Owuja.
                    </p>
                  </div>
                  <p className="pt-2 text-[16px] font-semibold text-black">
                    I am a...
                  </p>

                  {/* Role Switcher Cards (Node 35:3331) */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setAudience("customer")}
                      className={`flex flex-col items-start rounded-[12px] p-3 text-left transition ${
                        audience === "customer"
                          ? "border border-[#453332] bg-[rgba(249,105,81,0.15)]"
                          : "border-[0.5px] border-[#453332] bg-[#dfdfdf] hover:border-[#453332]"
                      }`}
                    >
                      <span className="text-[16px] font-semibold text-[#453332]">Shopper</span>
                      <span className="text-[14px] text-[#404040]">I want custom fashion</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAudience("fashion_house")}
                      className={`flex flex-col items-start rounded-[12px] p-3 text-left transition ${
                        audience === "fashion_house"
                          ? "border border-[#453332] bg-[rgba(249,105,81,0.15)]"
                          : "border-[0.5px] border-[#453332] bg-[#dfdfdf] hover:border-[#453332]"
                      }`}
                    >
                      <span className="text-[16px] font-semibold text-[#453332]">Designer</span>
                      <span className="text-[14px] text-[#404040]">I run a fashion business</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={join} className="flex flex-col gap-4 sm:gap-5">
                  {/* Input Fields Grid (Node 52:3522 & Node 60:4268) */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[14px] font-semibold text-[#453332]">Full name</span>
                      <input
                        name="name"
                        required
                        minLength={2}
                        placeholder="e.g. Chiamaka Okafor"
                        className="h-[56px] w-full rounded-[8px] border-[0.5px] border-[#453332] bg-[#dfdfdf] px-6 text-[16px] text-[#404040] placeholder:text-[#404040]/70 outline-none focus:border-[#453332] focus:bg-white"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-[14px] font-semibold text-[#453332]">Email</span>
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder="you@xmail.com"
                        className="h-[56px] w-full rounded-[8px] border-[0.5px] border-[#453332] bg-[#dfdfdf] px-6 text-[16px] text-[#404040] placeholder:text-[#404040]/70 outline-none focus:border-[#453332] focus:bg-white"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[14px] font-semibold text-[#453332]">WhatsApp number</span>
                      <input
                        name="phone"
                        type="tel"
                        placeholder="0803 847 1289"
                        className="h-[56px] w-full rounded-[8px] border-[0.5px] border-[#453332] bg-[#dfdfdf] px-6 text-[16px] text-[#404040] placeholder:text-[#404040]/70 outline-none focus:border-[#453332] focus:bg-white"
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-[14px] font-semibold text-[#453332]">City</span>
                      <div className="relative">
                        <select
                          name="city"
                          defaultValue="Lagos"
                          className="h-[56px] w-full appearance-none rounded-[8px] border-[0.5px] border-[#453332] bg-[#dfdfdf] px-6 pr-14 text-[16px] text-black outline-none focus:border-[#453332] focus:bg-white"
                        >
                          {CITIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <ChevronDownIcon className="pointer-events-none absolute right-6 top-1/2 size-6 -translate-y-1/2 text-[#453332]" />
                      </div>
                    </label>
                  </div>

                  {/* Designer-specific inputs (Node 65:4850 & Node 76:5740) */}
                  {audience === "fashion_house" ? (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[14px] font-semibold text-[#453332]">Fashion house name</span>
                        <input
                          name="businessName"
                          required
                          maxLength={120}
                          placeholder="e.g. Adaeze Couture"
                          className="h-[56px] w-full rounded-[8px] border-[0.5px] border-[#453332] bg-[#dfdfdf] px-6 text-[16px] text-[#404040] placeholder:text-[#404040]/70 outline-none focus:border-[#453332] focus:bg-white"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[14px] font-semibold text-[#453332]">Team size</span>
                        <div className="relative">
                          <select
                            name="teamSize"
                            defaultValue="Just me"
                            className="h-[56px] w-full appearance-none rounded-[8px] border-[0.5px] border-[#453332] bg-[#dfdfdf] px-6 pr-14 text-[16px] text-black outline-none focus:border-[#453332] focus:bg-white"
                          >
                            {TEAM_SIZES.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                          <ChevronDownIcon className="pointer-events-none absolute right-6 top-1/2 size-6 -translate-y-1/2 text-[#453332]" />
                        </div>
                      </label>
                    </div>
                  ) : (
                    /* Customer shopping interest chips (Node 43:3402 & 60:4289) */
                    <div className="flex flex-col gap-3">
                      <span className="text-[16px] font-semibold tracking-[-0.32px] text-[#453332]">
                        What are you shopping for? (optional)
                      </span>
                      <div className="flex flex-wrap gap-2.5">
                        {SHOPPING_INTERESTS.map((item) => {
                          const active = selectedInterests.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => toggleInterest(item)}
                              className={`flex h-[48px] items-center gap-2 rounded-[64px] px-4 py-3 text-[16px] transition ${
                                active
                                  ? "bg-[#453332] text-white"
                                  : "border-[0.5px] border-[#453332] bg-transparent text-[#453332] hover:bg-[#453332]/5"
                              }`}
                            >
                              {active && <TickIcon className="size-4 shrink-0 text-white" />}
                              <span>{item}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Honeypot for spam bots */}
                  <label className="visually-hidden" aria-hidden="true">
                    Website
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>

                  {/* Consent Checkbox (Node 60:4308) */}
                  <label className="mt-1 flex items-start gap-2.5 text-[12px] leading-relaxed text-[#404040]">
                    <input
                      name="consent"
                      type="checkbox"
                      required
                      defaultChecked
                      className="mt-0.5 h-4 w-4 rounded accent-[#453332]"
                    />
                    <span>
                      Send me launch updates and early access news. No spam, unsubscribe anytime.
                    </span>
                  </label>

                  {/* Submit Button (Node 60:4312) */}
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-[36px] bg-[#453332] py-3.5 text-[20px] font-medium text-white transition hover:bg-[#342625] disabled:opacity-50"
                    >
                      {busy ? "Sending code..." : "Join the waitlist"}
                    </button>
                    <p className="text-center text-[12px] text-[#404040]">
                      We only use your details to contact you about Owuja.
                    </p>
                  </div>
                </form>
              </>
            )}

            {/* Verification Step */}
            {step === "verify" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-[12px] font-bold uppercase tracking-wider text-[#f96951]">
                    VERIFY YOUR EMAIL
                  </p>
                  <h2 className="font-['Hedvig_Letters_Serif',Georgia,serif] text-2xl font-semibold text-[#453332]">
                    Check your inbox
                  </h2>
                  <p className="text-[14px] text-[#746765]">
                    Enter the six-digit code sent to <strong className="text-[#453332]">{email}</strong>. It expires in 10 minutes.
                  </p>
                </div>

                <form onSubmit={verify} className="flex flex-col gap-4">
                  <input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    required
                    autoFocus
                    placeholder="123456"
                    className="rounded-[8px] border-[0.5px] border-[#453332] bg-[#dfdfdf] px-4 py-3 text-center font-mono text-2xl tracking-[6px] text-[#453332] outline-none focus:bg-white focus:border-[#453332]"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-[36px] bg-[#453332] py-3 text-[16px] font-medium text-white transition hover:bg-[#342625] disabled:opacity-50"
                  >
                    {busy ? "Verifying..." : "Verify email"}
                  </button>
                </form>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={resend}
                    className="text-[13px] font-semibold text-[#453332] hover:underline"
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStep("join");
                      setMessage("");
                    }}
                    className="text-[13px] font-semibold text-[#453332] hover:underline"
                  >
                    Change email
                  </button>
                </div>
              </div>
            )}

            {/* Success Step */}
            {step === "success" && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f96951] text-2xl text-white">
                  ✓
                </div>
                <h2 className="font-['Hedvig_Letters_Serif',Georgia,serif] text-3xl font-semibold text-[#453332]">
                  You’re on the list!
                </h2>
                <p className="max-w-md text-[14px] text-[#746765]">
                  Your email has been verified. Share your unique link below to move up the list:
                </p>
                <div className="flex w-full gap-2">
                  <input
                    value={referral}
                    readOnly
                    className="w-full rounded-[8px] border-[0.5px] border-[#453332] bg-white px-3.5 py-2.5 text-[14px] text-[#453332] outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(referral);
                        setMessage("Link copied to clipboard!");
                      } catch {
                        setMessage("Select and copy your link above.");
                      }
                    }}
                    className="whitespace-nowrap rounded-[8px] bg-[#453332] px-4 py-2.5 text-[13px] font-semibold text-white"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Error / Success Feedback */}
            {message && (
              <p
                className={`mt-4 rounded-lg p-3 text-[13px] ${
                  message.includes("copied") || message.includes("Check your email")
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-red-50 text-red-700"
                }`}
                role="status"
              >
                {message}
              </p>
            )}
          </div>
        </section>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          SECTION: WHAT’S WAITING FOR YOU (Figma Node 65:4553 & 65:4916)
         ───────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-6 py-16 sm:px-12 lg:px-24">
        <div className="flex flex-col gap-[24px]">
          <div className="flex flex-col gap-[16px]">
            {/* Eyebrow & Dynamic Title */}
            <div className="flex flex-col gap-[8px]">
              <p className="font-['Instrument_Sans',sans-serif] text-[16px] font-medium tracking-[1.28px] text-[#f96951]">
                WHAT’S WAITING FOR YOU
              </p>
              <h2 className="font-['Instrument_Sans',sans-serif] text-[32px] font-semibold leading-tight text-[#453332] sm:text-[40px] lg:text-[48px]">
                {featuresAudience === "designers"
                  ? "Built for everyone in the atelier"
                  : "Built for the people who make and wear fashion"}
              </h2>
            </div>

            {/* Toggle: Shoppers vs Designers (Figma Node 78:6752 & 65:4558) */}
            <div className="flex items-center gap-[24px]">
              <button
                type="button"
                onClick={() => setFeaturesAudience("shoppers")}
                className={`flex h-[48px] w-[152px] items-center justify-center rounded-[64px] text-[20px] transition ${
                  featuresAudience === "shoppers"
                    ? "bg-[#453332] text-white"
                    : "border-[0.5px] border-[#453332] bg-[#dfdfdf] text-[#453332]"
                }`}
              >
                Shoppers
              </button>
              <button
                type="button"
                onClick={() => setFeaturesAudience("designers")}
                className={`flex h-[48px] w-[152px] items-center justify-center rounded-[64px] text-[20px] transition ${
                  featuresAudience === "designers"
                    ? "bg-[#453332] text-white"
                    : "border-[0.5px] border-[#453332] bg-[#dfdfdf] text-[#453332]"
                }`}
              >
                Designers
              </button>
            </div>
          </div>

          {/* Feature Cards Grid (Figma Node 65:4563 & 65:4926) */}
          <div className="grid grid-cols-1 gap-[20px] md:grid-cols-3">
            {activeFeatures.map((feat) => (
              <div
                key={feat.title}
                className="flex min-h-[159px] flex-col gap-[8px] rounded-[12px] border-[0.5px] border-solid border-[#453332] bg-[rgba(249,105,81,0.15)] p-[24px]"
              >
                <h3 className="font-['Instrument_Sans',sans-serif] text-[24px] font-semibold leading-snug text-[#453332]">
                  {feat.title}
                </h3>
                <p className="font-['Instrument_Sans',sans-serif] text-[18px] font-normal leading-normal text-[#404040] sm:text-[20px]">
                  {feat.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SECTION: QUESTIONS / GOOD TO KNOW (Figma Node 78:6846)
         ───────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-6 pb-24 pt-8 sm:px-12 lg:px-24">
        <div className="flex flex-col gap-[24px]">
          <div className="flex flex-col gap-[8px]">
            <p className="text-[16px] font-medium tracking-[1.28px] text-[#f96951]">
              QUESTIONS
            </p>
            <h2 className="font-['Instrument_Sans',sans-serif] text-4xl font-semibold text-[#453332] sm:text-[48px]">
              Good to know
            </h2>
          </div>

          {/* Accordion List (Node 78:6850) */}
          <div className="flex flex-col gap-[16px]">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={faq.question}
                  className={`border-[0.5px] border-solid border-[#453332] bg-[rgba(249,105,81,0.15)] p-[24px] transition ${
                    isOpen ? "rounded-[12px]" : "rounded-[8px]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="text-[20px] font-medium text-black sm:text-[24px]">
                      {faq.question}
                    </span>
                    <span className="ml-4 flex h-[32px] w-[32px] shrink-0 items-center justify-center text-3xl font-light text-black">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isOpen && (
                    <p className="pt-[16px] text-[17px] font-normal leading-normal text-[#404040] sm:text-[20px]">
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          FOOTER (Node 55:3755 & 65:4621)
         ───────────────────────────────────────────────────────────── */}
      <footer className="w-full rounded-t-[32px] bg-[#453332] py-8 text-white sm:py-10 lg:py-12">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-7 px-6 sm:px-12 lg:flex-row lg:items-start lg:gap-16 lg:px-24">
          {/* Brand & Tagline */}
          <div className="flex flex-col gap-2 sm:gap-4">
            <a href="/" className="inline-block">
              <img
                src="/assets/logo-white.svg"
                alt="Owuja"
                className="h-[25px] w-auto sm:h-8"
              />
            </a>
            <p className="text-[14px] text-white sm:text-[18px]">
              Where fashion gets down to business
            </p>
          </div>

          {/* Links & Contact */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-12 lg:gap-14">
            <div className="flex items-center gap-6">
              <a
                href="/privacy"
                className="text-[16px] font-medium text-[#f96951] transition hover:text-[#f96951]/80 sm:text-[18px]"
              >
                Privacy
              </a>
              <a
                href="/terms"
                className="text-[16px] font-medium text-[#f96951] transition hover:text-[#f96951]/80 sm:text-[18px]"
              >
                Terms
              </a>
              <a
                href="https://instagram.com/owuja"
                target="_blank"
                rel="noreferrer"
                className="text-[16px] font-medium text-[#f96951] transition hover:text-[#f96951]/80 sm:text-[18px]"
              >
                Instagram
              </a>
            </div>

            {/* Contact with Phone Icon (Node 55:3765) */}
            <div className="flex flex-col gap-3">
              <span className="text-[16px] font-medium text-[#f96951] sm:text-[18px]">
                Contact
              </span>
              <a
                href="tel:09034891028"
                className="flex items-center gap-2 text-[16px] text-white transition hover:text-[#f96951] sm:text-[18px]"
              >
                <CallIcon className="size-5 shrink-0 text-white" />
                <span>0903 489 1028</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
