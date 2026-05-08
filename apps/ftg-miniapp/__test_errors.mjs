/**
 * 测试脚本：连接微信开发者工具，检查控制台错误
 * 使用 miniprogram-automator SDK 直接连接
 */
import * as automator from 'miniprogram-automator';

async function main() {
  const wsEndpoint = 'ws://localhost:9420';
  console.log(`[test] 正在连接 ${wsEndpoint} ...`);

  let miniProgram;
  try {
    miniProgram = await automator.connect({ wsEndpoint });
    console.log('[test] 连接成功!');

    // 收集控制台日志
    const logs = [];
    miniProgram.on('console', (log) => {
      logs.push({
        level: log.level,
        text: log.text,
        args: log.args,
      });
    });

    // 等待小程序启动
    await new Promise(r => setTimeout(r, 3000));

    // 重启到首页
    console.log('[test] 重启到首页...');
    try {
      await miniProgram.reLaunch('/pages/home/index');
      console.log('[test] 重启成功');
    } catch (e) {
      console.log('[test] 重启失败:', e.message);
      // 尝试 navigateTo
      try {
        await miniProgram.navigateTo({ url: '/pages/home/index' });
      } catch (e2) {
        console.log('[test] navigateTo 也失败:', e2.message);
      }
    }

    // 等待页面加载
    await new Promise(r => setTimeout(r, 5000));

    // 获取当前页面
    try {
      const page = await miniProgram.currentPage();
      console.log('[test] 当前页面:', page ? '存在' : '不存在');
      if (page) {
        const data = await page.data();
        console.log('[test] 页面数据:', JSON.stringify(data).slice(0, 200));
      }
    } catch (e) {
      console.log('[test] 获取当前页面失败:', e.message);
    }

    // 输出控制台日志
    console.log('\n=== 控制台日志 (' + logs.length + ' 条) ===');
    for (const log of logs) {
      console.log(`[${log.level}] ${log.text}`);
      if (log.args && log.args.length > 1) {
        log.args.slice(1).forEach(a => console.log('  ->', typeof a === 'object' ? JSON.stringify(a).slice(0, 200) : a));
      }
    }

    // 输出错误和警告
    const errors = logs.filter(l => l.level === 'error' || l.level === 'warn');
    if (errors.length > 0) {
      console.log('\n=== 发现 ' + errors.length + ' 个错误/警告 ===');
    } else {
      console.log('\n=== ✅ 没有发现错误和警告 ===');
    }

    // 检查页面状态
    try {
      const systemInfo = await miniProgram.systemInfo();
      console.log('\n=== 系统信息 ===');
      console.log('SDK版本:', systemInfo.SDKVersion);
      console.log('系统:', systemInfo.system);
    } catch (e) {
      console.log('\n获取系统信息失败:', e.message);
    }

  } catch (err) {
    console.error('[test] 连接失败:', err.message);
    console.error(err.stack);
  } finally {
    if (miniProgram) {
      try { await miniProgram.close(); } catch (e) { /* ignore */ }
    }
  }
}

main();
