import { IModule, SaveData } from '../actor/IModule';
import { globalEventBus } from '../core/EventBus';
import { clamp } from '../../utils/math';

/** 单个资源的定义（最大值、恢复速率、消耗速率） */
export interface ResourceDef {
  maxValue: number;
  regenRate: number;
  consumptionRate: number;
}

/** 旅行资源系统完整配置 */
export interface TravelResourceConfig {
  stamina: ResourceDef;
  food: ResourceDef;
  morale: ResourceDef;
  foodToStaminaConversionRate: number;
}

/** 旅行资源存档数据 */
export interface TravelResourceSaveData {
  stamina: number;
  food: number;
  morale: number;
}

/** 资源变化事件载荷 */
export interface ResourceChangedPayload {
  stamina: number;
  food: number;
  morale: number;
  staminaPct: number;
  foodPct: number;
  moralePct: number;
}

/** 资源耗尽事件载荷 */
export interface ResourceDepletedPayload {
  depletedResources: string[];
}

/** 默认配置 */
export const DEFAULT_RESOURCE_CONFIG: TravelResourceConfig = {
  stamina: { maxValue: 100, regenRate: 2, consumptionRate: 1 },
  food: { maxValue: 100, regenRate: 0, consumptionRate: 0.5 },
  morale: { maxValue: 100, regenRate: 0.5, consumptionRate: 0.2 },
  foodToStaminaConversionRate: 2,
};

export class TravelResource implements IModule {
  readonly moduleId = 'TravelResource';

  private static _instance: TravelResource;
  static get instance(): TravelResource {
    if (!TravelResource._instance) {
      TravelResource._instance = new TravelResource();
    }
    return TravelResource._instance;
  }

  private config: TravelResourceConfig;
  private currentStamina: number;
  private currentFood: number;
  private currentMorale: number;
  private isTraveling: boolean = false;

  private constructor() {
    this.config = this.cloneConfig(DEFAULT_RESOURCE_CONFIG);
    this.currentStamina = this.config.stamina.maxValue;
    this.currentFood = this.config.food.maxValue;
    this.currentMorale = this.config.morale.maxValue;
  }

  get stamina(): number {
    return this.currentStamina;
  }

  get food(): number {
    return this.currentFood;
  }

  get morale(): number {
    return this.currentMorale;
  }

  get staminaMax(): number {
    return this.config.stamina.maxValue;
  }

  get foodMax(): number {
    return this.config.food.maxValue;
  }

  get moraleMax(): number {
    return this.config.morale.maxValue;
  }

  get staminaPct(): number {
    return this.currentStamina / this.config.stamina.maxValue;
  }

  get foodPct(): number {
    return this.currentFood / this.config.food.maxValue;
  }

  get moralePct(): number {
    return this.currentMorale / this.config.morale.maxValue;
  }

  /** 设置旅行状态（决定消耗还是恢复） */
  setTraveling(traveling: boolean): void {
    this.isTraveling = traveling;
  }

  tick(deltaSeconds: number): void {
    if (this.isTraveling) {
      this.currentStamina = clamp(
        this.currentStamina - this.config.stamina.consumptionRate * deltaSeconds,
        0,
        this.config.stamina.maxValue,
      );
      this.currentFood = clamp(
        this.currentFood - this.config.food.consumptionRate * deltaSeconds,
        0,
        this.config.food.maxValue,
      );
      this.currentMorale = clamp(
        this.currentMorale - this.config.morale.consumptionRate * deltaSeconds,
        0,
        this.config.morale.maxValue,
      );
    } else {
      this.currentStamina = clamp(
        this.currentStamina + this.config.stamina.regenRate * deltaSeconds,
        0,
        this.config.stamina.maxValue,
      );
      this.currentFood = clamp(
        this.currentFood + this.config.food.regenRate * deltaSeconds,
        0,
        this.config.food.maxValue,
      );
      this.currentMorale = clamp(
        this.currentMorale + this.config.morale.regenRate * deltaSeconds,
        0,
        this.config.morale.maxValue,
      );
    }

    // 检查资源耗尽
    const depleted: string[] = [];
    if (this.currentStamina <= 0) depleted.push('stamina');
    if (this.currentFood <= 0) depleted.push('food');
    if (this.currentMorale <= 0) depleted.push('morale');
    if (depleted.length > 0) {
      globalEventBus.emit<ResourceDepletedPayload>('resource:depleted', {
        depletedResources: depleted,
      });
    }

    globalEventBus.emit<ResourceChangedPayload>('resource:changed', {
      stamina: this.currentStamina,
      food: this.currentFood,
      morale: this.currentMorale,
      staminaPct: this.staminaPct,
      foodPct: this.foodPct,
      moralePct: this.moralePct,
    });
  }

