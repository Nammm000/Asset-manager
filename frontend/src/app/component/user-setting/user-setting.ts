import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { take } from 'rxjs';
import { UserService } from 'service/user.service';
import { AuthService } from 'service/auth.service';
import { ModalService } from 'service/modal.service';
import type { UserWrapper } from 'model/user.model';
import { getApiErrorMessage } from 'util/api-util';
import { customFormattedDate } from 'util/time-util';
import { GlobalMessages } from 'component/shared/global-constants';

/**
 * Read-only account page for the signed-in user (name, contact, role, account
 * level/number). The backend exposes no profile-update endpoint yet, so the
 * only action here is the shared change-password modal.
 */
@Component({
  selector: 'app-user-setting',
  imports: [],
  templateUrl: './user-setting.html',
  styleUrl: './user-setting.scss',
})
export class UserSetting implements OnInit {
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly profile = signal<UserWrapper | null>(null);
  readonly avatarLoadFailed = signal(false);

  constructor(
    private userService: UserService,
    // protected: referenced directly from the template (strictTemplates forbids private)
    protected authService: AuthService,
    private modalService: ModalService,
  ) {
    // A changed avatar URL (e.g. re-login as someone else) must retry the <img>.
    effect(() => {
      this.authService.avatarUrl();
      this.avatarLoadFailed.set(false);
    });
  }

  // Null-safe: profile() can be null while loading, and email() while logged out.
  readonly initials = computed(
    () => (this.profile()?.name ?? this.authService.email() ?? '?').charAt(0).toUpperCase(),
  );

  // Null when no URL is stored or the <img> errored -> initials fallback.
  readonly avatarSrc = computed(() =>
    this.avatarLoadFailed() ? null : this.authService.avatarUrl(),
  );

  // Formatting utils for the template
  protected readonly customFormattedDate = customFormattedDate;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.userService
      .getCurrentUser()
      .pipe(take(1))
      .subscribe({
        next: (user) => {
          this.profile.set(user);
          this.loading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(getApiErrorMessage(error, GlobalMessages.genericError));
          this.loading.set(false);
        },
      });
  }

  openChangePassword(): void {
    this.modalService.openChangePassword();
  }

  onAvatarError(): void {
    this.avatarLoadFailed.set(true);
  }
}
