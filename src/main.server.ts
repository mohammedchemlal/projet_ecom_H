import { registerLocaleData } from '@angular/common';
import localeFrMa from '@angular/common/locales/fr-MA';
import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

registerLocaleData(localeFrMa);

const bootstrap = (context: BootstrapContext) =>
    bootstrapApplication(App, config, context);

export default bootstrap;
