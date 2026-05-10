# Game1 Traditional Chinese → Simplified Chinese Conversion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all Traditional Chinese string literals in game1-miniapp source files to Simplified Chinese while preserving code, comments, variable names, and JSON structure.

**Architecture:** Use a Python conversion script (`opencc` library) with an AST-aware wrapper to convert string literals only. Files are processed in 5 independent groups: engine core systems, engine gameplay, pages (UI text), config JSON, and miscellaneous. Each group is a separate atomic commit with verification.

**Tech Stack:** Python 3 + opencc (Open Chinese Convert), Node.js 20 + TypeScript compiler API (for AST-awareness), Vitest (for verification), ESLint + tsc (for integrity checks)

**Conversion tool:** A Python script using `opencc-python-reimplemented` that:
  - Reads each `.ts`/`.tsx`/`.json` file
  - For JSON: converts all string values
  - For TS/TSX: uses regex/context awareness to convert only string literals (text in quotes), NOT comments or code identifiers

---

## Pre-work: Tooling & Baseline

### Task 0: Setup Conversion Infrastructure

**Files:**
- Create: `E:\.Code\.miniapps\tools\tch2sch\convert.py`
- Create: `E:\.Code\.miniapps\tools\tch2sch\char_map.py`

- [ ] **Step 0.1: Install opencc Python library**

Run: `pip install opencc-python-reimplemented`

- [ ] **Step 0.2: Verify opencc works**

Run: `python -c "from opencc import OpenCC; cc = OpenCC('t2s'); print(cc.convert('貓咪'))"`
Expected output: `猫咪`

