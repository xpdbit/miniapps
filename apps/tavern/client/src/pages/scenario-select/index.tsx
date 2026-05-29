/**
 * scenario-select — 剧本发现页
 * 浏览内置和自定义剧本，选择后初始化游戏
 */
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { httpClient } from '@/services/httpClient'
import { useGameStore } from '@/stores/gameStore'
import './index.scss'

interface ScenarioSummary {
  id: string
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  dimensionCount: number
  characterCount: number
  source: 'builtin' | 'custom'
}

interface InitResult {
  scenario: {
    meta: { id: string; name: string; description: string; tags: string[] }
    world: { dimensions: Array<{ key: string; label: string; icon?: string; range: [number, number] }> }
    rules: { loseCondition: string; winCondition: string; npcBehavior?: string }
  }
  characters: Array<{
    id: string; name: string; location: string; mood: number; energy: number
    health: number; hunger: number; flags?: { role?: string; expertise?: string[] }
  }>
  initialState: {
    dimensions: Record<string, number>
    time: { hour: number; day: number }
    weather: string
  }
  firstMessage: string
}

const API_BASE = typeof Taro !== 'undefined' ? '' : ''

export default function ScenarioSelectPage() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [initLoading, setInitLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { createSave, enableGameMode, setDimensions, setScenarioId } = useGameStore()

  useEffect(() => {
    loadScenarios()
  }, [])

  const loadScenarios = async () => {
    try {
      setLoading(true)
      const res: { code: number; data: ScenarioSummary[] } = await httpClient.get('/v1/ai-scripts/scenarios') as unknown as { code: number; data: ScenarioSummary[] }
      if (res?.code === 0) {
        setScenarios(res.data)
      }
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleStart = async (scenarioId: string) => {
    try {
      setInitLoading(scenarioId)
      setError('')

      const res = await (httpClient.post(
        `/v1/ai-scripts/scenarios/${scenarioId}/init`,
        {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as Promise<any>)
      const body = res as { code: number; data: InitResult }

      if (body?.code !== 0 || !body?.data) {
        throw new Error('初始化失败')
      }

      const data = body.data
      const chars = data.characters
      const playerChar = chars.find(c => c.flags?.role === 'player') ?? chars[0]

      // 创建存档
      const save = createSave({
        name: data.scenario.meta.name,
        playerCount: chars.filter(c => c.flags?.role === 'player').length,
        selectedCards: {
          characters: chars.map(c => c.id),
          mechanics: [],
          maps: [],
          backgrounds: [],
        },
        worldSetting: {
          title: data.scenario.meta.name,
          description: data.scenario.meta.description,
          rules: [data.scenario.rules.loseCondition, data.scenario.rules.winCondition].filter(Boolean),
        },
        groups: [
          {
            id: 'main',
            name: '王座厅',
            memberIds: chars.map(c => c.id),
            isGroup: true,
            pinned: false,
            _messages: [],
          },
        ],
      })

      // 设置 Scenario 状态
      setDimensions(data.initialState.dimensions)
      setScenarioId(scenarioId)

      // 进入游戏模式
      enableGameMode()

      // 跳转到聊天页
      Taro.navigateTo({
        url: `/pages/chat/index?saveId=${save.id}&scenarioId=${scenarioId}&characterId=${playerChar?.id ?? ''}&firstMessage=${encodeURIComponent(data.firstMessage)}`,
      })

    } catch (err: unknown) {
      setError((err as Error).message)
      Taro.showToast({ title: '初始化失败', icon: 'none' })
    } finally {
      setInitLoading(null)
    }
  }

  return (
    <View className="scenario-select-page">
      <View className="page-header">
        <Text className="title">🎮 游戏剧本</Text>
        <Text className="subtitle">选择一个剧本来开始游戏</Text>
      </View>

      {error ? (
        <View className="error-box">
          <Text>{error}</Text>
          <View className="retry-btn" onClick={loadScenarios}>
            <Text>重试</Text>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View className="loading-text"><Text>加载中...</Text></View>
      ) : (
        <ScrollView className="scenario-list" scrollY>
          {scenarios.map(s => (
            <View key={s.id} className="scenario-card" onClick={() => handleStart(s.id)}>
              <View className="card-tags">
                <Text className={`source-tag ${s.source}`}>
                  {s.source === 'builtin' ? '内置' : '社区'}
                </Text>
                {s.tags.slice(0, 3).map(t => (
                  <Text key={t} className="tag">{t}</Text>
                ))}
              </View>
              <Text className="card-name">{s.name}</Text>
              <Text className="card-desc">{s.description}</Text>
              <View className="card-meta">
                <Text>{s.dimensionCount}维度 · {s.characterCount}角色</Text>
                <Text className="meta-right">v{s.version} · {s.author}</Text>
              </View>
              <View
                className={`start-btn ${initLoading === s.id ? 'loading' : ''}`}
                onClick={e => {
                  e.stopPropagation()
                  handleStart(s.id)
                }}
              >
                <Text>{initLoading === s.id ? '生成中...' : '开始游戏'}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
