import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CloudSun,
  FileCheck,
  Handshake,
  MapPinned,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Truck,
  Users2
} from 'lucide-react';
import MandiBhaav from './MandiBhaav';
import PlatformSnapshot from './PlatformSnapshot';
import Weathersonu from './weathersonu';
import { MandiCache } from '../lib/sessionStorage';
import SiteStatsGrid from './SiteStatsGrid';
import { useSiteSettings } from '../lib/siteSettings';
import PublicLogisticsDirectory from './PublicLogisticsDirectory';

const platformCapabilities = [
  {
    icon: TrendingUp,
    title: 'Mandi and market intelligence',
    label: 'Live data',
    description:
      'Track mandi bhav signals for key commodities with public market snapshots that help users read price movement before trade decisions.'
  },
  {
    icon: Handshake,
    title: 'Purchase and sales workflows',
    label: 'Trade operations',
    description:
      'Create and manage purchase orders, sales orders, and confirmed order flows from one connected operating surface.'
  },
  {
    icon: FileCheck,
    title: 'Quality and deduction controls',
    label: 'Quality layer',
    description:
      'Capture quality parameters, apply deduction logic in confirmed orders, and keep transaction details structured for operational review.'
  },
  {
    icon: Truck,
    title: 'Logistics and movement planning',
    label: 'Execution',
    description:
      'Manage logistics providers and support movement planning alongside order, warehouse, and location workflows.'
  },
  {
    icon: BarChart3,
    title: 'Admin analytics and reports',
    label: 'Management',
    description:
      'Provide dashboards, analytics, and reporting views for users, orders, commodities, approvals, and operational activity.'
  },
  {
    icon: Users2,
    title: 'Role-based control system',
    label: 'Access control',
    description:
      'Support Admin, Super Admin, Farmer, Trader, FPO, Corporate, Miller, and Financer roles with controlled platform access.'
  }
];

const valuePillars = [
  {
    title: 'For market teams',
    text: 'Monitor prices, discover trade opportunities, and act on current market signals without switching systems.'
  },
  {
    title: 'For operations',
    text: 'Coordinate orders, logistics, quality checks, and fulfilment status in one continuous workflow.'
  },
  {
    title: 'For management',
    text: 'Review platform activity, users, commodities, locations, and reports from a stronger control layer.'
  }
];

const workflowSteps = [
  {
    title: '1. Observe the market',
    text: 'Use live mandi data and local weather signals to understand pricing conditions, supply pressure, and planning risks before a trade begins.'
  },
  {
    title: '2. Create and negotiate trades',
    text: 'Publish offers, review orders, and move buyers and sellers into structured transactions instead of scattered calls and spreadsheets.'
  },
  {
    title: '3. Validate quality and operations',
    text: 'Keep commodity information, quality parameters, approvals, and order status visible to the teams that need them.'
  },
  {
    title: '4. Execute delivery and oversight',
    text: 'Coordinate logistics, track fulfilment progress, and give admins the reporting layer needed to manage the whole ecosystem.'
  }
];

