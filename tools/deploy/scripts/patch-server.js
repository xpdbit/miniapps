const fs = require('fs');
const path = '/app/dist/server.js';
let s = fs.readFileSync(path, 'utf8');

// Add import line after agent-routes import
s = s.replace(
  '__importDefault(require("./agent-routes"));',
  '__importDefault(require("./agent-routes"));\nconst tavern_proxy_1 = __importDefault(require("./routes/tavern-proxy"));'
);

// Add app.use line after agent routes
s = s.replace(
  'agent_routes_1.default);\n// 健康检查端点',
  'agent_routes_1.default);\napp.use("/api/admin", tavern_proxy_1.default);\n// 健康检查端点'
);

fs.writeFileSync(path, s);
console.log('server.js patched');
