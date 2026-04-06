import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Profile, api, Offer, Order, QualityParameter } from '../lib/client';
import { Home, PlusCircle, LogOut, Cloud, TrendingUp, ShoppingCart, Store, Menu, X, FileText, Truck } from 'lucide-react';
import Dashboard from './customer/Dashboard';
import CreateTrade from './customer/CreateTrade';
import MandiBhaav from './MandiBhaav';
import WeatherForecast from './WeatherForecast';
import PurchaseOrderHistory from './customer/PurchaseOrderHistory';
import SaleOrderHistory from './customer/SaleOrderHistory';
import ConfirmedOrders from './customer/ConfirmedOrders';
import LogisticsProvidersList from './customer/LogisticsProvidersList';
import { ToastContainer, useToast } from './Toast';
// Commented out - not in use
// import Marketplace from './customer/Marketplace';
// import ActiveTrades from './customer/ActiveTrades';
// import OrderTracking from './customer/OrderTracking';
import { DashboardCache } from '../lib/sessionStorage';

type View = 'dashboard' | 'create-trade' | 'purchase-order' | 'sale-order' | 'confirmed-orders' | 'mandi' | 'weather' | 'logistics-providers';

interface CustomerPanelProps {
  profile: Profile | null; // Allow profile to be null
  onSignOut: () => void;
  signingOut: boolean;
}

