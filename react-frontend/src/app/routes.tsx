import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router';
import { App } from './app';
import { RequireAuth } from 'guard/RequireAuth';
import { RequireAdmin } from 'guard/RequireAdmin';

// Ported from app.routes.ts: every page is lazy-loaded (loadComponent → lazy)
// and role-gated. Titles are set per page via usePageTitle.
const Dashboard = lazy(() => import('component/dashboard/dashboard'));
const SavingsPassbooks = lazy(() => import('component/savings-passbooks/savings-passbooks'));
const LandAssets = lazy(() => import('component/land-assets/land-assets'));
const CashAssets = lazy(() => import('component/cash-assets/cash-assets'));
const OtherAssets = lazy(() => import('component/other-assets/other-assets'));
const UserSetting = lazy(() => import('component/user-setting/user-setting'));
const Currencies = lazy(() => import('component/currencies/currencies'));
const Users = lazy(() => import('component/users/users'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <RequireAuth><Dashboard /></RequireAuth> },
      { path: 'savings-passbooks', element: <RequireAuth><SavingsPassbooks /></RequireAuth> },
      { path: 'land-assets', element: <RequireAuth><LandAssets /></RequireAuth> },
      { path: 'cash-assets', element: <RequireAuth><CashAssets /></RequireAuth> },
      { path: 'other-assets', element: <RequireAuth><OtherAssets /></RequireAuth> },
      { path: 'user-setting', element: <RequireAuth><UserSetting /></RequireAuth> },
      { path: 'currencies', element: <RequireAdmin><Currencies /></RequireAdmin> },
      { path: 'users', element: <RequireAdmin><Users /></RequireAdmin> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