  /** 消耗体力，返回是否成功 */
  consumeStamina(amount: number): boolean {
    if (this.currentStamina < amount) return false;
    this.currentStamina -= amount;
    return true;
  }

  /** 消耗食物，返回是否成功 */
  consumeFood(amount: number): boolean {
    if (this.currentFood < amount) return false;
    this.currentFood -= amount;
    return true;
  }

  /** 变更士气值（正数增加，负数减少） */
  changeMorale(delta: number): void {
    this.currentMorale = clamp(
      this.currentMorale + delta,
      0,
      this.config.morale.maxValue,
    );
  }

  /** 将食物转换为体力 */
  convertFoodToStamina(foodAmount: number): boolean {
    if (this.currentFood < foodAmount) return false;
    const staminaGain = foodAmount * this.config.foodToStaminaConversionRate;
    this.currentFood -= foodAmount;
    this.currentStamina = clamp(
      this.currentStamina + staminaGain,
      0,
      this.config.stamina.maxValue,
    );
    return true;
  }

  /** 是否已筋疲力尽（无法继续旅行） */
  isExhausted(): boolean {
    return this.currentStamina <= 0 || this.currentFood <= 0;
  }

  /** 是否可以开始/继续旅行 */
  canTravel(): boolean {
    return this.currentStamina > 0 && this.currentFood > 0;
  }

  /** 完全恢复所有资源 */
  restoreAll(): void {
    this.currentStamina = this.config.stamina.maxValue;
    this.currentFood = this.config.food.maxValue;
    this.currentMorale = this.config.morale.maxValue;
  }

  /** 增加体力（超出上限部分无效），返回实际增加量 */
  addStamina(amount: number): number {
    const oldValue = this.currentStamina;
    this.currentStamina = clamp(
      this.currentStamina + amount,
      0,
      this.config.stamina.maxValue,
    );
    return this.currentStamina - oldValue;
  }

  /** 增加食物，返回实际增加量 */
  addFood(amount: number): number {
    const oldValue = this.currentFood;
    this.currentFood = clamp(
      this.currentFood + amount,
      0,
      this.config.food.maxValue,
    );
    return this.currentFood - oldValue;
  }

  /** 增加士气，返回实际增加量 */
  addMorale(amount: number): number {
    const oldValue = this.currentMorale;
    this.currentMorale = clamp(
      this.currentMorale + amount,
      0,
      this.config.morale.maxValue,
    );
    return this.currentMorale - oldValue;
  }

  /** 运行时动态更新配置 */
  updateConfig(config: Partial<TravelResourceConfig>): void {
    if (config.stamina) {
      Object.assign(this.config.stamina, config.stamina);
      this.currentStamina = Math.min(this.currentStamina, this.config.stamina.maxValue);
    }
    if (config.food) {
      Object.assign(this.config.food, config.food);
      this.currentFood = Math.min(this.currentFood, this.config.food.maxValue);
    }
    if (config.morale) {
      Object.assign(this.config.morale, config.morale);
      this.currentMorale = Math.min(this.currentMorale, this.config.morale.maxValue);
    }
    if (config.foodToStaminaConversionRate !== undefined) {
      this.config.foodToStaminaConversionRate = config.foodToStaminaConversionRate;
    }
  }

  onSave(): SaveData {
    return {
      stamina: this.currentStamina,
      food: this.currentFood,
      morale: this.currentMorale,
    };
  }

  onLoad(data: SaveData): void {
    const d = data as unknown as TravelResourceSaveData;
    this.currentStamina = d.stamina ?? this.config.stamina.maxValue;
    this.currentFood = d.food ?? this.config.food.maxValue;
    this.currentMorale = d.morale ?? this.config.morale.maxValue;
  }

  reset(): void {
    this.currentStamina = this.config.stamina.maxValue;
    this.currentFood = this.config.food.maxValue;
    this.currentMorale = this.config.morale.maxValue;
    this.isTraveling = false;
  }

  private cloneConfig(config: TravelResourceConfig): TravelResourceConfig {
    return {
      stamina: { ...config.stamina },
      food: { ...config.food },
      morale: { ...config.morale },
      foodToStaminaConversionRate: config.foodToStaminaConversionRate,
    };
  }
}
