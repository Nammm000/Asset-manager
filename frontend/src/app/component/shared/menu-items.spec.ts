import { visibleMenuItems } from './menu-items';

describe('visibleMenuItems', () => {
  it('hides admin items from every non-admin role', () => {
    for (const role of ['ROLE_USER', 'ROLE_CUSTOMER'] as const) {
      const labels = visibleMenuItems(role).map((item) => item.label);
      expect(labels).not.toContain('Currencies');
      expect(labels).not.toContain('Users');
    }
  });

  it('shows all seven items to admins', () => {
    expect(visibleMenuItems('ROLE_ADMIN')).toHaveLength(7);
  });

  it('shows the five shared items regardless of role', () => {
    for (const role of [null, 'ROLE_USER', 'ROLE_ADMIN', 'ROLE_CUSTOMER'] as const) {
      expect(visibleMenuItems(role).filter((item) => item.role === '')).toHaveLength(5);
    }
  });
});
