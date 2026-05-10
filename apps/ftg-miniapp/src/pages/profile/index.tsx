import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, Button, Input, OpenData } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useAuthStore } from '@/stores/authStore';
import { fetchCurrentUser } from '@/services/authService';
import {
  fetchUserStatsHttp,
  updateUserProfileHttp,
  uploadAvatar,
  decryptWechatUserInfo,
} from '@/services/userService';
import type { UserProfile, UserStats } from '@/types/user';

import { FoodType } from '@/types/food';
import { FOOD_TYPE_EMOJIS, FOOD_TYPE_LABELS } from '@/constants/foodTypes';
import './index.scss';

/**
 * 个人主页
 * 展示用户信息卡片、统计数据、功能入口列表
 *
 * 微信头像昵称获取说明：
 * - 微信自 2022年10月 起废弃了 wx.getUserProfile / wx.getUserInfo
 * - 进入页面时检测是否已设置头像/昵称，未设置则提示授权
 * - button open-type="getUserInfo"：一键授权获取微信头像 CDN URL + 昵称
 * - button open-type="chooseAvatar" + input type="nickname"：手动选择/编辑
 * - 头像 CDN URL 直接通过 PATCH /auth/me 保存，避免文件上传失败问题
 */
export default function ProfilePage() {
  // 页面显示时通知自定义底部栏切换选中状态
  useDidShow(() => {
    Taro.eventCenter.trigger('tabChange', 2);
  });

  // ============================================================
  // State
  // ============================================================
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [savingAvatar, setSavingAvatar] = useState<boolean>(false);
  const [savingNickname, setSavingNickname] = useState<boolean>(false);
  const [authorizing, setAuthorizing] = useState<boolean>(false);

  // 记住修改前的昵称，用于微信安全审核失败时回滚
  const prevNicknameRef = useRef<string | null>(null);
  // 数据加载版本号：防止 pending 的 loadData 在本地更新后被覆写
  // (如：挂载时启动 loadData → 用户上传头像 → setProfile → loadData 完成 → 覆写旧数据)
  const loadSeqRef = useRef(0);
  // 昵称修改后延迟刷新定时器，用于组件卸载时清理
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const token = useAuthStore((s) => s.token);

  // ============================================================
  // 数据加载（使用 HTTP API 替代 CloudBase，避免超时）
  // ============================================================
  const loadData = useCallback(async () => {
    // 递增版本号 — 任何本地更新操作（上传/改昵称）也会递增此值，
    // 使 pending 中的旧 loadData 在完成时跳过 state 写入。
    const mySeq = ++loadSeqRef.current;

    setLoading(true);
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      // 分别 catch 防止单个请求失败导致全部结果被丢弃
      // 使用 httpClient 原生超时（10秒），替代有问题的 Promise.race 方式
      const [authUser, statsData] = await Promise.all([
        fetchCurrentUser(token, 10000).catch(() => null),
        fetchUserStatsHttp(token, 10000).catch(() => null),
      ]);
      // 检查是否有更新的操作（上传/改昵称）已递增版本号
      if (mySeq !== loadSeqRef.current) return;
      if (!authUser) throw new Error('获取用户信息失败');
      setProfile({
        nickname: authUser.nickname ?? '',
        avatarUrl: authUser.avatarUrl ?? '',
        totalRecords: statsData?.totalRecords ?? 0,
        unlockedAchievements: statsData?.achievementsUnlocked ?? 0,
        maxStreak: statsData?.maxStreak ?? 0,
      });
      setStats(statsData);
    } catch {
      if (mySeq !== loadSeqRef.current) return;
      // 不覆盖已有数据（可能来自上传/昵称修改的本地更新）。
      // 首次加载失败时 profile/stats 保持 null，UI 中 OpenData 会兜底显示微信昵称/头像。
      Taro.showToast({
        title: '网络异常，部分数据不可用',
        icon: 'none',
        duration: 1500,
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
    return () => {
      // 组件卸载时清除待执行的延迟刷新定时器
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }
    };
  }, [loadData]);

  // ============================================================
  // 选择头像（微信新 API：button open-type="chooseAvatar"）
  // 替代已废弃的 getUserInfo / getUserProfile
  //
  // 注意：不要在 chooseAvatar 回调中用 await 做耗时操作！
  // 微信的 chooseAvatar 原生交互对回调有超时限制（约10秒），
  // 如果在回调内直接 await 上传完成，交互可能超时并抛出
  // WAServiceMainContext timeout 错误。
  // 正确的做法：回调中仅启动上传任务，立即返回。
  // ============================================================
  const handleChooseAvatar = useCallback(
    (e: { detail: { avatarUrl: string } }) => {
      if (!token) return;
      const tempFilePath = e.detail?.avatarUrl;
      if (!tempFilePath) return;

      // 同步启动上传流程，不阻塞 chooseAvatar 交互（void 显式忽略 Promise）
      void performAvatarUpload(token, tempFilePath);
    },
    [token],
  );

  /** 执行头像上传流程（与 chooseAvatar 回调分离，避免回调超时） */
  const performAvatarUpload = useCallback(
    async (tk: string, filePath: string) => {
      // 递增版本号，使 pending 的 loadData 在完成时跳过 state 写入
      // 解决竞态条件：挂载 loadData 还在 pending → 上传完成 setProfile → 
      // loadData 完成覆写旧数据 → 头像闪现消失
      loadSeqRef.current += 1;
      setSavingAvatar(true);
      try {
        // 上传头像获取永久 URL
        const avatarUrl = await uploadAvatar(tk, filePath);
        // 立即更新本地状态，确保 UI 即时反映新头像
        setProfile((prev) => {
          if (prev) return { ...prev, avatarUrl };
          return { nickname: '', avatarUrl, totalRecords: 0, unlockedAchievements: 0, maxStreak: 0 };
        });
        Taro.showToast({ title: '头像更新成功', icon: 'success', duration: 1500 });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '头像上传失败';
        Taro.showToast({ title: errMsg, icon: 'none', duration: 2000 });
      } finally {
        setSavingAvatar(false);
      }
    },
    [],
  );

  // ============================================================
  // 设置昵称（微信新 API：input type="nickname"）
  // 替代已废弃的 getUserInfo / getUserProfile
  // 昵称安全检测在 onBlur 时异步进行，未通过检测的内容会被清空
  // ============================================================
  const handleNicknameBlur = useCallback(
    async (e: { detail: { value: string } }) => {
      if (!token) return;
      const nickname = e.detail?.value;
      if (!nickname || nickname === profile?.nickname) return;

      // 记住修改前的昵称，用于安全审核失败时回滚
      prevNicknameRef.current = profile?.nickname ?? null;

      try {
        setSavingNickname(true);
        // 递增版本号，使 pending 的 loadData 不会覆写本次昵称更新
        loadSeqRef.current += 1;
        await updateUserProfileHttp(token, { nickname });
        // 立即更新本地状态，避免 loadData 失败后昵称丢失
        setProfile((prev) => {
          if (prev) return { ...prev, nickname };
          return { nickname, avatarUrl: '', totalRecords: 0, unlockedAchievements: 0, maxStreak: 0 };
        });
        Taro.showToast({ title: '昵称更新成功', icon: 'success', duration: 1500 });
        // 延迟刷新，等待微信异步安全审核完成后拉取后端全量数据
        if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
        loadTimerRef.current = setTimeout(() => {
          loadData();
        }, 1000);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '昵称保存失败';
        Taro.showToast({ title: errMsg, icon: 'none', duration: 2000 });
      } finally {
        setSavingNickname(false);
      }
    },
    [token, profile?.nickname, loadData],
  );

  // ============================================================
  // 昵称安全审核回调（微信基础库 2.24.4+ 支持）
  // 当微信对昵称的异步安全审核完成时触发。
  // 审核不通过时，显式回滚服务端已保存的昵称到修改前的值。
  //
  // 注：prevNicknameRef 仅在 blur handler 中设置（值为 profile?.nickname ?? null），
  // 此处不主动清空 —— 保证多次审核乱序到达时始终持有有效旧值。
  // profile?.nickname 永远为字符串（'' 兜底），不会出现 null 误写风险。
  // ============================================================
  const handleNicknameReview = useCallback(
    async (e: { detail: { pass: boolean } }) => {
      if (!e.detail?.pass) {
        console.warn('[Profile] 昵称安全审核未通过，回滚服务端数据');
        // 递增版本号，防止并发的 loadData 在回滚完成前覆写 profile
        loadSeqRef.current += 1;
        try {
          await updateUserProfileHttp(token!, { nickname: prevNicknameRef.current });
        } catch {
          // 回滚失败（网络问题等），静默处理 — 下次加载时会恢复
        }
        await loadData();
      }
    },
    [token, loadData],
  );

  // ============================================================
  // 微信资料一键授权（button open-type="getUserInfo"）
  // 用户授权后获取微信头像 CDN URL 和昵称，直接保存到服务端
  // ============================================================
  const handleGetUserInfo = useCallback(
    async (e: { detail: { encryptedData: string; iv: string; userInfo?: { nickName: string; avatarUrl: string } } }) => {
      if (!token) return;
      const { encryptedData, iv, userInfo } = e.detail;

      // 部分微信版本 userInfo 直接可用（旧版兼容）
      if (userInfo && userInfo.nickName && userInfo.avatarUrl) {
        setAuthorizing(true);
        try {
          // CDN 头像 URL + 昵称直接保存，无需文件上传
          await updateUserProfileHttp(token, {
            nickname: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl,
          });
          Taro.showToast({ title: '微信资料已同步', icon: 'success', duration: 1500 });
          loadData();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : '同步失败';
          Taro.showToast({ title: errMsg, icon: 'none', duration: 2000 });
        } finally {
          setAuthorizing(false);
        }
        return;
      }

      // 新版本微信：encryptedData 需服务端解密
      if (encryptedData && iv) {
        setAuthorizing(true);
        try {
          await decryptWechatUserInfo(token, { encryptedData, iv });
          Taro.showToast({ title: '微信资料已同步', icon: 'success', duration: 1500 });
          loadData();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : '同步失败';
          Taro.showToast({ title: errMsg, icon: 'none', duration: 2000 });
        } finally {
          setAuthorizing(false);
        }
        return;
      }
    },
    [token, loadData],
  );

  /** 是否应显示授权提示（无头像且无昵称时） */
  const needsAuth = !loading && profile !== null && !profile.avatarUrl && !profile.nickname;

  // ============================================================
  // 计算最爱食物
  // ============================================================
  const getFavoriteFood = (): string => {
    if (
      stats === null ||
      stats.foodTypeCounts === undefined ||
      stats.foodTypeCounts === null
    ) {
      return '🍽️';
    }

    const entries = Object.entries(stats.foodTypeCounts) as Array<
      [string, number]
    >;
    if (entries.length === 0) {
      return '🍽️';
    }

    // 按数量降序排序，取最常吃的食物类型
    const sorted = [...entries].sort(([, countA], [, countB]) => countB - countA);
    const topFoodType = sorted[0]?.[0] ?? '';

    if (topFoodType.length === 0) {
      return '🍽️';
    }

    // 尝试用 emoji 展示，没有 emoji 则显示名称
    const emoji = FOOD_TYPE_EMOJIS[topFoodType as FoodType];
    if (emoji !== undefined) {
      return emoji;
    }

    const label = FOOD_TYPE_LABELS[topFoodType as FoodType];
    return label ?? '🍽️';
  };

  // ============================================================
  // 功能入口列表
  // ============================================================
  interface MenuItem {
    icon: string;
    iconClass: string;
    title: string;
    subtitle: string;
    action: () => void;
  }

  const menuItems: MenuItem[] = [
    {
      icon: '🏆',
      iconClass: 'profile-menu-icon--achievement',
      title: '我的成就',
      subtitle: '查看已解锁的成就',
      action: () => {
        Taro.navigateTo({ url: '/pages/achievements/index' }).catch(() => {
          Taro.showToast({
            title: '成就页面开发中',
            icon: 'none',
            duration: 2000,
          });
        });
      },
    },
    {
      icon: '🗺️',
      iconClass: 'profile-menu-icon--record',
      title: '打卡足迹',
      subtitle: '查看美食打卡足迹',
      action: () => {
        Taro.navigateTo({ url: '/pages/checkin/index' }).catch(() => {
          Taro.showToast({
            title: '打卡页面开发中',
            icon: 'none',
            duration: 2000,
          });
        });
      },
    },
    {
      icon: '⚙️',
      iconClass: 'profile-menu-icon--setting',
      title: '设置',
      subtitle: 'AI 服务配置与偏好',
      action: () => {
        Taro.navigateTo({ url: '/pages/settings/index' });
      },
    },
    {
      icon: 'ℹ️',
      iconClass: 'profile-menu-icon--about',
      title: '关于',
      subtitle: '应用信息与版本',
      action: () => {
        Taro.showModal({
          title: '关于',
          content:
            '食物主题生成器\n通过 AI 识别食物并生成个性化主题图片。\n当前版本：1.0.0',
          showCancel: false,
          confirmText: '知道了',
        });
      },
    },
  ];

  // ============================================================
  // 加载状态
  // ============================================================
  if (loading) {
    return (
      <View className='profile-loading'>
        <Text className='profile-loading-text'>加载中...</Text>
      </View>
    );
  }

  // ============================================================
  // 主渲染
  // ============================================================
  return (
    <View className='profile-page'>
      {/* ==================== 用户信息卡片 ==================== */}
      <View className='profile-card'>
        {/* 头像 — 点击选择新头像（微信新 API：chooseAvatar） */}
        <Button
          className='profile-avatar-btn'
          openType='chooseAvatar'
          onChooseAvatar={handleChooseAvatar}
          loading={savingAvatar}
          disabled={savingAvatar}
        >
          <View className='profile-avatar'>
            {profile?.avatarUrl ? (
              <Image
                className='profile-avatar-image'
                src={profile.avatarUrl}
                mode='aspectFill'
              />
            ) : (
              <OpenData type='userAvatarUrl' className='profile-avatar-image profile-avatar-wechat' />
            )}
            {/* 头像编辑提示 */}
            <View className='profile-avatar-overlay'>
              <Text className='profile-avatar-overlay-text'>
                {savingAvatar ? '上传中...' : '点击更换'}
              </Text>
            </View>
          </View>
        </Button>

        {/* 昵称 — 点击编辑（微信新 API：input type="nickname"）
            聚焦时自动填充微信昵称，失焦时保存到服务端 */}
        <View className='profile-nickname-wrap'>
          <Input
            className='profile-nickname-input'
            type='nickname'
            value={profile?.nickname ?? ''}
            placeholder='点击设置昵称'
            onBlur={handleNicknameBlur}
            onNickNameReview={handleNicknameReview}
            disabled={savingNickname}
          />
          {savingNickname && (
            <Text className='profile-nickname-saving'>保存中...</Text>
          )}
        </View>
      </View>

      {/* ==================== 微信资料授权提示 ==================== */}
      {needsAuth && !authorizing && (
        <View className='profile-auth-banner'>
          <Text className='profile-auth-title'>使用微信资料</Text>
          <Text className='profile-auth-desc'>一键同步微信头像和昵称</Text>
          <Button
            className='profile-auth-btn'
            openType='getUserInfo'
            onGetUserInfo={handleGetUserInfo}
          >
            授权微信资料
          </Button>
        </View>
      )}
      {authorizing && (
        <View className='profile-auth-banner profile-auth-banner--loading'>
          <Text className='profile-auth-desc'>正在同步微信资料...</Text>
        </View>
      )}

      {/* ==================== 统计栅格 ==================== */}
      <View className='profile-stats'>
        <View className='profile-stat-item'>
          <Text className='profile-stat-value'>
            {profile?.totalRecords ?? 0}
          </Text>
          <Text className='profile-stat-label'>总记录数</Text>
        </View>
        <View className='profile-stat-item'>
          <Text className='profile-stat-value'>
            {stats?.totalCheckins ?? 0}
          </Text>
          <Text className='profile-stat-label'>打卡天数</Text>
        </View>
        <View className='profile-stat-item'>
          <Text className='profile-stat-value'>
            {profile?.unlockedAchievements ?? 0}
          </Text>
          <Text className='profile-stat-label'>解锁成就</Text>
        </View>
        <View className='profile-stat-item'>
          <Text className='profile-stat-value'>
            {getFavoriteFood()}
          </Text>
          <Text className='profile-stat-label'>最爱食物</Text>
        </View>
      </View>

      {/* ==================== 功能入口列表 ==================== */}
      <View className='profile-menu-section'>
        <View className='profile-menu-card'>
          {menuItems.map((item, index) => (
            <View
              key={String(index)}
              className='profile-menu-item'
              onClick={item.action}
            >
              <View className='profile-menu-left'>
                <View className={`profile-menu-icon ${item.iconClass}`}>
                  <Text>{item.icon}</Text>
                </View>
                <View className='profile-menu-text'>
                  <Text className='profile-menu-title'>{item.title}</Text>
                  <Text className='profile-menu-sub'>{item.subtitle}</Text>
                </View>
              </View>
              <Text className='profile-menu-arrow'>›</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
