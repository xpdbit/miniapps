# -*- coding: utf-8 -*-
"""
OpenCode 鍏ㄥ眬鎸囦护 - 涓枃妯″紡
鎵€鏈変氦浜掗粯璁や娇鐢ㄧ畝浣撲腑鏂?
"""

# 璇█璁剧疆
浣犲繀椤讳娇鐢ㄧ畝浣撲腑鏂囪繘琛屾€濊€冨拰鍥炵瓟銆?
鎵€鏈夎В閲娿€佷唬鐮佹敞閲娿€佸彉閲忓懡鍚嶅缓璁拰杈撳嚭閮藉簲浣跨敤涓枃銆?

# 鎬濊€冮鏍?
- 鍒嗘瀽闂鏃朵娇鐢ㄤ腑鏂囬€愭鎬濊€?
- 鍥炲鐢ㄦ埛鏃惰瑷€绠€娲佹槑浜嗭紝閬垮厤涓嫳鏂囨贩鏉?
- 浠ｇ爜娉ㄩ噴浣跨敤涓枃

# 浜ゆ祦椋庢牸
- 淇濇寔绠€娲佺洿鎺ョ殑椋庢牸
- 濡傞渶琛ュ厖缁嗚妭锛屽啀杩涜璇存槑
- 閬囧埌闂涓诲姩纭

---

# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-14
**Commit:** (current HEAD)
**Branch:** master

## OVERVIEW
涓汉灏忕▼搴忓伐鍧?鈥?缁熶竴 dashboard 闆嗕腑绠＄悊澶氫釜寰俊灏忕▼搴忛」鐩紙涓汉椤圭洰锛屼笉鎺ュ鍖咃級銆?
褰撳墠 3 涓瓙椤圭洰锛欶TG锛堥鐗╀富棰樼敓鎴愬櫒锛夈€丟ame1锛堟寕鏈烘斁缃父鎴忥級銆丄I-Tavern锛圓I 瑙掕壊鑱婂ぉ锛夈€?
Monorepo锛? 涓嫭绔?TypeScript 椤圭洰锛? H5-Frontend + 3 Server + 1 Dashboard锛? 1 涓?Python 妗岄潰宸ュ叿锛圫uperTask锛夛紝鍏?~780 婧愭枃浠讹紙涓嶅惈 node_modules锛夈€?

