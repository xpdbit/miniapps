export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/result/index',
    'pages/settings/index',
    'pages/profile/index',
    'pages/record/index',
    'pages/record/detail/index',
    'pages/camera/index',
    'pages/privacy/index',
    'pages/history/index',
    'pages/stats/index',
    'pages/gallery/index',
    'pages/achievements/index',
    'pages/checkin/index',
    'pages/favorites/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FF6B35',
    navigationBarTitleText: '食物主题生成器',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F5F5F5',
  },
  tabBar: {
    custom: true,
    color: '#999999',
    selectedColor: '#FF6B35',
    backgroundColor: '#FFFFFF',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/icons/home.png',
        selectedIconPath: 'assets/icons/home-active.png',
      },
      {
        pagePath: 'pages/gallery/index',
        text: '画廊',
        iconPath: 'assets/icons/gallery.png',
        selectedIconPath: 'assets/icons/gallery-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/profile.png',
        selectedIconPath: 'assets/icons/profile-active.png',
      },
    ],
  },
  // 权限声明
  permission: {
    'scope.userLocation': {
      desc: '用于记录您的美食打卡位置',
    },
  },
  requiredPrivateInfos: ['getLocation', 'chooseLocation'],
  // 网络超时配置 — 微信基础库 3.15.2 存在 known bug 会导致 WAServiceMainContext generic timeout
  // 显式配置可提供更清晰的超时错误信息，并防止 wx.request 使用不稳定的默认超时
  networkTimeout: {
    request: 30000,       // wx.request 超时 30s（匹配 httpClient 的 REQUEST_TIMEOUT）
    connectSocket: 60000, // WebSocket 连接超时 60s
    uploadFile: 60000,    // 文件上传超时 60s
    downloadFile: 60000,  // 文件下载超时 60s
  },
  // 分包策略 - 后续任务扩展
  subPackages: [],
  // CloudBase 已通过 app.ts 中的 wx.cloud.init 初始化
});
