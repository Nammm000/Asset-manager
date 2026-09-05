import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SavingsPassbookForm } from './savings-passbook-form';

describe('SavingsPassbookForm', () => {
  let component: SavingsPassbookForm;
  let fixture: ComponentFixture<SavingsPassbookForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavingsPassbookForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SavingsPassbookForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  /** Types into an input the way a real keystroke does, through the value accessor. */
  function typeIn(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function inputValue(selector: string): string {
    return (fixture.nativeElement.querySelector(selector) as HTMLInputElement).value;
  }

  it('OK computes term, proceeds and maturity from the typed deposit time', () => {
    typeIn('#passbook-principal', '1000000');
    typeIn('#passbook-rate', '5.5');
    typeIn('#passbook-deposit-time', '1 year');

    (fixture.nativeElement.querySelector('.ok-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.depositTerm()).toBe(365);
    expect(component.estimatedMaturityProceeds()).toBeCloseTo(1_055_000, 0);
    expect(component.estimatedMaturityProceedsText()).toBe('1.055.000');
    expect(component.maturityDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The readonly inputs mirror the computed values
    expect(inputValue('#passbook-deposit-term')).toBe('365');
    expect(inputValue('#passbook-proceeds')).toBe('1.055.000');
    expect(inputValue('#passbook-maturity')).toBe(component.maturityDate());
    expect(component.canSubmit()).toBe(true);
  });

  it('changing the deposit time after OK clears term, proceeds and maturity date', () => {
    typeIn('#passbook-principal', '1000000');
    typeIn('#passbook-rate', '5.5');
    typeIn('#passbook-deposit-time', '1 year');
    (fixture.nativeElement.querySelector('.ok-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.depositTerm()).toBe(365);

    typeIn('#passbook-deposit-time', '2 years');

    expect(component.depositTime()).toBe('2 years');
    expect(component.depositTerm()).toBeNull();
    expect(component.estimatedMaturityProceeds()).toBeNull();
    expect(component.estimatedMaturityProceedsText()).toBe('');
    expect(component.maturityDate()).toBe('');
    // The readonly inputs visibly clear and save is blocked until OK is clicked again
    expect(inputValue('#passbook-deposit-term')).toBe('');
    expect(inputValue('#passbook-proceeds')).toBe('');
    expect(inputValue('#passbook-maturity')).toBe('');
    expect(component.canSubmit()).toBe(false);
  });

  it('clears the derived values on every keystroke, even while the time string is invalid', () => {
    typeIn('#passbook-principal', '1000000');
    typeIn('#passbook-rate', '5.5');
    typeIn('#passbook-deposit-time', '1 year');
    (fixture.nativeElement.querySelector('.ok-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.maturityDate()).not.toBe('');

    typeIn('#passbook-deposit-time', '1x');

    expect(component.depositTime()).toBe('1x');
    expect(component.depositTerm()).toBeNull();
    expect(component.estimatedMaturityProceedsText()).toBe('');
    expect(component.maturityDate()).toBe('');
  });
});
