import { useEffect, useState, type ChangeEvent } from 'react';
import { getAll, remove, updateRole, updateStatus } from 'service/user.service';
import { useModalStore } from 'store/modal-store';
import { useT } from 'store/language-store';
import { getApiErrorMessage } from 'util/api-util';
import { customFormattedDate } from 'util/time-util';
import { GlobalMessages } from 'component/shared/global-constants';
import type { Role, UserWrapper } from 'model/user.model';
import { usePageTitle } from 'hooks/use-page-title';

// All page styles are global in src/scss/page.scss and src/scss/table.scss.
import './users.scss';

/** Roles an admin can assign here — ROLE_CUSTOMER is not assignable from the UI. */
const ASSIGNABLE_ROLES: Role[] = ['ROLE_USER', 'ROLE_ADMIN'];

/**
 * Ported from Angular's Users: admin user management — list, inline status/role
 * controls and delete; no create (signup owns that). UserWrapper.status is
 * stringly 'true'/'false' on the backend, and the timestamp field is createdTime.
 */
export function Users() {
  usePageTitle('Users | Asset Manager');

  const t = useT();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState<UserWrapper[]>([]);

  useEffect(() => {
    // Mount-only (Angular ngOnInit) — load() closes over just the setters and
    // the module-level service, so there is nothing stale to capture.
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = (): void => {
    setLoading(true);
    setErrorMessage('');
    getAll().then(
      (users) => {
        setRows(users);
        setLoading(false);
      },
      (error: unknown) => {
        setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError));
        setLoading(false);
      },
    );
  };

  const toggleStatus = (user: UserWrapper): void => {
    const next = user.status === 'true' ? 'false' : 'true';
    updateStatus(user.id, next).then(
      () => load(),
      (error: unknown) => setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError)),
    );
  };

  const onRoleChange = (user: UserWrapper, event: ChangeEvent<HTMLSelectElement>): void => {
    const role = event.target.value as Role;
    if (role === user.role) {
      return;
    }
    updateRole(user.id, role).then(
      () => load(),
      (error: unknown) => setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError)),
    );
  };

  const confirmDelete = (user: UserWrapper): void => {
    useModalStore.getState().openConfirmation({
      title: 'Delete user',
      message: `Delete ${user.email} and all their data? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => deleteUser(user.id),
    });
  };

  const deleteUser = (id: number): void => {
    remove(id).then(
      () => load(),
      (error: unknown) => setErrorMessage(getApiErrorMessage(error, GlobalMessages.genericError)),
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('menu.users')}</h1>
        <p className="page-subtitle">Manage accounts, roles and status.</p>
      </div>

      {loading ? (
        <p className="loading-text">Loading…</p>
      ) : errorMessage ? (
        <p className="error-banner">{errorMessage}</p>
      ) : rows.length === 0 ? (
        <p className="empty-state">No users found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>{t('common.status')}</th>
                <th>{t('common.created')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.phone}</td>
                  <td>
                    <select
                      className="role-select"
                      value={user.role}
                      onChange={(event) => onRoleChange(user, event)}
                      aria-label={`Role for ${user.email}`}
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span
                      className={`badge${user.status === 'true' ? ' badge--active' : ' badge--inactive'}`}
                    >
                      {user.status === 'true' ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td>{customFormattedDate(user.createdTime)}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="table-button" onClick={() => toggleStatus(user)}>
                        {user.status === 'true' ? t('common.deactivate') : t('common.activate')}
                      </button>
                      <button
                        type="button"
                        className="table-button table-button--danger"
                        onClick={() => confirmDelete(user)}
                        title="Delete"
                      >
                        <i className="icon-18 trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Users;
