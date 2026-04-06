import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, Mail, MapPin, Phone, ShieldCheck, Sprout, Tractor, Wheat } from 'lucide-react';
import { useSiteSettings } from '../lib/siteSettings';

const platformHighlights = [
  {
    icon: Wheat,
    title: 'Market visibility',
    text: 'Track signals, prices, and operational movement in one connected platform.'
  },
  {
    icon: Tractor,
    title: 'Trade workflows',
    text: 'Support farmers, traders, FPOs, corporates, millers, and financers with role-based flows.'
  },
  {
    icon: ShieldCheck,
    title: 'Operational control',
    text: 'Keep users, logistics, warehouses, and order data visible to the right teams.'
  }
];

const footerLinks = {
  platform: [
    { label: 'Home', to: '/' },
    { label: 'About Grainology', to: '/about' },
    { label: 'Services', to: '/services' },
    { label: 'Insights', to: '/features' }
  ],
  actions: [
    { label: 'Contact Us', to: '/contact' },
    { label: 'Create Account', to: '/register' },
    { label: 'Login', to: '/login' },
    { label: 'Dashboard', to: '/dashboard' }
  ]
};

export default function Footer() {
  const { settings } = useSiteSettings();
  const emailDetail = settings.contactDetails.find((item) => item.key === 'email');
  const phoneDetail = settings.contactDetails.find((item) => item.key === 'phone');
  const addressDetail = settings.contactDetails.find((item) => item.key === 'address');

  return (
    <footer className="relative overflow-hidden bg-[linear-gradient(180deg,#0b2017_0%,#07150f_100%)] text-stone-200">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(110,231,183,0.8),transparent)]" />
      <div className="absolute -left-20 top-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-lime-300/8 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                <Leaf className="h-4 w-4" />
                Grainology Network
              </div>
              <h2 className="mt-5 max-w-[15ch] text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Build smarter grain trade operations with one connected platform.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
                Grainology brings market intelligence, trade execution, logistics visibility, and platform oversight together for modern agricultural commerce teams.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-stone-950 transition hover:bg-emerald-400"
                >
                  Start with Grainology
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Talk to our team
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              {platformHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-stone-950/35 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-stone-300">{item.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-8 border-b border-white/10 pb-10 lg:grid-cols-[1.1fr_0.6fr_0.6fr_0.9fr]">
          <div>
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-200">
                <Sprout className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xl font-semibold text-white">Grainology</p>
                <p className="text-sm text-stone-400">Agricultural trade platform</p>
              </div>
            </Link>

            <p className="mt-5 max-w-md text-sm leading-7 text-stone-400">
              Built for real trading teams that need pricing visibility, order execution, warehouse coordination, and stronger operational governance across regions.
            </p>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                {settings.businessHours.heading}
              </p>
              <p className="mt-3 text-sm font-medium text-white">{settings.businessHours.primary}</p>
              <p className="mt-1 text-sm text-stone-400">{settings.businessHours.secondary}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">Platform</p>
            <div className="mt-4 flex flex-col gap-3">
              {footerLinks.platform.map((link) => (
                <Link key={link.label} to={link.to} className="text-sm text-stone-300 transition hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">Actions</p>
            <div className="mt-4 flex flex-col gap-3">
              {footerLinks.actions.map((link) => (
                <Link key={link.label} to={link.to} className="text-sm text-stone-300 transition hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">Contact</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 h-4 w-4 text-emerald-300" />
                <div className="text-sm text-stone-300">
                  {(emailDetail?.lines || ['support@grainology.com']).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-1 h-4 w-4 text-emerald-300" />
                <div className="text-sm text-stone-300">
                  {(phoneDetail?.lines || ['+91 1800-XXX-XXXX']).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-4 w-4 text-emerald-300" />
                <div className="text-sm text-stone-300">
                  {(addressDetail?.lines || ['India']).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-sm text-stone-400 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Grainology. Built for transparent, connected agricultural trade.</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-300">
              Live market context
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-300">
              Role-based workflows
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-300">
              Admin control layer
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
