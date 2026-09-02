import { Component, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from 'service/auth.service';
import { visibleMenuItems } from 'component/shared/menu-items';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  constructor(protected authService: AuthService) {}

  readonly items = computed(() => visibleMenuItems(this.authService.role()));
}
