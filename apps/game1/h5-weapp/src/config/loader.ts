export class ConfigManager {
  private static cache: Map<string, unknown> = new Map();

  static load<T>(name: string): T {
    if (this.cache.has(name)) {
      return this.cache.get(name) as T;
    }
    try {
      const data = require(`./${name}.json`) as T;
      this.cache.set(name, data);
      return data;
    } catch (err) {
      console.error(`[ConfigManager] 加载配置 ${name}.json 失败:`, err);
      throw new Error(`配置加载失败: ${name}`);
    }
  }

  static get<T>(name: string): T | undefined {
    return this.cache.get(name) as T | undefined;
  }

  static clear(): void {
    this.cache.clear();
  }

  static remove(name: string): void {
    this.cache.delete(name);
  }
}
