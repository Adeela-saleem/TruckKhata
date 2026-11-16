import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BarChart3, BookOpenText, HandCoins, LayoutGrid, Receipt, Settings, ShieldCheck, Trash2, Truck, UserRound, Users } from 'lucide-react';
import { Toaster } from './components/shared/Toast';
import { AppProvider, useApp, useData } from './app/context';
import { DialogHost } from './app/dialog';
import { listInsurance } from './core/repo/insurance';
import { Mark } from './ui/Brand';
import { Shell, type NavGroup } from './ui/Shell';
import { AuthProvider, useAuth } from './app/auth';
import AuthPage from './pages/auth/AuthPage';
import Dashboard from './pages/Dashboard';

const AdaList = lazy(() => import('./pages/ada/AdaList'));
const ReceiptList = lazy(() => import('./pages/ada/ReceiptList'));
const AdaForm = lazy(() => import('./pages/ada/AdaForm'));
const AdaDetail = lazy(() => import('./pages/ada/AdaDetail'));
const PartyList = lazy(() => import('./pages/parties/PartyList'));
const PartyForm = lazy(() => import('./pages/parties/PartyForm'));
const PartyDetail = lazy(() => import('./pages/parties/PartyDetail'));
const TripList = lazy(() => import('./pages/trips/TripList'));
const TripForm = lazy(() => import('./pages/trips/TripForm'));
const CaseSheet = lazy(() => import('./pages/trips/CaseSheet'));
const BillList = lazy(() => import('./pages/bills/BillList'));
const BillForm = lazy(() => import('./pages/bills/BillForm'));
const BillDetail = lazy(() => import('./pages/bills/BillDetail'));
const InsuranceList = lazy(() => import('./pages/insurance/InsuranceList'));
const InsuranceForm = lazy(() => import('./pages/insurance/InsuranceForm'));
const InsuranceDetail = lazy(() => import('./pages/insurance/InsuranceDetail'));
const Reports = lazy(() => import('./pages/reports/Reports'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const RecycleBin = lazy(() => import('./pages/settings/RecycleBin'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

function AppFrame() {
  const { t } = useApp();
  const { data: alerts } = useData(async (db) => (await listInsurance(db)).filter((i) => i.status !== 'active').length);
  const groups: NavGroup[] = [
    {
      heading: t('web.nav.overview'),
      items: [
        { to: '/', label: t('web.dashboard'), Icon: LayoutGrid },
        { to: '/reports', label: t('modules.reports'), Icon: BarChart3 },
      ],
    },
    {
      heading: t('home.khata'),
      items: [
        { to: '/ada', label: t('web.ada.tipEntry'), Icon: BookOpenText },
        { to: '/receipts', label: t('web.receipts.title'), Icon: HandCoins },
        { to: '/parties', label: t('modules.parties'), Icon: Users },
        { to: '/trips', label: t('modules.trips'), Icon: Truck },
        { to: '/bills', label: t('modules.bills'), Icon: Receipt },
        { to: '/insurance', label: t('modules.insurance'), Icon: ShieldCheck, badge: alerts || undefined },
      ],
    },
    {
      heading: t('web.nav.system'),
      items: [
        { to: '/profile', label: t('web.auth.profile.title'), Icon: UserRound },
        { to: '/settings', label: t('modules.settings'), Icon: Settings },
        { to: '/bin', label: t('settings.bin'), Icon: Trash2 },
      ],
    },
  ];
  return (
    <Shell groups={groups}>
          <Suspense fallback={<div className="flex-1" />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ada" element={<AdaList />} />
              <Route path="/ada/new" element={<AdaForm />} />
              <Route path="/ada/:id" element={<AdaDetail />} />
              <Route path="/ada/:id/edit" element={<AdaForm />} />
              <Route path="/receipts" element={<ReceiptList />} />
              <Route path="/parties" element={<PartyList />} />
              <Route path="/parties/new" element={<PartyForm />} />
              <Route path="/parties/:id" element={<PartyDetail />} />
              <Route path="/parties/:id/edit" element={<PartyForm />} />
              <Route path="/trips" element={<TripList />} />
              <Route path="/trips/new" element={<TripForm />} />
              <Route path="/trips/leg/:legId/edit" element={<TripForm />} />
              <Route path="/trips/:caseId" element={<CaseSheet />} />
              <Route path="/bills" element={<BillList />} />
              <Route path="/bills/new" element={<BillForm />} />
              <Route path="/bills/:id" element={<BillDetail />} />
              <Route path="/bills/:id/edit" element={<BillForm />} />
              <Route path="/insurance" element={<InsuranceList />} />
              <Route path="/insurance/new" element={<InsuranceForm />} />
              <Route path="/insurance/:id" element={<InsuranceDetail />} />
              <Route path="/insurance/:id/edit" element={<InsuranceForm />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/bin" element={<RecycleBin />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
    </Shell>
  );
}

function Splash({ error }: { error?: unknown }) {
  return (
    <div className="min-h-viewport grid place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <Mark size={48} />
        {error ? (
          <p className="text-[14px] text-content-muted max-w-sm">
            The data could not be opened in this browser. Allow site storage, or try another browser such as Chrome or Edge.
          </p>
        ) : (
          <p className="text-[14px] text-content-subtle">Opening Truck Khata</p>
        )}
      </div>
    </div>
  );
}

/** Signed out: only the sign in and sign up pages. Signed in: the app. */
function Gate() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Splash />;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage mode="signin" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location.pathname }} />} />
      </Routes>
    );
  }
  if (location.pathname === '/login' || location.pathname === '/signup') return <Navigate to="/" replace />;
  return <AppFrame />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider splash={(error) => <Splash error={error} />}>
        <AuthProvider>
          <Gate />
        </AuthProvider>
        <DialogHost />
        <Toaster />
      </AppProvider>
    </BrowserRouter>
  );
}
