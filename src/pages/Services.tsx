import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CloudSun,
  FileCheck,
  Handshake,
  MapPinned,
  ShieldCheck,
  TrendingUp,
  Truck,
  Users2,
  Warehouse
} from 'lucide-react';
import Footer from '../components/Footer';
import SiteStatsGrid from '../components/SiteStatsGrid';
import { useSiteSettings } from '../lib/siteSettings';

const deliveredServices = [
  {
    icon: TrendingUp,
    title: 'Mandi Bhav and Market Intelligence',
    label: 'Public discovery',
    description:
      'Users can view mandi prices and arrivals before sign-in, helping them understand market movement and discover opportunities directly from the public website.',
    features: ['Live mandi snapshots', 'Commodity visibility', 'Market-led discovery before login']
  },
  {
    icon: CloudSun,
    title: 'Weather and Regional Planning Context',
    label: 'Planning support',
    description:
      'Weather and location context help teams connect local operating conditions with trading, harvest timing, dispatch decisions, and movement planning.',
    features: ['Current weather context', 'Regional location visibility', 'Better planning before execution']
  },
  {
    icon: Handshake,
    title: 'Purchase and Sales Order Workflows',
    label: 'Trade operations',
    description:
      'The platform supports purchase orders, sales orders, and confirmed order flows so commercial teams can move from opportunity to structured transaction.',
    features: ['Purchase order management', 'Sales order creation', 'Confirmed order processing']
  },
  {
    icon: FileCheck,
    title: 'Quality and Deduction Controls',
    label: 'Quality layer',
    description:
      'Commodity quality parameters and deduction logic are captured inside the workflow, improving operational accuracy and giving teams clearer transaction records.',
    features: ['Quality parameter setup', 'Deduction-based calculations', 'Operational record visibility']
  },
  {
    icon: Warehouse,
    title: 'Warehouse, Location, and Commodity Masters',
    label: 'Master data',
    description:
      'Admin teams can maintain warehouse, location, commodity, and variety structures so customer workflows run on organized operational data.',
    features: ['Warehouse management', 'Location management', 'Commodity and variety setup']
  },
  {
    icon: Truck,
    title: 'Logistics and Provider Oversight',
    label: 'Execution',
    description:
      'Grainology includes logistics provider management and movement coordination support to connect commercial decisions with downstream execution work.',
    features: ['Logistics provider records', 'Dispatch-oriented oversight', 'Execution support across workflows']
  },
  {
    icon: Users2,
    title: 'Role-Based User Management',
    label: 'Access control',
    description:
      'The project supports Farmer, Trader, FPO, Corporate, Miller, Financer, Admin, and Super Admin roles, each with controlled access aligned to platform responsibilities.',
    features: ['Multi-role onboarding', 'Admin and super admin control', 'Role-specific workflow access']
  },
  {
    icon: BarChart3,
    title: 'Analytics, Reports, and Admin Oversight',
    label: 'Management layer',
    description:
      'Dashboards, reports, approvals, and platform analytics give management teams the visibility needed to operate and review a live agri-trade system.',
    features: ['Analytics dashboard', 'Operational reporting', 'Approval and oversight control']
  }
];

const deliveryFlow = [
  'Public market discovery with mandi bhav access',
  'Trade workflow creation through purchase and sales orders',
  'Quality validation and deduction tracking',
  'Warehouse, location, and commodity master management',
  'Logistics provider oversight and operational follow-through',
  'Analytics, approvals, and management reporting'
];

