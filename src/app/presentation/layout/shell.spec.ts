import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionStoragePort } from '../../application/ports/auth-repository.port';
import { Role, Session } from '../../domain/models/session.model';
import { Shell } from './shell';

function sessionOf(role: Role): Session {
  return {
    accessToken: 'token',
    expiresAt: new Date(Date.now() + 3_600_000),
    username: role === 'admin' ? 'admin' : 'vendedor.demo',
    role,
  };
}

async function shellFor(role: Role): Promise<ComponentFixture<Shell>> {
  const session = sessionOf(role);

  await TestBed.configureTestingModule({
    imports: [Shell],
    providers: [
      provideRouter([]),
      {
        provide: SessionStoragePort,
        useValue: { read: () => session, write: () => {}, clear: () => {} },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(Shell);
  fixture.detectChanges();
  return fixture;
}

describe('Shell', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('offers the seller sign-up to an administrator (DP-04)', async () => {
    const fixture = await shellFor('admin');

    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      '.app-nav a[href="/vendedores/nuevo"]',
    );

    expect(link).withContext('the administrator has no way into the seller sign-up').not.toBeNull();
    expect(link?.textContent?.trim()).toBe('Nuevo vendedor');
  });

  it('hides the seller sign-up from a seller (DP-04)', async () => {
    const fixture = await shellFor('seller');

    expect(fixture.nativeElement.querySelector('a[href="/vendedores/nuevo"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Nuevo vendedor');
  });
});
