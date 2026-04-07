import { registerLocaleData } from '@angular/common';
import localeFrMa from '@angular/common/locales/fr-MA';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

registerLocaleData(localeFrMa);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
