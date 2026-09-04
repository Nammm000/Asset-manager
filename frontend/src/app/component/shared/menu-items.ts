import type { Role } from 'model/user.model';

export interface Menu {
  path: string; // route path without leading slash
  label: string;
  description: string; // shown on the dashboard quick links
  icon: string; // glyph class from src/scss/icon.scss, rendered as `icon-18 {icon}`
  /** '' = any authenticated user; 'ROLE_ADMIN' = admins only. */
  role: '' | 'ROLE_ADMIN';
}

const MENU_ITEMS: Menu[] = [
  {
    path: 'dashboard',
    label: 'Dashboard',
    description: 'Overview and quick access to your assets.',
    icon: 'grid',
    role: '',
  },
  {
    path: 'savings-passbooks',
    label: 'Savings Passbooks',
    description: 'Track bank passbooks, interest rates and deposits.',
    icon: 'book-open',
    role: '',
  },
  {
    path: 'land-assets',
    label: 'Land Assets',
    description: 'Manage land holdings, purchases and sales.',
    icon: 'map',
    role: '',
  },
  {
    path: 'cash-assets',
    label: 'Cash Assets',
    description: 'Cash wallets and their per-currency balances.',
    icon: 'credit-card',
    role: '',
  },
  {
    path: 'other-assets',
    label: 'Other Assets',
    description: 'Everything else you own, valued per unit.',
    icon: 'box',
    role: '',
  },
  {
    path: 'currencies',
    label: 'Currencies',
    description: 'Define the currencies used across balances.',
    icon: 'dollar-sign',
    role: 'ROLE_ADMIN',
  },
  {
    path: 'users',
    label: 'Users',
    description: 'Manage accounts, roles and status.',
    icon: 'users',
    role: 'ROLE_ADMIN',
  },
];

/**
 * Admin-only items are hidden from everyone else; the remaining items are
 * visible to any authenticated role (the backend's asset endpoints are
 * owner-scoped, not role-gated).
 */
export function visibleMenuItems(role: Role | null): Menu[] {
  return MENU_ITEMS.filter((item) => item.role !== 'ROLE_ADMIN' || role === 'ROLE_ADMIN');
}
