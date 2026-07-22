import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TestingMngService } from './data-access/server-management.service';
import { WebSocketService } from '../../core/websocket.service';
@Component({
  selector: 'app-server-management-panel',
  templateUrl: './server-management.component.html',
  styleUrls: ['./server-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers:[WebSocketService,TestingMngService],
  standalone: false,
})
export class ServerManagementPanelComponent {
  public wssCore = inject(WebSocketService);
  private testingService = inject(TestingMngService);
  public panelOpenStateSD: boolean = true; //status of extension panel
  public manageStreamForm: FormGroup = inject(FormBuilder).group({
      cmd: ['start'],
      timeToWork: [30, { validators: [Validators.required, Validators.pattern('[0-9]*')] }],
      intervalToEmit: [50, { validators: [Validators.required, Validators.pattern('[0-9]*')] }],
      market: ['n'],
    });
  manageStream() {
    const cmd = this.wssCore.streamActive ? 'stop' : 'start';
    this.manageStreamForm.get('cmd')?.patchValue(cmd);
    this.testingService.sendMessageToServer(this.manageStreamForm.value);
  }
  get interval() {
    return this.manageStreamForm.get('intervalToEmit');
  }
  get timeToWork() {
    return this.manageStreamForm.get('timeToWork');
  }
}
