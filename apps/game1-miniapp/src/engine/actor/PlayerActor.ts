import { IModule, SaveData } from './IModule';
import { expToNextLevel } from '../../utils/math';

export interface PlayerSaveData {
  level: number;
  exp: number;
  gold: number;
  gems: number;
  totalMileage: number;
  playTime: number;
  prestigeCount: number;
  moduleSaves: Record<string, SaveData>;
  lastLoginTime: number;
}

export class PlayerActor {
  private static _instance: PlayerActor;
  static get instance(): PlayerActor {
    if (!PlayerActor._instance) {
      PlayerActor._instance = new PlayerActor();
    }
    return PlayerActor._instance;
  }

  level: number = 1;
  exp: number = 0;
  expToNext: number = 100;
  gold: number = 0;
  gems: number = 0;
  totalMileage: number = 0;
  playTime: number = 0;
  prestigeCount: number = 0;

  private modules: Map<string, IModule> = new Map();

  registerModule(module: IModule): void {
    this.modules.set(module.moduleId, module);
  }

  getModule<T extends IModule>(id: string): T | undefined {
    return this.modules.get(id) as T | undefined;
  }

  getAllModules(): IModule[] {
    return Array.from(this.modules.values());
  }

  addExp(amount: number): void {
    this.exp += amount;
    while (this.exp >= this.expToNext && this.level < 999) {
      this.exp -= this.expToNext;
      this.level += 1;
      this.expToNext = expToNextLevel(this.level);
    }
  }

  addGold(amount: number): void {
    this.gold += amount;
  }

  spendGold(amount: number): boolean {
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  addGems(amount: number): void {
    this.gems += amount;
  }

  spendGems(amount: number): boolean {
    if (this.gems < amount) return false;
    this.gems -= amount;
    return true;
  }

  addMileage(amount: number): void {
    this.totalMileage += amount;
  }

  /** 离线收益处理 */
  processOfflineTime(seconds: number): void {
    const idleGold = Math.floor(seconds * 0.5);
    const idleExp = Math.floor(seconds * 0.1);
    const idleMileage = seconds * 0.05;
    this.addGold(idleGold);
    this.addExp(idleExp);
    this.addMileage(idleMileage);
  }

  onSave(): PlayerSaveData {
    const moduleSaves: Record<string, SaveData> = {};
    this.modules.forEach((module, id) => {
      moduleSaves[id] = module.onSave();
    });
    return {
      level: this.level,
      exp: this.exp,
      gold: this.gold,
      gems: this.gems,
      totalMileage: this.totalMileage,
      playTime: this.playTime,
      prestigeCount: this.prestigeCount,
      moduleSaves,
      lastLoginTime: Math.floor(Date.now() / 1000),
    };
  }

  onLoad(data: PlayerSaveData): void {
    this.level = data.level ?? 1;
    this.exp = data.exp ?? 0;
    this.gold = data.gold ?? 0;
    this.gems = data.gems ?? 0;
    this.totalMileage = data.totalMileage ?? 0;
    this.playTime = data.playTime ?? 0;
    this.prestigeCount = data.prestigeCount ?? 0;
    this.expToNext = expToNextLevel(this.level);

    if (data.moduleSaves) {
      this.modules.forEach((module, id) => {
        const moduleData = data.moduleSaves[id];
        if (moduleData) {
          module.onLoad(moduleData);
        }
      });
    }
  }

  reset(): void {
    this.level = 1;
    this.exp = 0;
    this.expToNext = expToNextLevel(1);
    this.gold = 0;
    this.gems = 0;
    this.totalMileage = 0;
    this.playTime = 0;
    this.modules.forEach((module) => module.reset());
  }
}
