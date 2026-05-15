import { View, Text, ScrollView } from '@tarojs/components';
import { useState } from 'react';
import './index.module.scss';

// ============================================================
// 角色职业定义
// ============================================================
interface Job {
  id: string;
  name: string;
  icon: string;
}

const JOBS: Job[] = [
  { id: 'warrior', name: '战士', icon: '⚔️' },
  { id: 'mage', name: '法师', icon: '🔮' },
  { id: 'priest', name: '牧师', icon: '✨' },
  { id: 'ranger', name: '游侠', icon: '🏹' },
  { id: 'assassin', name: '刺客', icon: '🗡️' },
  { id: 'knight', name: '骑士', icon: '🛡️' },
];

// ============================================================
// 角色成员接口
// ============================================================
interface TeamMember {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  job: string;
  avatar: string;
  isActive: boolean;
}

// ============================================================
// 占位数据
// ============================================================
const PLACEHOLDER_MEMBERS: TeamMember[] = [
  {
    id: 'player',
    name: '旅行者',
    level: 12,
    hp: 850,
    maxHp: 1000,
    attack: 120,
    defense: 80,
    speed: 95,
    job: 'warrior',
    avatar: '🧑',
    isActive: true,
  },
  {
    id: 'companion-1',
    name: '小雪',
    level: 8,
    hp: 420,
    maxHp: 420,
    attack: 65,
    defense: 45,
    speed: 110,
    job: 'mage',
    avatar: '👩‍🎤',
    isActive: true,
  },
  {
    id: 'companion-2',
    name: '阿石',
    level: 10,
    hp: 680,
    maxHp: 720,
    attack: 88,
    defense: 95,
    speed: 60,
    job: 'knight',
    avatar: '🧔',
    isActive: false,
  },
];

const MAX_TEAM_SIZE = 4;

// ============================================================
// 获取职业信息
// ============================================================
function getJobById(jobId: string): Job | undefined {
  return JOBS.find((j) => j.id === jobId);
}

