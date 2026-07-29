"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from "framer-motion";
import {
  UserPlus,
  UploadCloud,
  Send,
  ShieldCheck,
  FileQuestion,
  Award,
  BadgeCheck,
  RotateCcw,
  Users,
  FileCheck2,
  Radio,
  Shield,
  ArrowRight,
} from "lucide-react";

// ── Data ──────────────────────────────────────────────────

type Step = {
  num: string;
  phase: "core" | "conditional";
  icon: React.ElementType;
  title: string;
  micro: string;
  summary: string;
  bullets: string[];
  chips?: string[];
  badge?: string;
  outputs?: string[];
  footerNote?: string;
  cta?: { label: string; href: string };
};

const STEPS: Step[] = [
  {
    num: "01",
    phase: "core",
    icon: UserPlus,
    title: "Sign Up",
    micro: "Account & Organisation Setup",
    summary: "Create a Climactix ID, register your organisation, and configure the assessment profile.",
    bullets: ["Create Climactix ID", "Register organisation", "Accept declaration", "Configure assessment profile"],
    cta: { label: "Start Assessment", href: "/register" },
  },
  {
    num: "02",
    phase: "core",
    icon: UploadCloud,
    title: "Provide Assessment & Evidence",
    micro: "Disclosure & Evidence Upload",
    summary: "Complete the structured assessment and attach supporting evidence across every disclosure category.",
    bullets: ["Structured disclosure questionnaire", "Multi-format evidence upload", "Auto-save across sessions"],
    chips: [
      "Policies", "ESG Reports", "Sustainability Reports", "Certifications",
      "Images", "Geotagged Evidence", "Utility Bills", "Carbon Data", "Other Documents",
    ],
  },
  {
    num: "03",
    phase: "core",
    icon: Send,
    title: "Submit Assessment",
    micro: "Validation & Lock",
    summary: "The assessment is automatically validated for completeness, then locked for independent review.",
    bullets: ["Automatic validation", "Completeness check", "Assessment locked for review"],
  },
  {
    num: "04",
    phase: "core",
    icon: ShieldCheck,
    title: "Independent Technical Review",
    micro: "Accredited Professional Review",
    summary: "An accredited climate professional verifies disclosures against the submitted evidence.",
    bullets: [
      "Verify disclosures",
      "Validate uploaded evidence",
      "Detect inconsistencies",
      "Assess credibility",
      "Evaluate methodology compliance",
    ],
    badge: "Accredited Professional",
  },
  {
    num: "05",
    phase: "conditional",
    icon: FileQuestion,
    title: "Evidence Request",
    micro: "Conditional — Triggered Only If Evidence Is Insufficient",
    summary: "If disclosures cannot be verified against the evidence provided, the reviewer requests clarification before the assessment proceeds.",
    bullets: ["Request clarification", "Upload additional evidence", "Organisation resubmits", "Return to reviewer"],
  },
  {
    num: "06",
    phase: "core",
    icon: Award,
    title: "Principal Surveyor Approval",
    micro: "Final Technical Approval",
    summary: "A Principal Surveyor reviews the reviewer's findings and signs off on methodology compliance.",
    bullets: ["Review findings", "Quality assurance", "Methodology compliance", "Final sign-off"],
    badge: "Principal Surveyor",
  },
  {
    num: "07",
    phase: "core",
    icon: BadgeCheck,
    title: "Rating Published",
    micro: "Published on Climactix Terminal",
    summary: "The completed rating and supporting intelligence package are published to the Climactix Terminal.",
    bullets: [],
    outputs: ["Green Rating", "Climate Risk Report", "Methodology Summary", "Confidence Score", "Public / Private Rating"],
    footerNote: "Accessible to investors, banks, insurers, corporates and regulators.",
  },
];

const GOVERNANCE = [
  {
    icon: Users,
    title: "Assessment Stage",
    items: ["Company representative", "Evidence upload", "Digital declaration"],
  },
  {
    icon: ShieldCheck,
    title: "Verification Stage",
    items: ["Accredited climate professionals", "Independent auditors", "Evidence validation"],
  },
  {
    icon: FileCheck2,
    title: "Approval Stage",
    items: ["Principal Surveyor", "Quality assurance", "Final rating authorisation"],
  },
  {
    icon: Radio,
    title: "Publication Stage",
    items: ["Climactix Terminal", "Public / private rating", "Continuous monitoring"],
  },
];

// ── Component ─────────────────────────────────────────────

