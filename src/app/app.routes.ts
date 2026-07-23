import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path:'',
    pathMatch: 'full',
    loadComponent: () => import('./features/realtime-quotes-dashboard/rt-quotes-stream.component')
    .then(c=>c.RealTimeQuotesStreamComponent)
  }
]