import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoginUseCase } from '../../../../application/use-cases/login.use-case';
import { SessionStore } from '../../../../application/state/session.store';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="auth">
      <div class="auth__card card">
        <div class="auth__brand">
          <span class="auth__mark" aria-hidden="true">SSF</span>
          <div class="auth__identity">
            <h1 class="auth__title">Simple Stock Flow</h1>
            <p class="auth__subtitle">Catálogo, ventas y reportes en un solo lugar</p>
          </div>
        </div>

        <form class="form" [formGroup]="form" (ngSubmit)="submit()">
          <label class="field">
            <span class="field__label">Usuario</span>
            <input type="text" formControlName="username" autocomplete="username" />
          </label>

          <label class="field">
            <span class="field__label">Clave</span>
            <input type="password" formControlName="password" autocomplete="current-password" />
          </label>

          @if (error(); as message) {
            <p class="alert alert--error" role="alert">{{ message }}</p>
          }

          <button
            type="submit"
            class="btn btn--primary btn--block"
            [disabled]="form.invalid || loading()"
          >
            {{ loading() ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>
      </div>
    </section>
  `,
  styles: `
    .auth {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      place-items: center;
      min-height: 100vh;
      min-height: 100dvh;
      padding: var(--space-6) var(--space-5);
      background:
        radial-gradient(60rem 30rem at 50% -10%, var(--color-accent-soft), transparent 70%),
        var(--color-surface);
    }
    .auth__card {
      width: 100%;
      max-width: 23rem;
      min-width: 0;
      padding: var(--space-7) var(--space-6);
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-6);
      box-shadow: var(--shadow-lg);
    }
    .auth__brand {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }
    .auth__mark {
      display: grid;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      flex: none;
      border-radius: var(--radius-md);
      background: var(--color-accent);
      color: #fff;
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
    }
    .auth__identity {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-1);
    }
    .auth__title {
      font-size: var(--text-xl);
    }
    .auth__subtitle {
      color: var(--color-text-muted);
      font-size: var(--text-xs);
      line-height: var(--leading-tight);
    }
  `,
})
export class LoginPage {
  private readonly login = inject(LoginUseCase);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const session = await this.login.execute(this.form.getRawValue());
      this.session.set(session);
      await this.router.navigate(['/productos']);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.loading.set(false);
    }
  }
}
