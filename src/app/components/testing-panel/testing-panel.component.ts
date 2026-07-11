import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TestingMngService } from '../../services/testing-mng.service';

@Component({
  selector: 'app-testing-panel',
  templateUrl: './testing-panel.component.html',
  styleUrls: ['./testing-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TestingPanelComponent {
  public testingService = inject(TestingMngService);
  public manageStreamForm: FormGroup;
  public serverStatus: boolean = !!this.testingService.webSocketTest$ && !this.testingService.webSocketTest$.closed;
  public panelOpenStateSD: boolean = true; //status of extension panel
  constructor(private fb: FormBuilder) {
    this.manageStreamForm = this.fb.group({
      cmd: ['start'],
      timeToWork: [30, { validators: [Validators.required, Validators.pattern('[0-9]*')] }],
      intervalToEmit: [50, { validators: [Validators.required, Validators.pattern('[0-9]*')] }],
      market: ['n'],
    });
  }
  manageStream() {
    const cmd = this.testingService.streamStarted ? 'stop' : 'start';
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
