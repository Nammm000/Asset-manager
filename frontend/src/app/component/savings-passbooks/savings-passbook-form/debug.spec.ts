import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NgModel } from '@angular/forms';
import { SavingsPassbookForm } from './savings-passbook-form';

describe('SavingsPassbookForm debug', () => {
  let component: SavingsPassbookForm;
  let fixture: ComponentFixture<SavingsPassbookForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavingsPassbookForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(SavingsPassbookForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function typeIn(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function termProbe(): string {
    const term = fixture.nativeElement.querySelector('#passbook-deposit-term') as HTMLInputElement;
    const termDebugEl = fixture.debugElement.query((el) => el.nativeElement === term);
    const ngModel = termDebugEl ? termDebugEl.injector.get(NgModel, null) : null;
    return JSON.stringify({
      domValue: term.value,
      signal: component.depositTerm(),
      viewModel: ngModel?.viewModel,
      controlValue: ngModel?.control?.value,
    });
  }

  const variants: Array<{ name: string; typePrincipal: boolean; typeRate: boolean; typeTime: boolean }> = [
    { name: 'A-all-typed', typePrincipal: true, typeRate: true, typeTime: true },
    { name: 'B-time-typed-only', typePrincipal: false, typeRate: false, typeTime: true },
    { name: 'C-rate-typed-only', typePrincipal: false, typeRate: true, typeTime: false },
    { name: 'D-principal-typed-only', typePrincipal: true, typeRate: false, typeTime: false },
  ];

  for (const v of variants) {
    it(`debug ${v.name}`, () => {
      if (v.typePrincipal) {
        typeIn('#passbook-principal', '1000000');
      } else {
        component.principalAmount.set(1_000_000);
      }
      if (v.typeRate) {
        typeIn('#passbook-rate', '5.5');
      } else {
        component.interestRate.set(5.5);
      }
      if (v.typeTime) {
        typeIn('#passbook-deposit-time', '1 year');
      } else {
        component.depositTime.set('1 year');
      }
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('.ok-button') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect({ variant: v.name, probe: termProbe() }).toEqual({});
    });
  }
});
