# UX 状态管理：Loading / Error / Empty / Success

> 状态: current | 来源: Frontend Patterns, LogRocket, vibe coder blog, tessi-labs

## 核心认知

**每个有数据请求的组件都必须处理全部四个状态。这是硬性要求，不是可选项。**

现实应用约有 30% 的时间处于这四种非"正常路径"状态之一。AI 生成代码默认只处理 Success 状态——这正是产品感觉"半成品"的主要来源。

## 四个状态的顺序（必须严格）

```tsx
function DataComponent() {
  // 顺序 → loading > error > empty > success
  if (loading)  return <Skeleton />;
  if (error)    return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data || data.length === 0) return <EmptyState />;

  return <DataView data={data} />;
}
```

**为什么这个顺序**: Loading → Error（即使部分数据存在）→ Empty → Success。

## Loading 状态

### 选择策略（根据时长）

| 加载时长 | 推荐 UI |
|----------|---------|
| < 100ms | 不显示任何东西 |
| 100–500ms | Spinner |
| 500ms–3s | Skeleton Screen |
| 3–5s | Skeleton + 进度提示文字 |
| > 10s | 改用异步通知（邮件/推送） |

### Skeleton Screen 准则

- 骨架尺寸必须和真实内容匹配（避免布局偏移）
- 使用脉冲动画（subtle pulse），不要闪烁
- 不要用 spinner 作为主要内容区的 loading（2026 年看起来廉价）

```tsx
// 延迟显示 loading 避免闪烁
const [showLoading, setShowLoading] = useState(false);

useEffect(() => {
  const timer = setTimeout(() => setShowLoading(true), 200);
  return () => clearTimeout(timer);
}, []);

if (loading && showLoading) return <Skeleton />;
```

### 按钮 Loading

- 异步操作期间禁用按钮
- 显示加载指示器（spinner + "保存中…"）
- 防止重复提交

## Error 状态

### 好与坏的 Error 消息

```
❌ "An error occurred"                → 无帮助
❌ "ECONNREFUSED"                     → 技术术语，用户恐慌
❌ "TypeError: cannot read X of undefined" → 永远不该出现在生产环境

✅ "无法保存您的更改，服务器暂时过载。将在几秒后自动重试。" → 清晰、可操作
✅ "无法加载项目列表。请检查您的网络连接后重试。"         → 有恢复路径
```

### Error 处理的三个问题

1. **发生了什么** — 用普通语言说明
2. **用户能做什么** — 重试、联系支持、返回
3. **如何回到正常工作状态** — 清晰的恢复路径

### 不同类型的 Error 响应

| HTTP 状态 | 用户消息 | 操作 |
|-----------|----------|------|
| 网络断开 | "网络连接已断开" | 自动重试 + 恢复通知 |
| 500 | "服务器暂时不可用" | 重试按钮 |
| 403 | "您没有访问此内容的权限" | 联系管理员 |
| 404 | "页面不存在" | 建议前往其他页面 |
| 429 | "请求过于频繁" | 请稍后再试 |
| 验证失败 | 字段级别的具体错误 | 修正输入后重试 |

### 重试策略

```tsx
// 指数退避重试
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url);
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}
```

**注意**: 404/400 类错误不要重试——重试只会再次失败。

### Error Boundary

- 每个 React 应用至少一个顶层 Error Boundary
- 理想情况：每个路由一个 Error Boundary
- 失败范围要小——一个组件出错不应当让整个页面空白

## Empty 状态

### 空状态三要素

1. **解释为什么** — "还没有任何项目"
2. **告诉用户下一步** — "创建第一个项目"按钮
3. **设定期望** — 示例、图示、功能说明

### 两种空状态区别对待

| 场景 | 消息 | 操作 |
|------|------|------|
| 新用户首次使用 | "欢迎！开始创建你的第一个项目" | CTA 按钮 |
| 筛选无结果 | "没有符合条件的结果" | "清除筛选"按钮 |
| 搜索无结果 | "没有找到 '{关键词}' 的结果" | 建议修改关键词 |

## Optimistic UI（乐观更新）

**模式**: 立即更新 UI → 后台请求 → 失败回滚。

```tsx
// 乐观更新 + 回滚
const previousData = [...data];
setData(prev => prev.filter(item => item.id !== id));

try {
  await api.delete(id);
} catch {
  setData(previousData); // 回滚
  showToast("删除失败，已恢复");
}
```

**适用场景**: 点赞、收藏、评论、低风险 CRUD。
**不适用场景**: 支付、删除、永久性破坏操作。

## 工具化

### 自定义 Hook 模式

```tsx
function useAsync<T>(fn: () => Promise<T>, deps: any[]) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const result = await fn();
      setData(result);
      setState('success');
    } catch (err) {
      setError(err as Error);
      setState('error');
    }
  }, deps);

  return { state, data, error, execute };
}
```

### 使用状态机（推荐）

```tsx
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error; retry: () => void };
```

使用 discriminated union 强制 TypeScript 检查所有状态。

## 检查清单

- [ ] Loading/Skeleton 匹配真实内容布局
- [ ] 延迟 200ms 显示 loading 避免闪烁
- [ ] 异步期间按钮禁用 + 反馈
- [ ] Error 消息用用户语言（非技术术语）
- [ ] Error 状态提供恢复路径
- [ ] 4xx 错误不自动重试
- [ ] Empty 状态包含说明 + 引导操作
- [ ] 筛选空态和首次空态有区分
- [ ] 乐观更新有回滚机制
- [ ] 非阻塞错误用 toast，阻塞错误用页面级 UI
- [ ] Error Boundary 覆盖每个路由
- [ ] 使用 TypeScript discriminated union 确保所有状态被处理
