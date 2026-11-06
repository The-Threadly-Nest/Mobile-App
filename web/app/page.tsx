"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { api, errorMessage } from "../lib/api";
import { createSubmissionLock } from "../lib/submission-lock";
import type { Audience, JoinWaitlistInput, JoinWaitlistResponse, WaitlistStats } from "../lib/waitlist-types";

const HERO_TITLE = "Your fashion business, all in one place.";

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

function CopyIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 12.9V17.1C16 20.6 14.6 22 11.1 22H6.9C3.4 22 2 20.6 2 17.1V12.9C2 9.4 3.4 8 6.9 8H11.1C14.6 8 16 9.4 16 12.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 6.9V11.1C22 14.6 20.6 16 17.1 16H16V12.9C16 9.4 14.6 8 11.1 8H8V6.9C8 3.4 9.4 2 12.9 2H17.1C20.6 2 22 3.4 22 6.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.736l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function InstagramIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

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
    answer: "Coming soon across Nigeria and Africa.",
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
  const [step, setStep] = useState<"join" | "success">("join");
  const [busy, setBusy] = useState(false);
  const submissionLock = useRef(createSubmissionLock());
  const [message, setMessage] = useState("");
  const [referral, setReferral] = useState("");
  const [city, setCity] = useState("Lagos");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["Bridal", "Aso-Ebi"]);
  const [copied, setCopied] = useState(false);

  // Typewriter animation state
  const [typedTitle, setTypedTitle] = useState("");
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  const refreshStats = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await api<WaitlistStats>("/api/waitlist/stats", { signal });
      if (!Number.isSafeInteger(data.registered) || data.registered < 0 || data.capacity !== 5000) throw new Error("Invalid waitlist count");
      if (signal?.aborted) return;
      setStats(data);
      setStatsUnavailable(false);
    } catch {
      if (!signal?.aborted) setStatsUnavailable(true);
    }
  }, []);
  const progressWidth = stats ? Math.min(100, stats.registered / stats.capacity * 100) : 0;

  // Desktop - 2 state: Feature tab, FAQ accordion, and Modal
  const [featuresAudience, setFeaturesAudience] = useState<"shoppers" | "designers">("shoppers");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { if (!document.hidden) void refreshStats(controller.signal); };
    refresh();
    const interval = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refreshStats]);

  useEffect(() => {
    let charIndex = 0;
    let isDeleting = false;
    let timeoutId: NodeJS.Timeout;

    function tick() {
      if (!isDeleting) {
        charIndex++;
        setTypedTitle(HERO_TITLE.slice(0, charIndex));

        if (charIndex === HERO_TITLE.length) {
          setIsTypingComplete(true);
          timeoutId = setTimeout(() => {
            isDeleting = true;
            setIsTypingComplete(false);
            tick();
          }, 2400);
          return;
        }
        timeoutId = setTimeout(tick, 55);
      } else {
        charIndex--;
        setTypedTitle(HERO_TITLE.slice(0, charIndex));

        if (charIndex === 0) {
          isDeleting = false;
          timeoutId = setTimeout(tick, 500);
          return;
        }
        timeoutId = setTimeout(tick, 28);
      }
    }

    timeoutId = setTimeout(tick, 200);
    return () => clearTimeout(timeoutId);
  }, []);

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
    if (step !== "join" || !submissionLock.current.start()) return;

    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");
    const submittedCity = (city === "Other" ? value("otherCity") : city).trim();
    if (city === "Other" && submittedCity.length < 2) {
      setMessage("Please enter your city name.");
      submissionLock.current.retry();
      return;
    }

    const data: JoinWaitlistInput = {
      name: value("name"),
      email: value("email"),
      audience,
      city: submittedCity,
      phone: value("phone"),
      website: value("website"),
      consent: form.get("consent") === "on",
      ...(audience === "fashion_house"
        ? {
          businessName: value("businessName"),
          teamSize: value("teamSize"),
        }
        : {
          interests: selectedInterests.join(", "),
        }),
      referredBy: new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("ref") || undefined,
    };

    setMessage("");
    setBusy(true);
    try {
      const response = await api<JoinWaitlistResponse>("/api/waitlist", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!response || typeof response.message !== "string") {
        throw new Error("We couldn't confirm your signup. Please try again.");
      }
      submissionLock.current.complete();
      setReferral(response.referralCode ? `${window.location.origin}/?ref=${encodeURIComponent(response.referralCode)}` : "");
      setStep("success");
      void refreshStats();
    } catch (error) {
      submissionLock.current.retry();
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const activeFeatures = featuresAudience === "shoppers" ? SHOPPER_FEATURES : DESIGNER_FEATURES;

  // Shared form card content (used both in mobile inline & desktop popup modal)
  function renderWaitlistForm() {
    return (
      <>
        {/* Card Title & Intro */}
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-['Hedvig_Letters_Serif'] serif-semibold text-2xl font-normal text-[#453332]">
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
              disabled={busy}
              onClick={() => setAudience("customer")}
              className={`flex flex-col items-start rounded-[12px] p-3 text-left transition ${audience === "customer"
                ? "border border-[#453332] bg-[rgba(249,105,81,0.15)]"
                : "border-[0.5px] border-[#453332] bg-[#dfdfdf] hover:border-[#453332]"
                }`}
            >
              <span className="text-[16px] font-semibold text-[#453332]">Shopper</span>
              <span className="text-[14px] text-[#404040]">I want custom fashion</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => setAudience("fashion_house")}
              className={`flex flex-col items-start rounded-[12px] p-3 text-left transition ${audience === "fashion_house"
                ? "border border-[#453332] bg-[rgba(249,105,81,0.15)]"
                : "border-[0.5px] border-[#453332] bg-[#dfdfdf] hover:border-[#453332]"
                }`}
            >
              <span className="text-[16px] font-semibold text-[#453332]">Designer</span>
              <span className="text-[14px] text-[#404040]">I run a fashion business</span>
            </button>
          </div>
        </div>

        <form onSubmit={join} aria-busy={busy} className="flex flex-col gap-4 sm:gap-5">
          <fieldset disabled={busy} className="contents">
          {/* Input Fields Grid (Node 52:3522 & Node 60:4268) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
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

          {city === "Other" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[14px] font-semibold text-[#453332]">Your city</span>
              <input
                name="otherCity"
                type="text"
                autoComplete="address-level2"
                required
                minLength={2}
                maxLength={100}
                placeholder="Enter your city name"
                className="h-[56px] w-full rounded-[8px] border-[0.5px] border-[#453332] bg-[#dfdfdf] px-6 text-[16px] text-[#404040] placeholder:text-[#404040]/70 outline-none focus:border-[#453332] focus:bg-white"
              />
            </label>
          )}

          {/* Designer-specific inputs (Node 65:4850 & Node 76:5740) */}
          {audience === "fashion_house" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                      className={`flex h-[48px] items-center gap-2 rounded-[64px] px-4 py-3 text-[16px] transition ${active
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
              {busy ? "Joining..." : "Join the waitlist"}
            </button>
            <p className="text-center text-[12px] text-[#404040]">
              We only use your details to contact you about Owuja.
            </p>
          </div>
          </fieldset>
        </form>
      </>
    );
  }

  // Shared confirmation view matching reference design
  function renderSuccessContent() {
    const displayReferral =
      referral ||
      (typeof window !== "undefined"
        ? `${window.location.origin}/?ref=OWUJA`
        : "https://owuja.com/?ref=OWUJA");

    return (
      <div className="flex flex-col items-center gap-5 py-5 text-center">
        {/* Landing Page Official Logo */}
        <div className="flex items-center justify-center py-1">
          <img src="/assets/logo.svg" alt="Owuja" className="h-10 w-auto" />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="font-['Hedvig_Letters_Serif'] text-[28px] font-normal leading-tight text-[#453332] sm:text-[32px]">
            You&apos;re on the waitlist
          </h2>
          <p className="mx-auto max-w-sm text-[15px] font-medium leading-relaxed text-[#746765]">
            You&apos;ve successfully secured your spot. Excited?
            <br />
            Feel free to refer your friends!
          </p>
        </div>

        {/* Guaranteed Referral Link with One-Click Copy */}
        <div className="flex w-full max-w-[430px] items-center justify-between rounded-full border border-black/10 bg-[#f4f4f4] p-1.5 pl-5 shadow-inner">
          <input
            type="text"
            readOnly
            value={displayReferral}
            onClick={async (e) => {
              (e.target as HTMLInputElement).select();
              await navigator.clipboard.writeText(displayReferral);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="w-full cursor-pointer bg-transparent text-[14px] text-[#453332] outline-none"
          />
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(displayReferral);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            title="Copy referral link"
            className={`flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition ${copied
              ? "bg-[#25D366] text-white"
              : "bg-[#1a1a1a] text-white hover:bg-black"
              }`}
          >
            {copied ? (
              <>
                <TickIcon className="h-3.5 w-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <CopyIcon className="h-3.5 w-3.5 text-white" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* "Or" separator */}
        <p className="text-[14px] font-medium text-[#746765]">Or</p>

        {/* Social Share & Follow Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* X (Twitter) */}
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("I just joined the Owuja waitlist — the marketplace for custom African fashion. Join me!")}&url=${encodeURIComponent(displayReferral)}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-[42px] items-center gap-2 rounded-full bg-[#1c1c1c] px-5 text-[14px] font-medium text-white transition hover:bg-black"
          >
            <XIcon className="h-3.5 w-3.5 fill-current" />
            <span>Share</span>
          </a>

          {/* WhatsApp */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent("I just joined the Owuja waitlist — custom African fashion, all in one place. Join me: " + displayReferral)}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-[42px] items-center gap-2 rounded-full bg-[#25D366] px-5 text-[14px] font-medium text-white transition hover:bg-[#20bd5a]"
          >
            <WhatsAppIcon className="h-4 w-4 fill-current" />
            <span>Share</span>
          </a>

          {/* Instagram Button */}
          <a
            href="https://www.instagram.com/useowuja?xtok=MTluNDdiaHdsZWVuMg%3D%3D"
            target="_blank"
            rel="noreferrer"
            className="flex h-[42px] items-center gap-2 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] px-5 text-[14px] font-medium text-white shadow-sm transition hover:opacity-95"
          >
            <InstagramIcon className="h-4 w-4" />
            <span>Instagram</span>
          </a>
        </div>

        {/* Follow us on Instagram direct link */}
        <div className="pt-2 text-[14px] text-[#746765]">
          Follow us on Instagram:{" "}
          <a
            href="https://www.instagram.com/useowuja?xtok=MTluNDdiaHdsZWVuMg%3D%3D"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#f96951] underline underline-offset-4 hover:opacity-80"
          >
            @useowuja
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#453332]">
      {/* Header with Official Logo */}
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-6 sm:px-12 lg:px-24">
        <a href="/" className="flex items-center gap-2">
          <img src="/assets/logo.svg" alt="Owuja" className="h-9 w-auto" />
        </a>
        {/* Mobile: scroll to form | Desktop: open modal */}
        <a
          href="#reserve"
          className="flex h-[48px] items-center justify-center rounded-[36px] bg-[#453332] px-[20px] py-[12px] font-['Instrument_Sans',sans-serif] text-[20px] font-medium text-white transition hover:bg-[#342625] lg:hidden"
        >
          Join waitlist
        </a>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="hidden h-[48px] items-center justify-center rounded-[36px] bg-[#453332] px-[20px] py-[12px] font-['Instrument_Sans',sans-serif] text-[20px] font-medium text-white transition hover:bg-[#342625] lg:flex"
        >
          Join waitlist
        </button>
      </header>

      {/* Main Hero & Form Grid Layout (Desktop - 1) */}
      <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-6 pb-20 pt-16 sm:px-12 lg:gap-16 lg:px-24">
        {/* Centered Hero Section */}
        <section className="flex flex-col items-center gap-9 text-center">
          <div className="flex flex-col gap-4 lg:max-w-2xl">
            <h1 className="font-['Hedvig_Letters_Serif'] serif-semibold text-4xl font-normal leading-[1.08] text-[#453332] sm:text-5xl lg:text-[54px] min-h-[85px] sm:min-h-[110px] lg:min-h-[125px]">
              <span className="sr-only">{HERO_TITLE}</span>
              <span aria-hidden="true">{typedTitle}</span>
              <span
                aria-hidden="true"
                className="inline-block w-[3px] h-[0.9em] ml-1.5 bg-[#f96951] align-baseline animate-pulse"
              />
            </h1>
            <p className="text-[17px] leading-relaxed text-[#404040] sm:text-[19px]">
              Sell clothes, retain clients, and manage operations in one place with Owuja. Designers track orders, chats, measurements, staff, and invoices, while shoppers browse and order custom pieces.
            </p>
          </div>

          {/* Gliding Ticker in a Straight Line */}
          <div className="relative w-full max-w-xl overflow-hidden py-1 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="animate-marquee items-center gap-8 text-[15px] sm:text-[16px] font-medium text-[#453332]">
              {[
                "Free to join",
                "Early access invites",
                "Founding member perks",
                "Free to join",
                "Early access invites",
                "Founding member perks",
                "Free to join",
                "Early access invites",
                "Founding member perks",
                "Free to join",
                "Early access invites",
                "Founding member perks",
              ].map((perk, i) => (
                <span key={i} className="inline-flex items-center gap-8 shrink-0">
                  <span>{perk}</span>
                  <span className="size-1.5 rounded-full bg-[#f96951]" />
                </span>
              ))}
            </div>
          </div>

          {/* Progress / Spots Left (Transparent bg, left-spaced, animated) */}
          <div className="flex w-full flex-col gap-3 px-1 lg:max-w-2xl">
            <div className="flex items-baseline justify-between text-left">
              <div className="flex items-baseline gap-3">
                <span className="font-['Hedvig_Letters_Serif'] serif-semibold text-3xl sm:text-4xl font-normal text-[#f96951]">
                  {stats ? stats.registered.toLocaleString() : "—"}
                </span>
                <span className="text-[15px] sm:text-[16px] text-[#404040]">registered · 5,000 spaces</span>
              </div>
              <span className="text-[14px] font-medium text-[#746765]">
                {stats ? `${Math.max(0, stats.capacity - stats.registered).toLocaleString()} founding spots left` : statsUnavailable ? "Count temporarily unavailable" : "Loading registrations…"}
              </span>
            </div>
            <div role="progressbar" aria-label="Founding member registrations" aria-valuemin={0} aria-valuemax={5000} aria-valuenow={stats ? Math.min(5000, stats.registered) : undefined} className="h-3 w-full overflow-hidden rounded-[36px] bg-[#dfdfdf]">
              <div
                className="h-full rounded-[36px] bg-[#f96951] transition-all duration-1000 ease-out"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          </div>

          {/* Desktop: Prominent Join us CTA button */}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="group hidden lg:inline-flex h-[68px] items-center justify-center gap-3 rounded-[40px] bg-[#453332] px-14 text-[24px] font-semibold text-white shadow-xl shadow-[#453332]/30 transition-all duration-300 hover:scale-105 hover:bg-[#342625] hover:shadow-2xl hover:shadow-[#453332]/45 active:scale-95"
          >
            <span>Join us</span>
            <svg
              className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8.91 19.92L15.43 13.4C16.2 12.63 16.2 11.37 15.43 10.6L8.91 4.08"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeMiterlimit="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </section>

        {/* Mobile View: Inline Form Section (hidden on desktop) */}
        <section id="reserve" className="flex flex-col lg:hidden">
          <div className="rounded-[16px] bg-transparent p-0 shadow-none">
            {step === "join" ? renderWaitlistForm() : renderSuccessContent()}

            {/* Error / Success Feedback */}
            {message && (
              <p
                className={`mt-4 rounded-lg p-3 text-[13px] ${message.includes("copied") || message.includes("Check your email")
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
                className={`flex h-[48px] w-[152px] items-center justify-center rounded-[64px] text-[20px] transition ${featuresAudience === "shoppers"
                  ? "bg-[#453332] text-white"
                  : "border-[0.5px] border-[#453332] bg-[#dfdfdf] text-[#453332]"
                  }`}
              >
                Shoppers
              </button>
              <button
                type="button"
                onClick={() => setFeaturesAudience("designers")}
                className={`flex h-[48px] w-[152px] items-center justify-center rounded-[64px] text-[20px] transition ${featuresAudience === "designers"
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
                  className={`border-[0.5px] border-solid border-[#453332] bg-[rgba(249,105,81,0.15)] p-[24px] transition ${isOpen ? "rounded-[12px]" : "rounded-[8px]"
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
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-16 lg:gap-20">
            <div className="flex flex-wrap items-center gap-8 sm:gap-10 lg:gap-12">
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
                href="https://www.instagram.com/useowuja?xtok=MTluNDdiaHdsZWVuMg%3D%3D"
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

      {/* ─────────────────────────────────────────────────────────────
          DESKTOP WAITLIST MODAL (Glassmorphism Effect)
         ───────────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 hidden items-center justify-center bg-black/35 p-4 backdrop-blur-md transition-all lg:flex"
          onClick={() => {
            setShowModal(false);
          }}
        >
          <div
            className="no-scrollbar relative max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[24px] border border-white/60 bg-white/80 p-6 shadow-2xl shadow-[#453332]/25 backdrop-blur-xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glass Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
              }}
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/60 text-[#453332] shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow"
              aria-label="Close"
            >
              ✕
            </button>

            {step === "join" ? renderWaitlistForm() : renderSuccessContent()}

            {/* Modal Error Feedback */}
            {message && step === "join" && (
              <p
                className={`mt-4 rounded-lg p-3 text-[13px] ${message.includes("copied") || message.includes("Check your email")
                  ? "bg-emerald-50/90 text-emerald-800"
                  : "bg-red-50/90 text-red-700"
                  }`}
                role="status"
              >
                {message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
