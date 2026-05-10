import { View, Text } from '@tarojs/components';
import { useGameStore } from '../../stores';
import './index.module.scss';

function formatPlayTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function HomePage() {
  const { level, exp, expToNext, gold, totalMileage, gems, playTime, journeyProgress } = useGameStore();
  const progressPct = expToNext > 0 ? Math.min((exp / expToNext) * 100, 100) : 0;
  const journeyPct = journeyProgress;

  return (
    <View className='journey-page'>
      {/* 全景场景 */}
      <View className='scene-container'>
        {/* 天空渐变 */}
        <View className='sky-gradient' />

        {/* 太阳 */}
        <View className='sun' />

        {/* 云朵 */}
        <View className='clouds'>
          <View className='cloud cloud-1' />
          <View className='cloud cloud-2' />
          <View className='cloud cloud-3' />
        </View>

        {/* 远山 */}
        <View className='mountain-range'>
          <View className='mountain mountain-1' />
          <View className='mountain mountain-2' />
          <View className='mountain mountain-3' />
        </View>

        {/* 中景丘陵 */}
        <View className='hills'>
          <View className='hill hill-1' />
          <View className='hill hill-2' />
        </View>

        {/* 树木 */}
        <View className='forest'>
          <View className='tree tree-1'>
            <View className='tree-trunk' />
            <View className='tree-canopy' />
          </View>
          <View className='tree tree-2'>
            <View className='tree-trunk' />
            <View className='tree-canopy' />
          </View>
          <View className='tree tree-3'>
            <View className='tree-trunk' />
            <View className='tree-canopy' />
          </View>
          <View className='tree tree-4'>
            <View className='tree-trunk' />
            <View className='tree-canopy' />
          </View>
          <View className='tree tree-5'>
            <View className='tree-trunk' />
            <View className='tree-canopy' />
          </View>
        </View>

        {/* 旅途路径 */}
        <View className='journey-path'>
          <View className='path-base' />
          <View
            className='path-progress'
            style={{ width: `${journeyPct}%` }}
          />
          <View className='path-marker marker-1' />
          <View className='path-marker marker-2' />
          <View className='path-marker marker-3' />
          <View className='path-marker marker-4' />
          <View className='path-marker marker-5' />
        </View>

        {/* 队伍角色在路上 */}
        <View className='party-on-road'>
          <View className='player-figure' />
          <View className='follower-dot dot-1' />
          <View className='follower-dot dot-2' />
          <View className='follower-dot dot-3' />
        </View>

        {/* 地面 */}
        <View className='ground' />
      </View>

      {/* 极简底部信息栏 */}
      <View className='journey-bottom-bar'>
        <View className='stat-item'>
          <Text className='stat-value'>Lv.{level}</Text>
          <Text className='stat-label'>等级</Text>
        </View>
        <View className='stat-divider' />
        <View className='stat-item'>
          <Text className='stat-value'>{Math.floor(progressPct)}%</Text>
          <Text className='stat-label'>成长</Text>
        </View>
        <View className='stat-divider' />
        <View className='stat-item'>
          <Text className='stat-value'>
            <Text className='gold-icon'>✦</Text>
            {gold}
          </Text>
          <Text className='stat-label'>金币</Text>
        </View>
        <View className='stat-divider' />
        <View className='stat-item'>
          <Text className='stat-value' style={{ fontSize: '13px' }}>
            📍{totalMileage.toFixed(1)}
          </Text>
          <Text className='stat-label'>里程</Text>
        </View>
        <View className='stat-divider' />
        <View className='stat-item'>
          <Text className='stat-value' style={{ fontSize: '13px' }}>
            {formatPlayTime(playTime)}
          </Text>
          <Text className='stat-label'>在线</Text>
        </View>
      </View>

      {/* 旅途状态文字（浮动在场景上方） */}
      <View className='journey-status-tag'>
        <View className='status-dot' />
        <Text className='status-label'>探索中</Text>
      </View>
    </View>
  );
}
