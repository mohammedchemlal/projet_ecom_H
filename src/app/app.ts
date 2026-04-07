import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { filter, map, startWith } from 'rxjs';

import { HeaderComponent } from './layouts/header/header.component';

@Component({
  selector: 'app-root',
  imports: [ConfirmDialogModule, HeaderComponent, RouterOutlet, ToastModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly hideHeader = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/admin') || url.startsWith('/auth');
  });
}
