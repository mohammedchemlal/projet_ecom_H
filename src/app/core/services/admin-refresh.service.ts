import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminRefreshService {
  private subjects = new Map<string, Subject<void>>();

  private getSubject(name: string): Subject<void> {
    if (!this.subjects.has(name)) {
      this.subjects.set(name, new Subject<void>());
    }

    return this.subjects.get(name)!;
  }

  notify(name: string): void {
    this.getSubject(name).next();
  }

  on(name: string): Observable<void> {
    return this.getSubject(name).asObservable();
  }
}
