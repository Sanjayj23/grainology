import { useState } from 'react';
import { Offer, Profile } from '../../lib/client';
import { Search, MapPin, Package, X, ShoppingCart } from 'lucide-react';
import { usePopupContext } from '../../contexts/PopupContext';

interface MarketplaceProps {
  offers: Offer[];
  profile: Profile;
  onPlaceOrder: (offerId: string, quantity: number, price: number) => Promise<{ error: any }>;
}

export default function Marketplace({ offers, profile, onPlaceOrder }: MarketplaceProps) {
  const { showAlert } = usePopupContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommodity, setSelectedCommodity] = useState<string>('All');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const commodities = ['All', 'Paddy', 'Maize', 'Wheat'];

  const filteredOffers = offers.filter(offer => {
    const matchesSearch = offer.commodity.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         offer.variety.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         offer.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCommodity = selectedCommodity === 'All' || offer.commodity === selectedCommodity;
    return matchesSearch && matchesCommodity;
  });

  const handlePlaceOrder = async () => {
    if (!selectedOffer || profile.role !== 'trader') return;

    if (orderQuantity < selectedOffer.min_trade_quantity_mt) {
      await showAlert({
        title: 'Minimum Trade Quantity',
        message: `Minimum trade quantity is ${selectedOffer.min_trade_quantity_mt} MT`,
        tone: 'warning',
      });
      return;
    }

    setLoading(true);
    const { error } = await onPlaceOrder(
      selectedOffer.id,
      orderQuantity,
      selectedOffer.price_per_quintal
    );

    setLoading(false);
    if (!error) {
      setSelectedOffer(null);
      setOrderQuantity(1);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by commodity, variety, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {commodities.map((commodity) => (
              <button
                key={commodity}
                onClick={() => setSelectedCommodity(commodity)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCommodity === commodity
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {commodity}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOffers.map((offer) => (
          <div key={offer.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{offer.commodity}</h3>
                  <p className="text-sm text-gray-600">{offer.variety}</p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  {offer.status}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{offer.location}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Package className="w-4 h-4" />
                  <span className="text-sm">{offer.quantity_mt} MT available</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Price per Quintal</p>
                    <p className="text-2xl font-bold text-green-600">₹{offer.price_per_quintal}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Seller</p>
                    <p className="text-sm font-medium text-gray-800">{offer.seller?.name || 'N/A'}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedOffer(offer)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredOffers.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No offers found</p>
        </div>
      )}

      {selectedOffer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-800">Offer Details</h2>
              <button
                onClick={() => setSelectedOffer(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Commodity</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedOffer.commodity}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Variety</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedOffer.variety}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Quantity Available</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedOffer.quantity_mt} MT</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Price per Quintal</p>
                  <p className="text-lg font-semibold text-green-600">₹{selectedOffer.price_per_quintal}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedOffer.location}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Seller</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedOffer.seller?.name || 'N/A'}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Quality Report</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  {Object.keys(selectedOffer.quality_report).length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(selectedOffer.quality_report).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{key}:</span>
                          <span className="text-sm font-medium text-gray-800">{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No quality data available</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Trade Terms</h3>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Min Trade Quantity:</span>
                      <span className="text-sm font-medium text-gray-800">{selectedOffer.min_trade_quantity_mt} MT</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Payment Terms:</span>
                      <span className="text-sm font-medium text-gray-800">{selectedOffer.payment_terms}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Offer Validity:</span>
                      <span className="text-sm font-medium text-gray-800">{selectedOffer.offer_validity_days} days</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Logistics Details</h3>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Delivery Location:</span>
                      <span className="text-sm font-medium text-gray-800">{selectedOffer.delivery_location || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Logistics:</span>
                      <span className="text-sm font-medium text-gray-800">{selectedOffer.logistics_option}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Delivery Timeline:</span>
                      <span className="text-sm font-medium text-gray-800">{selectedOffer.delivery_timeline_days} days</span>
                    </div>
                  </div>
                </div>
              </div>

              {profile.role === 'trader' && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Place Order</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity (MT)
                      </label>
                      <input
                        type="number"
                        min={selectedOffer.min_trade_quantity_mt}
                        max={selectedOffer.quantity_mt}
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Minimum: {selectedOffer.min_trade_quantity_mt} MT | Maximum: {selectedOffer.quantity_mt} MT
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Amount (Estimated)</span>
                        <span className="text-xl font-bold text-green-600">
                          ₹{(orderQuantity * 10 * selectedOffer.price_per_quintal).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Based on {orderQuantity} MT × 10 quintals/MT × ₹{selectedOffer.price_per_quintal}/quintal
                      </p>
                    </div>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={loading || orderQuantity < selectedOffer.min_trade_quantity_mt || orderQuantity > selectedOffer.quantity_mt}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      {loading ? 'Placing Order...' : 'Place Order'}
                    </button>
                  </div>
                </div>
              )}

              {profile.role === 'farmer' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Only traders can place orders. Switch to a trader account to purchase commodities.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
