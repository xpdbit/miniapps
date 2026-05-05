/**
 * 图片预处理管线
 *
 * 提供图片压缩、缩放、EXIF修正和格式转换的完整管线。
 * 支持可选的进度回调和多种预置配置。
 *
 * @module image/processor
 */

import Taro from '@tarojs/taro';
import { IMAGE_LIMITS } from '@/constants/themeDefaults';

/**
 * canvasToTempFilePath 接受的 canvas 参数类型
 * 从 Taro 类型中提取，避免直接引用 WeChat 类型
 */
type CanvasArg = NonNullable<Parameters<typeof Taro.canvasToTempFilePath>[0]>['canvas'];

/* ==================== 类型定义 ==================== */

/** 处理预置配置 */
export interface ProcessingPreset {
  /** 预置名称 */
  name: string;
  /** 文件大小上限（字节），可选 */
  maxSize?: number;
  /** 最大边长（像素），可选 */
  maxDimension?: number;
  /** 目标格式 */
  format: 'jpg' | 'png';
  /** 图片品质（0~1），仅对 jpg 有效，可选 */
  quality?: number;
  /** 是否纠正 EXIF 方向信息 */
  correctOrientation: boolean;
}

/** 单张图片处理结果 */
export interface ProcessResult {
  /** 处理后文件路径 */
  filePath: string;
  /** 原始文件大小（字节） */
  originalSize: number;
  /** 压缩后文件大小（字节） */
  compressedSize: number;
  /** 图片宽度（像素） */
  width: number;
  /** 图片高度（像素） */
  height: number;
  /** 图片格式 */
  format: string;
  /** EXIF 旋转角度（度）：0、90、180、-90 */
  orientation: number;
}

/** 进度信息 */
export interface ProgressInfo {
  /** 当前步骤名称 */
  step: string;
  /** 总体进度百分比（0~100） */
  progress: number;
}

/** 压缩选项 */
export interface CompressOptions {
  /** 图片品质（0~1） */
  quality: number;
}

/** 缩放选项 */
export interface ResizeOptions {
  /** 最大边长（像素） */
  maxDimension: number;
}

/** Canvas 渲染选项（内部使用） */
interface RenderOptions {
  /** 输出格式 */
  format: 'jpg' | 'png';
  /** 输出品质（0~1） */
  quality: number;
  /** 可选的最大边长 */
  maxDimension?: number;
  /** 是否纠正 EXIF 方向 */
  correctExif: boolean;
}

/** Canvas 渲染结果（内部使用） */
interface RenderResult {
  /** 输出文件路径 */
  filePath: string;
  /** 输出宽度 */
  width: number;
  /** 输出高度 */
  height: number;
}

/** 管线执行步骤 */
export type PipelineStep = 'validate' | 'compress' | 'resize' | 'format' | 'exif';

/* ==================== 预置配置 ==================== */

/** PP-ShiTu 食物识别预置：小图、高质量 jpg */
export const PP_SHITU_PRESET: ProcessingPreset = {
  name: 'pp-shitu',
  maxSize: 2 * 1024 * 1024,
  maxDimension: 640,
  format: 'jpg',
  quality: 0.9,
  correctOrientation: true,
};

/** Canvas 合成预置：中等尺寸 png（无损） */
export const CANVAS_COMPOSE_PRESET: ProcessingPreset = {
  name: 'canvas-compose',
  maxDimension: 1080,
  format: 'png',
  correctOrientation: true,
};

/** 缩略图预置：小尺寸、低质量 jpg */
export const THUMBNAIL_PRESET: ProcessingPreset = {
  name: 'thumbnail',
  maxDimension: 200,
  format: 'jpg',
  quality: 0.6,
  correctOrientation: false,
};

/** 上传预置：限制大小和尺寸的中等质量 jpg */
export const UPLOAD_PRESET: ProcessingPreset = {
  name: 'upload',
  maxSize: 1 * 1024 * 1024,
  maxDimension: 2048,
  format: 'jpg',
  quality: 0.85,
  correctOrientation: true,
};

