import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { UserSetting } from './user-setting';
import { ModalService } from 'service/modal.service';
import type { UserWrapper } from 'model/user.model';

const currentUser = (overrides: Partial<UserWrapper> = {}): UserWrapper => ({
  id: 1,
  name: 'Test User',
  email: 'user@test.com',
  phone: '0123456789',
  status: 'true',
  createdTime: '2026-01-01T10:00:00',
  role: 'ROLE_USER',
  accountLevel: { id: 2, code: 'VIP', name: 'VIP', description: null },
  accountNumber: 'ACC-001',
  ...overrides,
});

describe('UserSetting', () => {
  let component: UserSetting;
  let fixture: ComponentFixture<UserSetting>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserSetting],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(UserSetting);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  const flushCurrentUser = (user: UserWrapper, status = 200) =>
    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === `${environment.apiUrl}/users/current-user`)
      .flush(user, { status, statusText: status === 200 ? 'OK' : 'Error' });

  it('loads the current user on init', () => {
    flushCurrentUser(currentUser());

    expect(component.profile()?.email).toBe('user@test.com');
    expect(component.loading()).toBe(false);
    expect(component.errorMessage()).toBe('');
  });

  it('surfaces the API error message on failure', () => {
    flushCurrentUser(currentUser(), 403);

    expect(component.profile()).toBeNull();
    expect(component.loading()).toBe(false);
    expect(component.errorMessage()).not.toBe('');
  });

  it('keeps account-level fields optional (admin list shape)', () => {
    flushCurrentUser(currentUser({ accountLevel: undefined, accountNumber: null }));

    expect(component.profile()?.accountNumber).toBeNull();
  });

  it('opens the change-password modal from the quick action', () => {
    flushCurrentUser(currentUser());

    component.openChangePassword();

    expect(TestBed.inject(ModalService).isChangePasswordVisible()).toBe(true);
  });
});
