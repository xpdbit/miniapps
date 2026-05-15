import { View, Text } from '@tarojs/components';
import type { CSSProperties } from 'react';
import './index.scss';

export type IconName =
  | 'gold' | 'gem' | 'exp' | 'mileage'
  | 'hp' | 'attack' | 'defense' | 'speed' | 'wisdom'
  | 'stamina' | 'food' | 'morale'
  | 'travel' | 'combat' | 'team' | 'inventory'
  | 'achievement' | 'card' | 'skill' | 'prestige'
  | 'pet' | 'event' | 'map' | 'pvp'
  | 'time' | 'level' | 'star' | 'chest'
  | 'arrow_up' | 'arrow_down' | 'check' | 'cross'
  | 'lock' | 'unlock' | 'info' | 'warning';

const ICON_MAP: Record<IconName, string> = {
  gold: '🪙', gem: '💎', exp: '⭐', mileage: '📏',
  hp: '❤️', attack: '⚔️', defense: '🛡️', speed: '💨', wisdom: '📖',
  stamina: '⚡', food: '🍖', morale: '🎵',
  travel: '🚶', combat: '⚔️', team: '👥', inventory: '🎒',
  achievement: '🏆', card: '🃏', skill: '✨', prestige: '🔄',
  pet: '🐾', event: '📜', map: '🗺️', pvp: '🏴',
  time: '⏱️', level: '📊', star: '⭐', chest: '🎁',
  arrow_up: '↑', arrow_down: '↓', check: '✓', cross: '✗',
  lock: '🔒', unlock: '🔓', info: 'ℹ️', warning: '⚠️',
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export default function Icon({ name, size = 32, className = '', style }: IconProps) {
  const emoji = ICON_MAP[name] || '❓';
  return (
    <Text
      className={`game-icon ${className}`}
      style={{
        fontSize: `${size}rpx`,
        lineHeight: 1,
        ...style,
      }}
    >
      {emoji}
    </Text>
  );
}

export { ICON_MAP };