/* ==================== 内部工具 ==================== */

/**
 * 获取文件大小（字节）
 * 若文件不存在或读取失败，返回 0
 */
function getFileSize(filePath: string): number {
  try {
    const fs = Taro.getFileSystemManager();
    const stat = fs.statSync(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

/**
 * 根据最大边长计算缩放后的尺寸，保持宽高比
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number,
): { width: number; height: number } {
  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return { width: originalWidth, height: originalHeight };
  }

  const ratio = Math.min(
    maxDimension / originalWidth,
    maxDimension / originalHeight,
  );

  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio),
  };
}

/**
 * 将 EXIF orientation 字符串转换为旋转角度（度）
 * - 'up'            -> 0
 * - 'down'          -> 180
 * - 'left'          -> -90
 * - 'right'         -> 90
 * - 其他/未知       -> 0
 */
function getExifRotation(orientation: string): number {
  switch (orientation) {
    case 'down':
      return 180;
    case 'left':
      return -90;
    case 'right':
      return 90;
    default:
      return 0;
  }
}

/**
 * 判断 EXIF 方向是否正常（无需纠正）
 */
function isOrientationNormal(orientation: string): boolean {
  return orientation === 'up' || orientation === '' || orientation === undefined;
}

/* ==================== Canvas 渲染工具 ==================== */

/**
 * 通过离屏 Canvas 对图片进行渲染
 *
 * 将图片加载到 Canvas 上，支持 EXIF 旋转纠正、尺寸缩放和格式转换。
 *
 * @param filePath   - 源图片路径
 * @param options    - 渲染选项
 * @returns          渲染结果（文件路径、宽、高）
 */
async function renderImageToCanvas(
  filePath: string,
  options: RenderOptions,
): Promise<RenderResult> {
  const imageInfo = await Taro.getImageInfo({ src: filePath });

  const rawWidth = imageInfo.width;
  const rawHeight = imageInfo.height;

  const exifRotation = getExifRotation(imageInfo.orientation);
  const needsSwap = Math.abs(exifRotation) === 90;

  // 经过 EXIF 纠正后的展示尺寸
  const displayWidth = imageInfo.width;
  const displayHeight = imageInfo.height;

  // 计算最终输出尺寸
  let outputWidth = displayWidth;
  let outputHeight = displayHeight;

  if (options.maxDimension !== undefined) {
    const dims = calculateDimensions(displayWidth, displayHeight, options.maxDimension);
    outputWidth = dims.width;
    outputHeight = dims.height;
  }

  // Canvas 物理尺寸需要容纳原始图片（可能被 EXIF 旋转）
  // 若需要 90° 旋转，则 canvas 宽高与展示尺寸相反
  const canvasWidth = needsSwap ? rawHeight : rawWidth;
  const canvasHeight = needsSwap ? rawWidth : rawHeight;

  const canvas = Taro.createOffscreenCanvas({
    type: '2d',
    width: canvasWidth,
    height: canvasHeight,
  });

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  const img = canvas.createImage();

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      resolve();
    };
    img.onerror = () => {
      reject(new Error(`无法加载图片: ${filePath}`));
    };
    img.src = filePath;
  });

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (options.correctExif && exifRotation !== 0) {
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.rotate((exifRotation * Math.PI) / 180);
    ctx.drawImage(img as unknown as CanvasImageSource, -img.width / 2, -img.height / 2, img.width, img.height);
    ctx.restore();
  } else {
    ctx.drawImage(img as unknown as CanvasImageSource, 0, 0, canvasWidth, canvasHeight);
  }

  const fileType = options.format === 'jpg' ? 'jpg' : 'png';
  const qualityNum = options.format === 'jpg'
    ? Math.min(Math.max(options.quality, 0), 1)
    : 1;

  const tempResult = await Taro.canvasToTempFilePath({
    canvas: canvas as unknown as CanvasArg,
    x: 0,
    y: 0,
    width: canvasWidth,
    height: canvasHeight,
    destWidth: outputWidth,
    destHeight: outputHeight,
    fileType,
    quality: qualityNum,
  });

  return {
    filePath: tempResult.tempFilePath,
    width: outputWidth,
    height: outputHeight,
  };
}

