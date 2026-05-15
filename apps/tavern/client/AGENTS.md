# apps/tavern/client 鈥?寰俊灏忕▼搴?+ H5

## OVERVIEW
Taro 4.x 璺ㄥ钩鍙板簲鐢?(React 18 + Zustand 5 + TypeScript + Sass)锛孉I-Tavern 瑙掕壊鑱婂ぉ搴旂敤銆傛敮鎸?WeChat 灏忕▼搴忓拰 H5 娴忚鍣ㄥ弻骞冲彴銆傝鑹插競鍦烘祻瑙堛€丼SE 娴佸紡鑱婂ぉ銆佽鑹插崱鍒涘缓涓庣鐞嗐€佽嚜瀹氫箟浜鸿銆?

## STRUCTURE
```
apps/tavern/client/
鈹溾攢鈹€ src/
鈹?  鈹溾攢鈹€ app.ts           # 搴旂敤鍏ュ彛 (璁よ瘉鍒濆鍖?閰嶉鍒锋柊)
鈹?  鈹溾攢鈹€ app.config.ts    # 灏忕▼搴忛厤缃?(3 tabBar 椤甸潰)
鈹?  鈹溾攢鈹€ app.scss         # 鍏ㄥ眬鏍峰紡 & CSS 鍙橀噺 (鏆楄壊涓婚)
鈹?  鈹溾攢鈹€ pages/           # 椤甸潰缁勪欢
鈹?  鈹?  鈹溾攢鈹€ market/      # 瑙掕壊甯傚満 (娴忚/鎼滅储/鏍囩/杞挱)
鈹?  鈹?  鈹溾攢鈹€ chat/        # 鑱婂ぉ椤甸潰 (SSE 娴佸紡/浼氳瘽绠＄悊)
鈹?  鈹?  鈹溾攢鈹€ character/   # 瑙掕壊璇︽儏
鈹?  鈹?  鈹?  鈹斺攢鈹€ detail/  # 瑙掕壊璇︽儏椤?
鈹?  鈹?  鈹溾攢鈹€ creator/     # 瑙掕壊鍗＄紪杈?鍙戝竷
鈹?  鈹?  鈹溾攢鈹€ profile/     # 涓汉涓婚〉
鈹?  鈹?  鈹溾攢鈹€ persona/     # 鑷畾涔変汉璁剧鐞?
鈹?  鈹?  鈹斺攢鈹€ settings/    # 璁剧疆 (API Key/鍋忓ソ)
鈹?  鈹溾攢鈹€ components/      # 鍏变韩缁勪欢
鈹?  鈹?  鈹溾攢鈹€ CharacterCard/ # 瑙掕壊鍗＄墖
鈹?  鈹?  鈹溾攢鈹€ ChatBubble/  # 鑱婂ぉ姘旀场
鈹?  鈹?  鈹溾攢鈹€ ModelSelector/ # 妯″瀷閫夋嫨鍣?
鈹?  鈹?  鈹斺攢鈹€ Skeleton/    # 楠ㄦ灦灞?
鈹?  鈹溾攢鈹€ services/        # API 灏佽
鈹?  鈹?  鈹溾攢鈹€ httpClient.ts  # 缁熶竴 HTTP 瀹㈡埛绔?(JWT 鑷姩鎼哄甫/401 鎷︽埅)
鈹?  鈹?  鈹溾攢鈹€ characterService.ts # 瑙掕壊鍗?CRUD
鈹?  鈹?  鈹溾攢鈹€ marketService.ts    # 瑙掕壊甯傚満 API
鈹?  鈹?  鈹斺攢鈹€ personaService.ts   # 浜鸿 API
鈹?  鈹溾攢鈹€ stores/          # Zustand 鐘舵€佺鐞?
鈹?  鈹?  鈹溾攢鈹€ authStore.ts      # 璁よ瘉鐘舵€?(寰俊鐧诲綍/JWT/姣忔棩閰嶉)
鈹?  鈹?  鈹溾攢鈹€ chatStore.ts      # 鑱婂ぉ鐘舵€?(浼氳瘽/娑堟伅/娴佸紡/妯″瀷閫夋嫨)
鈹?  鈹?  鈹斺攢鈹€ characterStore.ts # 瑙掕壊鍗＄姸鎬?
鈹?  鈹溾攢鈹€ hooks/           # 鑷畾涔?Hooks
鈹?  鈹?  鈹斺攢鈹€ useSSE.ts    # SSE 娴佸紡鑱婂ぉ Hook
鈹?  鈹溾攢鈹€ types/           # TypeScript 绫诲瀷瀹氫箟
鈹?  鈹?  鈹溾攢鈹€ character.ts # 瑙掕壊鍗＄被鍨?
鈹?  鈹?  鈹溾攢鈹€ chat.ts      # 鑱婂ぉ绫诲瀷 (浼氳瘽/娑堟伅)
鈹?  鈹?  鈹斺攢鈹€ common.ts    # 閫氱敤绫诲瀷
鈹?  鈹溾攢鈹€ utils/           # 宸ュ叿鍑芥暟
鈹?  鈹斺攢鈹€ constants/       # 甯搁噺瀹氫箟
鈹斺攢鈹€ package.json         # Taro 4.0.13 + React 18 + Zustand 5
```