export default function LandingPage() {
  const mandiSectionRef = useRef<HTMLDivElement>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [mandiData, setMandiData] = useState<any[]>([]);
  const { settings } = useSiteSettings();

  useEffect(() => {
    if (!hasLoaded) {
      loadMandiPreview();
      setHasLoaded(true);
    }
  }, [hasLoaded]);

  const loadMandiPreview = async () => {
    try {
      const cached = MandiCache.getDefault() as any[] | { data?: any[] } | null;
      if (cached) {
        if (Array.isArray(cached) && cached.length > 0) {
          setMandiData(cached);
          return;
        }

        if (!Array.isArray(cached) && Array.isArray(cached.data) && cached.data.length > 0) {
          setMandiData(cached.data);
          return;
        }
      }

      const commodities = ['Paddy', 'Maize', 'Wheat'];
      const allData: any[] = [];

      for (const commodity of commodities) {
        const params = new URLSearchParams({
          commodity_group: 'Cereals',
          commodity,
          limit: '50'
        });

        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/mandi/agmarknet?${params.toString()}`,
            { signal: AbortSignal.timeout(15000) }
          );

          if (response.ok) {
            const result = await response.json();
            if (Array.isArray(result.data) && result.data.length > 0) {
              allData.push(...result.data.slice(0, 1));
            }
          }
        } catch (error: any) {
          console.warn(`Failed to load ${commodity} preview:`, error.message);
        }
      }

      setMandiData(allData);
      if (allData.length > 0) {
        MandiCache.setDefault(allData);
      }
    } catch (error) {
      console.error('Error loading mandi preview:', error);
    }
  };

  const scrollToMandiSection = () => {
    mandiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-900">
      <section className="bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_35%),linear-gradient(180deg,#f2f7ef_0%,#e5f1df_100%)]">
        <div className="relative overflow-hidden min-h-[calc(100svh-80px)] bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1800&q=80')"
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,32,20,0.72)_0%,rgba(8,43,25,0.58)_36%,rgba(9,27,18,0.16)_62%,rgba(9,27,18,0.08)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),_transparent_32%)]" />
          <div className="absolute inset-y-0 left-0 w-[58%] bg-[linear-gradient(90deg,rgba(8,29,20,0.60)_0%,rgba(8,29,20,0.40)_34%,rgba(8,29,20,0.18)_60%,rgba(8,29,20,0.05)_82%,transparent_100%)] backdrop-blur-[2px]" />
          <div className="absolute left-[-8rem] top-1/2 h-[32rem] w-[36rem] -translate-y-1/2 rounded-full bg-emerald-200/10 blur-3xl" />

          <div className="relative z-10 mx-auto grid min-h-[calc(100svh-80px)] max-w-[94rem] items-center gap-8 px-3 py-6 sm:px-4 sm:py-8 lg:grid-cols-[1.18fr_0.82fr] lg:px-4 lg:py-10">
            <div className="relative max-w-[58rem] text-white">
              <div className="relative z-10 px-4 py-5 sm:px-5 sm:py-7 lg:px-5 lg:py-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold backdrop-blur sm:px-5 sm:py-3 sm:text-sm">
                  <Sprout className="h-4 w-4 text-emerald-200" />
                  Capability-led agricultural commerce platform
                </div>

                <h1 className="mt-5 max-w-[18ch] text-[2.2rem] font-semibold leading-[1.01] tracking-[-0.04em] text-white drop-shadow-[0_6px_30px_rgba(0,0,0,0.3)] sm:mt-7 sm:text-[3.8rem] lg:text-[4.8rem] xl:text-[5.1rem]">
                  Grainology brings market intelligence, trade operations, logistics and admin control into one system.
                </h1>

                <p className="mt-4 max-w-[42rem] text-base leading-7 text-white/92 drop-shadow-[0_4px_18px_rgba(0,0,0,0.22)] sm:mt-5 sm:text-lg sm:leading-8 lg:text-[1.12rem]">
                  Run grain trading with live signals, structured workflows, and stronger operational visibility in one platform.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-4">
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-7 py-4 text-base font-semibold text-white shadow-[0_16px_40px_rgba(4,120,87,0.32)] transition hover:bg-emerald-800 sm:px-8 sm:py-4 sm:text-lg"
                  >
                    Start on Grainology
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <button
                    type="button"
                    onClick={scrollToMandiSection}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/70 bg-white/20 px-7 py-4 text-base font-semibold text-white backdrop-blur transition hover:bg-white/28 sm:px-8 sm:py-4 sm:text-lg"
                  >
                    Explore live mandi data
                    <TrendingUp className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-[19rem] rounded-[28px] border border-white/80 bg-white p-3 shadow-[0_28px_70px_rgba(15,23,42,0.26)] sm:max-w-sm sm:p-4">
                <div className="overflow-hidden rounded-[22px] border border-stone-200">
                  <img
                    src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=900&q=80"
                    alt="Grainology hero preview"
                    className="h-48 w-full object-cover sm:h-64"
                  />
                </div>
                <div className="p-3 sm:p-4">
                  <p className="text-xl font-semibold text-emerald-700 sm:text-2xl">Grainology</p>
                  <p className="mt-2 text-base leading-7 text-stone-600 sm:mt-3 sm:text-lg sm:leading-8">
                    Monitor market-linked agricultural operations with one connected grain workflow platform.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f1e7] px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-[94rem]">
          <div className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Platform stats</p>
              <h2 className="mt-4 font-serif text-3xl text-stone-900 sm:text-4xl">
                Grainology at a glance
              </h2>
              <p className="mt-4 text-base leading-8 text-stone-700 sm:text-lg">
                A quick snapshot of the scale, reach, and reliability Grainology brings to agricultural trade operations.
              </p>
            </div>

            <div className="mt-8">
              <SiteStatsGrid stats={settings.homepageStats} />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(180deg,#ffffff_0%,#f6f1e7_100%)] px-4 py-20 lg:px-8">
        <div className="mx-auto grid max-w-[90rem] gap-10 xl:grid-cols-[0.84fr_1.16fr] xl:items-start">
          <div className="xl:sticky xl:top-24">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Live market context</p>
            <h2 className="mt-4 font-serif text-4xl text-stone-900 sm:text-5xl">
              Real-time location, weather, and mandi signals in one place
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700">
              View local location details, current weather conditions, and public mandi price updates together.
              This helps users understand regional context, monitor market movement, and make better planning decisions
              before moving into trading or operations.
            </p>

            <div className="mt-8 grid gap-4">
              <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <MapPinned className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-stone-900">Location and weather provide planning context</p>
                    <p className="mt-2 text-sm leading-7 text-stone-600">
                      Teams can quickly understand local conditions, temperature, and wind before planning harvest,
                      dispatch timing, or transport readiness.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-stone-900">Mandi Bhav gives public price intelligence</p>
                    <p className="mt-2 text-sm leading-7 text-stone-600">
                      Users can preview current price signals immediately, and the full mandi board below remains open
                      without forcing a login before discovery.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[42px] border border-stone-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.10)]">
            <div className="border-b border-stone-200 bg-[linear-gradient(135deg,#11372a_0%,#1b5d42_56%,#2c7d5a_100%)] px-6 py-8 text-white sm:px-8 lg:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-200">
                Live planning board
              </p>

              <h3 className="mt-3 max-w-[24ch] text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                Location, weather, and mandi prices in one view
              </h3>

              <div className="mt-8 space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">
                    What this shows
                  </p>
                  <p className="text-sm leading-7 text-white/85">
                    One surface for location awareness, weather conditions, and public mandi movement before users move deeper into the platform.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">
                    Why it matters
                  </p>
                  <p className="text-sm leading-7 text-white/85">
                    Helps teams plan harvest timing, dispatch readiness, and market tracking with live context instead of isolated widgets.
                  </p>
                </div>
              </div>
            </div>


            <div className="grid gap-0 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="border-b border-stone-200 bg-[linear-gradient(180deg,#f7fbf8_0%,#eef5f1_100%)] xl:border-b-0 xl:border-r">
                <div className="flex items-center justify-between px-6 py-5 sm:px-8">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-100 text-emerald-700">
                      <CloudSun className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Planning context</p>
                      <h4 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-stone-900">Location &amp; Weather</h4>
                    </div>
                  </div>
                  <div className="hidden rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white xl:inline-flex">
                    Live
                  </div>
                </div>
                <div className="px-6 pb-6 sm:px-8 sm:pb-8">
                  <Weathersonu embedded hideHeader />
                </div>
              </div>

              <div className="bg-[linear-gradient(180deg,#ffffff_0%,#fcfaf6_100%)]">
                <div className="flex items-center justify-between px-6 py-5 sm:px-8">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-100 text-emerald-700">
                      <TrendingUp className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Market intelligence</p>
                      <h4 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-stone-900">Mandi Bhav snapshot</h4>
                    </div>
                  </div>
                  <div className="hidden rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-700 xl:inline-flex">
                    Public access
                  </div>
                </div>

                <div className="px-6 pb-6 sm:px-8 sm:pb-8">
                  <div className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr]">
                    

                    <div className="space-y-3">
                      {mandiData.length > 0 ? (
                        mandiData.slice(0, 4).map((item: any, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-[24px] border border-stone-200 bg-white px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-lg font-semibold text-stone-900">{item.commodity}</p>
                              <p className="mt-1 truncate text-sm text-stone-500">{item.market || 'Market data feed'}</p>
                            </div>
                            <div className="ml-4 text-right">
                              <p className="text-base font-bold text-emerald-700">
                                {item.dates && Object.keys(item.dates).length > 0
                                  ? `₹${Math.round((Object.values(item.dates)[0] as any)?.price || 0).toLocaleString()}`
                                  : 'N/A'}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-400">per quintal</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex min-h-[17rem] items-center justify-center rounded-[28px] border border-dashed border-stone-300 bg-[linear-gradient(180deg,#fbfaf8_0%,#f5f2ed_100%)] px-6 text-center">
                          <div>
                            <p className="text-2xl font-semibold tracking-[-0.03em] text-stone-900">Loading mandi preview</p>
                            <p className="mt-2 text-sm leading-6 text-stone-500">Fetching the latest public mandi pricing rows for the preview board.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div ref={mandiSectionRef}>
        <MandiBhaav />
      </div>

      <PlatformSnapshot />

      <PublicLogisticsDirectory />

      <section className="bg-[#efe7d7] px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Who the platform serves</p>
            <h2 className="mt-4 font-serif text-3xl text-stone-900 sm:text-4xl">
              Built for market action, operational flow, and management visibility
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {valuePillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-[28px] border border-stone-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">{pillar.title}</p>
                <p className="mt-4 text-base leading-8 text-stone-700">{pillar.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f4efe4] px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Platform modules</p>
            <h2 className="mt-4 font-serif text-4xl text-stone-900 sm:text-5xl">
              Core Grainology modules for trading, operations, and control
            </h2>
            <p className="mt-5 text-lg leading-8 text-stone-700">
              Grainology combines market visibility with structured execution. These modules show how the platform connects
              mandi intelligence, order workflows, quality controls, logistics planning, admin reporting, and role-based access
              in one operational system.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {platformCapabilities.map((capability) => {
              const Icon = capability.icon;
              return (
                <div
                  key={capability.title}
                  className="group rounded-[30px] border border-stone-200 bg-[linear-gradient(180deg,#ffffff_0%,#faf5ea_100%)] p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_25px_70px_rgba(15,23,42,0.12)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-700 group-hover:text-white">
                      <Icon className="h-7 w-7" />
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      {capability.label}
                    </span>
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold text-stone-900">{capability.title}</h3>
                  <p className="mt-4 text-base leading-7 text-stone-600">{capability.description}</p>
                  <div className="mt-6 h-px bg-stone-200" />
                  <p className="mt-4 text-sm font-medium text-stone-500">Implemented in the current Grainology platform experience.</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>



      <section className="bg-[#1f3b2f] px-4 py-20 text-white lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">How the platform works</p>
            <h2 className="mt-4 font-serif text-4xl sm:text-5xl">
              Grainology supports the grain commerce journey from signal to settlement
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-4">
            {workflowSteps.map((step) => (
              <div key={step.title} className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
                <p className="text-lg font-semibold text-white">{step.title}</p>
                <p className="mt-4 text-sm leading-7 text-emerald-50/80">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* <section className="bg-[linear-gradient(180deg,#f7f1e5_0%,#efe6d3_100%)] px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Contact Grainology</p>
            <h2 className="mt-4 font-serif text-4xl text-stone-900 sm:text-5xl">
              Connect with the Grainology team for platform support and business enquiries
            </h2>
            <p className="mt-5 text-lg leading-8 text-stone-700">
              If you want to understand the platform, request support, or discuss Grainology for your grain operations,
              you can reach us directly through the contact details below.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {settings.contactDetails.map((detail) => {
              const Icon = contactIcons[detail.key as keyof typeof contactIcons] || MapPin;
              return (
                <div
                  key={detail.title}
                  className="rounded-[28px] border border-stone-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold text-stone-900">{detail.title}</h3>
                  <div className="mt-4 space-y-2 text-base leading-8 text-stone-600">
                    {detail.lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 rounded-[28px] border border-stone-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">{settings.businessHours.heading}</p>
                <p className="mt-3 text-xl font-semibold text-stone-900">{settings.businessHours.primary}</p>
                <p className="mt-2 text-base text-stone-600">{settings.businessHours.secondary}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
                >
                  Visit contact page
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
                >
                  Start with Grainology
                  <ShieldCheck className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section> */}

      {/* <section className="bg-[#f4efe4] px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-[96rem]">
          <div ref={mandiSectionRef} id="mandi-bhav-section" className="scroll-mt-24">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Open market access</p>
            <h2 className="mt-4 font-serif text-4xl text-stone-900 sm:text-5xl">
              Explore live mandi prices directly from the home page
            </h2>
            <p className="mt-5 max-w-4xl text-lg leading-8 text-stone-700">
              Users can review current mandi rates and arrivals without signing in first. Registration only becomes
              necessary when they want to move from market discovery into platform workflows and trading actions.
            </p>
            <div className="mt-8 rounded-[32px] border border-stone-200 bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-5 lg:p-6">

            </div>
          </div>

          <div className="mt-14 grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
            <div className="rounded-[36px] bg-[linear-gradient(160deg,#102f23_0%,#1d5c3f_100%)] p-8 text-white shadow-[0_32px_90px_rgba(17,94,63,0.22)] sm:p-10">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200">Control tower view</p>
              <h2 className="mt-4 font-serif text-4xl sm:text-5xl">
                The platform is larger than a price board
              </h2>
              <p className="mt-5 text-lg leading-8 text-emerald-50/90">
                Grainology also includes the management layer needed to operate a real agricultural trading system.
                The home page now makes that clear with specific platform control areas instead of repeating generic features.
              </p>

              <div className="mt-8 rounded-[30px] border border-white/10 bg-white/8 p-6 backdrop-blur">
                <p className="text-sm uppercase tracking-[0.24em] text-emerald-200">Included operational areas</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    'User management',
                    'Warehouse management',
                    'Location management',
                    'Commodity and variety setup',
                    'Confirmed order flows',
                    'Analytics and reports',
                    'Weather forecasting',
                    'Logistics provider oversight'
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/6 px-4 py-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      <span className="text-sm text-stone-100">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {controlTowerModules.map((module) => {
                const Icon = module.icon;
                return (
                  <div
                    key={module.title}
                    className="rounded-[30px] border border-stone-200 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.12)]"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-emerald-300">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold leading-tight text-stone-900">{module.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-stone-600">{module.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section> */}

      <section className="bg-white px-4 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[32px] bg-[linear-gradient(135deg,#0f3d2e_0%,#1f6b48_100%)] p-8 text-white shadow-[0_30px_90px_rgba(22,101,52,0.28)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-200">Partner ecosystem</p>
            <h2 className="mt-4 font-serif text-4xl">Partner with Grainology</h2>
            <p className="mt-5 text-lg leading-8 text-emerald-50/90">
              This call-to-action now has its own purpose. It is separate from Contact and aimed at organizations,
              aggregators, logistics partners, and enterprise buyers who want to join the platform ecosystem.
            </p>
            <div className="mt-8 space-y-4">
              {[
                'Onboard as a strategic buyer or aggregator',
                'Expand logistics and fulfilment partnerships',
                'Build regional operating coverage with shared workflows'
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <ShieldCheck className="mt-1 h-5 w-5 text-emerald-300" />
                  <p className="text-sm leading-7 text-emerald-50/85">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-stone-900 transition hover:bg-emerald-50"
              >
                Discuss partnership opportunities
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[32px] border border-stone-200 bg-[#f4efe4] p-7">
              <MapPinned className="h-10 w-10 text-emerald-700" />
              <h3 className="mt-5 text-2xl font-semibold text-stone-900">Built for regional operations</h3>
              <p className="mt-4 text-base leading-7 text-stone-700">
                Location, warehouse, commodity, and user flows support the kind of distributed agricultural
                operations that need both local execution and central visibility.
              </p>
            </div>
            <div className="rounded-[32px] border border-stone-200 bg-stone-900 p-7 text-white">
              <Users2 className="h-10 w-10 text-emerald-300" />
              <h3 className="mt-5 text-2xl font-semibold">Role-based experiences</h3>
              <p className="mt-4 text-base leading-7 text-stone-300">
                Public visitors can explore price intelligence, while authenticated users unlock trading, logistics,
                and operational workflows matched to their role.
              </p>
            </div>
            <div className="rounded-[32px] border border-stone-200 bg-white p-7 md:col-span-2">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Clear next steps</p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-7 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Create your trade account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 px-7 py-4 text-sm font-semibold text-stone-900 transition hover:bg-stone-50"
                >
                  Contact the Grainology team
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
