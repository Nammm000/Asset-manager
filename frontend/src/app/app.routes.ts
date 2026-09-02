import { Routes } from '@angular/router';
import { authGuard, adminGuard } from 'guard/route-guard.service';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('component/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [authGuard],
    title: 'Dashboard | Asset Manager',
  },
  {
    path: 'savings-passbooks',
    loadComponent: () => import('component/savings-passbooks/savings-passbooks').then((m) => m.SavingsPassbooks),
    canActivate: [authGuard],
    title: 'Savings Passbooks | Asset Manager',
  },
  {
    path: 'land-assets',
    loadComponent: () => import('component/land-assets/land-assets').then((m) => m.LandAssets),
    canActivate: [authGuard],
    title: 'Land Assets | Asset Manager',
  },
  {
    path: 'cash-assets',
    loadComponent: () => import('component/cash-assets/cash-assets').then((m) => m.CashAssets),
    canActivate: [authGuard],
    title: 'Cash Assets | Asset Manager',
  },
  {
    path: 'other-assets',
    loadComponent: () => import('component/other-assets/other-assets').then((m) => m.OtherAssets),
    canActivate: [authGuard],
    title: 'Other Assets | Asset Manager',
  },
  {
    path: 'currencies',
    loadComponent: () => import('component/currencies/currencies').then((m) => m.Currencies),
    canActivate: [adminGuard],
    title: 'Currencies | Asset Manager',
  },
  {
    path: 'users',
    loadComponent: () => import('component/users/users').then((m) => m.Users),
    canActivate: [adminGuard],
    title: 'Users | Asset Manager',
  },
  { path: '**', redirectTo: '' },
];
