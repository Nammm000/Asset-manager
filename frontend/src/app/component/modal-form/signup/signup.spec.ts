import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NgForm } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { Signup } from './signup';

describe('Signup', () => {
  let component: Signup;
  let fixture: ComponentFixture<Signup>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Signup],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Signup);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('toggles password and confirm password visibility with the eye buttons', async () => {
    component.isVisible.set(true);
    fixture.detectChanges();
    const passwordInput: HTMLInputElement = fixture.nativeElement.querySelector('#password');
    const confirmInput: HTMLInputElement = fixture.nativeElement.querySelector('#confirmPassword');
    const toggles: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('.password-toggle');

    expect(passwordInput.type).toBe('password');
    expect(confirmInput.type).toBe('password');
    toggles[0].click();
    toggles[1].click();
    await fixture.whenStable();

    expect(passwordInput.type).toBe('text');
    expect(confirmInput.type).toBe('text');
  });

  it('signs up with name/phone (backend contract) and closes the modal on success', () => {
    component.email.set('a@b.c');
    component.name.set('Alice');
    component.phone.set('0123456789');
    component.password.set('Passw0rd!');
    component.confirmPassword.set('Passw0rd!');
    component.isVisible.set(true);
    component.submit({} as NgForm);

    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/auth/signup`);
    expect(req.request.body).toEqual({
      name: 'Alice',
      email: 'a@b.c',
      phone: '0123456789',
      password: 'Passw0rd!',
    });
    req.flush({ id: 1, name: 'Alice', phone: '0123456789', email: 'a@b.c', accountNumber: 'ACC-1' });

    expect(component.isVisible()).toBe(false);
  });
});
