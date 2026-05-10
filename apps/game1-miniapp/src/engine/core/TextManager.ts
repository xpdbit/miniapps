export class TextManager {
  private texts: Map<string, string> = new Map();
  private static _instance: TextManager;

  static get instance(): TextManager {
    if (!TextManager._instance) {
      TextManager._instance = new TextManager();
    }
    return TextManager._instance;
  }

  load(config: Record<string, string>): void {
    for (const [key, value] of Object.entries(config)) {
      this.texts.set(key, value);
    }
  }

  get(key: string, ...args: (string | number)[]): string {
    let text = this.texts.get(key);
    if (text === undefined) {
      return `{${key}}`;
    }
    args.forEach((arg, i) => {
      text = text!.replace(new RegExp(`\\{${i}\\}`, 'g'), String(arg));
    });
    return text;
  }

  getMany(keys: string[]): string[] {
    return keys.map((key) => this.get(key));
  }

  has(key: string): boolean {
    return this.texts.has(key);
  }

  clear(): void {
    this.texts.clear();
  }

  getAllKeys(): string[] {
    return Array.from(this.texts.keys());
  }
}

export const textManager = TextManager.instance;