export default function Services() {
  const { settings } = useSiteSettings();

  return (
    <div className="min-h-screen bg-stone-950 text-stone-900">
      <section className="bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_35%),linear-gradient(180deg,#f2f7ef_0%,#e5f1df_100%)]">
        <div
          className="relative overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1800&q=80')"
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,32,20,0.78)_0%,rgba(8,43,25,0.58)_36%,rgba(9,27,18,0.18)_64%,rgba(9,27,18,0.1)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_35%)]" />
          <div className="absolute right-[-8rem] top-12 h-[28rem] w-[28rem] rounded-full bg-emerald-200/10 blur-3xl" />

          <div className="relative z-10 mx-auto grid max-w-[94rem] gap-10 px-4 py-20 lg:grid-cols-[1.12fr_0.88fr] lg:px-8 lg:py-24">
            <div className="max-w-[56rem] text-white">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur sm:text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-200" />
                Grainology Services
              </div>
              <h1 className="mt-6 max-w-[13ch] text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-[4.2rem] lg:text-[5rem]">
                Services aligned to the actual Grainology project delivered to customers.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/88">
                These are the real product capabilities available in the project: market intelligence, weather context, order workflows, quality controls, logistics oversight, admin management, and analytics.
              </p>
            </div>

            <div className="rounded-[34px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,239,228,0.96)_100%)] p-6 text-stone-900 shadow-[0_28px_80px_rgba(0,0,0,0.24)] backdrop-blur-sm sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-900">Delivered service flow</p>
              <div className="mt-6 grid gap-3">
                {deliveryFlow.map((step) => (
                  <div key={step} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white/75 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-800" />
                    <span className="text-sm text-stone-900">{step}</span>
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
              The same Grainology stats used on the homepage
            </h2>
            <p className="mt-4 text-base leading-8 text-stone-700 sm:text-lg">
              Service communication now stays aligned with the homepage by using the same centrally managed platform stats.
            </p>
          </div>
          <div className="mt-8">
            <SiteStatsGrid stats={settings.homepageStats} />
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#ffffff_0%,#f6f1e7_100%)] px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-[94rem]">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Delivered capabilities</p>
            <h2 className="mt-4 font-serif text-4xl text-stone-900 sm:text-5xl">
              Real modules and workflows available in the Grainology project
            </h2>
            <p className="mt-5 text-lg leading-8 text-stone-700">
              This service layer reflects the actual platform delivered in the project, not a generic agri-tech list. Each area below maps to a real Grainology capability used by customers or administrators.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {deliveredServices.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.title}
                  className="rounded-[30px] border border-stone-200 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.12)]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-emerald-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">{service.label}</p>
                  <h3 className="mt-3 text-2xl font-semibold leading-tight text-stone-900">{service.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-stone-600">{service.description}</p>
                  <div className="mt-5 space-y-2">
                    {service.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-600" />
                        <span className="text-sm text-stone-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-20 lg:px-8">
        <div className="mx-auto grid max-w-[92rem] gap-8 xl:grid-cols-[0.88fr_1.12fr]">
          <div className="rounded-[34px] bg-[linear-gradient(135deg,#0f3d2e_0%,#1f6b48_100%)] p-8 text-white shadow-[0_30px_90px_rgba(22,101,52,0.28)] sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200">Operational coverage</p>
            <h2 className="mt-4 font-serif text-4xl sm:text-5xl">
              Services built for execution, visibility, and control
            </h2>
            <p className="mt-5 text-lg leading-8 text-emerald-50/90">
              Grainology supports both public discovery and managed internal workflows, making it useful to customer-facing participants and platform operators at the same time.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {[
              {
                icon: MapPinned,
                title: 'Location-aware planning',
                text: 'Regional weather, mandi, and location context strengthen planning before commercial action begins.'
              },
              {
                icon: Handshake,
                title: 'Trade movement into workflow',
                text: 'Potential opportunities convert into purchase, sale, and confirmed order records inside one system.'
              },
              {
                icon: FileCheck,
                title: 'Quality-backed operations',
                text: 'Quality setup and deduction logic help teams keep operational decisions tied to transaction records.'
              },
              {
                icon: BarChart3,
                title: 'Management visibility',
                text: 'Reports, dashboards, approvals, and analytics help admins supervise a live agricultural trading platform.'
              }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-[28px] border border-stone-200 bg-[#f4efe4] p-7">
                  <Icon className="h-10 w-10 text-emerald-700" />
                  <h3 className="mt-5 text-2xl font-semibold text-stone-900">{item.title}</h3>
                  <p className="mt-4 text-base leading-7 text-stone-700">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#ffffff_0%,#f6f1e7_100%)] px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-[92rem] rounded-[40px] border border-stone-200 bg-stone-900 p-8 text-white shadow-[0_32px_90px_rgba(15,23,42,0.24)] sm:p-10">
          <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200">Start here</p>
              <h2 className="mt-4 font-serif text-4xl sm:text-5xl">
                Use Grainology as the connected operating layer for grain trade.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-300">
                If you want the combination of market visibility, structured transactions, quality controls, logistics oversight, and management reporting in one platform, Grainology is designed for that exact need.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-7 py-4 text-sm font-semibold text-stone-950 transition hover:bg-emerald-400"
              >
                Start on Grainology
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Talk to our team
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
