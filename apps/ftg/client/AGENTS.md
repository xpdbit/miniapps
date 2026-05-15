# apps/ftg/client 鈥?寰俊灏忕▼搴?(Taro)

## OVERVIEW
Taro 4.x 寰俊灏忕▼搴?+ H5 (React 18 + TypeScript + Sass)锛孉I 鍥剧墖璇嗗埆椋熸潗 鈫?Canvas 鍚堟垚涓婚鍥剧墖銆?

## STRUCTURE
```
apps/ftg/client/
鈹溾攢鈹€ src/
鈹?  鈹溾攢鈹€ app.ts           # 搴旂敤鍏ュ彛
鈹?  鈹溾攢鈹€ pages/           # 椤甸潰缁勪欢 (home/camera/gallery/result/record/stats绛?
鈹?  鈹溾攢鈹€ components/      # 鍏变韩缁勪欢
鈹?  鈹?  鈹溾攢鈹€ AppButton/   # 閫氱敤鎸夐挳 (4鍙樹綋+loading)
鈹?  鈹?  鈹溾攢鈹€ AppCard/     # 閫氱敤鍗＄墖
鈹?  鈹?  鈹溾攢鈹€ SectionHeader/ # 鍖哄煙鏍囬缁勪欢
鈹?  鈹?  鈹溾攢鈹€ EmptyState/  # 绌虹姸鎬佺粍浠?
鈹?  鈹?  鈹溾攢鈹€ Skeleton/    # 楠ㄦ灦灞?(4绫诲瀷)
鈹?  鈹?  鈹溾攢鈹€ Icon/        # SVG 鍥炬爣绯荤粺 (18鍥炬爣)
鈹?  鈹?  鈹溾攢鈹€ charts/      # Canvas 2D 鍥捐〃 (Line/Pie/Bar/CalendarHeatmap)
鈹?  鈹?  鈹斺攢鈹€ Loading.tsx  # 鍔犺浇閬僵 (鍚玹ype/zIndex)
鈹?  鈹溾攢鈹€ hooks/           # 鑷畾涔?Hooks
鈹?  鈹溾攢鈹€ stores/          # Zustand 鐘舵€佺鐞?(authStore)
鈹?  鈹溾攢鈹€ custom-tab-bar/  # 鑷畾涔夊簳閮ㄦ爮 (鏇夸唬鍘熺敓 tabBar)
鈹?  鈹溾攢鈹€ services/        # 浜戝嚱鏁拌皟鐢?API 灏佽
鈹?  鈹?  鈹溾攢鈹€ db/          # 浜戞暟鎹簱 DAL 灞?(10涓?
鈹?  鈹?  鈹溾攢鈹€ httpClient.ts # 缁熶竴 HTTP 瀹㈡埛绔?(JWT 鑷姩鎼哄甫)
鈹?  鈹?  鈹溾攢鈹€ authService.ts # 寰俊鐧诲綍 + Token 楠岃瘉灏佽
鈹?  鈹?  鈹斺攢鈹€ themeApi.ts  # 涓婚 HTTP API 鏈嶅姟
鈹?  鈹溾攢鈹€ types/           # TypeScript 绫诲瀷瀹氫箟
鈹?  鈹溾攢鈹€ constants/       # 甯搁噺瀹氫箟
鈹?  鈹斺攢鈹€ utils/           # 宸ュ叿鍑芥暟 (Canvas/鍥剧墖/瀹氫綅/鍒嗕韩)
鈹溾攢鈹€ cloudfunctions/      # 浜戝嚱鏁?(servers/ftg-server 鐨?REST API 姝ｅ湪鏇夸唬涓?
鈹溾攢鈹€ config/              # Taro 鏋勫缓閰嶇疆
鈹溾攢鈹€ project.config.json  # 寰俊寮€鍙戣€呭伐鍏烽厤缃?
鈹斺攢鈹€ tsconfig.json        # TypeScript 閰嶇疆
```

