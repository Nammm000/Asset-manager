import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { SavingsPassbookForm as SavingsPassbookFormComponent } from 'component/savings-passbooks/savings-passbook-form/savings-passbook-form';

// Ported from savings-passbook-form.spec.ts: TestBed → RTL render of the form
// modal (create mode, like the Angular fixture with no input set). Angular's
// typeIn() helper set input.value and fired one 'input' event; fireEvent.change
// is the equivalent one-shot setter — userEvent.type's per-keystroke events
// would fight the principal input's digit-strip + regrouping mask. No HTTP:
// these tests never submit.
let SavingsPassbookForm: typeof SavingsPassbookFormComponent;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  ({ SavingsPassbookForm } = await import(
    'component/savings-passbooks/savings-passbook-form/savings-passbook-form'
  ));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** Types into an input the way the Angular helper did: value + one input event. */
function typeIn(selector: string, value: string): void {
  fireEvent.change(document.querySelector(selector)!, { target: { value } });
}

function inputValue(selector: string): string {
  return (document.querySelector(selector) as HTMLInputElement).value;
}

function renderForm(): void {
  render(<SavingsPassbookForm passbook={null} onSaved={vi.fn()} onClosed={vi.fn()} />);
}

/** principal + rate + a valid time, then OK — the shared prologue of every test. */
async function computeFromOneYear(): Promise<void> {
  typeIn('#passbook-principal', '1000000');
  typeIn('#passbook-rate', '5.5');
  typeIn('#passbook-deposit-time', '1 year');
  await userEvent.click(screen.getByRole('button', { name: 'OK' }));
}

async function expectComputed(): Promise<void> {
  // The readonly inputs mirror the computed signals (depositTerm/proceeds/maturityDate).
  expect(inputValue('#passbook-deposit-term')).toBe('365');
  expect(inputValue('#passbook-proceeds')).toBe('1.055.000');
  expect(inputValue('#passbook-maturity')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
}

function expectComputedCleared(): void {
  expect(inputValue('#passbook-deposit-term')).toBe('');
  expect(inputValue('#passbook-proceeds')).toBe('');
  expect(inputValue('#passbook-maturity')).toBe('');
}

describe('SavingsPassbookForm', () => {
  it('OK computes term, proceeds and maturity from the typed deposit time', async () => {
    renderForm();
    await computeFromOneYear();

    await expectComputed();
    // canSubmit() — the save button unlocks only once term + maturity exist.
    expect(screen.getByRole('button', { name: 'Add Passbook' })).toBeEnabled();
  });

  it('changing the deposit time after OK clears term, proceeds and maturity date', async () => {
    renderForm();
    await computeFromOneYear();
    expect(inputValue('#passbook-deposit-term')).toBe('365');

    typeIn('#passbook-deposit-time', '2 years');

    expect(inputValue('#passbook-deposit-time')).toBe('2 years');
    expectComputedCleared();
    // Save is blocked until OK is clicked again.
    expect(screen.getByRole('button', { name: 'Add Passbook' })).toBeDisabled();
  });

  it('clears the derived values on every keystroke, even while the time string is invalid', async () => {
    renderForm();
    await computeFromOneYear();
    expect(inputValue('#passbook-maturity')).not.toBe('');

    typeIn('#passbook-deposit-time', '1x');

    expect(inputValue('#passbook-deposit-time')).toBe('1x');
    expectComputedCleared();
  });

  it('changing the interest rate after OK clears term, proceeds and maturity date', async () => {
    renderForm();
    await computeFromOneYear();
    expect(inputValue('#passbook-deposit-term')).toBe('365');

    typeIn('#passbook-rate', '6');

    expect(inputValue('#passbook-rate')).toBe('6');
    expectComputedCleared();
    expect(screen.getByRole('button', { name: 'Add Passbook' })).toBeDisabled();
  });

  it('changing the principal amount after OK clears term, proceeds and maturity date', async () => {
    renderForm();
    await computeFromOneYear();
    expect(inputValue('#passbook-deposit-term')).toBe('365');

    typeIn('#passbook-principal', '2000000');

    expect(inputValue('#passbook-principal')).toBe('2.000.000'); // re-formatted with dot grouping
    expectComputedCleared();
    expect(screen.getByRole('button', { name: 'Add Passbook' })).toBeDisabled();
  });

  it('clearing the principal input entirely also clears the computed fields', async () => {
    renderForm();
    await computeFromOneYear();
    expect(inputValue('#passbook-deposit-term')).toBe('365');

    typeIn('#passbook-principal', '');

    expect(inputValue('#passbook-principal')).toBe('');
    expectComputedCleared();
  });

  it('changing created at after OK clears term, proceeds and maturity date', async () => {
    renderForm();
    await computeFromOneYear();
    expect(inputValue('#passbook-deposit-term')).toBe('365');

    typeIn('#passbook-created-at', '2026-01-15');

    expect(inputValue('#passbook-created-at')).toBe('2026-01-15');
    expectComputedCleared();
    expect(screen.getByRole('button', { name: 'Add Passbook' })).toBeDisabled();
  });
});
