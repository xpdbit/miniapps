# 馃崝 涓汉灏忕▼搴忓伐鍧?

鍩轰簬 **Taro 4.x + React 18 + TypeScript** 鐨勪釜浜哄皬绋嬪簭闆嗗悎锛岄€氳繃缁熶竴绠＄悊鍚庡彴闆嗕腑绠＄悊澶氫釜椤圭洰銆?

褰撳墠瀛愰」鐩細**椋熺墿涓婚鐢熸垚鍣?(Food Theme Generator)** 鈥?AI 璇嗗埆椋熺墿骞剁敓鎴愪釜鎬у寲涓婚鍥剧墖锛?*AI-Tavern** 鈥?瑙掕壊鑱婂ぉ搴旂敤銆?

## 鎶€鏈爤

| 灞傜骇 | 鎶€鏈?|
|------|------|
| **鍓嶇妗嗘灦** | Taro 4.x + React 18 + TypeScript |
| **鍚庣 API** | Express + TypeScript + Prisma ORM |
| **绠＄悊鍚庡彴** | React 19 + Vite + Ant Design |
| **鏁版嵁搴?* | MySQL 8.0 + Redis 7 |
| **AI 璇嗗埆 (FTG)** | PP-ShiTuV2 (PaddleClas) 鐙珛瀹瑰櫒 |
| **AI 鏂囨湰 (Tavern)** | 閫氫箟鍗冮棶 (DashScope) + 澶氭ā鍨?|
| **涓婚娓叉煋 (FTG)** | Markup 妯℃澘 + CSS Class 绯荤粺 |
| **閮ㄧ讲** | Docker Compose + Nginx (ECS) |

## 鏍稿績鍔熻兘

| 椤圭洰 | 鍔熻兘 | 璇存槑 |
|------|------|------|
| **FTG** | 椋熺墿璇嗗埆 | PP-ShiTuV2 AI 璇嗗埆 鈫?杩斿洖椋熺墿鍚嶇О銆佺被鍒€佺儹閲?|
| **FTG** | 涓婚妯℃澘 | Markup 妯℃澘 + CSS Class 绯荤粺娓叉煋椋熺墿鍗＄墖 |
| **FTG** | 浣嶇疆鎵撳崱 | 璁板綍缇庨鎵撳崱浣嶇疆锛孏PS + IP 瀹氫綅 |
| **FTG** | 鎴愬氨绯荤粺 | 鍩轰簬鎵撳崱娆℃暟銆佽褰曟暟绛夋潯浠剁殑鎴愬氨瑙ｉ攣 |
| **FTG** | 缁熻闈㈡澘 | 楗鏁版嵁鍙鍖栥€佹墦鍗＄粺璁?|
| **Tavern** | 瑙掕壊甯傚満 | 瑙掕壊鍗℃祻瑙?鎼滅储/鏍囩/杞挱 |
| **Tavern** | SSE 娴佸紡鑱婂ぉ | EventSource 娴佸紡瀵硅瘽锛屽妯″瀷鍒囨崲 |
| **Tavern** | 瑙掕壊鍒涘缓 | 鑷畾涔夎鑹插崱缂栬緫涓庡彂甯?|
| **Tavern** | 浜鸿绠＄悊 | 鑷畾涔変汉璁鹃厤缃?|
| **閫氱敤** | 绠＄悊鍚庡彴 | 缁熶竴绠＄悊鎵€鏈夐」鐩殑鐢ㄦ埛/鏁版嵁/閰嶇疆 |
| **閫氱敤** | 閮ㄧ讲 | Docker Compose + Nginx 涓€閿儴缃插埌 ECS |

## 椤圭洰缁撴瀯

```
.miniapps/
鈹溾攢鈹€ apps/
鈹?  鈹溾攢鈹€ ftg/              # FTG 椤圭洰
鈹?  鈹?  鈹溾攢鈹€ client/    # Taro 4.x 璺ㄥ钩鍙板鎴风
鈹?  鈹?  鈹斺攢鈹€ server/      # Express 鍚庣 API
鈹?  鈹溾攢鈹€ game1/            # Game1 椤圭洰
鈹?  鈹?  鈹溾攢鈹€ client/    # Taro 璺ㄥ钩鍙板鎴风
鈹?  鈹?  鈹斺攢鈹€ server/      # Express 鍚庣 API
鈹?  鈹斺攢鈹€ tavern/           # AI-Tavern 椤圭洰
鈹?      鈹溾攢鈹€ client/    # Taro 4.x 璺ㄥ钩鍙板鎴风
鈹?      鈹斺攢鈹€ server/      # Express 鍚庣 API
鈹溾攢鈹€ dashboard/            # 缁熶竴绠＄悊鍚庡彴
鈹溾攢鈹€ deploy/               # 閮ㄧ讲閰嶇疆 (Docker/Nginx)
鈹溾攢鈹€ docs/                 # 椤圭洰鏂囨。
鈹溾攢鈹€ plan/                 # 瑙勫垝鏂囨。
鈹溾攢鈹€ prisma/               # 缁熶竴 Prisma Schema
鈹斺攢鈹€ tools/                # 寮€鍙戝伐鍏?
```

## 蹇€熷紑濮?

### 鍚庣

```bash
cd apps/ftg/server
npm install
npm run dev
```

### 绠＄悊鍚庡彴

```bash
cd dashboard
npm install
npm run dev
```

### 灏忕▼搴?

```bash
# FTG 椋熺墿涓婚鐢熸垚鍣?(WeChat)
cd apps/ftg/client
npm install
npm run dev:weapp

# FTG H5 寮€鍙?
cd apps/ftg/client
npm run dev:h5

# AI-Tavern 瑙掕壊鑱婂ぉ (WeChat)
cd apps/tavern/client
npm install
npm run dev:weapp

# AI-Tavern H5 寮€鍙?
cd apps/tavern/client
npm run dev:h5
```

## 鏂囨。

璇﹁ [docs/README.md](./docs/README.md) 鑾峰彇瀹屾暣鏂囨。瀵艰埅銆?
