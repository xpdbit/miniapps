export interface ActorTemplate {
  actorId: string;
  name: string;
  race: string;
  baseStats: {
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
  };
  growthStats: {
    hpPerLevel: number;
    attackPerLevel: number;
    defensePerLevel: number;
    speedPerLevel: number;
  };
  skills: string[];
  description: string;
}

export class ActorTemplateManager {
  private templates: Map<string, ActorTemplate> = new Map();

  loadFromConfig(config: Record<string, ActorTemplate>): void {
    for (const [id, template] of Object.entries(config)) {
      this.templates.set(id, template);
    }
  }

  getTemplate(id: string): ActorTemplate {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`ActorTemplate 不存在: ${id}`);
    }
    return template;
  }

  getTemplateSafe(id: string): ActorTemplate | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): ActorTemplate[] {
    return Array.from(this.templates.values());
  }

  hasTemplate(id: string): boolean {
    return this.templates.has(id);
  }

  clear(): void {
    this.templates.clear();
  }
}

export const actorTemplateManager = new ActorTemplateManager();
