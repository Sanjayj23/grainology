import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileCheck,
  Handshake,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Truck,
  Users2
} from 'lucide-react';
import Footer from '../components/Footer';
import SiteStatsGrid from '../components/SiteStatsGrid';
import { useSiteSettings } from '../lib/siteSettings';

const platformStoryPoints = [
  {
    title: 'Built around real agri trade operations',
    text: 'Grainology is not only a marketplace layer. It is designed as an operational system for teams that need price context, workflow control, fulfilment visibility, and reporting.'
  },
  {
    title: 'Role-based platform for the full network',
    text: 'Farmers, traders, FPOs, corporates, millers, financers, admins, and super admins can work within one connected environment instead of fragmented tools.'
  },
  {
    title: 'Market visibility connected to execution',
    text: 'Live mandi data, weather context, quality records, order flows, logistics coordination, and analytics work together so decisions stay tied to action.'
  }
];

const operatingPrinciples = [
  {
    icon: TrendingUp,
    title: 'Market-informed decisions',
    text: 'Public mandi bhav visibility and regional planning context help users read market movement before a trade begins.'
  },
  {
    icon: Handshake,
    title: 'Structured transactions',
    text: 'Purchase orders, sale orders, and confirmed order workflows move business away from ad hoc calls and spreadsheet-driven coordination.'
  },
  {
    icon: FileCheck,
    title: 'Traceable quality controls',
    text: 'Commodity setup, quality parameters, and deduction logic create clearer operating records for commercial and audit review.'
  },
  {
    icon: Truck,
    title: 'Operational fulfilment visibility',
    text: 'Warehouse, location, and logistics oversight support the real downstream work required after a deal is created.'
  },
  {
    icon: BarChart3,
    title: 'Management reporting',
    text: 'Admins and super admins can review analytics, platform activity, approvals, and core operational records from one control surface.'
  },
  {
    icon: Users2,
    title: 'Controlled access by role',
    text: 'Each participant group sees workflows and controls relevant to its responsibilities, while management retains the right level of oversight.'
  }
];

export default function About() {
  const { settings } = useSiteSettings();

  return (
    <div className="min-h-screen bg-stone-950 text-stone-900">
      <section className="bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_35%),linear-gradient(180deg,#f2f7ef_0%,#e5f1df_100%)]">
        <div
          className="relative overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1800&q=80')"
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,32,20,0.88)_0%,rgba(8,43,25,0.76)_34%,rgba(9,27,18,0.58)_68%,rgba(9,27,18,0.52)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_34%)]" />
          <div className="absolute left-[-10rem] top-1/2 h-[32rem] w-[36rem] -translate-y-1/2 rounded-full bg-emerald-200/10 blur-3xl" />

          <div className="relative z-10 mx-auto grid max-w-[94rem] gap-10 px-4 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
            <div className="max-w-[54rem] text-white">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur sm:text-sm">
                <Sprout className="h-4 w-4 text-emerald-200" />
                About Grainology
              </div>
              <h1 className="mt-6 max-w-[14ch] text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-[4.2rem] lg:text-[5rem]">
                Grainology is built to run modern grain trade operations, not just list offers.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/88">
                The platform combines market intelligence, transaction workflows, logistics planning, quality controls, and admin oversight into one connected agricultural commerce system.
              </p>
            </div>

            <div className="rounded-[34px] border border-white/18 bg-[linear-gradient(180deg,rgba(4,12,9,0.82)_0%,rgba(7,19,14,0.74)_100%)] p-6 text-white shadow-[0_32px_90px_rgba(0,0,0,0.38)] backdrop-blur-md sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200">Why it exists</p>
              <div className="mt-6 space-y-5">
                {platformStoryPoints.map((point) => (
                  <div key={point.title} className="rounded-[24px] border border-white/12 bg-white/[0.04] p-5 sm:p-6">
                    <p className="text-xl font-semibold leading-tight text-white">{point.title}</p>
                    <p className="mt-3 text-base leading-8 text-stone-100/92">{point.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f1e7] px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-[94rem] rounded-[32px] border border-stone-200 bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Shared platform stats</p>
            <h2 className="mt-4 font-serif text-3xl text-stone-900 sm:text-4xl">
              The same Grainology scale indicators used across the website
            </h2>
            <p className="mt-4 text-base leading-8 text-stone-700 sm:text-lg">
              These stats are centrally managed and reflect the platform footprint shown throughout the public experience.
            </p>
          </div>
          <div className="mt-8">
            <SiteStatsGrid stats={settings.homepageStats} />
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#ffffff_0%,#f6f1e7_100%)] px-4 py-20 lg:px-8">
        <div className="mx-auto grid max-w-[92rem] gap-10 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="xl:sticky xl:top-24">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Operating philosophy</p>
            <h2 className="mt-4 font-serif text-4xl text-stone-900 sm:text-5xl">
              Grainology connects market context to controlled execution
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700">
              The project was shaped around what agricultural trading teams actually need: discover price signals, create transactions, validate quality, coordinate fulfilment, and retain oversight across the entire chain.
            </p>
            <div className="mt-8 rounded-[30px] bg-stone-900 p-7 text-white shadow-[0_28px_70px_rgba(15,23,42,0.22)]">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200">Core value</p>
              <p className="mt-4 text-2xl font-semibold leading-tight">
                One operating surface for agricultural trade intelligence, workflows, and administration.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {operatingPrinciples.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[30px] border border-stone-200 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.12)]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-emerald-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold leading-tight text-stone-900">{item.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-stone-600">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-[92rem] rounded-[40px] border border-stone-200 bg-[linear-gradient(135deg,#0f3d2e_0%,#1f6b48_100%)] p-8 text-white shadow-[0_32px_90px_rgba(22,101,52,0.24)] sm:p-10">
          <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200">Next step</p>
              <h2 className="mt-4 font-serif text-4xl sm:text-5xl">
                Explore the exact services Grainology delivers to customer teams
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-emerald-50/90">
                The services page outlines the actual platform modules delivered in the project, from mandi intelligence and weather context to order workflows, quality controls, logistics, and admin reporting.
              </p>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/10 p-6 backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200">Included areas</p>
              <div className="mt-5 grid gap-3">
                {[
                  'Mandi bhav and market discovery',
                  'Weather and planning context',
                  'Purchase, sale, and confirmed order workflows',
                  'Quality parameters and deduction controls',
                  'Warehouse, location, and logistics oversight',
                  'Analytics, reports, and admin governance'
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    <span className="text-sm text-stone-100">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/services"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-stone-900 transition hover:bg-emerald-50"
            >
              View project services
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Start with Grainology
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
