import { Component, ElementRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ModalService } from 'service/modal.service';
import { AuthService } from 'service/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  isMobileMenuOpen = signal(false);
  isDropdownOpen = signal(false);
  avatarLoadFailed = signal(false);

  private readonly elementRef = inject(ElementRef);

  constructor(
    private modalService: ModalService,
    // protected: referenced directly from the template (strictTemplates forbids private)
    protected authService: AuthService,
  ) {
    // A changed avatar URL (e.g. re-login as someone else) must retry the <img>.
    effect(() => {
      this.authService.avatarUrl();
      this.avatarLoadFailed.set(false);
    });
  }

  // Null-safe: strictTemplates requires handling a null email even though
  // isAuthenticated() implies a sub claim whenever this renders.
  readonly initials = computed(() => this.authService.email()?.charAt(0).toUpperCase() ?? '?');

  // Null when no URL is stored or the <img> errored -> initials fallback.
  readonly avatarSrc = computed(() =>
    this.avatarLoadFailed() ? null : this.authService.avatarUrl(),
  );

  openLogin(): void {
    this.modalService.openLogin();
  }

  openSignup(): void {
    this.modalService.openSignup();
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((v) => !v);
  }

  toggleDropdown(): void {
    this.isDropdownOpen.update((v) => !v);
  }

  closeDropdown(): void {
    this.isDropdownOpen.set(false);
  }

  onAvatarError(): void {
    this.avatarLoadFailed.set(true);
  }

  openChangePassword(): void {
    this.closeDropdown();
    this.modalService.openChangePassword();
  }

  logout(): void {
    this.closeDropdown();
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDropdown();
  }
}
