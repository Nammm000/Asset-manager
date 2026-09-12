import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from 'service/auth.service';
import { LanguageService } from 'service/language.service';
import { visibleMenuItems } from 'component/shared/menu-items';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  constructor(
    protected authService: AuthService,
    protected langService: LanguageService,
  ) {}

  readonly items = computed(() => visibleMenuItems(this.authService.role()));

  /** Icons-only mode: labels are hidden until the arrow is clicked again. */
  readonly collapsed = signal(false);

  toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }
}
