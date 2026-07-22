import { RouterModule, Routes } from '@angular/router';
import { RealTimeQuotesStreamComponent } from './features/realtime-quotes-dashboard/rt-quotes-stream.component';
import { NgModule } from '@angular/core';

export const appRoutes: Routes  = [
  {
    path:'',
    component:RealTimeQuotesStreamComponent,
  }
];
@NgModule ({
  imports:[RouterModule.forRoot(appRoutes)],
  exports:[RouterModule]
})
export class AppRouteModule {}