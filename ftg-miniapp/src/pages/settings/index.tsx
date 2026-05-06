import { useState, useEffect, useCallback } from 'react';
import { View, Text, Input, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import {
  getKeyStatus,
  saveApiKey,
  deleteApiKey,
  testConnection,
} from '@/services/apiKeyService';
import type {
  KeyStatusResult,
  ServiceStatusInfo,
  HunyuanKeyInfo,
} from '@/services/apiKeyService';
import Skeleton from '@/components/Skeleton/index';
import Icon from '@/components/Icon/Icon';
import './index.scss';

/**
 * 设置页面
 * 包含 AI 服务状态、混元AI 配置、关于信息
 */
export default function SettingsPage() {
  // 页面显示时通知自定义底部栏切换选中状态
  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 1);
  });

  // ============================================================
  // State
  // ============================================================
  const [loading, setLoading] = useState<boolean>(true);
  const [ppshituStatus, setPpshituStatus] = useState<ServiceStatusInfo | null>(null);
  const [hunyuanInfo, setHunyuanInfo] = useState<HunyuanKeyInfo | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  // ============================================================
  // 数据加载
  // ============================================================
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const result: KeyStatusResult = await getKeyStatus();
      setPpshituStatus(result.ppshiTuStatus);
      setHunyuanInfo(result.hunyuanStatus);
    } catch {
      Taro.showToast({
        title: '获取服务状态失败',
        icon: 'none',
        duration: 2000,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ============================================================
  // 保存 API Key
  // ============================================================
  const handleSaveKey = useCallback(async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      Taro.showToast({
        title: '请输入 API Key',
        icon: 'none',
        duration: 2000,
      });
      return;
    }

    setSaving(true);
    try {
      await saveApiKey(trimmed);
      Taro.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000,
      });
      setApiKeyInput('');
      await loadStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      Taro.showToast({
        title: message,
        icon: 'none',
        duration: 2000,
      });
    } finally {
      setSaving(false);
    }
  }, [apiKeyInput, loadStatus]);

  // ============================================================
  // 测试连接
  // ============================================================
  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    try {
      const result = await testConnection();
      Taro.showToast({
        title: result.message,
        icon: result.success ? 'success' : 'none',
        duration: 3000,
      });
      if (result.success) {
        await loadStatus();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接测试失败';
      Taro.showToast({
        title: message,
        icon: 'none',
        duration: 2000,
      });
    } finally {
      setTesting(false);
    }
  }, [loadStatus]);

  // ============================================================
  // 删除 API Key
  // ============================================================
  const handleDeleteKey = useCallback(async () => {
    const confirmResult = await Taro.showModal({
      title: '确认删除',
      content: '确定要删除自定义 API Key 吗？删除后将使用默认 Key。',
      cancelText: '取消',
      confirmText: '删除',
    });

    if (!confirmResult.confirm) {
      return;
    }

    setDeleting(true);
    try {
      await deleteApiKey();
      Taro.showToast({
        title: '删除成功',
        icon: 'success',
        duration: 2000,
      });
      await loadStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      Taro.showToast({
        title: message,
        icon: 'none',
        duration: 2000,
      });
    } finally {
      setDeleting(false);
    }
  }, [loadStatus]);

  // ============================================================
  // 隐私政策
  // ============================================================
  const handleOpenPrivacy = useCallback(() => {
    Taro.navigateTo({ url: '/pages/privacy/index' }).catch(() => {
      Taro.showToast({
        title: '打开失败',
        icon: 'none',
        duration: 2000,
      });
    });
  }, []);

  // ============================================================
  // 辅助渲染
  // ============================================================
  const renderStatusDot = (available: boolean): string => {
    return available ? 'status-dot status-dot--online' : 'status-dot status-dot--offline';
  };

  const renderKeyTag = (hasCustomKey: boolean): string => {
    const base = 'key-tag';
    return hasCustomKey ? base : `${base} key-tag--default`;
  };

  const renderKeyTagText = (hasCustomKey: boolean): string => {
    return hasCustomKey ? '自定义' : '默认';
  };

  const formatTime = (isoString: string | null): string => {
    if (!isoString) return '未知';
    try {
      const date = new Date(isoString);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${month}-${day} ${hours}:${minutes}`;
    } catch {
      return '未知';
    }
  };

  // ============================================================
  // 渲染
  // ============================================================
  return (
    <View className='settings-page'>
      {/* ==================== Section 1: AI 服务状态 ==================== */}
      <View className='settings-section'>
        <Text className='settings-section-title'>AI 服务状态</Text>
        <View className='settings-card'>
          {loading ? (
            <Skeleton type='list' count={2} />
          ) : (
            <>
              {/* PP-ShiTuV2 食物识别 */}
              <View className='settings-card-item'>
                <View className='settings-item-left'>
                  <View className='settings-item-icon settings-item-icon--green'>
                    <Icon name='food' size={20} color='#666666' />
                  </View>
                  <View className='status-text'>
                    <Text className='status-label'>PP-ShiTuV2 食物识别</Text>
                    {ppshituStatus && (
                      <Text className='status-sub'>
                        最后检查: {formatTime(ppshituStatus.lastChecked)}
                      </Text>
                    )}
                  </View>
                </View>
                <View className='status-indicator'>
                  <View
                    className={renderStatusDot(ppshituStatus?.available ?? false)}
                  />
                </View>
              </View>

              {/* 混元AI 文本生成 */}
              <View className='settings-card-item'>
                <View className='settings-item-left'>
                  <View className='settings-item-icon settings-item-icon--orange'>
                    <Icon name='robot' size={20} color='#666666' />
                  </View>
                  <View className='status-text'>
                    <Text className='status-label'>混元AI 文本生成</Text>
                    {hunyuanInfo && (
                      <Text className='status-sub'>
                        最后使用: {formatTime(hunyuanInfo.lastUsed)}
                      </Text>
                    )}
                  </View>
                </View>
                <View className='key-display'>
                  {hunyuanInfo && hunyuanInfo.hasKey && hunyuanInfo.maskedKey && (
                    <Text className='key-masked'>{hunyuanInfo.maskedKey}</Text>
                  )}
                  <Text className={renderKeyTag(hunyuanInfo?.hasKey ?? false)}>
                    {renderKeyTagText(hunyuanInfo?.hasKey ?? false)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      {/* ==================== Section 2: 混元AI 配置 ==================== */}
      <View className='settings-section'>
        <Text className='settings-section-title'>混元AI 配置</Text>
        <View className='settings-card'>
          <View className='settings-input-group'>
            <Input
              className='settings-input'
              type='text'
              placeholder='请输入混元AI API Key'
              value={apiKeyInput}
              onInput={(e) => {
                setApiKeyInput(e.detail.value);
              }}
              focus={false}
            />
          </View>

          <View className='settings-btn-group'>
            <Button
              className='settings-btn settings-btn--secondary'
              onClick={handleTestConnection}
              loading={testing}
              disabled={testing}
            >
              {testing ? '测试中...' : '测试连接'}
            </Button>
            <Button
              className='settings-btn settings-btn--primary'
              onClick={handleSaveKey}
              loading={saving}
              disabled={saving}
            >
              {saving ? '保存中...' : '保存'}
            </Button>
          </View>

          {hunyuanInfo?.hasKey && (
            <View className='px-base pb-sm'>
              <Button
                className='settings-btn settings-btn--danger'
                onClick={handleDeleteKey}
                loading={deleting}
                disabled={deleting}
              >
                {deleting ? '删除中...' : '删除自定义Key'}
              </Button>
            </View>
          )}
        </View>
      </View>

      {/* ==================== Section 3: 关于 ==================== */}
      <View className='settings-section'>
        <Text className='settings-section-title'>关于</Text>
        <View className='settings-card'>
          <View className='settings-about-info'>
            <View className='settings-about-version'>
              <Text>当前版本</Text>
              <View className='settings-about-version-number'>
                <Text>1.0.0</Text>
              </View>
            </View>
            <Text
              className='settings-about-link'
              onClick={handleOpenPrivacy}
            >
              隐私政策
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