/* ==================== 处理函数 ==================== */

/**
 * 压缩图片品质
 *
 * 使用 Taro.compressImage，仅调节品质参数，不改变图片尺寸。
 *
 * @param filePath - 源图片路径
 * @param options  - 压缩选项（quality: 0~1）
 * @returns        压缩后的临时文件路径
 */
export async function compressImage(
  filePath: string,
  options: CompressOptions,
): Promise<string> {
  const result = await Taro.compressImage({
    src: filePath,
    quality: Math.round(options.quality * 100),
  });
  return result.tempFilePath;
}

/**
 * 缩放图片至指定最大边长
 *
 * 保持宽高比，若图片已经小于最大边长则直接返回原路径。
 * 内部通过 Canvas 重绘，保持原格式和无损品质。
 *
 * @param filePath - 源图片路径
 * @param options  - 缩放选项（maxDimension）
 * @returns        缩放后的临时文件路径
 */
export async function resizeImage(
  filePath: string,
  options: ResizeOptions,
): Promise<string> {
  const imageInfo = await Taro.getImageInfo({ src: filePath });

  const displayWidth = imageInfo.width;
  const displayHeight = imageInfo.height;

  // 如果图片已经小于最大边长，直接返回
  if (displayWidth <= options.maxDimension && displayHeight <= options.maxDimension) {
    return filePath;
  }

  const originalFormat = imageInfo.type === 'png' ? 'png' : 'jpg';

  const result = await renderImageToCanvas(filePath, {
    format: originalFormat,
    quality: 1,
    maxDimension: options.maxDimension,
    correctExif: true,
  });

  return result.filePath;
}

/**
 * 转换图片格式
 *
 * 如果当前格式已经是目标格式，则直接返回原路径。
 *
 * @param filePath - 源图片路径
 * @param format   - 目标格式
 * @returns        格式转换后的临时文件路径
 */
export async function convertFormat(
  filePath: string,
  format: 'jpg' | 'png',
): Promise<string> {
  const imageInfo = await Taro.getImageInfo({ src: filePath });

  const currentFormat = imageInfo.type.toLowerCase();
  const targetFormat = format === 'jpg' ? 'jpg' : 'png';

  // 已经是目标格式时跳过
  if (currentFormat === targetFormat || (targetFormat === 'jpg' && currentFormat === 'jpeg')) {
    return filePath;
  }

  const result = await renderImageToCanvas(filePath, {
    format,
    quality: 1,
    correctExif: true,
  });

  return result.filePath;
}

/**
 * 纠正 EXIF 方向
 *
 * 读取图片的 EXIF Orientation 标签，若方向不正常则通过 Canvas
 * 自动旋转至正确方向。
 *
 * @param filePath - 源图片路径
 * @returns        纠正方向后的临时文件路径
 */
export async function correctOrientation(filePath: string): Promise<string> {
  const imageInfo = await Taro.getImageInfo({ src: filePath });

  if (isOrientationNormal(imageInfo.orientation)) {
    return filePath;
  }

  const originalFormat = imageInfo.type === 'png' ? 'png' : 'jpg';

  const result = await renderImageToCanvas(filePath, {
    format: originalFormat,
    quality: 1,
    correctExif: true,
  });

  return result.filePath;
}

/* ==================== 管线 ==================== */

/**
 * 图片处理管线
 *
 * 将 validate → compress → resize → format → exif 五个步骤
 * 串联为完整的处理流程，支持进度回调和错误容忍。
 */