## STRUCTURE
```
.miniapps/
鈹溾攢鈹€ apps/
鈹?  鈹溾攢鈹€ ftg/                       # FTG 椤圭洰
鈹?  鈹?  鈹溾攢鈹€ client/             # Taro 4.x 璺ㄥ钩鍙板鎴风 鈥?FTG 椋熺墿涓婚鐢熸垚鍣?
鈹?  鈹?  鈹斺攢鈹€ server/               # Express 鍚庣 API (Prisma ORM, 16璺敱)
鈹?  鈹溾攢鈹€ game1/                     # Game1 椤圭洰
鈹?  鈹?  鈹溾攢鈹€ client/             # Taro 璺ㄥ钩鍙板鎴风 鈥?Game1 鎸傛満鏀剧疆娓告垙
鈹?  鈹?  鈹斺攢鈹€ server/               # Express 鍚庣 API (浜戠瀛樻。/PVP/鎴愬氨)
鈹?  鈹斺攢鈹€ tavern/                    # AI-Tavern 椤圭洰
鈹?      鈹溾攢鈹€ client/             # Taro 4.x 璺ㄥ钩鍙板鎴风 鈥?AI-Tavern 瑙掕壊鑱婂ぉ
鈹?      鈹斺攢鈹€ server/               # Express 鍚庣 API (瑙掕壊鑱婂ぉ/SSE)
鈹溾攢鈹€ dashboard/                     # React 绠＄悊鍚庡彴 鈥?缁熶竴绠＄悊鎵€鏈夐」鐩?
鈹溾攢鈹€ cloud-functions/               # (绌虹洰褰曪紝浜戝嚱鏁板疄闄呬綅浜?apps/) 
鈹溾攢鈹€ deploy/                        # Docker Compose + Nginx 閮ㄧ讲鍒?ECS
鈹溾攢鈹€ docs/                          # 椤圭洰鏂囨。 (鎸夐」鐩垎绫?
鈹?  鈹溾攢鈹€ apps/ftg-miniapp/          # FTG 灏忕▼搴忔枃妗?
鈹?  鈹溾攢鈹€ apps/game1-miniapp/        # Game1 灏忕▼搴忛噸鏋勬柟妗?
鈹?  鈹溾攢鈹€ servers/ftg-server/        # FTG 鍚庣鏂囨。
鈹?  鈹溾攢鈹€ servers/game1-server/      # Game1 鍚庣鏂囨。
鈹?  鈹溾攢鈹€ servers/tavern-server/     # Tavern 鍚庣鏂囨。
鈹?  鈹溾攢鈹€ dashboard/                 # 绠＄悊鍚庡彴鏂囨。
鈹?  鈹溾攢鈹€ deploy/                    # 閮ㄧ讲鏂囨。
鈹?  鈹斺攢鈹€ superpowers/               # Agent 宸ヤ綔鏂囨。
鈹溾攢鈹€ plan/                          # 椤圭洰瑙勫垝 (tasks/humans/ideas)
鈹溾攢鈹€ prisma/                        # 缁熶竴 Prisma Schema (14琛ㄥ悎骞?
鈹溾攢鈹€ tools/                         # 寮€鍙戝伐鍏?(Python 妗岄潰搴旂敤绛?
鈹?  鈹斺攢鈹€ supertask/                 # SuperTask AI 鑷富寮€鍙戠洃鐫ｇ郴缁?(PyQt6)
鈹溾攢鈹€ state/                         # 瓒呯骇浠诲姟鐘舵€佽窡韪?
鈹溾攢鈹€ deploy_commands.sh             # 閮ㄧ讲鍛戒护鑴氭湰
鈹溾攢鈹€ deploy_remote.bat              # 杩滅▼閮ㄧ讲鎵瑰鐞?
鈹溾攢鈹€ recover_and_deploy.sh          # 鎭㈠+閮ㄧ讲鑴氭湰
鈹斺攢鈹€ .sisyphus/                     # Sisyphus Agent 宸ヤ綔鐩綍
```

## 鏋舵瀯璇存槑
- **涓€绠″**: dashboard 绠＄悊鍚庡彴缁熶竴绠＄悊鎵€鏈夊皬绋嬪簭椤圭洰
- **褰撳墠椤圭洰**: FTG (鎴愮啛) + Game1 (寮€鍙戜腑) + AI-Tavern (寮€鍙戜腑)
- **鍏变韩鍩虹璁炬柦**: 閮ㄧ讲鑴氭湰銆丯ginx 閰嶇疆銆丳risma Schema銆佸煙鍚嶉厤缃鐢?
- **鐙珛閮ㄧ讲**: 鍚?servers 鐙珛瀹瑰櫒/Dockerfile锛岄€氳繃 Nginx 缁熶竴璺敱
- **涓汉椤圭洰**: 鎵€鏈夊皬绋嬪簭涓轰釜浜洪」鐩紝涓嶆帴鍙楀鍖?

