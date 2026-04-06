import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X, Sprout } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut, signingOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    console.log('📍 [Navigation] handleSignOut called');
    try {
      // Call signOut and wait briefly for state to be cleared
      await signOut();
      console.log('📍 [Navigation] signOut completed, navigating to /login');
      // Add a small delay to ensure state is cleared before navigation
      setTimeout(() => {
        navigate('/login');
      }, 50);
    } catch (error) {
      console.error('📍 [Navigation] Handle signOut error:', error);
      // Fallback: clear manually and navigate
      localStorage.removeItem('auth_token');
      sessionStorage.clear();
      navigate('/login');
    }
  };

  return (
    <>
      {/* Top Partner Bar */}
      <div className="bg-stone-900 text-white py-2.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-stone-300">
            Grainology for agricultural trade intelligence, operations, and partnerships
          </p>
          <div className="flex items-center gap-4">
            {/* <Link to="/contact" className="font-medium text-emerald-300 hover:text-emerald-200 transition-colors">
              Partner with us
            </Link> */}
            <Link to="/register" className="hover:underline font-semibold">
              Create your trade account
            </Link>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <Sprout className="w-8 h-8 text-green-600" />
              <span className="text-2xl font-bold text-gray-900">Grainology</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                Home
              </Link>
              <Link to="/about" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                About
              </Link>
              <Link to="/services" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                Services
              </Link>
              <Link to="/contact" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                Contact
              </Link>
              
              {user ? (
                <div className="flex items-center gap-4">
                  <Link
                    to="/dashboard"
                    className="text-gray-700 hover:text-green-600 font-medium transition-colors"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {signingOut ? 'Logging Out...' : 'Logout'}
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  Login
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-gray-700"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t">
            <div className="px-4 py-4 space-y-3">
              <Link
                to="/"
                className="block text-gray-700 hover:text-green-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/about"
                className="block text-gray-700 hover:text-green-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                to="/services"
                className="block text-gray-700 hover:text-green-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Services
              </Link>
              <Link
                to="/contact"
                className="block text-gray-700 hover:text-green-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </Link>
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="block text-gray-700 hover:text-green-600 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
                    disabled={signingOut}
                    className="w-full text-left bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {signingOut ? 'Logging Out...' : 'Logout'}
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="block bg-green-600 text-white px-4 py-2 rounded-lg text-center font-semibold hover:bg-green-700 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
