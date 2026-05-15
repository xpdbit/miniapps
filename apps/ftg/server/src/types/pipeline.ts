/**
 * 处理流水线相关类型定义
 */

/** 流水线状态枚举 */
export enum PipelineStatus {
  PENDING = 'pending',
  RECOGNIZING = 'recognizing',
  RECOGNIZED = 'recognized',
  GENERATING = 'generating',
  COMPOSING = 'composing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/** 流水线记录 */
export interface PipelineRecord {
  id: number;
  userId: number;
  pipelineId: string;
  status: PipelineStatus;
  progress: number;
  imageUrl?: string;
  themeId?: string;
  resultJson?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