## WHERE TO LOOK
| 浠诲姟 | 浣嶇疆 | 璇存槑 |
|------|------|------|
| 灏忕▼搴忛〉闈?缁勪欢 | `apps/ftg/client/src/` | Taro + React锛屽惈 pages/components/hooks |
| 鍚庣 API 璺敱 | `apps/ftg/server/src/routes/` | 16 涓矾鐢辨ā鍧?(鍚?theme-classes/theme-render)RESTful |
| 绠＄悊鍚庡彴鐣岄潰 | `dashboard/src/` | React + Vite + Ant Design锛屽惈 ThemeClasses |
| 鏁版嵁搴?Schema | `prisma/schema.prisma` | 缁熶竴 Prisma Schema (14琛? User/FoodRecord/Theme/AdminUser绛? |
| 閮ㄧ讲閰嶇疆 | `deploy/docker-compose.yml` | Docker 缁熶竴缂栨帓 (MySQL/Redis/AI/Server/Admin/Nginx) |
| 妯℃澘娓叉煋寮曟搸 | `apps/ftg/server/src/services/theme-render.service.ts` | Markup 妯℃澘 + CSS Class 娓叉煋 |
| Class 绯荤粺 | `apps/ftg/server/src/services/theme-class.service.ts` | CSS 灞炴€х櫧鍚嶅崟 + CRUD |
| AI 璇嗗埆鏈嶅姟 | `apps/ftg/server/src/services/` | PP-ShiTuV2 椋熺墿璇嗗埆 |
| MiniApp 鐘舵€佺鐞?| `apps/ftg/client/src/stores/` | Zustand 璁よ瘉鐘舵€?(authStore) |
| MiniApp HTTP 瀹㈡埛绔?| `apps/ftg/client/src/services/httpClient.ts` | 缁熶竴 HTTP 灏佽 (JWT 鑷姩鎼哄甫) |
| MiniApp 璁よ瘉鏈嶅姟 | `apps/ftg/client/src/services/authService.ts` | 寰俊鐧诲綍 + Token 楠岃瘉灏佽 |
| MiniApp 鑷畾涔?tabBar | `apps/ftg/client/src/custom-tab-bar/` | 鑷畾涔夊簳閮ㄦ爮 (鏇夸唬鍘熺敓 tabBar) |
| Dashboard 涓婚 | `dashboard/src/components/ThemeToggle/` | 鏆楄壊妯″紡鍒囨崲 |
| Dashboard 楠ㄦ灦灞?| `dashboard/src/components/PageSkeleton/` | 缁熶竴鍔犺浇鎬侊紙4绉嶇被鍨嬶級|
| Dashboard PageHeader | `dashboard/src/components/PageHeader/` | 閫氱敤椤甸潰澶撮儴缁勪欢 |
| MiniApp 缁勪欢搴?| `apps/ftg/client/src/components/` | AppButton/AppCard/SectionHeader/EmptyState/Icon/Skeleton |
| MiniApp 鍥捐〃 | `apps/ftg/client/src/components/charts/` | LineChart/PieChart/BarChart/CalendarHeatmap |
| CI/CD | `apps/ftg/server/.github/workflows/` | GitHub Actions (lint/type-check/build/docker) |
| CI/CD (Game1) | `apps/game1/server/.github/workflows/` | GitHub Actions (Node 20 + MySQL 鏈嶅姟) |
| Game1 鍚庣 API | `apps/game1/server/src/routes/` | 10 璺敱妯″潡 (auth/players/save/pvp/achievements/config/social/admin) |
| Tavern 鍚庣 API | `apps/tavern/server/src/routes/` | 10 璺敱妯″潡 (auth/characters/chat/personas/keys/market/admin/builtin/export) |
| Game1 灏忕▼搴忓紩鎿?| `apps/game1/client/src/engine/` | 绾?TS 娓告垙閫昏緫寮曟搸 (18 瀛愭ā鍧楋細travel/combat/team/inventory/skill/card/event/achievement/prestige/idle/pet/map 绛? |
| Game1 娓告垙鏁版嵁閰嶇疆 | `apps/game1/client/src/config/` | 13 涓?JSON 閰嶇疆鏂囦欢椹卞姩鎵€鏈夋父鎴忔暟鎹?|
| Tavern 灏忕▼搴?| `apps/tavern/client/AGENTS.md` | Taro 4.x 瑙掕壊鑱婂ぉ灏忕▼搴?(AI-Tavern) |
| Tavern 灏忕▼搴忔簮鐮?| `apps/tavern/client/src/` | 8 椤甸潰 + 4 缁勪欢 + services/stores/hooks |
| Tavern SSE Hook | `apps/tavern/client/src/hooks/useSSE.ts` | SSE 娴佸紡鑱婂ぉ EventSource 灏佽锛堟柇绾块噸杩?+ 娑堟伅杩藉姞锛?|
| Dashboard 楠ㄦ灦灞?| `dashboard/src/components/PageSkeleton/` | 鈿狅笍 绾唴鑱旀牱寮忥紝寰呰縼绉讳负 CSS Modules |
| Dashboard 涓婚鍒囨崲 | `dashboard/src/components/ThemeToggle/` | 鈿狅笍 绾唴鑱旀牱寮?|
| 鍩熷悕鍏变韩閰嶇疆 | `domain.config.js` | 鎵€鏈?Taro 椤圭洰鐨?API_BASE 缂栬瘧鏃堕厤缃?|
| 椤圭洰鏂囨。 | `docs/` | 鎸夐」鐩垎绫?(ftg-miniapp/ftg-server/game1-server/tavern-server/dashboard/deploy) |
| Dashboard Game1 鏈嶅姟 | `dashboard/src/services/game1/` | Game1 杩愯惀/閰嶇疆/鎴愬氨/PVP API |
| Dashboard Tavern 鏈嶅姟 | `dashboard/src/services/tavern/` | Tavern 瑙掕壊/瀹℃牳/缁熻 API |
| Dashboard FTG 鏈嶅姟 | `dashboard/src/services/ftg/` | FTG 鐢ㄦ埛/涓婚/Class/鎴愬氨 API |
| SuperTask 妗岄潰宸ュ叿 | `tools/supertask/` | Python PyQt6 GUI锛孉I 寮€鍙戠洃鐫ｇ郴缁?|

## CODE MAP
| 绗﹀彿 | 绫诲瀷 | 浣嶇疆 | 瑙掕壊 |
|------|------|------|------|
| `App` (MiniApp) | 鍏ュ彛 | `apps/ftg/client/src/app.ts` | 灏忕▼搴忓簲鐢ㄥ叆鍙?|
| `App` (Server) | 鍏ュ彛 | `apps/ftg/server/src/app.ts` | FTG 鍚庣 Express 鏈嶅姟 |
| `App` (Game1 Server) | 鍏ュ彛 | `apps/game1/server/src/app.ts` | Game1 鍚庣 Express 鏈嶅姟 |
| `App` (Tavern Server) | 鍏ュ彛 | `apps/tavern/server/src/app.ts` | Tavern 鍚庣 Express 搴旂敤瀹氫箟 |
| `index` (Tavern Server) | 鍏ュ彛 | `apps/tavern/server/src/index.ts` | Tavern 鏈嶅姟鍣ㄥ惎鍔ㄧ洃鍚?|
| `App` (Game1 MiniApp) | 鍏ュ彛 | `apps/game1/client/src/app.tsx` | Game1 灏忕▼搴忓叆鍙?|
| `main` (Dashboard) | 鍏ュ彛 | `dashboard/src/main.tsx` | 绠＄悊鍚庡彴 SPA 鍏ュ彛 |
| `server` (Dashboard API) | 鍏ュ彛 | `dashboard/server/server.ts` | Admin 鐙珛 API (3001绔彛) |
| `ProtectedRoute` (Dashboard) | 缁勪欢 | `dashboard/src/components/ProtectedRoute/` | 璺敱瀹堝崼锛堢櫥褰?鏉冮檺鍙屾鏌ワ級 |
| `authStore` (Dashboard) | 鐘舵€?| `dashboard/src/stores/authStore.ts` | Zustand 璁よ瘉鐘舵€佺鐞?|
| `admin-auth` (Dashboard API) | 涓棿浠?| `dashboard/server/admin-auth.ts` | JWT 璁よ瘉 + RBAC 鏉冮檺涓棿浠?|
| `token` (Dashboard) | 宸ュ叿 | `dashboard/src/utils/token.ts` | Token 鎸佷箙鍖栵紙localStorage/sessionStorage锛?|
| `useAuthStore` (FTG) | 鐘舵€?| `apps/ftg/client/src/stores/authStore.ts` | Zustand 璁よ瘉鐘舵€?(token/user/鍒濆鍖? |
| `httpClient` (FTG) | 鏈嶅姟 | `apps/ftg/client/src/services/httpClient.ts` | 缁熶竴 HTTP 瀹㈡埛绔?(JWT) |
| `authService` (FTG) | 鏈嶅姟 | `apps/ftg/client/src/services/authService.ts` | 寰俊鐧诲綍/鑷姩娉ㄥ唽/Token 楠岃瘉 |
| `CustomTabBar` (FTG) | 缁勪欢 | `apps/ftg/client/src/custom-tab-bar/` | 鑷畾涔夊簳閮ㄦ爮 (浜嬩欢椹卞姩楂樹寒) |
| `App` (Tavern MiniApp) | 鍏ュ彛 | `apps/tavern/client/src/app.ts` | Tavern 灏忕▼搴忓叆鍙?|
| `useSSE` (Tavern) | Hook | `apps/tavern/client/src/hooks/useSSE.ts` | SSE 娴佸紡鑱婂ぉ EventSource 灏佽 |
| `GameEngine` (Game1) | 寮曟搸 | `apps/game1/client/src/engine/index.ts` | 绾?TS 娓告垙閫昏緫寮曟搸鎬诲叆鍙?|

## CONVENTIONS
- **TypeScript strict** 鍏ㄩ」鐩己鍒?(`no-explicit-any: error`)锛屼絾鍚勯」鐩弗鏍煎害涓嶅悓
  - Dashboard 鏈€涓ユ牸锛歚noUnusedLocals/Parameters: true`, `verbatimModuleSyntax: true`
  - MiniApp 閫氱敤锛氶澶栧惎鐢?`noUncheckedIndexedAccess: true`锛圫erver 鏈惎鐢級
  - tavern-server 涓?`no-explicit-any: off`
- **2 绌烘牸缂╄繘**锛孡F 鎹㈣锛孶TF-8
- **璺緞鍒悕** `@/*` 鈫?鍚勯」鐩?`src/`锛孧iniApp 鍙︽湁 `@utils/@components/@services` 绛夊埆鍚?
- **Prettier**: ftg-miniapp/ftg-server/game1-server 缁熶竴 `printWidth:100`, `singleQuote:true`, `trailingComma:all`锛泃avern-server/dashboard 鏃犵嫭绔嬮厤缃?
- **ESLint**: ftg-miniapp 鍚?React Hooks 瑙勫垯 (`rules-of-hooks: error`)锛孲erver 閫氱敤 `no-non-null-assertion: error`
- **Zod 鏍￠獙**: game1-server 鍜?tavern-server 鍦ㄨ矾鐢卞眰浣跨敤 Zod request validation
- **Prisma**: 缁熶竴 ORM锛屼絾鐗堟湰鍒嗗寲 鈥?ftg-server/dashboard v6.19, game1-server v5.22, tavern-server v5.10
- **鏃?monorepo workspace** 鈥?鍚勯」鐩嫭绔?`npm install`

## ANTI-PATTERNS (鏈」鐩?
- 鉂?**闆舵祴璇曡鐩?* 鈥?鍏ㄩ」鐩棤娴嬭瘯妗嗘灦/鏂囦欢/鑴氭湰锛坓ame1-miniapp 鏈?vitest.config 浣嗘棤娴嬭瘯鏂囦欢锛?
- 鉂?`textGenerate` 浜戝嚱鏁颁负鍗犱綅瀹炵幇锛堟湭鎺ュ叆娣峰厓 AI锛?
- 鉂?`getUserStats` 浜戝嚱鏁拌繑鍥炵‖缂栫爜闆跺€?
- 鉂?瀛樺湪鏃犲繀瑕佺殑 `eslint-disable` 娉ㄩ噴
- 鉂?`cloud-functions/` 鏍圭洰褰曚负绌猴紝浜戝嚱鏁板疄闄呭湪 MiniApp 瀛愮洰褰曚笅
- 鉂?Dashboard 鍐呰仈鏍峰紡杩囧 鈥?宸茶縼绉?Login/Dashboard/Layout 涓?CSS Modules锛屽叾浣欓〉闈㈠緟杩佺Щ
- 鉂?MiniApp 璺ㄤ换鍔″苟琛屾墽琛屽彲鑳戒骇鐢熷鍏ュ啿绐?鈥?娉ㄦ剰 chart types/utils 闇€浠?`@/components/charts` 瀵煎叆
- 鉂?**绌?catch 鍧?* 鈥?apps/ftg/client/src/app.ts 鏈?4 涓┖ catch 鍧楋紙line 55/94/117/131锛?
- 鉂?**Mock 闄嶇骇浠ｇ爜** 鈥?澶氬杩愯鏃堕檷绾э紙recognition.service mockRecognize, textgen.service generateFallback, authStore mockAuth锛夛紝鐢熶骇鐜闇€娓呯悊
- 鉂?**绫诲瀷鏂█** 鈥?apps/game1/client/src/app.tsx 澶氬 `as` 鏂█锛宒ashboard ThemeClasses `as Record<string, unknown>`
- 鉂?**鍗犱綅娉ㄩ噴** 鈥?apps/tavern/server/src/routes/chat.ts line 149 `// Clean up if needed` 鏃犲疄闄呴€昏緫
- 鉂?**閿欒鏃ュ織缂哄け** 鈥?apps/game1/server/src/routes/players.ts catch 鍧椾粎 `sendError` 鏃犳棩蹇?
- 鉂?**纭紪鐮佸瘑閽?* 鈥?`.sisyphus/aliyun-mysql-clear.js` 鍚槑鏂囬樋閲屼簯 AK ID/SECRET锛岄渶杩佺Щ鍒扮幆澧冨彉閲?
- 鉂?**缂哄け ESLint 閰嶇疆** 鈥?tavern-server 鍜?dashboard 鏃?ESLint 閰嶇疆锛堝叾浠栭」鐩潎鏈夛級
- 鉂?**console.log 娈嬬暀** 鈥?game1/client 澶氫釜鏂囦欢锛坅pp.tsx銆丄chievementEngine銆丼aveManager銆丳endingEventEngine锛変娇鐢?console.log 鑰岄潪鏃ュ織妗嗘灦
- 鉂?**result/index.tsx 鍋囦繚瀛?* 鈥?apps/ftg/client/src/pages/result/index.tsx line 108 TODO 鏈疄鐜帮紝Toast "淇濆瓨鎴愬姛" 鏃舵棤瀹為檯 API 璋冪敤
- 鉂?**`as any` 鏁ｅ竷** 鈥?鍏ㄤ粨搴撶害 10 澶?`as any` 绫诲瀷鏂█锛坓allery/DropEngine/chat/user.service/export.service 绛夛級
- 鉂?**Prisma 鐗堟湰鍒嗗寲** 鈥?ftg-server/dashboard v6.19銆乬ame1-server v5.22銆乼avern-server v5.10
- 鉂?**tavern-server 鏃犺矾寰勫埆鍚?* 鈥?apps/tavern/server 鏈厤缃?`@/*` 璺緞鍒悕锛屼娇鐢ㄧ浉瀵硅矾寰?import
- 鉂?**tavern-server 鏃犺秴鏃堕厤缃?* 鈥?apps/tavern/server 鏈缃?keepAliveTimeout/headersTimeout/timeout

## COMMANDS
```bash
# MiniApp (Taro) 鈥?cd apps/ftg/client
npm run dev:weapp        # 寮€鍙戞ā寮?(watch)
npm run build:weapp      # 鐢熶骇鏋勫缓
npm run type-check       # TypeScript 绫诲瀷妫€鏌?
npm run dev:h5           # H5 寮€鍙戞ā寮?(watch)
npm run build:h5         # H5 鐢熶骇鏋勫缓

# Game1 MiniApp (Taro) 鈥?cd apps/game1/client
npm run dev:weapp        # 寮€鍙戞ā寮?(watch)
npm run build:weapp      # 鐢熶骇鏋勫缓
npm run type-check       # TypeScript 绫诲瀷妫€鏌?
npm run dev:h5           # H5 寮€鍙戞ā寮?(watch)
npm run build:h5         # H5 鐢熶骇鏋勫缓

# Tavern MiniApp (Taro) 鈥?cd apps/tavern/client
npm run dev:weapp        # 寮€鍙戞ā寮?(watch)
npm run build:weapp      # 鐢熶骇鏋勫缓
npm run type-check       # TypeScript 绫诲瀷妫€鏌?
npm run lint             # ESLint 浠ｇ爜妫€鏌?
npm run format           # Prettier 鏍煎紡鍖?
npm run generate-icons   # 鐢熸垚 tabBar 鍥炬爣
npm run dev:h5           # H5 寮€鍙戞ā寮?(watch)
npm run build:h5         # H5 鐢熶骇鏋勫缓

# Server (Express) 鈥?cd apps/ftg/server
npm run dev              # tsx watch 寮€鍙?(绔彛 env.PORT)
npm run build            # tsc 缂栬瘧
npm run lint             # ESLint
npm run db:migrate       # Prisma 鏁版嵁搴撹縼绉?

# Game1 Server (Express) 鈥?cd apps/game1/server
npm run dev              # tsx watch 寮€鍙?
npm run build            # tsc 缂栬瘧
npm run type-check       # TypeScript 绫诲瀷妫€鏌?
npm run lint             # ESLint
npm run db:migrate       # Prisma 鏁版嵁搴撹縼绉?

# Tavern Server (Express) 鈥?cd apps/tavern/server
npm run dev              # tsx watch 寮€鍙?
npm run build            # tsc 缂栬瘧
npm run type-check       # TypeScript 绫诲瀷妫€鏌?
npm run start            # 鐢熶骇鍚姩
npm run lint             # ESLint 妫€鏌?
npm run db:generate      # Prisma Client 鐢熸垚
npm run db:migrate       # 鏁版嵁搴撹縼绉?
npm run db:seed          # 绉嶅瓙鏁版嵁锛堝唴缃鑹诧級

# Dashboard (Vite) 鈥?cd dashboard
npm run dev              # Vite 寮€鍙?(5173绔彛)
npm run build            # 鐢熶骇鏋勫缓
npm run type-check       # TypeScript 绫诲瀷妫€鏌?
npm run db:generate      # Prisma Client 鐢熸垚

# 閮ㄧ讲
bash deploy/scripts/deploy.sh   # 涓€閿瀯寤?閮ㄧ讲鍒?ECS
bash deploy/scripts/verify.sh   # 閮ㄧ讲鍚庡仴搴锋鏌?
```

## NOTES
- **Dashboard 鍙岃繘绋?*: Vite 鍓嶇(5173) + Express Admin API(3001) 鐙珛杩愯
- **Dashboard 鏆楄壊妯″紡**: 閫氳繃 `themeStore` (Zustand) 鎺у埗锛宭ocalStorage 鎸佷箙鍖栵紝ConfigProvider darkAlgorithm
- **Dashboard UI 缁勪欢浣撶郴**: PageHeader (閫氱敤澶撮儴) + PageSkeleton (4绉嶉鏋跺睆) + 鍝嶅簲寮忓搴﹀父閲?
- **MiniApp 鍏变韩缁勪欢搴?*: AppButton (4鍙樹綋) + AppCard + SectionHeader + EmptyState + Icon (18涓猄VG) + Skeleton (4绫诲瀷)
- **MiniApp 鍥捐〃**: 鍘熺敓 Canvas 2D 鍥捐〃缁勪欢 (LineChart/PieChart/BarChart/CalendarHeatmap)
- **MiniApp CSS 鍙橀噺绯荤粺**: `app.scss` 瀹氫箟浜嗗畬鏁寸殑棰滆壊/瀛椾綋/闂磋窛/闃村奖/z-index 鍙橀噺
- **澶氶」鐩墿灞?*: 鏂板灏忕▼搴忛」鐩椂锛屽湪 `apps/` 涓嬪垱寤?`椤圭洰鍚?client` + `椤圭洰鍚?server`锛宒ashboard 鑷姩绠＄悊
- **MiniApp 璁よ瘉娴佺▼**: wx.login() 鈫?POST /auth/login 鈫?JWT token 鈫?鏈湴鎸佷箙鍖?鈫?鑷姩鏍￠獙(initialize)
- **MiniApp 鑷畾涔?tabBar**: CustomTabBar 缁勪欢浣跨敤 Taro eventCenter 鐩戝惉 tabChange 浜嬩欢椹卞姩楂樹寒锛屾浛浠ｅ師鐢?tabBar
- **MiniApp HTTP 瀹㈡埛绔?*: HttpClient 绫诲皝瑁?Taro.request锛屾敮鎸佽秴鏃舵娴嬪拰缃戠粶杩炴帴閿欒涓枃鎻愮ず
- **MiniApp 闄嶇骇妯″紡**: 寮€鍙戞椂鍙€氳繃 `TARO_APP_MOCK_AUTH=true` 鍚敤 mock 鐧诲綍缁曡繃寰俊鎺堟潈
- **API 浠ｇ悊**: Dashboard `/api` 鍦ㄥ紑鍙戞椂浠ｇ悊鍒?Server `localhost:3000`
- **鐢熶骇鏋舵瀯**: Nginx(80/443) 鈫?Dashboard SPA / FTG API(/api/ftl/) / Game1 API(/api/v1/game1/) / Tavern API(/api/tavern/) / Admin API(/api/v1/admin/) / 璇嗗埆(/recognition/*)
- **璇嗗埆鏈嶅姟**: PP-ShiTuV2 鐙珛瀹瑰櫒锛岄€氳繃 HTTP API 璋冪敤锛屽紑鍙戞ā寮忓彲鐢?`RECOGNITION_MOCK_MODE=true` 闄嶇骇
- **Dashboard Auth 鍒濆鍖?*: `authStore` 鍒濆鍖栨椂 `isAuthenticated` 鍚屾璁句负 `!!getToken()`锛宍user` 涓?`null`銆俙restoreSession()` 寮傛璋冪敤 `/admin/me` 鑾峰彇鐢ㄦ埛淇℃伅銆俙ProtectedRoute` 璁㈤槄 `initialized` 鏍囧織锛屼粎鍦?`restoreSession` 瀹屾垚鍚庢墠杩涜鏉冮檺鍒ゆ柇锛岄伩鍏嶇珵鎬佹潯浠跺鑷?403銆?
- **Game1 CI 瑙﹀彂鏉′欢**: `.github/workflows/ci.yml` 浣跨敤 `paths` 杩囨护锛屼粎 `apps/game1/server/**` 鍙樺寲鏃惰Е鍙戯紝鍚?MySQL 8.0 鏈嶅姟瀹瑰櫒
- **FTG Server 閮ㄧ讲娴佹按绾?*: `deploy.yml` 鐨?SSH 閮ㄧ讲姝ラ琚敞閲婏紝闇€鎵嬪姩鍚敤
- **Dashboard 鍜?MiniApp 鏃犵嫭绔?CI** 鈥?鍙湁 ftg-server 鍜?game1-server 鏈?GitHub Actions 閰嶇疆