// ============================================================
// 队伍页面
// ============================================================
export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>(PLACEHOLDER_MEMBERS);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showJobSelect, setShowJobSelect] = useState(false);
  const [jobSelectTarget, setJobSelectTarget] = useState<string | null>(null);

  const activeCount = members.filter((m) => m.isActive).length;
  const emptySlots = MAX_TEAM_SIZE - members.length;

  // ============================================================
  // 打开成员详情
  // ============================================================
  function handleMemberClick(member: TeamMember) {
    setSelectedMember(member);
    setShowJobSelect(false);
  }

  // ============================================================
  // 关闭详情弹窗
  // ============================================================
  function handleCloseDetail() {
    setSelectedMember(null);
    setShowJobSelect(false);
    setJobSelectTarget(null);
  }

  // ============================================================
  // 切换成员激活状态
  // ============================================================
  function handleToggleActive(memberId: string) {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, isActive: !m.isActive } : m))
    );
    // 更新选中成员状态
    if (selectedMember && selectedMember.id === memberId) {
      setSelectedMember((prev) =>
        prev ? { ...prev, isActive: !prev.isActive } : null
      );
    }
  }

  // ============================================================
  // 打开职业选择
  // ============================================================
  function handleOpenJobSelect() {
    if (selectedMember) {
      setJobSelectTarget(selectedMember.id);
      setShowJobSelect(true);
    }
  }

  // ============================================================
  // 选择职业
  // ============================================================
  function handleSelectJob(jobId: string) {
    if (jobSelectTarget) {
      setMembers((prev) =>
        prev.map((m) => (m.id === jobSelectTarget ? { ...m, job: jobId } : m))
      );
      // 更新选中成员职业
      if (selectedMember && selectedMember.id === jobSelectTarget) {
        setSelectedMember((prev) => (prev ? { ...prev, job: jobId } : null));
      }
    }
    setShowJobSelect(false);
    setJobSelectTarget(null);
  }

  // ============================================================
  // 渲染职业标签
  // ============================================================
  function renderJobBadge(jobId: string, className?: string) {
    const job = getJobById(jobId);
    if (!job) return null;
    return (
      <View className={`member-job-badge ${className || ''}`}>
        <Text className="member-job-badge-icon">{job.icon}</Text>
        <Text className="member-job-badge-name">{job.name}</Text>
      </View>
    );
  }

  // ============================================================
  // 渲染HP条
  // ============================================================
  function renderHpBar(hp: number, maxHp: number) {
    const percent = (hp / maxHp) * 100;
    return (
      <View className="member-hp-bar">
        <View className="member-hp-fill" style={{ width: `${percent}%` }} />
      </View>
    );
  }

  return (
    <View className="team-page fade-in">
      {/* 页面标题 */}
      <View className="team-header">
        <Text className="team-header-title">队伍</Text>
        <Text className="team-header-sub">
          {activeCount}/{MAX_TEAM_SIZE} 已出发
        </Text>
      </View>

      <ScrollView className="team-list" scrollY enhanced bounces={false}>
        {/* 已加入的角色 */}
        {members.map((member) => {
          const job = getJobById(member.job);
          return (
            <View
              key={member.id}
              className={`member-card ${!member.isActive ? 'member-card--inactive' : ''}`}
              onClick={() => handleMemberClick(member)}
            >
              {/* 头像 */}
              <View className="member-avatar">
                <Text className="member-avatar-text">{member.avatar}</Text>
                {!member.isActive && (
                  <View className="member-avatar-inactive-badge">
                    <Text className="member-avatar-inactive-text">休</Text>
                  </View>
                )}
              </View>

              {/* 信息 */}
              <View className="member-info">
                <View className="member-name-row">
                  <View className="member-name-job-row">
                    <Text className="member-name">{member.name}</Text>
                    {renderJobBadge(member.job)}
                  </View>
                  <Text className="member-level">Lv.{member.level}</Text>
                </View>

                {renderHpBar(member.hp, member.maxHp)}

                <Text className="member-hp-text">
                  HP {member.hp}/{member.maxHp}
                </Text>

                <View className="member-stats-row">
                  <Text className="member-stat">⚔️ {member.attack}</Text>
                  <Text className="member-stat">🛡️ {member.defense}</Text>
                  <Text className="member-stat">💨 {member.speed}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* 空闲位置 */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <View key={`empty-${i}`} className="member-card member-card--empty">
            <View className="member-avatar member-avatar--empty">
              <Text className="member-avatar-text">+</Text>
            </View>
            <View className="member-info">
              <Text className="member-empty-text">空闲位置</Text>
              <Text className="member-empty-hint">可招募新同伴</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 底部添加按钮 */}
      <View className="team-footer">
        <View
          className={`add-member-btn ${emptySlots === 0 ? 'add-member-btn--disabled' : ''}`}
        >
          <Text className="add-member-btn-text">
            {emptySlots === 0 ? '队伍已满' : '添加成员'}
          </Text>
        </View>
      </View>

      {/* 详情弹窗 */}
      {selectedMember && (
        <View className="member-detail-overlay" onClick={handleCloseDetail}>
          <View
            className="member-detail-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <View className="detail-header">
              <View className="detail-avatar">
                <Text className="detail-avatar-text">{selectedMember.avatar}</Text>
              </View>
              <View className="detail-title">
                <Text className="detail-name">{selectedMember.name}</Text>
                <Text className="detail-level">Lv.{selectedMember.level}</Text>
              </View>
              <View className="detail-close-btn" onClick={handleCloseDetail}>
                <Text className="detail-close-btn-text">✕</Text>
              </View>
            </View>

            {/* 职业标签 */}
            <View className="detail-job-row">
              {renderJobBadge(selectedMember.job, 'detail-job-badge')}
              {!showJobSelect && (
                <View className="change-job-btn" onClick={handleOpenJobSelect}>
                  <Text className="change-job-btn-text">换职业</Text>
                </View>
              )}
            </View>

            {/* 职业选择 */}
            {showJobSelect && (
              <View className="job-select-grid">
                {JOBS.map((job) => (
                  <View
                    key={job.id}
                    className={`job-option ${selectedMember.job === job.id ? 'job-option--selected' : ''}`}
                    onClick={() => handleSelectJob(job.id)}
                  >
                    <Text className="job-option-icon">{job.icon}</Text>
                    <Text className="job-option-name">{job.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 属性列表 */}
            {!showJobSelect && (
              <View className="detail-stats">
                <View className="detail-stat-row">
                  <Text className="detail-stat-label">生命值</Text>
                  <View className="detail-stat-divider" />
                  <Text className="detail-stat-value">
                    {selectedMember.hp} / {selectedMember.maxHp}
                  </Text>
                </View>
                <View className="detail-stat-row">
                  <Text className="detail-stat-label">攻击力</Text>
                  <View className="detail-stat-divider" />
                  <Text className="detail-stat-value">{selectedMember.attack}</Text>
                </View>
                <View className="detail-stat-row">
                  <Text className="detail-stat-label">防御力</Text>
                  <View className="detail-stat-divider" />
                  <Text className="detail-stat-value">{selectedMember.defense}</Text>
                </View>
                <View className="detail-stat-row">
                  <Text className="detail-stat-label">速度</Text>
                  <View className="detail-stat-divider" />
                  <Text className="detail-stat-value">{selectedMember.speed}</Text>
                </View>
              </View>
            )}

            {/* 编队按钮 */}
            {!showJobSelect && (
              <View
                className={`toggle-active-btn ${selectedMember.isActive ? 'toggle-active-btn--active' : ''}`}
                onClick={() => handleToggleActive(selectedMember.id)}
              >
                <Text className="toggle-active-btn-text">
                  {selectedMember.isActive ? '撤下队伍' : '编入队伍'}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}