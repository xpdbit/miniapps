export interface SaveData {
  [key: string]: unknown;
}

export interface IModule {
  readonly moduleId: string;
  tick(deltaSeconds: number): void;
  onSave(): SaveData;
  onLoad(data: SaveData): void;
  reset(): void;
}
