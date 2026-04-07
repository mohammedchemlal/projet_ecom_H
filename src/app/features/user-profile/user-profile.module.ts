import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { UserProfileComponent } from './user-profile.component';

// PrimeNG Modules
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';

const routes: Routes = [{ path: '', component: UserProfileComponent }];

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule.forChild(routes),
    TagModule,
    DialogModule,
    ToastModule,
    UserProfileComponent
  ]
})
export class UserProfileModule {}