## WHERE TO LOOK
| 浠诲姟 | 浣嶇疆 | 璇存槑 |
|------|------|------|
| 椤甸潰 | `src/pages/` | 12 涓〉闈?(home/camera/gallery/result绛? |
| 鍏变韩缁勪欢搴?| `src/components/` | AppButton/AppCard/SectionHeader/EmptyState/Icon(18SVG)/Skeleton(4绫诲瀷)/Loading |
| 鍥捐〃缁勪欢 | `src/components/charts/` | Canvas 2D 鍘熺敓鍥捐〃 (Line/Pie/Bar/CalendarHeatmap) |
| 涓婚鐢诲粖 | `src/pages/gallery/` | API 浼樺厛 + 鏈湴鍥為€€ |
| 涓婚 HTTP API | `src/services/themeApi.ts` | 瀵规帴 servers/ftg-server 鐨?RESTful 涓婚鎺ュ彛 |
| 璁よ瘉 HTTP 鏈嶅姟 | `src/services/authService.ts` | 寰俊鐧诲綍 + Token 楠岃瘉灏佽 |
| HTTP 瀹㈡埛绔?| `src/services/httpClient.ts` | 缁熶竴 HTTP 灏佽 (JWT 鑷姩鎼哄甫) |
| 璁よ瘉鐘舵€佺鐞?| `src/stores/authStore.ts` | Zustand 璁よ瘉鐘舵€?(token/user/鍒濆鍖? |
| 鑷畾涔?tabBar | `src/custom-tab-bar/` | 鑷畾涔夊簳閮ㄦ爮 (浜嬩欢椹卞姩楂樹寒) |
| 鍏ㄥ眬鏍峰紡 | `src/app.scss` | CSS 鍙橀噺绯荤粺锛堥鑹?瀛椾綋/闂磋窛/闃村奖/z-index锛?|
| 鏍峰紡 | `src/` | Sass (.scss) 妯″潡鍖栨牱寮?|

## CONVENTIONS
- Taro 4.x API锛屾瀯寤哄懡浠?`taro build --type weapp`锛堝皬绋嬪簭锛夋垨 `taro build --type h5`锛圚5锛?
- React 18 + TypeScript strict 妯″紡
- Sass 妯″潡鍖栨牱寮?(`.module.scss`)
- 璺緞鍒悕 `@/*`, `@utils/*`, `@components/*`, `@services/*`, `@types/*`, `@constants/*`
- Prettier: printWidth 100, singleQuote, trailingComma all

## ANTI-PATTERNS
- 鉂?`textGenerate` 浜戝嚱鏁颁负鍗犱綅瀹炵幇 鈥?寰呮帴鍏ユ贩鍏?AI
- 鉂?`getUserStats` 浜戝嚱鏁拌繑鍥炵‖缂栫爜闆跺€?鈥?闇€瀹炵幇鏁版嵁搴撹仛鍚?
- 鉂?涓嶅緱鍦ㄧ粍浠朵腑鐩存帴鍐欏鏉備笟鍔￠€昏緫 鈥?鎶藉埌 hooks/services
- 鉂?绂佹 `eslint-disable` 鏃犲厖鍒嗙悊鐢辩殑娉ㄩ噴
- 鉂?**绌?catch 鍧?* 鈥?`src/app.ts` 鏈?4 涓┖ catch 鍧楋紙line 55 "鐜涓嶆敮鎸佹椂闈欓粯"銆乴ine 94/117/131 "Toast 澶辫触鏃堕潤榛樺鐞?锛夛紝搴旀坊鍔犻敊璇棩蹇?
- 鉂?**TODO 鍗犱綅瀹炵幇** 鈥?`src/pages/result/index.tsx` line 108 `// TODO: 璋冪敤浜戝嚱鏁颁繚瀛橀鐗╄褰昤锛宧andleSave 鏈畬鎴?
- 鉂?**Mock 闄嶇骇浠ｇ爜** 鈥?`src/stores/authStore.ts` 瀛樺湪 `TARO_APP_MOCK_AUTH=true` mock 鍒嗘敮锛屼笂绾垮墠闇€娓呯悊

## COMMANDS
```bash
# 寰俊灏忕▼搴?
npm run dev:weapp         # Taro 寮€鍙戞ā寮?(watch 鐑噸杞?
npm run build:weapp       # Taro 鐢熶骇鏋勫缓
npm run build:weapp:prod  # 鐢熶骇+鍘嬬缉鏋勫缓

# H5
npm run dev:h5            # H5 寮€鍙戞ā寮?(watch 鐑噸杞?
npm run build:h5          # H5 鐢熶骇鏋勫缓
npm run build:h5:prod     # H5 鐢熶骇+鍘嬬缉鏋勫缓

# 閫氱敤
npm run type-check        # TypeScript 绫诲瀷妫€鏌?
npm run lint              # ESLint 浠ｇ爜妫€鏌?
npm run format            # Prettier 鏍煎紡鍖?
```

## NOTES
- **CSS 鍙橀噺绯荤粺**: `app.scss` 瀹氫箟浜嗗畬鏁寸殑棰滆壊/瀛椾綋/闂磋窛/闃村奖/z-index 鍙橀噺
- **鍥炬爣绯荤粺**: Icon 缁勪欢浣跨敤 `<Image>` + data URI 娓叉煋 SVG锛屾敮鎸?size/color prop锛岀敱 `@/components/Icon` 瀵煎叆
- **鍥捐〃缁勪欢**: charts/ 涓嬬殑 4 涓浘琛ㄤ娇鐢ㄥ師鐢?Canvas 2D锛屾病鏈夌涓夋柟鍥捐〃渚濊禆锛岀被鍨嬪湪 `@/components/charts` 涓畾涔?
- **鍏变韩缁勪欢**: 浠?`@/components` barrel 缁熶竴瀵煎嚭锛圓ppButton/AppCard/SectionHeader/EmptyState/Icon/Skeleton/Loading锛?
- **椤甸潰鍔ㄧ敾**: 鍚勯〉闈㈠凡娣诲姞娣″叆/婊戝姩鍔ㄧ敾锛宍app.scss` 鍖呭惈鍏ㄥ眬 `prefers-reduced-motion` 鏀寔
- 浜戝嚱鏁颁笂浼犻渶閫氳繃寰俊寮€鍙戣€呭伐鍏锋垨 cloudbaserc.json 閰嶇疆
- AI 娴佹按绾? 鍓嶇瑙﹀彂 鈫?`orchestrateAIPipeline` 缂栨帓 鈫?澶氬嚱鏁板苟琛屽鐞?鈫?杩斿洖缁撴灉
- 鍥剧墖鍚堟垚鍦ㄥ墠绔畬鎴?(Canvas 2D)锛岄潪鏈嶅姟绔悎鎴?
- **璁よ瘉娴佺▼**: wx.login() 鈫?POST /auth/login 鈫?JWT token 鈫?Taro Storage 鎸佷箙鍖?鈫?鑷姩鏍￠獙(initialize)
- **鑷畾涔?tabBar**: CustomTabBar 缁勪欢浣跨敤 Taro eventCenter 鐩戝惉 tabChange 浜嬩欢椹卞姩楂樹寒锛屾浛浠ｅ師鐢?tabBar
- **HTTP 瀹㈡埛绔?*: HttpClient 绫诲皝瑁?Taro.request锛屾敮鎸佽秴鏃舵娴嬪拰缃戠粶杩炴帴閿欒涓枃鎻愮ず
- `.FoodThemeGenerator_MiniAPP/` 涓烘棫鐗堬紝鍕夸慨鏀?
- **H5 鍏煎**: `Taro.login()` 鍦?H5 鐜涓嬩細澶辫触骞惰嚜鍔ㄩ檷绾т负 Mock 鐧诲綍锛堟湇鍔＄闇€鏀寔 `dev_` 鍓嶇紑 code锛?
- **H5 璁よ瘉闄嶇骇**: 寰俊灏忕▼搴忎娇鐢?wx.login锛孒5 浣跨敤 Mock code (`dev_` 鍓嶇紑) 鐧诲綍锛岀‘淇濇湇鍔＄宸查厤缃搴旇矾鐢?
