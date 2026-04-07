import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { CartComponent } from './cart.component';

// PrimeNG Modules
import { RatingModule } from 'primeng/rating';
import { InputNumberModule } from 'primeng/inputnumber';

const routes: Routes = [{ path: '', component: CartComponent }];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    RatingModule,
    InputNumberModule,
    CartComponent
  ]
})
export class CartModule {}