export class ProcessingPipeline {
  private preset: ProcessingPreset;
  private onProgress?: (info: ProgressInfo) => void;

  /**
   * @param preset      - 处理预置
   * @param onProgress  - 可选进度回调
   */
  constructor(
    preset: ProcessingPreset,
    onProgress?: (info: ProgressInfo) => void,
  ) {
    this.preset = preset;
    this.onProgress = onProgress;
  }

  /**
   * 执行管线处理
   *
   * @param filePath - 源图片路径
   * @returns        处理结果
   */
  async execute(filePath: string): Promise<ProcessResult> {
    const originalSize = getFileSize(filePath);
    const imageInfo = await Taro.getImageInfo({ src: filePath });

    let currentFilePath = filePath;
    let currentSize = originalSize;
    let currentWidth = imageInfo.width;
    let currentHeight = imageInfo.height;
    let currentFormat = imageInfo.type;
    let exifRotationValue = 0;

    /* ---------- Step 1: 校验 ---------- */
    this.emitProgress('validate', 0);

    const validationError = this.validate(filePath, imageInfo);
    if (validationError !== null) {
      console.warn(`[ImageProcessor] 校验失败: ${validationError}`);
      return this.buildResult(
        currentFilePath, originalSize, currentSize,
        currentWidth, currentHeight, currentFormat, 0,
      );
    }

    this.emitProgress('validate', 20);

    /* ---------- Step 2: 压缩 ---------- */
    this.emitProgress('compress', 20);

    if (this.preset.quality !== undefined && this.preset.quality < 1) {
      try {
        currentFilePath = await compressImage(currentFilePath, {
          quality: this.preset.quality,
        });
        currentSize = getFileSize(currentFilePath);
      } catch (err) {
        console.warn('[ImageProcessor] 压缩失败，继续后续步骤:', err);
      }
    }

    this.emitProgress('compress', 40);

    /* ---------- Step 3: 缩放 ---------- */
    this.emitProgress('resize', 40);

    if (this.preset.maxDimension !== undefined) {
      try {
        currentFilePath = await resizeImage(currentFilePath, {
          maxDimension: this.preset.maxDimension,
        });
        const newInfo = await Taro.getImageInfo({ src: currentFilePath });
        currentWidth = newInfo.width;
        currentHeight = newInfo.height;
        currentFormat = newInfo.type;
        currentSize = getFileSize(currentFilePath);
      } catch (err) {
        console.warn('[ImageProcessor] 缩放失败，继续后续步骤:', err);
      }
    }

    this.emitProgress('resize', 60);

    /* ---------- Step 4: 格式转换 ---------- */
    this.emitProgress('format', 60);

    try {
      currentFilePath = await convertFormat(currentFilePath, this.preset.format);
      currentFormat = this.preset.format;
      currentSize = getFileSize(currentFilePath);
    } catch (err) {
      console.warn('[ImageProcessor] 格式转换失败，继续后续步骤:', err);
    }

    this.emitProgress('format', 80);

    /* ---------- Step 5: EXIF 方向纠正 ---------- */
    this.emitProgress('exif', 80);

    if (this.preset.correctOrientation) {
      try {
        const preExifInfo = await Taro.getImageInfo({ src: currentFilePath });
        exifRotationValue = getExifRotation(preExifInfo.orientation);

        if (exifRotationValue !== 0) {
          currentFilePath = await correctOrientation(currentFilePath);
          const postExifInfo = await Taro.getImageInfo({ src: currentFilePath });
          currentWidth = postExifInfo.width;
          currentHeight = postExifInfo.height;
          currentSize = getFileSize(currentFilePath);
        }
      } catch (err) {
        console.warn('[ImageProcessor] EXIF 纠正失败，继续:', err);
      }
    }

    this.emitProgress('exif', 100);

    /* ---------- 获取最终信息 ---------- */
    try {
      const finalInfo = await Taro.getImageInfo({ src: currentFilePath });
      currentWidth = finalInfo.width;
      currentHeight = finalInfo.height;
      currentFormat = finalInfo.type;
    } catch {
      // 使用上一次已知的信息
    }

    return this.buildResult(
      currentFilePath, originalSize, currentSize,
      currentWidth, currentHeight, currentFormat, exifRotationValue,
    );
  }

