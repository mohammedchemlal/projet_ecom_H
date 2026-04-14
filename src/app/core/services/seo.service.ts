import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { ActivatedRouteSnapshot } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  updateFromSnapshot(snapshot: ActivatedRouteSnapshot) {
    let s: ActivatedRouteSnapshot | null = snapshot;
    while (s && s.firstChild) {
      s = s.firstChild;
    }

    const data = s?.data || {};
    const title = data['title'] || "Valerya — Bijoux d'exception";
    const description = data['description'] || 'Bijoux artisanaux, collections élégantes et livraison au Maroc.';

    this.setTitle(title);
    this.setMetaTags({ description });
    this.setOpenGraph({ title, description });
    this.setCanonical(window.location.href);
  }

  setTitle(title: string) {
    this.title.setTitle(title);
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ name: 'twitter:title', content: title });
  }

  setMetaTags({ description }: { description?: string }) {
    if (description) {
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
      this.meta.updateTag({ name: 'twitter:description', content: description });
    }
  }

  setOpenGraph({ title, description, image }: { title?: string; description?: string; image?: string }) {
    if (title) this.meta.updateTag({ property: 'og:title', content: title });
    if (description) this.meta.updateTag({ property: 'og:description', content: description });
    if (image) this.meta.updateTag({ property: 'og:image', content: image });
  }

  setCanonical(url: string) {
    try {
      let link: HTMLLinkElement | null = document.querySelector("link[rel='canonical']");
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', url);
    } catch (e) {
      // running in non-browser environment (server) — skip canonical
    }
  }
}