export default function CustomerPanel({ profile, onSignOut, signingOut }: CustomerPanelProps) {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [qualityParams, setQualityParams] = useState<QualityParameter[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      // Check cache first
      const cached = DashboardCache.getCustomerData(profile.id) as { offers: Offer[]; orders: Order[]; qualityParams: QualityParameter[] } | null;
      if (cached && cached.offers && cached.orders && cached.qualityParams) {
        setOffers(cached.offers || []);
        setMyOrders(cached.orders || []);
        setQualityParams(cached.qualityParams || []);
        setLoading(false);
        // Still load fresh data in background
        loadOffers();
        loadMyOrders();
        loadQualityParams();
      } else {
        loadOffers();
        loadMyOrders();
        loadQualityParams();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [profile]);

  const loadOffers = async () => {
    const { data, error } = await api
      .from('offers')
      .select('*, seller:profiles!offers_seller_id_fkey(name)')
      .eq('status', 'Active')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOffers(data as any);
      // Cache the data
      if (profile) {
        const cached = DashboardCache.getCustomerData(profile.id) as { offers: Offer[]; orders: Order[]; qualityParams: QualityParameter[] } | null;
        DashboardCache.setCustomerData(profile.id, {
          offers: data as any,
          orders: cached?.orders || [],
          qualityParams: cached?.qualityParams || []
        });
      }
    }
  };

  const loadMyOrders = async () => {
    if (!profile) return;
    
    let ordersData: any[] = [];
    
    if (profile.role === 'farmer') {
      const { data: farmerOffers } = await api
        .from('offers')
        .select('id')
        .eq('seller_id', profile.id);

      if (!farmerOffers || farmerOffers.length === 0) {
        setMyOrders([]);
        // Cache empty orders
        const cached = DashboardCache.getCustomerData(profile.id) as { offers: Offer[]; orders: Order[]; qualityParams: QualityParameter[] } | null;
        DashboardCache.setCustomerData(profile.id, {
          offers: cached?.offers || [],
          orders: [],
          qualityParams: cached?.qualityParams || []
        });
        return;
      }

      const offerIds = farmerOffers.map((o: { id: string }) => o.id);

      const { data, error } = await api
        .from('orders')
        .select('*, offer:offers(*, seller:profiles!offers_seller_id_fkey(name)), buyer:profiles!orders_buyer_id_fkey(name)')
        .in('offer_id', offerIds)
        .order('created_at', { ascending: false });

      if (!error && data) {
        ordersData = data as any;
        setMyOrders(ordersData);
      }
    } else {
      const { data, error } = await api
        .from('orders')
        .select('*, offer:offers(*, seller:profiles!offers_seller_id_fkey(name)), buyer:profiles!orders_buyer_id_fkey(name)')
        .eq('buyer_id', profile.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        ordersData = data as any;
        setMyOrders(ordersData);
      }
    }
    
    // Cache the orders
    if (ordersData.length >= 0 && profile) {
      const cached = DashboardCache.getCustomerData(profile.id) as { offers: Offer[]; orders: Order[]; qualityParams: QualityParameter[] } | null;
      DashboardCache.setCustomerData(profile.id, {
        offers: cached?.offers || [],
        orders: ordersData,
        qualityParams: cached?.qualityParams || []
      });
    }
  };

  const loadQualityParams = async () => {
    const { data, error } = await api
      .from('quality_parameters')
      .select('*')
      .order('commodity', { ascending: true });

    if (!error && data) {
      setQualityParams(data);
      // Cache the data
      if (profile) {
        const cached = DashboardCache.getCustomerData(profile.id) as { offers: Offer[]; orders: Order[]; qualityParams: QualityParameter[] } | null;
        DashboardCache.setCustomerData(profile.id, {
          offers: cached?.offers || [],
          orders: cached?.orders || [],
          qualityParams: data
        });
      }
    }
  };

  const handleCreateOffer = async (offerData: any) => {
    if (!profile) {
      return { error: { message: 'User profile not available' } };
    }
    
    if (profile.kyc_status !== 'verified') {
      return { error: { message: 'Please complete KYC verification before creating offers' } };
    }

    const { error } = await api.from('offers').insert({
      seller_id: profile.id,
      ...offerData,
    });

    if (!error) {
      await loadOffers();
      setCurrentView('dashboard');
    }

    return { error };
  };

  const handlePlaceOrder = async (offerId: string, quantity: number, price: number) => {
    if (!profile) {
      return { error: { message: 'User profile not available' } };
    }
    
    if (profile.kyc_status !== 'verified') {
      return { error: { message: 'Please complete KYC verification before placing orders' } };
    }

    const { error } = await api.from('orders').insert({
      offer_id: offerId,
      buyer_id: profile.id,
      quantity_mt: quantity,
      final_price_per_quintal: price,
      status: 'Pending Approval',
    });

    if (!error) {
      await loadMyOrders();
      await loadOffers();
    }

    return { error };
  };

  const handleViewChange = (view: View) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-green-600 border-solid mx-auto mb-4"></div>
          <p className="text-xl text-gray-700 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg flex flex-col transform transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-green-700">Grainology</h1>
              <p className="text-sm text-gray-600 mt-1">{profile?.name || 'User'}</p>
              <p className="text-xs text-gray-500 capitalize">{profile?.role || 'customer'}</p>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-gray-600 hover:bg-gray-100 p-2 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {/* 1. Dashboard */}
          <button
            onClick={() => handleViewChange('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'dashboard'
                ? 'bg-green-50 text-green-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="font-medium">Dashboard</span>
          </button>

          {/* 2. Create Trade */}
          <button
            onClick={() => handleViewChange('create-trade')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'create-trade'
                ? 'bg-green-50 text-green-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            <span className="font-medium">Create Trade</span>
          </button>

          {/* 3. Purchase Order */}
          <button
            onClick={() => handleViewChange('purchase-order')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'purchase-order'
                ? 'bg-green-50 text-green-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="font-medium">Purchase Order</span>
          </button>

          {/* 4. Sales Order */}
          <button
            onClick={() => handleViewChange('sale-order')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'sale-order'
                ? 'bg-green-50 text-green-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Store className="w-5 h-5" />
            <span className="font-medium">Sales Order</span>
          </button>

          {/* 5. All Confirmed Order */}
          <button
            onClick={() => handleViewChange('confirmed-orders')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'confirmed-orders'
                ? 'bg-green-50 text-green-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium">All Confirmed Order</span>
          </button>

          {/* 6. Mandi Bhav */}
          <button
            onClick={() => handleViewChange('mandi')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'mandi'
                ? 'bg-green-50 text-green-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="font-medium">Mandi Bhav</span>
          </button>

          {/* 7. Weather */}
          <button
            onClick={() => handleViewChange('weather')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'weather'
                ? 'bg-green-50 text-green-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Cloud className="w-5 h-5" />
            <span className="font-medium">Weather</span>
          </button>

          {/* 8. Logistics Providers */}
          <button
            onClick={() => handleViewChange('logistics-providers')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'logistics-providers'
                ? 'bg-green-50 text-green-700'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Truck className="w-5 h-5" />
            <span className="font-medium">Logistics Providers</span>
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={async () => {
              console.log('📍 [CustomerPanel] Sign out button clicked');
              try {
                await onSignOut();
                console.log('📍 [CustomerPanel] onSignOut completed, navigating to /login');
                setTimeout(() => {
                  navigate('/login');
                }, 50);
              } catch (error) {
                console.error('📍 [CustomerPanel] Sign out error:', error);
                localStorage.removeItem('auth_token');
                sessionStorage.clear();
                navigate('/login');
              }
            }}
            disabled={signingOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">
              {signingOut ? 'Signing Out...' : 'Sign Out'}
            </span>
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm border-b border-gray-200 p-4 md:p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-gray-600 hover:text-gray-900 p-2 -ml-2"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="p-4 md:p-6">
          {currentView === 'dashboard' && profile && (
            <Dashboard profile={profile} orders={myOrders} offers={offers} />
          )}
          {currentView === 'create-trade' && profile && (
            <CreateTrade
              qualityParams={qualityParams}
              onCreateOffer={handleCreateOffer}
              userRole={profile?.role as 'farmer' | 'trader'}
              userId={profile.id}
            />
          )}
          {currentView === 'purchase-order' && profile && (
            <PurchaseOrderHistory userId={profile.id} userName={profile.name || 'User'} />
          )}
          {currentView === 'sale-order' && profile && (
            <SaleOrderHistory userId={profile.id} userName={profile.name || 'User'} />
          )}
          {currentView === 'confirmed-orders' && profile && (
            <ConfirmedOrders userId={profile.id} userName={profile.name || 'User'} />
          )}
          {currentView === 'mandi' && (
            <MandiBhaav />
          )}
          {currentView === 'weather' && (
            <WeatherForecast />
          )}
          {currentView === 'logistics-providers' && (
            <LogisticsProvidersList />
          )}
        </div>
      </main>
    </div>
  );
}
