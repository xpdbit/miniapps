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
        pagePath: 'pages/settings/index',
        text: '设置',
        iconPath: 'assets/icons/settings.png',
        selectedIconPath: 'assets/icons/settings-active.png',
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
  // 分包策略 - 后续任务扩展
  subPackages: [],
  // CloudBase 已通过 app.ts 中的 wx.cloud.init 初始化
});
