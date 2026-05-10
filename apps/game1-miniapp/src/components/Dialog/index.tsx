import { View, Text } from '@tarojs/components';
import './index.scss';

interface DialogChoice {
  label: string;
  value: string;
  disabled?: boolean;
  hint?: string;
}

interface DialogProps {
  visible: boolean;
  title: string;
  description?: string;
  choices?: DialogChoice[];
  onChoice?: (value: string) => void;
  onClose?: () => void;
  children?: React.ReactNode;
  type?: 'info' | 'event' | 'reward' | 'confirm';
}

export default function Dialog({
  visible,
  title,
  description,
  choices,
  onChoice,
  onClose,
  children,
  type = 'info',
}: DialogProps) {
  if (!visible) return null;

  return (
    <View className='dialog-overlay' onClick={onClose}>
      <View
        className={`dialog-container dialog-container--${type}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <View className='dialog-header'>
          <Text className='dialog-title'>{title}</Text>
        </View>

        {/* 描述 */}
        {description && (
          <View className='dialog-body'>
            <Text className='dialog-desc'>{description}</Text>
          </View>
        )}

        {/* 自定义内容 */}
        {children && <View className='dialog-body'>{children}</View>}

        {/* 选项 */}
        {choices && choices.length > 0 && (
          <View className='dialog-choices'>
            {choices.map((choice) => (
              <View
                key={choice.value}
                className={`dialog-choice ${choice.disabled ? 'dialog-choice--disabled' : ''}`}
                onClick={() => !choice.disabled && onChoice?.(choice.value)}
              >
                <Text className='dialog-choice-label'>{choice.label}</Text>
                {choice.hint && (
                  <Text className='dialog-choice-hint'>{choice.hint}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 关闭按钮 */}
        {type === 'info' && onClose && (
          <View className='dialog-close' onClick={onClose}>
            <Text className='dialog-close-text'>关闭</Text>
          </View>
        )}
      </View>
    </View>
  );
}
