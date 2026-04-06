export default function PlatformSnapshot() {
  return (
    <section className="bg-[#efe7d7] px-4 py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Platform snapshot</p>
          <h2 className="mt-4 font-serif text-3xl text-stone-900 sm:text-4xl">
            A quick view of what Grainology connects across the platform
          </h2>
          <p className="mt-5 text-lg leading-8 text-stone-700">
            Grainology brings together live market signals, trading workflows, quality checks, logistics coordination,
            and admin oversight in one structured grain operations platform.
          </p>
        </div>

        <div className="rounded-[36px] border border-[#ddd2bb] bg-[#f8f2e5] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-8">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-[28px] bg-[#1f1a17] p-7 text-white sm:p-8">
              <p className="text-sm uppercase tracking-[0.30em] text-emerald-300">Live signals</p>
              <h3 className="mt-4 max-w-md text-3xl font-semibold leading-tight sm:text-4xl">
                Mandi, weather, and planning context
              </h3>
              <p className="mt-4 max-w-md text-base leading-8 text-stone-300 sm:text-lg">
                Users can view mandi price updates and weather conditions together, helping them understand market movement
                and local operating conditions before creating or reviewing trades.
              </p>
            </div>

            <div className="rounded-[28px] bg-[#d6f4e5] p-7 text-stone-900 sm:p-8">
              <p className="text-sm uppercase tracking-[0.30em] text-emerald-900">Platform scope</p>
              <h3 className="mt-4 max-w-md text-3xl font-semibold leading-tight sm:text-4xl">
                Multi-role grain workflows
              </h3>
              <p className="mt-4 max-w-md text-base leading-8 text-stone-700 sm:text-lg">
                The platform is structured for farmers, traders, FPOs, corporates, millers, financers, admins, and
                super admins with role-based access across trading and management workflows.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-stone-200 bg-white p-6 sm:p-8">
            <div className="flex flex-wrap gap-3">
              {[
                'Trade creation',
                'Purchase orders',
                'Sale orders',
                'Quality checks',
                'Logistics',
                'Analytics'
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-stone-100 px-5 py-2.5 text-sm font-semibold text-stone-700 sm:px-6 sm:py-3 sm:text-base"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] bg-stone-50 p-6">
                <p className="text-sm font-medium text-stone-500">Connected roles</p>
                <p className="mt-3 text-2xl font-semibold leading-tight text-stone-900">From farmer to super admin</p>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  Grainology connects operational users and management users inside one shared platform structure.
                </p>
              </div>
              <div className="rounded-[24px] bg-stone-50 p-6">
                <p className="text-sm font-medium text-stone-500">Decision layer</p>
                <p className="mt-3 text-2xl font-semibold leading-tight text-stone-900">Market data plus workflow control</p>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  Public mandi and weather signals are combined with internal order, quality, and approval workflows.
                </p>
              </div>
              <div className="rounded-[24px] bg-stone-50 p-6">
                <p className="text-sm font-medium text-stone-500">Access model</p>
                <p className="mt-3 text-2xl font-semibold leading-tight text-stone-900">Public visibility, secure execution</p>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  Users can explore live public signals openly, while trade actions and admin controls stay inside secure role-based access.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
