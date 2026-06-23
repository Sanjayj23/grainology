import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import LandingPage from './components/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import About from './pages/About';
import Services from './pages/Services';
import Features from './pages/Features';
import Contact from './pages/Contact';
import CustomerPanel from './components/CustomerPanel';
import AdminPanel from './components/AdminPanel';
import KYCCallback from './pages/KYCCallback';
import { AgmarknetDashboard } from './components/agmarknet/AgmarknetDashboard';
import ScrollToTop from './components/ScrollToTop';
import { ToastProvider } from './contexts/ToastContext';
import { PopupProvider } from './contexts/PopupContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function Dashboard() {
  const { profile, loading, signOut, signingOut } = useAuth();

  // Wait for profile to load before determining which panel to show
  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (profile.role === 'admin' || profile.role === 'super_admin') {
    return <AdminPanel profile={profile} onSignOut={signOut} signingOut={signingOut} />;
  }

  return <CustomerPanel profile={profile} onSignOut={signOut} signingOut={signingOut} />;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is already logged in, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <PopupProvider>
        <Router>
          <ScrollToTop />
          <Routes>
          {/* Public Routes */}
          <Route path="/" element={
            <>
              <Navigation />
              <LandingPage />
              <Footer />
            </>
          } />
          <Route path="/about" element={
            <>
              <Navigation />
              <About />
            </>
          } />
          <Route path="/services" element={
            <>
              <Navigation />
              <Services />
            </>
          } />
          <Route path="/features" element={
            <>
              <Navigation />
              <Features />
            </>
          } />
          <Route path="/contact" element={
            <>
              <Navigation />
              <Contact />
            </>
          } />
          <Route path="/mandi-bhaav" element={
            <div className="min-h-screen bg-slate-50">
              <Navigation />
              <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
                <AgmarknetDashboard />
              </div>
              <Footer />
            </div>
          } />
          <Route path="/login" element={
            <AuthRoute>
              <Login />
            </AuthRoute>
          } />
          <Route path="/register" element={
            <AuthRoute>
              <Register />
            </AuthRoute>
          } />
          <Route path="/kyc-callback" element={<KYCCallback />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Redirect unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </PopupProvider>
    </ToastProvider>
  );
}
