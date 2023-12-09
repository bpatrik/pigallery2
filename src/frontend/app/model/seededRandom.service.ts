import {Injectable} from '@angular/core';

@Injectable()
export class SeededRandomService {
  private static readonly baseSeed = Math.random() * 2147483647;
  private seed: number;

  constructor() {
    this.setSeed(0);

    if (this.seed <= 0) {
      this.seed += 2147483646;
    }
  }

  setSeed(seed: number): void {
    this.seed = (SeededRandomService.baseSeed + seed) % 2147483647; // shifting with 16 to the left
  }

  get(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
}
