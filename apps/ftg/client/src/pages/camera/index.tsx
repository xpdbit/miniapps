import { useState, useEffect, useCallback, useRef } from 'react';
import Taro from '@tarojs/taro';
import {
  Camera,
  CoverView,
  View,
  Image,
  Text,
} from '@tarojs/components';
import { processImage, UPLOAD_PRESET } from '@/utils/image/processor';
import { API_BASE } from '@/services/httpClient';
import { useAuthStore } from '@/stores/authStore';
import './index.scss';

/* ==================== 类型定义 ==================== */

/** 页面状态 */
type PageState = 'camera' | 'preview' | 'uploading';

/** 闪光灯模式 */
type FlashMode = 'auto' | 'on' | 'off' | 'torch';

/** 拍照结果 */
interface TakePhotoResult {
  tempImagePath: string;
  errMsg: string;
}

/* ==================== 常量 ==================== */

const FLASH_MODES: FlashMode[] = ['auto', 'on', 'off', 'torch'];

const FLASH_LABELS: Record<FlashMode, string> = {
  auto: '自动',
  on: '开启',
  off: '关闭',
  torch: '常亮',
};

/* ==================== 组件 ==================== */

export default function CameraPage() {
  /* ---------- 平台检查 ---------- */
  // H5 平台不支持原生相机，显示友好提示
  if (process.env.TARO_ENV !== 'weapp') {
    return (
      <View className="camera-page">
        <View className="camera-h5-fallback">
          <Text className="camera-h5-icon">📷</Text>
          <Text className="camera-h5-title">相机功能仅支持微信小程序</Text>
          <Text className="camera-h5-desc">请在微信中打开小程序使用拍照功能</Text>
        </View>
      </View>
    );
  }

  /* ---------- 状态 ---------- */
  const [pageState, setPageState] = useState<PageState>('camera');
  const [flashMode, setFlashMode] = useState<FlashMode>('auto');
  const [tempFilePath, setTempFilePath] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---------- 生命周期 ---------- */

  useEffect(() => {
    checkCameraPermission();
    return () => {
      clearProgressSimulation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- 权限检查 ---------- */

  async function checkCameraPermission(): Promise<void> {
    try {
      const setting = await Taro.getSetting();
      if (setting.authSetting['scope.camera']) {
        return;
      }

      try {
        await Taro.authorize({ scope: 'scope.camera' });
      } catch {
        const modalRes = await Taro.showModal({
          title: '需要相机权限',
          content: '请在设置中开启相机权限以拍摄食物照片',
          confirmText: '去设置',
        });
        if (modalRes.confirm) {
          await Taro.openSetting();
        }
      }
    } catch {
      console.warn('[CameraPage] 相机权限检查失败');
    }
  }

  /* ---------- 拍照 ---------- */

  const handleTakePhoto = useCallback((): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      try {
        const ctx = Taro.createCameraContext();
        ctx.takePhoto({
          quality: 'high',
          success: (res: TakePhotoResult) => resolve(res.tempImagePath),
          fail: (err: unknown) => reject(err),
        });
      } catch (err: unknown) {
        reject(err);
      }
    });
  }, []);

  const handleCapture = useCallback(async () => {
    if (isCapturing) {
      return;
    }
    setIsCapturing(true);

    try {
      const filePath = await handleTakePhoto();
      // 立即将临时文件持久化存储，避免后续 getImageInfo 等 API 读取失败
      let savedPath = filePath;
      try {
        const fs = Taro.getFileSystemManager();
        savedPath = fs.saveFileSync(filePath);
      } catch (e) {
        console.warn('[CameraPage] 持久化拍照临时文件失败，使用原路径:', e);
      }
      setTempFilePath(savedPath);
      setPageState('preview');
    } catch {
      Taro.showToast({
        title: '拍照失败，请重试',
        icon: 'none',
      });
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, handleTakePhoto]);

  /* ---------- 相册选择 ---------- */

  const handlePickAlbum = useCallback(async () => {
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album'],
      });
      const filePath = res.tempFilePaths[0];
      if (filePath === undefined || filePath.length === 0) {
        return;
      }
      // 立即将临时文件持久化存储，避免后续 getImageInfo 等 API 读取失败
      let savedPath = filePath;
      try {
        const fs = Taro.getFileSystemManager();
        savedPath = fs.saveFileSync(filePath);
      } catch (e) {
        console.warn('[CameraPage] 持久化相册临时文件失败，使用原路径:', e);
      }
      setTempFilePath(savedPath);
      setPageState('preview');
    } catch {
      // 用户取消选择
    }
  }, []);

  /* ---------- 闪光灯 ---------- */

  const handleToggleFlash = useCallback(() => {
    setFlashMode((prev) => {
      const currentIndex = FLASH_MODES.indexOf(prev);
      const nextIndex = (currentIndex + 1) % FLASH_MODES.length;
      return FLASH_MODES[nextIndex] as FlashMode;
    });
  }, []);

  /* ---------- 重拍 ---------- */

  const handleRetake = useCallback(() => {
    setTempFilePath('');
    setUploadProgress(0);
    setPageState('camera');
  }, []);

  /* ---------- 进度模拟 ---------- */

  const clearProgressSimulation = useCallback(() => {
    if (progressTimerRef.current !== null) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgressSimulation = useCallback(() => {
    clearProgressSimulation();
    setUploadProgress(0);

    progressTimerRef.current = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) {
          return prev;
        }
        const increment = Math.random() * 10 + 5;
        return Math.min(85, Math.round(prev + increment));
      });
    }, 250);
  }, [clearProgressSimulation]);

  /* ---------- 上传 & 识别 ---------- */

  /** 上传请求最大重试次数 */
  const MAX_UPLOAD_RETRIES = 1;
  /** 上传重试间隔（毫秒） */
  const UPLOAD_RETRY_DELAY = 1500;

  /**
   * 带重试的 Taro.uploadFile 封装
   * 仅对超时类错误重试，其他错误直接抛出
   */
  async function uploadFileWithRetry(
    params: Parameters<typeof Taro.uploadFile>[0],
    maxRetries: number = MAX_UPLOAD_RETRIES,
  ): Promise<Taro.uploadFile.SuccessCallbackResult> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await Taro.uploadFile(params);
      } catch (err) {
        lastError = err;
        const errStr =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null
              ? JSON.stringify(err)
              : String(err);

        const isTimeout =
          errStr.includes('timeout') ||
          errStr.includes('超时') ||
          errStr.includes('Timeout');

        if (isTimeout && attempt < maxRetries) {
          console.warn(
            `[CameraPage] 上传超时，${UPLOAD_RETRY_DELAY}ms 后重试 (${attempt + 1}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, UPLOAD_RETRY_DELAY));
          continue;
        }

        break;
      }
    }

    throw lastError;
  }

  /**
   * 分类上传错误，返回中文描述
   */
  function classifyUploadError(err: unknown): string {
    const errStr =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null
          ? JSON.stringify(err)
          : String(err);

    // 域名白名单错误（真机/体验版常见）
    if (
      errStr.includes('不在以下') ||
      errStr.includes('domain list') ||
      errStr.includes('合法域名') ||
      errStr.includes('not in list')
    ) {
      return '服务器域名未在微信后台配置，请在「开发管理 → 服务器域名」中添加 uploadFile 白名单';
    }

    // SSL 证书错误（自签名证书被微信拒绝）
    if (
      errStr.includes('ERR_CERT') ||
      errStr.includes('SSL') ||
      errStr.includes('certificate') ||
      errStr.includes('cert')
    ) {
      return '服务器 SSL 证书无效，请更换为有效的 CA 签名证书';
    }

    // 连接被拒绝（服务器未启动）
    if (errStr.includes('ERR_CONNECTION_REFUSED') || errStr.includes('Connection refused')) {
      return '无法连接到服务器，请确认服务已启动';
    }

    // DNS 解析失败
    if (errStr.includes('ERR_NAME_NOT_RESOLVED') || errStr.includes('name not resolved')) {
      return '服务器域名解析失败，请检查网络连接';
    }

    // request:fail 系列错误（网络不可达 / 域名不在白名单的通用错误）
    if (
      errStr.includes('request:fail') ||
      errStr.includes('Network Error') ||
      errStr.includes('NSURLErrorDomain') ||
      errStr.includes('net::ERR_FAILED')
    ) {
      return '网络不可用，请检查网络连接或服务器域名白名单配置';
    }

    // 超时
    if (errStr.includes('timeout') || errStr.includes('超时') || errStr.includes('Timeout')) {
      return '上传超时，请检查网络后重试';
    }

    return '上传失败，请重试';
  }

  /**
   * 压缩图片 + 上传到食物识别服务（multipart/form-data）
   *
   * 使用 Taro.uploadFile 发送 multipart 请求到 /api/v1/recognize（服务器已有），
   * 返回识别结果（食物名称、类型、热量等）。
   *
   * 注意：Taro.uploadFile 封装 wx.uploadFile。真机调试时微信会校验：
   * 1. uploadFile 合法域名白名单（需在 mp.weixin.qq.com 配置）
   * 2. SSL 证书有效性（需 CA 签名证书，自签名被拒绝）
   */
  const uploadWithCompression = useCallback(
    async (filePath: string): Promise<{
      imagePath: string;
      foodName: string;
      foodType: string;
      calories: string;
    }> => {
      // Step 1: 使用 UPLOAD_PRESET 压缩图片（缩小到 512px + 85% 品质）
      // 注意：processImage 内部调用 getImageInfo，某些环境中可能失败
      let compressed: { filePath: string };
      try {
        compressed = await processImage(filePath, UPLOAD_PRESET);
      } catch (imgErr) {
        console.warn('[CameraPage] 图片压缩/获取信息失败，降级使用原图:', imgErr);
        compressed = { filePath };
      }

      // Step 2: 通过 Taro.uploadFile 上传到识别接口（multipart/form-data），带重试
      const token = useAuthStore.getState().token;
      const recognizeUrl = `${API_BASE}/recognize`;

      const res = await uploadFileWithRetry({
        url: recognizeUrl,
        filePath: compressed.filePath,
        name: 'image', // 对应服务端 multer upload.single('image')
        header: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 60000,
      });

      // Taro.uploadFile 返回的 res.data 是 string，需手动 JSON.parse
      const resData = JSON.parse(res.data) as {
        success: boolean;
        errCode: number;
        errMsg?: string;
        data?: {
          foodName: string;
          confidence: number;
          foodType: string;
          calories?: {
            caloriesTotal: number;
            protein: number;
            fat: number;
            carbs: number;
          };
        };
      };

      if (!resData.success || !resData.data) {
        const httpStatus = res.statusCode ?? '?';
        throw new Error(resData.errMsg || `识别失败 (HTTP ${httpStatus})`);
      }

      // Step 3: 将压缩后的临时文件保存到持久化存储
      // 临时路径（如 http://tmp/xxx.jpg）在页面跳转后可能失效或被视为 HTTP URL
      let imagePath = compressed.filePath;
      try {
        const fs = Taro.getFileSystemManager();
        imagePath = fs.saveFileSync(compressed.filePath);
      } catch (e) {
        console.warn('[CameraPage] 保存图片到持久化存储失败，使用临时路径:', e);
      }

      return {
        imagePath,
        foodName: resData.data.foodName,
        foodType: resData.data.foodType,
        calories: resData.data.calories ? JSON.stringify(resData.data.calories) : '',
      };
    },
    [],
  );

  const handleUsePhoto = useCallback(async () => {
    setPageState('uploading');
    startProgressSimulation();

    try {
      const result = await uploadWithCompression(tempFilePath);

      clearProgressSimulation();
      setUploadProgress(100);

      // 构建路由参数：压缩图片路径 + 食物识别结果
      let resultUrl = `/pages/result/index?themeImageUrl=${encodeURIComponent(result.imagePath)}`;
      resultUrl += `&foodName=${encodeURIComponent(result.foodName)}`;
      resultUrl += `&foodType=${encodeURIComponent(result.foodType)}`;
      if (result.calories) {
        resultUrl += `&calories=${encodeURIComponent(result.calories)}`;
      }

      await Taro.navigateTo({ url: resultUrl });
    } catch (err) {
      clearProgressSimulation();

      console.error('[CameraPage] 上传失败详情:', err);

      const errorTitle = classifyUploadError(err);

      Taro.showToast({
        title: errorTitle,
        icon: 'none',
        duration: 3000,
      });
      setPageState('preview');
    }
  }, [tempFilePath, startProgressSimulation, clearProgressSimulation, uploadWithCompression]);

  /* ---------- 相机错误 ---------- */

  const handleCameraError = useCallback(() => {
    Taro.showToast({
      title: '相机启动失败，请检查权限',
      icon: 'none',
    });
  }, []);

  /* ==================== 渲染 ==================== */

  /* ---- 相机模式 ---- */
  if (pageState === 'camera') {
    return (
      <View className='camera-page'>
        <Camera
          className='camera-preview'
          devicePosition='back'
          flash={flashMode}
          mode='normal'
          onError={handleCameraError}
        />

        {/* 取景框遮罩（4 片） */}
        <CoverView className='viewfinder-mask viewfinder-mask--top' />
        <CoverView className='viewfinder-mask viewfinder-mask--bottom' />
        <CoverView className='viewfinder-mask viewfinder-mask--left' />
        <CoverView className='viewfinder-mask viewfinder-mask--right' />

        {/* 四角括号 */}
        <CoverView className='viewfinder-corner viewfinder-corner--tl' />
        <CoverView className='viewfinder-corner viewfinder-corner--tr' />
        <CoverView className='viewfinder-corner viewfinder-corner--bl' />
        <CoverView className='viewfinder-corner viewfinder-corner--br' />

        {/* 辅助线 */}
        <CoverView className='viewfinder-guide-h' />
        <CoverView className='viewfinder-guide-v' />

        {/* 提示文字 */}
        <CoverView className='camera-hint'>将食物放入框内拍照</CoverView>

        {/* 底部工具栏 */}
        <CoverView className='camera-toolbar'>
          {/* 相册选择 */}
          <CoverView className='toolbar-btn' onClick={handlePickAlbum}>
            <CoverView className='album-icon'>
              <CoverView className='album-icon-inner' />
            </CoverView>
            <CoverView className='toolbar-btn-label'>相册</CoverView>
          </CoverView>

          {/* 拍照按钮 */}
          <CoverView
            className={`capture-btn${isCapturing ? ' capture-btn--disabled' : ''}`}
            onClick={handleCapture}
          />

          {/* 闪光灯切换 */}
          <CoverView className='toolbar-btn' onClick={handleToggleFlash}>
            <CoverView
              className={`flash-icon${flashMode === 'torch' ? ' flash-icon--active' : ''}`}
            >
              ⚡
            </CoverView>
            <CoverView className='toolbar-btn-label'>
              {FLASH_LABELS[flashMode]}
            </CoverView>
          </CoverView>
        </CoverView>
      </View>
    );
  }

  /* ---- 预览模式 ---- */
  if (pageState === 'preview') {
    return (
      <View className='preview-container'>
        <View className='preview-image-wrapper'>
          <Image
            className='preview-image'
            src={tempFilePath}
            mode='aspectFit'
          />
        </View>
        <View className='preview-actions'>
          <View
            className='preview-btn preview-btn--retake'
            onClick={handleRetake}
            hoverClass='none'
          >
            重拍
          </View>
          <View
            className='preview-btn preview-btn--confirm'
            onClick={handleUsePhoto}
            hoverClass='none'
          >
            使用照片
          </View>
        </View>
      </View>
    );
  }

  /* ---- 上传模式 ---- */
  return (
    <View className='uploading-container'>
      <View className='uploading-image-wrapper'>
        <Image
          className='uploading-image'
          src={tempFilePath}
          mode='aspectFit'
        />
      </View>
      <View className='uploading-overlay'>
        <Text className='uploading-text'>正在上传...</Text>
        <View className='progress-track'>
          <View
            className='progress-fill'
            style={{ width: `${uploadProgress}%` }}
          />
        </View>
        <Text className='progress-label'>{uploadProgress}%</Text>
      </View>
    </View>
  );
}
