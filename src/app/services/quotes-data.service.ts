/* eslint-disable @typescript-eslint/no-unused-expressions */
import { inject, Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { throttleTime, switchMap, filter, timeout, catchError, repeat, tap } from 'rxjs/operators';
import { BehaviorSubject, EMPTY, MonoTypeOperatorFunction, Observable, of, throwError } from 'rxjs';
import { SnacksService } from './snacks.service';
import { TConnectionStatus } from '../types/shared-models';
import { SERVER_ERRORS } from '../types/errors-model';
import { AuthService } from './auth.service';
import { ENV } from '../../environments/environment';
export interface IRate {
  //Intreface for received quotes from server
  time: Date; //quote rate
  symbol: string; // instrument code
  bid: number; // price to buy
  ask: number; // price to sell
  open: number; // price to sell
  chgBid: number;
  chgAsk: number;
  chgUpDown: number;
}
@Injectable({
  providedIn: 'root',
})
export class QuotesDataService {
  //Service to handle data
  private readonly snacksService = inject(SnacksService);
  private readonly authService= inject(AuthService);
  private quotesWS$: WebSocketSubject<IRate[] | { message: string } | { cmd: 'close' }> | undefined = undefined;
  private readonly _connectionState$ = new BehaviorSubject<TConnectionStatus>('disconnected'); //Connection status for UI
  //Connection status for UI
  private readonly _connectionRepeat$ = new BehaviorSubject<{ current: number; total: number } | null>(null);
  private readonly _streamActive$ = new BehaviorSubject<boolean>(false); //Stream status for UI
  private quotesDataArray: IRate[] = []; // Quotes array to be displayed in the template
  private closeConnectionErrorCode: number | null = null;
  private conecctionRetryCount: number = 2;
  private connectionAttemptN: number = 0;

  public connectToWSServer(endpoint = ENV.TEST_WS_ENDPOINT) {
    this._connectionState$.next('Connecting');
    this.quotesWS$ = webSocket({
      url: endpoint + '/front',
      openObserver: {
        next: () => {
          this._connectionState$.next('connected');
          this.closeConnectionErrorCode = null;
          this.connectionAttemptN = 0;
        },
      },
      closeObserver: {
        next: (event) => {
          this.closeConnectionErrorCode = this.closeConnectionErrorCode || event.code;
          console.log('UI connection is closed with code: in code', this.closeConnectionErrorCode);
        },
      },
    });

    this.quotesWS$
      .pipe(
        catchError((err) => {
          console.log('catchError', err.code);
          if (this.closeConnectionErrorCode && SERVER_ERRORS.get(this.closeConnectionErrorCode)?.retryConnection) {
            throwError(() => err);
            this._connectionState$.next('disconnected');
          }
          return EMPTY;
        }),
        this.handleRepeatErrors(),
        filter((data) => 'message' in Object(data)),
      )
      .subscribe({
        complete: () => {
          this._connectionState$.next('disconnected');
          this._streamActive$.next(false);
        },
        next: (msg) => {
          this.connectionAttemptN = 0;
          this._connectionState$.next('connected');
          switch ((msg as { message: string }).message) {
            case 'stream_started':
              this._streamActive$.next(true);
              this.quotesDataArray = [];
              break;
            case 'stream_stopped':
              this._streamActive$.next(false);
              break;
            default:
              console.log('msg', msg);
          }
        },
      });
  }

  private handleRepeatErrors<T>(): MonoTypeOperatorFunction<T> {
    return repeat({
      delay: () => {
        this.connectionAttemptN++;
        return of(SERVER_ERRORS.get(this.closeConnectionErrorCode!)?.authErr === true).pipe(
          tap((jwtError) =>
            jwtError === true ? setTimeout(() => this.authService.refreshJWTSub.next(true), 10) : null,
          ),
          switchMap((jwtError) => (jwtError === true ? this.authService.jwtRefreshedSub : of(false))),
          switchMap(() =>
            SERVER_ERRORS.get(this.closeConnectionErrorCode!)?.retryConnection === false ? EMPTY : of(true),
          ),
          catchError((err) => {
            console.log('error handleRepeatErrors', err);
            this.connectionAttemptN = this.conecctionRetryCount;
            this._connectionState$.next('disconnected');
            return throwError(() => err);
          }),
          tap(() => {
            this._connectionRepeat$.next({ current: this.connectionAttemptN, total: this.conecctionRetryCount });
            console.log(
              `QuotesDataService: Trying to reconnect due to error ${this.closeConnectionErrorCode}. Attempt ${this.connectionAttemptN} out of ${this.conecctionRetryCount}`,
            );
            this._connectionState$.next('Reconnecting');
            if (this.conecctionRetryCount + 1 === this.connectionAttemptN) {
              this.connectionAttemptN = 0;
              this.quotesWS$?.closed ? null : this.quotesWS$?.unsubscribe();
              this._connectionState$.next('disconnected');
              this.closeConnectionErrorCode && SERVER_ERRORS.get(this.closeConnectionErrorCode)?.errmsgIgnore
                ? null
                : this.snacksService.openSnack(
                    `Error code: ${this.closeConnectionErrorCode}. ${SERVER_ERRORS.get(1)?.messageToUI} `,
                    'Okay',
                    'error-snackBar',
                  );
              return EMPTY;
            }
            return of({});
          }),
        );
      },
    });
  }

  public tapToQuotesStream(cachingTime = 500): Observable<IRate[]> {
    let bufferRates: IRate[] = [];
    return of(!this.quotesWS$ || this.quotesWS$.closed).pipe(
      switchMap(() =>
        this.quotesWS$!.pipe(
          filter((data) => !('message' in Object(data))),
          timeout({ each: ENV.STREAM_TIMEOUT }),
          switchMap((newSet) => {
            const newSetSymbols = (newSet as IRate[]).map((newRate) => newRate.symbol);
            return of(
              (bufferRates = (newSet as IRate[]).concat(
                bufferRates.filter((oldRate) => !newSetSymbols.includes(oldRate.symbol)),
              )),
            );
          }),
          throttleTime(cachingTime),
          switchMap((newSetFull) => {
            bufferRates = [];
            newSetFull.length && !this._streamActive$.value ? this._streamActive$.next(true) : null;
            newSetFull.forEach((newRate) => {
              const index = this.quotesDataArray.findIndex((rateRow) => rateRow.symbol === newRate.symbol);
              index > -1 ? (this.quotesDataArray[index] = newRate) : this.quotesDataArray.push(newRate);
            });
            return of(this.quotesDataArray);
          }),
          catchError((err) => {
            console.error('error tapToQuotesStream', err);
            this._streamActive$.next(false);
            let errMsg = 'Server error';
            switch (err.name) {
              case 'TimeoutError':
                errMsg = `Warning: There has been no new quote for ${ENV.STREAM_TIMEOUT / 1000} sec...`;
                this.disconnectFromServer(); //??
                break;
            }
            this.quotesWS$?.closed === false && this._connectionState$.getValue() !== 'Reconnecting'
              ? this.snacksService.openSnack(errMsg, 'Okay', 'error-snackBar')
              : null;
            return of([]); //??
            // return of(this.quotesDataArray)
          }),
        ),
      ),
    );
  }

  public disconnectFromServer() {
    if (!this.quotesWS$) {
      return;
    }
    if (this.quotesWS$.closed === false) {
      this._connectionState$.next('Disconnecting');
      this.quotesWS$.next({ cmd: 'close' });
    }
  }

  get connectionState() {
    return this._connectionState$.value;
  }
  get connectionState$() {
    return this._connectionState$.asObservable();
  }
  get connectionRepeat$() {
    return this._connectionRepeat$.asObservable();
  }
  get streamActive$() {
    return this._streamActive$.asObservable();
  }
}