## WHERE TO LOOK
| 鍏虫敞鐐?| 浣嶇疆 | 璇存槑 |
|--------|------|------|
| 瑙掕壊甯傚満 | `src/pages/market/` + `src/services/marketService.ts` | 瑙掕壊鍗℃祻瑙?鎼滅储/鏍囩/杞挱 |
| 鑱婂ぉ椤甸潰 | `src/pages/chat/` + `src/hooks/useSSE.ts` | SSE 娴佸紡鑱婂ぉ/浼氳瘽绠＄悊 |
| 瑙掕壊鍒涘缓 | `src/pages/creator/` + `src/services/characterService.ts` | 瑙掕壊鍗＄紪杈?鍙戝竷 |
| 瑙掕壊璇︽儏 | `src/pages/character/` + `src/pages/character/detail/` | 瑙掕壊璇︽儏/鏀惰棌 |
| 涓汉璁剧疆 | `src/pages/profile/` + `src/pages/settings/` | 涓汉淇℃伅/API Key/鍋忓ソ |
| 浜鸿绠＄悊 | `src/pages/persona/` | 鑷畾涔変汉璁?|
| 璁よ瘉鐘舵€?| `src/stores/authStore.ts` | 寰俊鐧诲綍/JWT/姣忔棩閰嶉 |
| 鑱婂ぉ鐘舵€?| `src/stores/chatStore.ts` | 浼氳瘽/娑堟伅/娴佸紡 |
| 瑙掕壊鐘舵€?| `src/stores/characterStore.ts` | 瑙掕壊鍗＄紦瀛?鏀惰棌 |
| HTTP 瀹㈡埛绔?| `src/services/httpClient.ts` | JWT 鑷姩鎼哄甫/401 鎷︽埅 |
| 绫诲瀷瀹氫箟 | `src/types/character.ts` + `chat.ts` | 瑙掕壊鍗?鑱婂ぉ绫诲瀷 |
| 搴旂敤閰嶇疆 | `src/app.config.ts` | 灏忕▼搴?H5 鍙屽钩鍙伴厤缃?|
| CSS 鍙橀噺 | `src/app.scss` | 鏆楄壊涓婚/绱壊涓昏壊 #8B5CF6 |
| SSE 娴佸紡 | `src/hooks/useSSE.ts` | EventSource 灏佽/鏂嚎閲嶈繛 |

## CONVENTIONS
- Taro 4.x API (4.0.13)锛屾瀯寤哄懡浠?`taro build --type weapp` / `taro build --type h5`
- React 18 + TypeScript strict 妯″紡
- Zustand 5 鐘舵€佺鐞?
- Sass 妯″潡鍖栨牱寮?(`.module.scss`)
- 璺緞鍒悕 `@/*`, `@services/*`, `@stores/*`, `@types/*`, `@hooks/*`, `@components/*`
- Prettier: printWidth 100, singleQuote, trailingComma all
- 2 绌烘牸缂╄繘锛孡F 鎹㈣锛孶TF-8

## COMMANDS
```bash
npm run dev:weapp        # 寰俊灏忕▼搴忓紑鍙戞ā寮?(watch 鐑噸杞?
npm run build:weapp      # 寰俊灏忕▼搴忕敓浜ф瀯寤?
npm run dev:h5           # H5 寮€鍙戞ā寮?(watch 鐑噸杞?
npm run build:h5         # H5 鏋勫缓
npm run build:h5:prod    # H5 鐢熶骇鏋勫缓
npm run type-check       # TypeScript 绫诲瀷妫€鏌?
npm run lint             # ESLint 浠ｇ爜妫€鏌?
npm run format           # Prettier 鏍煎紡鍖?
npm run generate-icons   # 鐢熸垚 tabBar 鍥炬爣
```

## NOTES
- **Taro 4.0.13** + React 18 + Zustand 5
- **鍙屽钩鍙?*: 寰俊灏忕▼搴?(weapp) + H5 娴忚鍣?
- **H5 璺敱**: hash 妯″紡锛岄厤缃?8 涓嚜瀹氫箟璺敱璺緞
- **婧愮洰褰曞叡鐢ㄤ簬鍙屽钩鍙?*: `src/` 鍚屾椂鎻愪緵 weapp 鍜?h5 鏋勫缓
- **API_BASE_URL 缂栬瘧鏃舵敞鍏?*: 閫氳繃鏍圭洰褰?`domain.config.js` 閰嶇疆
- **SSE 娴佸紡鑱婂ぉ**: `useSSE` hook 灏佽 EventSource锛屾敮鎸佹柇绾块噸杩炲拰娴佸紡娑堟伅杩藉姞
- **璁よ瘉娴佺▼**: wx.login() 鈫?POST /auth/login 鈫?JWT 鈫?Taro Storage 鎸佷箙鍖?鈫?restoreSession 鑷姩鎭㈠
- **姣忔棩閰嶉**: authStore 绠＄悊姣忔棩娑堟伅閰嶉锛屽垏鍓嶅彴鏃惰嚜鍔ㄥ埛鏂?
- **HTTP 瀹㈡埛绔?*: HttpClient 绫诲皝瑁?Taro.request锛岃嚜鍔ㄦ惡甯?JWT token锛?01 鍝嶅簲鏃惰Е鍙戠櫥鍑?
- **瑙掕壊甯傚満**: 鏀寔鏍囩绛涢€夈€佸垎椤靛姞杞姐€佽疆鎾帹鑽?
- **澶氭ā鍨嬫敮鎸?*: 閫氳繃 ModelSelector 缁勪欢鍒囨崲 AI 妯″瀷 (閫氫箟鍗冮棶绛?
- **authStore**: 浣跨敤 `@tarojs/taro` Storage API锛屽弻骞冲彴鍏煎
- **H5 鏋勫缓**: 鍦?`apps/tavern/` 涓嬪畨瑁呬緷璧栧悗锛岃繍琛?`npm run dev:h5` 鍗冲彲
