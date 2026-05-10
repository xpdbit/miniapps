/**
 * XML → JSON 配置文件转换脚本
 *
 * 将 Unity XML 配置文件批量转换为小程序 JSON 格式。
 *
 * 用法:
 *   node scripts/convert-xml-to-json.js \
 *     --input "E:\UnityProgram\Game1\Assets\Resources\Data" \
 *     --output "apps/game1-miniapp/src/config"
 *
 * 依赖: npm install xml2js
 */

const fs = require('fs');
const path = require('path');
const { parseString } = require('xml2js');

// 解析命令行参数
const args = process.argv.slice(2);
const inputDir = args[args.indexOf('--input') + 1] || null;
const outputDir = args[args.indexOf('--output') + 1] || null;

if (!inputDir || !outputDir) {
  console.error('用法: node convert-xml-to-json.js --input <input_dir> --output <output_dir>');
  process.exit(1);
}

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// XML 文件映射（Unity 文件名 → 小程序文件名）
const FILE_MAP = {
  'Items.xml': 'items.json',
  'Actors.xml': 'actors.json',
  'Events.xml': 'events.json',
  'Skills.xml': 'skills.json',
  'Achievements.xml': 'achievements.json',
  'Texts.xml': 'texts.json',
};

/**
 * 转换单文件
 */
function convertFile(xmlPath, jsonName) {
  const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
  parseString(xmlContent, { explicitArray: false, ignoreAttrs: false }, (err, result) => {
    if (err) {
      console.error(`  解析失败 ${xmlPath}:`, err.message);
      return;
    }
    const outputPath = path.join(outputDir, jsonName);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`  ✅ ${path.basename(xmlPath)} → ${jsonName}`);
  });
}

console.log(`\n📂 输入目录: ${inputDir}`);
console.log(`📂 输出目录: ${outputDir}\n`);

let converted = 0;
for (const [xmlFile, jsonFile] of Object.entries(FILE_MAP)) {
  const xmlPath = path.join(inputDir, xmlFile);
  if (fs.existsSync(xmlPath)) {
    convertFile(xmlPath, jsonFile);
    converted++;
  } else {
    console.log(`  ⏭️  跳过 ${xmlFile} (文件不存在)`);
  }
}

console.log(`\n✅ 转换完成: ${converted}/${Object.keys(FILE_MAP).length} 个文件\n`);