export default function AssessmentLifecycle() {
  const [activeNum, setActiveNum] = useState<string>("04");
  const sectionRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.85", "start 0.25"],
  });
  const railScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const active = STEPS.find((s) => s.num === activeNum) ?? STEPS[0];
  const coreSteps = STEPS.filter((s) => s.phase === "core");
  const branchStep = STEPS.find((s) => s.phase === "conditional")!;

  const revealVariants = {
    hidden: { opacity: 0, y: 14 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : { duration: 0.4, delay: i * 0.06, ease: [0.4, 0, 0.2, 1] },
    }),
  };

  return (
    <section ref={sectionRef} className="section-pad bg-black border-b border-[#1F1F1F] py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="max-w-2xl mb-4">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-gray-500 mb-3">
            Process · Assessment Lifecycle
          </p>
          <div className="w-8 border-t border-[#2A2A2A] mb-5" />
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4 leading-tight">
            How the Assessment Works
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Institutional-grade climate risk assessments backed by evidence, independent verification,
            and technical review before publication on the Climactix Terminal.
          </p>
        </div>

        <div className="flex items-center gap-2 mb-14">
          <Shield className="w-3.5 h-3.5 text-[#4DA3FF]" aria-hidden="true" />
          <span className="text-[10.5px] font-mono font-semibold uppercase tracking-[0.1em] text-gray-500">
            Transparent&nbsp;&middot;&nbsp;Verifiable&nbsp;&middot;&nbsp;Independent&nbsp;&middot;&nbsp;Trusted
          </span>
        </div>

        {/* ── Desktop rail ── */}
        <div className="hidden lg:block relative mb-8">
          <div className="relative grid grid-cols-6">
            <div className="absolute left-0 right-0 top-5 h-px bg-[#1F1F1F]" aria-hidden="true" />
            <motion.div
              className="absolute left-0 top-5 h-px bg-gradient-to-r from-[#1D4ED8] to-[#4DA3FF] origin-left"
              style={{ right: 0, scaleX: prefersReducedMotion ? 1 : railScale }}
              aria-hidden="true"
            />
            {coreSteps.map((step, i) => {
                const isActive = step.num === activeNum;
                const Icon = step.icon;
                return (
                  <motion.button
                    key={step.num}
                    type="button"
                    custom={i}
                    variants={revealVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-80px" }}
                    onClick={() => setActiveNum(step.num)}
                    aria-expanded={isActive}
                    aria-controls="lifecycle-detail-panel"
                    className="group flex flex-col items-center justify-center gap-2 focus-visible:outline-none"
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center border transition-all duration-150 ${
                        isActive
                          ? "border-[#4DA3FF] bg-[#0D2040] text-[#7BBEFF] shadow-[0_0_0_4px_rgba(77,163,255,0.12)]"
                          : "border-[#2A2A2A] bg-black text-gray-500 group-hover:border-[#444444] group-hover:text-gray-300"
                      } group-focus-visible:ring-2 group-focus-visible:ring-[#4DA3FF] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-black`}
                      style={{ borderRadius: "9999px" }}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className={`font-mono text-[9px] font-bold tracking-widest ${isActive ? "text-[#7BBEFF]" : "text-gray-600"}`}>
                      {step.num}
                    </span>
                    <span className={`text-[11px] font-semibold text-center leading-tight px-1 ${isActive ? "text-white" : "text-gray-500"}`}>
                      {step.title}
                    </span>
                  </motion.button>
                );
              })}
          </div>

          {/* Conditional branch — Step 05, anchored under node 04's column center (col 4 of 6 = 58.33%) */}
          <div className="relative h-20 mt-1" aria-hidden="false">
            <div
              className="absolute flex flex-col items-center"
              style={{ left: "58.333%", transform: "translateX(-50%)" }}
            >
              <div className="w-px h-6 border-l border-dashed border-[#3D3420]" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setActiveNum(branchStep.num)}
                aria-expanded={activeNum === branchStep.num}
                aria-controls="lifecycle-detail-panel"
                className={`flex items-center gap-2.5 px-3.5 py-2 border border-dashed whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  activeNum === branchStep.num
                    ? "border-[#C9A227] bg-[#1F1800] text-[#E8C355]"
                    : "border-[#4A4022] text-[#9C8A55] hover:border-[#C9A227]"
                }`}
              >
                <branchStep.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-mono text-[9px] font-bold tracking-widest">{branchStep.num}</span>
                <span className="text-[11px] font-semibold">{branchStep.title}</span>
                <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide text-[#8A7842]">
                  <RotateCcw className="w-3 h-3" /> Loops to 04
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile vertical rail ── */}
        <div className="lg:hidden flex flex-col gap-3 mb-8">
          {STEPS.map((step) => {
            const isActive = step.num === activeNum;
            const isBranch = step.phase === "conditional";
            const Icon = step.icon;
            return (
              <button
                key={step.num}
                type="button"
                onClick={() => setActiveNum(step.num)}
                aria-expanded={isActive}
                aria-controls="lifecycle-detail-panel"
                className={`flex items-center gap-3 px-4 py-3.5 border text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  isBranch
                    ? isActive
                      ? "border-dashed border-[#C9A227] bg-[#1F1800] focus-visible:ring-[#C9A227]"
                      : "border-dashed border-[#4A4022] focus-visible:ring-[#C9A227]"
                    : isActive
                    ? "border-[#4DA3FF] bg-[#0D2040] focus-visible:ring-[#4DA3FF]"
                    : "border-[#1F1F1F] bg-[#0A0A0A] focus-visible:ring-[#4DA3FF]"
                }`}
              >
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border ${
                    isBranch
                      ? isActive ? "border-[#C9A227] text-[#E8C355]" : "border-[#4A4022] text-[#9C8A55]"
                      : isActive ? "border-[#4DA3FF] text-[#7BBEFF]" : "border-[#2A2A2A] text-gray-500"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block font-mono text-[9px] font-bold tracking-widest ${isBranch ? "text-[#8A7842]" : "text-gray-600"}`}>
                    {step.num} {isBranch && "· Conditional"}
                  </span>
                  <span className={`block text-[13px] font-semibold truncate ${isActive ? "text-white" : "text-gray-400"}`}>
                    {step.title}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Detail panel ── */}
        <div id="lifecycle-detail-panel" role="region" aria-live="polite" className="border border-[#1F1F1F] bg-[#0A0A0A]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.num}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="p-7 lg:p-9"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#4DA3FF] mb-2">
                    {active.num} &middot; {active.micro}
                  </p>
                  <h3 className="text-xl font-bold text-white">{active.title}</h3>
                </div>
                {active.badge && (
                  <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#2A2A2A] bg-black text-[10px] font-mono font-bold uppercase tracking-wide text-gray-300">
                    <ShieldCheck className="w-3 h-3 text-[#10B981]" /> {active.badge}
                  </span>
                )}
              </div>

              <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-2xl">{active.summary}</p>

              {active.bullets.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 mb-2">
                  {active.bullets.map((b) => (
                    <div key={b} className="flex items-start gap-2.5 py-1.5 border-b border-[#141414]">
                      <span className="w-1 h-1 rounded-full bg-[#4DA3FF] flex-shrink-0 mt-2" aria-hidden="true" />
                      <span className="text-gray-300 text-xs">{b}</span>
                    </div>
                  ))}
                </div>
              )}

              {active.chips && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {active.chips.map((c) => (
                    <span
                      key={c}
                      className="px-2.5 py-1 border border-[#2A2A2A] bg-black text-[10px] font-mono uppercase tracking-wide text-gray-400"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {active.outputs && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-[#1F1F1F] mt-2">
                  {active.outputs.map((o) => (
                    <div key={o} className="bg-[#0A0A0A] px-4 py-4 flex items-start gap-2">
                      <BadgeCheck className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-xs font-semibold leading-snug">{o}</span>
                    </div>
                  ))}
                </div>
              )}

              {active.footerNote && (
                <p className="text-gray-500 text-xs mt-5 pt-5 border-t border-[#1F1F1F]">{active.footerNote}</p>
              )}

              {active.cta && (
                <Link href={active.cta.href} className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-[#1D4ED8] text-white text-[13px] font-semibold hover:bg-[#1E40AF] transition-colors">
                  {active.cta.label} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Governance & Assurance strip ── */}
        <div className="mt-16">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-gray-500 mb-6">
            Governance &amp; Assurance Layer
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-[#1F1F1F]">
            {GOVERNANCE.map((stage, i) => {
              const Icon = stage.icon;
              return (
                <div key={stage.title} className="bg-black px-6 py-7 relative">
                  {i < GOVERNANCE.length - 1 && (
                    <ArrowRight
                      className="hidden md:block absolute -right-3 top-9 w-4 h-4 text-gray-700 z-10 bg-black"
                      aria-hidden="true"
                    />
                  )}
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2A2A2A] text-[#4DA3FF] mb-4">
                    <Icon className="w-4 h-4" />
                  </span>
                  <h4 className="text-sm font-bold text-white mb-3">{stage.title}</h4>
                  <ul className="space-y-1.5">
                    {stage.items.map((item) => (
                      <li key={item} className="text-gray-500 text-xs leading-relaxed">{item}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Trust banner ── */}
        <div className="mt-16 border border-[#0F2D5E] bg-[#020812] p-8 lg:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-center">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-[#4DA3FF] flex-shrink-0 mt-0.5" />
              <p className="text-gray-300 text-sm lg:text-base leading-relaxed max-w-xl">
                Every Climactix rating is backed by evidence, independent verification, technical oversight,
                and a transparent methodology to ensure trust, credibility, and decision-grade climate intelligence.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6 flex-shrink-0">
              <div className="border border-[#1F1F1F] bg-black px-5 py-4 w-full sm:w-56">
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3">Sample Rating</p>
                <div className="flex items-end justify-between mb-3">
                  <span className="text-2xl font-bold text-[#10B981]">A</span>
                  <span className="text-lg font-bold text-white">78<span className="text-xs text-gray-500 font-normal">/100</span></span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: "Physical", value: 82 },
                    { label: "Transition", value: 75 },
                    { label: "ESG", value: 80 },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-500 w-14 flex-shrink-0">{r.label}</span>
                      <span className="flex-1 h-1 bg-[#1F1F1F]">
                        <span className="block h-full bg-[#4DA3FF]" style={{ width: `${r.value}%` }} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href="/report"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#2A2A2A] text-white text-[13px] font-semibold hover:border-[#4DA3FF] hover:text-[#7BBEFF] transition-colors flex-shrink-0"
              >
                View Sample Report <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
