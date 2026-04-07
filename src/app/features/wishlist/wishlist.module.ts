import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { WishlistComponent } from './wishlist.component';

// PrimeNG Modules
import { RatingModule } from 'primeng/rating';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';

const routes: Routes = [{ path: '', component: WishlistComponent }];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    RatingModule,
    DialogModule,
    ButtonModule,
    ToastModule,
    WishlistComponent
  ]
})
export class WishlistModule {}