  /**
   * 校验图片是否满足处理前置条件
   *
   * @returns 校验失败时返回错误描述，成功返回 null
   */
  private validate(
    filePath: string,
    imageInfo: Taro.getImageInfo.SuccessCallbackResult,
  ): string | null {
    if (!filePath || filePath.length === 0) {
      return '文件路径为空';
    }

    const fileSize = getFileSize(filePath);
    if (fileSize <= 0) {
      return '文件不存在或为空';
    }

    if (this.preset.maxSize !== undefined && fileSize > this.preset.maxSize) {
      return `文件大小 (${fileSize}) 超过预置上限 (${this.preset.maxSize})`;
    }

    if (fileSize > IMAGE_LIMITS.maxFileSize) {
      return `文件大小 (${fileSize}) 超过系统上限 (${IMAGE_LIMITS.maxFileSize})`;
    }

    if (imageInfo.width <= 0 || imageInfo.height <= 0) {
      return '图片尺寸无效';
    }

    if (imageInfo.width > IMAGE_LIMITS.maxWidth || imageInfo.height > IMAGE_LIMITS.maxHeight) {
      return `图片尺寸 (${imageInfo.width}x${imageInfo.height}) 超过系统限制 (${IMAGE_LIMITS.maxWidth}x${IMAGE_LIMITS.maxHeight})`;
    }

    return null;
  }

  /**
   * 发射进度事件
   */
  private emitProgress(step: string, progress: number): void {
    if (this.onProgress) {
      this.onProgress({ step, progress });
    }
  }

  /**
   * 构建 ProcessResult 对象
   */
  private buildResult(
    filePath: string,
    originalSize: number,
    compressedSize: number,
    width: number,
    height: number,
    format: string,
    orientation: number,
  ): ProcessResult {
    return {
      filePath,
      originalSize,
      compressedSize,
      width,
      height,
      format,
      orientation,
    };
  }
}

/* ==================== 主入口 API ==================== */

/**
 * 使用指定预置处理单张图片
 *
 * @param filePath    - 源图片路径
 * @param preset      - 处理预置
 * @param onProgress  - 可选进度回调
 * @returns           处理结果
 */
export async function processImage(
  filePath: string,
  preset: ProcessingPreset,
  onProgress?: (info: ProgressInfo) => void,
): Promise<ProcessResult> {
  const pipeline = new ProcessingPipeline(preset, onProgress);
  return pipeline.execute(filePath);
}

/**
 * 使用相同预置批量顺序处理多张图片
 *
 * 图片按顺序逐一处理，每完成一张即加入结果数组。
 * 进度回调中的 step 字段会包含当前文件序号（如 "[1/5] compress"）。
 *
 * @param files       - 源图片路径数组
 * @param preset      - 处理预置
 * @param onProgress  - 可选进度回调
 * @returns           处理结果数组
 */
export async function processImages(
  files: string[],
  preset: ProcessingPreset,
  onProgress?: (info: ProgressInfo) => void,
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    if (file === undefined || file === null || file.length === 0) {
      continue;
    }

    const fileIndex = i + 1;

    const result = await processImage(file, preset, (progress) => {
      if (onProgress) {
        const batchProgress = ((i / total) + (progress.progress / 100 / total)) * 100;
        onProgress({
          step: `[${fileIndex}/${total}] ${progress.step}`,
          progress: Math.round(batchProgress * 100) / 100,
        });
      }
    });

    results.push(result);
  }

  return results;
}
