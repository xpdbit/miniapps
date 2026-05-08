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
      setTempFilePath(filePath);
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
      setTempFilePath(filePath);
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

  /* ---------- 上传 ---------- */

  /** 最大上传重试次数 */
  const MAX_UPLOAD_RETRIES = 2;

  /**
   * 压缩图片 + 上传到云存储（含重试）
   */
  const uploadWithCompression = useCallback(
    async (filePath: string): Promise<string> => {
      // Step 1: 使用 UPLOAD_PRESET 压缩图片（缩小到 2048px + 85% 品质）
      const compressed = await processImage(filePath, UPLOAD_PRESET);

      // Step 2: 上传到云存储（含重试）
      const cloudPath = `food-images/${Date.now()}.jpg`;
      let lastError: unknown;

      for (let attempt = 0; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
        try {
          const result = await wx.cloud.uploadFile({
            cloudPath,
            filePath: compressed.filePath,
          });
          return result.fileID;
        } catch (err) {
          lastError = err;
          // 非最后尝试时等待一秒后重试
          if (attempt < MAX_UPLOAD_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000));
            console.warn(
              `[CameraPage] 上传重试 ${attempt + 1}/${MAX_UPLOAD_RETRIES}`,
            );
          }
        }
      }

      throw lastError;
    },
    [],
  );

  const handleUsePhoto = useCallback(async () => {
    setPageState('uploading');
    startProgressSimulation();

    try {
      const fileID = await uploadWithCompression(tempFilePath);

      clearProgressSimulation();
      setUploadProgress(100);

      await Taro.navigateTo({
        url: `/pages/result/index?fileId=${fileID}`,
      });
    } catch (err) {
      clearProgressSimulation();

      const isTimeout =
        err instanceof Error &&
        (err.message?.includes('timeout') || err.message?.includes('超时'));

      Taro.showToast({
        title: isTimeout ? '上传超时，请检查网络后重试' : '上传失败，请重试',
        icon: 'none',
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
