import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { filter, map, startWith } from 'rxjs';

import { HeaderComponent } from './layouts/header/header.component';
import { SeoService } from './core/services/seo.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ConfirmDialogModule, HeaderComponent, RouterOutlet, ToastModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

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

  constructor() {
    // Update meta/title on navigation end using route data (deepest child)
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(() => {
      try {
        this.seo.updateFromSnapshot(this.router.routerState.snapshot.root);
      } catch (e) {
        // ignore in environments where document isn't available
      }
    });
  }
}