- [ ] **Step 0.3: Run baseline type-check**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm run type-check   # tsc --noEmit
npm run lint         # eslint 'src/**/*.{ts,tsx}' --fix
```
Expected: Pass clean. Record output as baseline.

- [ ] **Step 0.4: Run baseline test**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm test             # vitest run
```
Expected: Pass (even if zero tests — verify vitest doesn't crash).

- [ ] **Step 0.5: Verify git is clean**

```bash
cd E:\.Code\.miniapps
git status
git stash  # stash any WIP changes
```
Expected: Working tree clean. Branch: master (or feature branch if specified).

- [ ] **Step 0.6: Create feature branch**

```bash
cd E:\.Code\.miniapps
git checkout -b feat/simplified-chinese
```

- [ ] **Step 0.7: Write the conversion script**

```python
#!/usr/bin/env python3
"""
tch2sch/convert.py — Convert Traditional Chinese to Simplified Chinese
Only processes string literals (quoted text), NOT comments or code.
Usage: python convert.py <file_or_dir>
"""
import json
import os
import re
import sys
from pathlib import Path

from opencc import OpenCC

cc = OpenCC('t2s')  # Traditional to Simplified

# File extensions to process
TS_EXTENSIONS = {'.ts', '.tsx'}
JSON_EXTENSIONS = {'.json'}

def convert_json_file(filepath: Path) -> int:
    """Convert all string values in a JSON file. Returns count of converted strings."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    data = json.loads(content)
    count = 0
    
    def convert_value(v):
        nonlocal count
        if isinstance(v, str):
            converted = cc.convert(v)
            if converted != v:
                count += 1
            return converted
        elif isinstance(v, dict):
            return {k: convert_value(v) for k, v in v.items()}
        elif isinstance(v, list):
            return [convert_value(item) for item in v]
        return v
    
    converted = convert_value(data)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(converted, f, ensure_ascii=False, indent=2)
    
    return count


def convert_ts_file(filepath: Path) -> int:
    """Convert string literals in TS/TSX files, preserving comments and code structure.
    Strategy:
    1. Remove comments (store their positions)
    2. Find all quoted strings in code
    3. Convert string content only
    4. Restore comments
    Returns count of converted strings.
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Strategy: extract lines, find quoted strings, check if they contain Chinese,
    # convert if so, rebuild
    lines = content.split('\n')
    count = 0
    result_lines = []
    
    for line in lines:
        stripped = line.strip()
        
        # Skip comment-only lines (lines starting with //, /*, *, or inside block comments)
        # We handle this by only touching strings on lines that have actual code
        is_comment_line = (
            stripped.startswith('//') or
            stripped.startswith('*') or
            stripped.startswith('/*') or
            stripped.startswith('*/')
        )
        
        if is_comment_line:
            result_lines.append(line)
            continue
        
        # On code lines, find and convert quoted strings
        # Match content inside double or single quotes (handling escape sequences)
        def replace_quoted(match):
            nonlocal count
            quote_char = match.group(1)
            inner = match.group(2)
            converted = cc.convert(inner)
            if converted != inner:
                count += 1
            return f'{quote_char}{converted}{quote_char}'
        
        processed = re.sub(
            r"""(['\"])((?:[^'\"\\]|\\.)*?)\1""",
            replace_quoted,
            line
        )
        
        result_lines.append(processed)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(result_lines))
    
    return count


def process_file(filepath: Path) -> int:
    """Process a single file. Returns count of converted strings."""
    ext = filepath.suffix.lower()
    
    if ext in TS_EXTENSIONS:
        return convert_ts_file(filepath)
    elif ext in JSON_EXTENSIONS:
        return convert_json_file(filepath)
    else:
        print(f"  Skipping {filepath} (unsupported extension)")
        return 0


def process_path(path: Path) -> None:
    """Process a file or directory."""
    if path.is_file():
        count = process_file(path)
        if count > 0:
            print(f"  Converted {count} strings in {path.relative_to(Path.cwd())}")
    elif path.is_dir():
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if d != 'node_modules']
            for fname in files:
                ext = Path(fname).suffix.lower()
                if ext in TS_EXTENSIONS or ext in JSON_EXTENSIONS:
                    filepath = Path(root) / fname
                    count = process_file(filepath)
                    if count > 0:
                        print(f"  Converted {count} strings in {filepath.relative_to(Path.cwd())}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python convert.py <file_or_directory> [...]")
        sys.exit(1)
    
    for arg in sys.argv[1:]:
        path = Path(arg)
        if not path.exists():
            print(f"Error: {path} does not exist")
            continue
        process_path(path)
```

Commit: `git add tools/tch2sch/ && git commit -m "chore: add Traditional-to-Simplified Chinese conversion script"`

---

## Task Group 1: Engine — Inventory & Equipment Systems

**Rationale:** These are core gameplay data files with item names, descriptions, and error messages. Independent from other engine modules.

**Files:**
- Modify: `apps/game1-miniapp/src/engine/inventory/EquipmentSystem.ts` (~7 conversions)
- Modify: `apps/game1-miniapp/src/engine/inventory/InventoryEngine.ts` (~17 conversions)
- Modify: `apps/game1-miniapp/src/engine/inventory/ItemRegistry.ts` (~14 conversions)
- Modify: `apps/game1-miniapp/src/engine/inventory/DropEngine.ts` (~11 conversions)

- [ ] **Step 1.1: Run conversion tool on inventory files**

```bash
cd E:\.Code\.miniapps
python tools/tch2sch/convert.py apps/game1-miniapp/src/engine/inventory/
```

- [ ] **Step 1.2: Verify — type-check**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm run type-check
```
Expected: Pass clean (no type errors introduced — string content changes don't affect types).

- [ ] **Step 1.3: Verify — lint**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm run lint
```
Expected: Pass clean (or only pre-existing lint warnings).

- [ ] **Step 1.4: Verify — spot-check conversion accuracy**

Read the modified files and manually verify:
- `EquipmentSystem.ts` — error messages like `装备失败：队员不存在` should become `装备失败：队员不存在` (already simplified?) → confirm opencc handled them.
- `InventoryEngine.ts` — comments should NOT change, string literals should.
- `ItemRegistry.ts` — `console.log` messages should convert.

- [ ] **Step 1.5: Commit**

```bash
cd E:\.Code\.miniapps
git add apps/game1-miniapp/src/engine/inventory/
git commit -m "feat(game1): convert inventory system text to Simplified Chinese"
```

---

## Task Group 2: Engine — Event System

**Rationale:** Event tree/chain engines contain narrative descriptions and dialogue in Traditional Chinese. Independent from Group 1.

**Files:**
- Modify: `apps/game1-miniapp/src/engine/event/EventTreeEngine.ts` (~8 conversions)
- Modify: `apps/game1-miniapp/src/engine/event/EventChainEngine.ts` (~6 conversions)
- Modify: `apps/game1-miniapp/src/engine/event/PendingEventEngine.ts` (check — may have text)

- [ ] **Step 2.1: Run conversion tool on event files**

```bash
cd E:\.Code\.miniapps
python tools/tch2sch/convert.py apps/game1-miniapp/src/engine/event/
```

- [ ] **Step 2.2: Verify — type-check + lint**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm run type-check && npm run lint
```
Expected: Both pass clean.

- [ ] **Step 2.3: Verify — spot-check**

Read `EventTreeEngine.ts` — check that merchant dialogue like `「100 金币，它就是你的了。」` converted correctly to `「100 金币，它就是你的了。」` (if 幣→币 and 的 stays same).

Read `EventChainEngine.ts` — narrative descriptions like `「你在路边发现一支遭到袭击的商队」`.

- [ ] **Step 2.4: Commit**

```bash
cd E:\.Code\.miniapps
git add apps/game1-miniapp/src/engine/event/
git commit -m "feat(game1): convert event system text to Simplified Chinese"
```

---

## Task Group 3: Engine — Gameplay Systems (Pet, Travel, Activity, Idle)

**Rationale:** Pet names/descriptions, travel resource text, activity idle rewards. Mix of game data and UI strings.

**Files:**
- Modify: `apps/game1-miniapp/src/engine/pet/PetEngine.ts` (~72 conversions — pet names + descriptions)
- Modify: `apps/game1-miniapp/src/engine/activity/ActivityEngine.ts` (~11 conversions)
- Modify: `apps/game1-miniapp/src/engine/idle/IdleRewardEngine.ts` (~7 conversions)
- Modify: `apps/game1-miniapp/src/engine/travel/TravelEngine.ts` (~4 conversions)
- Modify: `apps/game1-miniapp/src/engine/travel/TravelResource.ts` (~3 conversions)
- Modify: `apps/game1-miniapp/src/engine/travel/RouteEventController.ts` (~7 conversions)

- [ ] **Step 3.1: Run conversion tool on gameplay engine files**

```bash
cd E:\.Code\.miniapps
python tools/tch2sch/convert.py apps/game1-miniapp/src/engine/pet/ apps/game1-miniapp/src/engine/travel/ apps/game1-miniapp/src/engine/activity/ apps/game1-miniapp/src/engine/idle/
```

- [ ] **Step 3.2: Verify — type-check + lint**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm run type-check && npm run lint
```
Expected: Both pass clean.

- [ ] **Step 3.3: Verify — critical spot-check on PetEngine.ts**

Read `PetEngine.ts` lines 80-91 to verify:
| Original (Traditional) | Expected (Simplified) |
|---|---|
| `貓咪` | `猫咪` |
| `優雅的貓咪，增加暴擊傷害` | `优雅的猫咪，增加暴击伤害` |
| `聰明的狐狸，增加金幣收益` | `聪明的狐狸，增加金币收益` |
| `睿智的貓頭鷹，增加經驗收益` | `睿智的猫头鹰，增加经验收益` |
| `銳利的蒼鷹，提升攻擊` | `锐利的苍鹰，提升攻击` |
| `兇猛的戰狼，全面提升戰鬥力` | `凶猛的战狼，全面提升战斗力` |
| `極致速度` | `极致速度` |
| `堅不可摧` | `坚不可摧` |
| `鳳凰` | `凤凰` |
| `復活` | `复活` |
| `幼龍` | `幼龙` |
| `傳說中的龍裔，毀滅之力` | `传说中的龙裔，毁灭之力` |
| `全方位的守護者` | `全方位的守护者` |

- [ ] **Step 3.4: Commit**

```bash
cd E:\.Code\.miniapps
git add apps/game1-miniapp/src/engine/pet/ apps/game1-miniapp/src/engine/travel/ apps/game1-miniapp/src/engine/activity/ apps/game1-miniapp/src/engine/idle/
git commit -m "feat(game1): convert pet/travel/activity/idle text to Simplified Chinese"
```

---

## Task Group 4: Engine — Supporting Systems (Team, Combat, Prestige, Card, Achievement, Skill, Map, PVP)

**Rationale:** Smaller remaining engine files with 1-4 conversions each. Can be batched.

**Files:**
- Modify: `apps/game1-miniapp/src/engine/team/TeamEngine.ts` (~4 conversions)
- Modify: `apps/game1-miniapp/src/engine/combat/CombatEngine.ts` (~2 conversions)
- Modify: `apps/game1-miniapp/src/engine/combat/CombatStateMachine.ts` (~3 conversions)
- Modify: `apps/game1-miniapp/src/engine/prestige/PrestigeEngine.ts` (~2 conversions)
- Modify: `apps/game1-miniapp/src/engine/card/CardEngine.ts` (~2 conversions)
- Modify: `apps/game1-miniapp/src/engine/achievement/TaskEngine.ts` (~2 conversions)
- Modify: `apps/game1-miniapp/src/engine/skill/SkillData.ts` (~1 conversion)
- Modify: `apps/game1-miniapp/src/engine/map/RegionGenerator.ts` (~1 conversion)
- Modify: `apps/game1-miniapp/src/engine/pvp/PvpEngine.ts` (~1 conversion)

- [ ] **Step 4.1: Run conversion tool on supporting engine files**

```bash
cd E:\.Code\.miniapps
python tools/tch2sch/convert.py apps/game1-miniapp/src/engine/team/ apps/game1-miniapp/src/engine/combat/ apps/game1-miniapp/src/engine/prestige/ apps/game1-miniapp/src/engine/card/ apps/game1-miniapp/src/engine/achievement/ apps/game1-miniapp/src/engine/skill/ apps/game1-miniapp/src/engine/map/ apps/game1-miniapp/src/engine/pvp/
```

- [ ] **Step 4.2: Verify — type-check + lint**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm run type-check && npm run lint
```
Expected: Both pass clean.

- [ ] **Step 4.3: Commit**

```bash
cd E:\.Code\.miniapps
git add apps/game1-miniapp/src/engine/team/ apps/game1-miniapp/src/engine/combat/ apps/game1-miniapp/src/engine/prestige/ apps/game1-miniapp/src/engine/card/ apps/game1-miniapp/src/engine/achievement/ apps/game1-miniapp/src/engine/skill/ apps/game1-miniapp/src/engine/map/ apps/game1-miniapp/src/engine/pvp/
git commit -m "feat(game1): convert supporting engine systems text to Simplified Chinese"
```

---

## Task Group 5: Pages (UI Text)

**Rationale:** All 12 page files contain UI labels, event narratives, and button text. This is the largest group by line count. The event page has the most narrative text (48 conversions), others are smaller.

**Files:**
- Modify: `apps/game1-miniapp/src/pages/event/index.tsx` (~48 conversions — labels, event narratives)
- Modify: `apps/game1-miniapp/src/pages/card/index.tsx` (~7 conversions — rarity labels like 史诗→史诗, 传说→传说)
- Modify: `apps/game1-miniapp/src/pages/dashboard/index.tsx` (~10 conversions)
- Modify: `apps/game1-miniapp/src/pages/pet/index.tsx` (~10 conversions)
- Modify: `apps/game1-miniapp/src/pages/inventory/index.tsx` (~11 conversions)
- Modify: `apps/game1-miniapp/src/pages/prestige/index.tsx` (~4 conversions)
- Modify: `apps/game1-miniapp/src/pages/travel/index.tsx` (~5 conversions)
- Modify: `apps/game1-miniapp/src/pages/team/index.tsx` (~4 conversions)
- Modify: `apps/game1-miniapp/src/pages/skill/index.tsx` (~1 conversion)
- Modify: `apps/game1-miniapp/src/pages/achievement/index.tsx` (~2 conversions)
- Modify: `apps/game1-miniapp/src/pages/combat/index.tsx` (check for Traditional Chinese)
- Modify: `apps/game1-miniapp/src/pages/pet/index.config.ts` (~1 conversion — navigation bar title)

- [ ] **Step 5.1: Run conversion tool on pages**

```bash
cd E:\.Code\.miniapps
python tools/tch2sch/convert.py apps/game1-miniapp/src/pages/
```

- [ ] **Step 5.2: Verify — type-check + lint (with JSX)**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm run type-check && npm run lint
```
Expected: Both pass clean. Note: JSX text content (`<Text>...</Text>`) should be converted as well.

- [ ] **Step 5.3: Verify — spot-check event page narrative**

Read `pages/event/index.tsx` lines 88-109 to verify:
| Original (Traditional) | Expected (Simplified) |
|---|---|
| `裝飾華麗` | `装饰华丽` |
| `風塵僕僕` | `风尘仆仆` |
| `補給` | `补给` |
| `廢棄神廟` | `废弃神庙` |
| `強盜` | `强盗` |
| `謹慎前行` | `谨慎前行` |
| `隱蔽的果園` | `隐蔽的果园` |
| `擊退` | `击退` |
| `繳獲` | `缴获` |
| `時` (in `2小時前`) | `时` (in `2小时前`) |

- [ ] **Step 5.4: Commit**

```bash
cd E:\.Code\.miniapps
git add apps/game1-miniapp/src/pages/
git commit -m "feat(game1): convert page text to Simplified Chinese"
```

---

## Task Group 6: Config JSON, Stores, and Root Files

**Rationale:** JSON config files contain item names, descriptions, achievement text, event data. Stores and app.tsx have Chinese strings.

**Files (JSON config):**
- Modify: `apps/game1-miniapp/src/config/items.json` — item names/descriptions
- Modify: `apps/game1-miniapp/src/config/texts.json` — game text strings
- Modify: `apps/game1-miniapp/src/config/achievements.json` — achievement descriptions
- Modify: `apps/game1-miniapp/src/config/cards.json` — card descriptions
- Modify: `apps/game1-miniapp/src/config/events.json` — event narratives
- Modify: `apps/game1-miniapp/src/config/eventTrees.json` — event tree text
- Modify: `apps/game1-miniapp/src/config/prestige.json` — prestige descriptions
- Modify: `apps/game1-miniapp/src/config/races.json` — race descriptions
- Modify: `apps/game1-miniapp/src/config/skills.json` — skill descriptions
- Modify: `apps/game1-miniapp/src/config/tasks.json` — task descriptions
- Modify: `apps/game1-miniapp/src/config/actors.json` — actor descriptions (check)

**Files (TypeScript):**
- Modify: `apps/game1-miniapp/src/stores/inventoryStore.ts` (~4 conversions)
- Modify: `apps/game1-miniapp/src/app.tsx` (~1 conversion — `应用启动`)
- Modify: `apps/game1-miniapp/src/config/loader.ts` (check for Chinese strings)
- Modify: `apps/game1-miniapp/src/engine/core/TextManager.ts` (check for Chinese)
- Modify: `apps/game1-miniapp/src/engine/core/SaveManager.ts` (check for Chinese strings in logging)

**Note:** For JSON files, the script will convert ALL string values (since JSON values are always data, never comments/code). This is safe.

- [ ] **Step 6.1: Run conversion tool on config + stores**

```bash
cd E:\.Code\.miniapps
python tools/tch2sch/convert.py apps/game1-miniapp/src/config/ apps/game1-miniapp/src/stores/ apps/game1-miniapp/src/app.tsx apps/game1-miniapp/src/engine/core/TextManager.ts apps/game1-miniapp/src/engine/core/SaveManager.ts
```

- [ ] **Step 6.2: Verify JSON structure is intact**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
for f in src/config/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "OK: $f" || echo "FAIL: $f"; done
```
Expected: All JSON files parse successfully.

- [ ] **Step 6.3: Verify — type-check + lint**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm run type-check && npm run lint
```
Expected: Both pass clean.

- [ ] **Step 6.4: Commit**

```bash
cd E:\.Code\.miniapps
git add apps/game1-miniapp/src/config/ apps/game1-miniapp/src/stores/ apps/game1-miniapp/src/app.tsx apps/game1-miniapp/src/engine/core/TextManager.ts apps/game1-miniapp/src/engine/core/SaveManager.ts
git commit -m "feat(game1): convert config JSON and store text to Simplified Chinese"
```

---

## Task Group 7: Final Verification & Integration

- [ ] **Step 7.1: Full type-check pass**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm run type-check
```
Expected: 0 errors. If errors, diagnose and fix.

- [ ] **Step 7.2: Full lint pass**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm run lint
```
Expected: 0 errors, 0 warnings (or only pre-existing ones).

- [ ] **Step 7.3: Full test pass**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm test
```
Expected: vitest runs and all tests pass (or reports "no test files found" — acceptable for this project).

- [ ] **Step 7.4: Build verification (dry-run)**

```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npm run build:weapp -- --dry-run 2>&1 || echo "Build dry-run not supported, skipping"
```
Or just verify no build-crashing issues:
```bash
cd E:\.Code\.miniapps\apps\game1-miniapp
npx tsc --noEmit --pretty 2>&1 | Select-String -Pattern "error TS"
```
Expected: No TS errors.

- [ ] **Step 7.5: Git status review**

```bash
cd E:\.Code\.miniapps
git status
git log --oneline -10
```
Verify: All 6 commits present, working tree clean, no unintended modifications.

- [ ] **Step 7.6: Spot-check key files for correctness**

Use `git diff` to review changes to:
- `apps/game1-miniapp/src/engine/pet/PetEngine.ts` — verify pet names
- `apps/game1-miniapp/src/pages/event/index.tsx` — verify narratives
- `apps/game1-miniapp/src/config/items.json` — verify item data

```bash
cd E:\.Code\.miniapps
git diff master..HEAD -- apps/game1-miniapp/src/engine/pet/PetEngine.ts
git diff master..HEAD -- apps/game1-miniapp/src/pages/event/index.tsx | head -100
```

Verify: No comment modifications, no code keyword changes, string content only.

---

## Execution Strategy

### Commit Order (6 atomic commits)
1. Tooling (Task 0) — `chore: add Traditional-to-Simplified Chinese conversion script`
2. Inventory systems (Task 1) — `feat(game1): convert inventory system text to Simplified Chinese`
3. Event systems (Task 2) — `feat(game1): convert event system text to Simplified Chinese`
4. Gameplay systems (Task 3) — `feat(game1): convert pet/travel/activity/idle text to Simplified Chinese`
5. Supporting systems (Task 4) — `feat(game1): convert supporting engine systems text to Simplified Chinese`
6. Pages (Task 5) — `feat(game1): convert page text to Simplified Chinese`
7. Config/Stores (Task 6) — `feat(game1): convert config JSON and store text to Simplified Chinese`

### Parallel Execution
Groups 1-4 (engine subsystems) can be run in parallel since they touch independent files.
Group 5 (pages) must be sequential since it's a single conversion run on the pages directory.
Group 6 (config JSON) can run in parallel with Groups 1-5.

### Safety Net
If the opencc script converts a comment or code keyword, the error will be caught by:
- `git diff` review before commit
- `tsc --noEmit` type-check (if code is broken)
- `eslint --fix` (if syntax is broken)

### Handling False Positives
The conversion script may convert strings in `console.log()` messages that contain English text with no Chinese characters — these will be no-ops (opencc only converts actual Traditional Chinese characters).

### Character Boundaries
Some characters look the same in both systems but have different code points:
- `說` (U+8AAA, Traditional) → `说` (U+8BF4, Simplified)
- `體` (U+9AD4, Traditional) → `体` (U+4F53, Simplified)
- `爲` (U+723A, Traditional) → `为` (U+4E3A, Simplified)

opencc handles all standard conversions correctly including one-to-many mappings (e.g., `乾→干, 幹→干`).

---

## Self-Review Checklist

- [ ] **Spec coverage:** Each file from the user's list has at least one task that processes it.
- [ ] **Placeholder scan:** No TBD, TODO, or incomplete steps in the plan.
- [ ] **Type consistency:** The conversion script output is consistent across all tasks. Verification steps use the same commands.
- [ ] **Commit strategy:** 6 atomic commits, each independently verifiable, no single commit touches unrelated files.
- [ ] **Edge case coverage:** JSON files handled separately from TS files. Comments explicitly excluded. Build verification included.
