const config = {
  pages: [
    'pages/market/index',
    'pages/chat/index',
    'pages/character/index',
    'pages/character/detail/index',
    'pages/creator/index',
    'pages/profile/index',
    'pages/persona/index',
    'pages/settings/index',
  ],
  window: {
    navigationBarTitleText: 'AI 酒馆',
    navigationBarBackgroundColor: '#0A0A10',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0A0A10',
  },
  tabBar: {
    color: '#6C6C80',
    selectedColor: '#7C5CFC',
    backgroundColor: '#12121A',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/market/index',
        text: '市场',
        iconPath: 'assets/icons/market.png',
        selectedIconPath: 'assets/icons/market-active.png',
      },
      {
        pagePath: 'pages/chat/index',
        text: '聊天',
        iconPath: 'assets/icons/chat.png',
        selectedIconPath: 'assets/icons/chat-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/profile.png',
        selectedIconPath: 'assets/icons/profile-active.png',
      },
    ],
  },
  usingComponents: {},
  permission: {
    'scope.userLocation': {
      desc: '用于获取您的位置信息',
    },
  },
  requiredPrivateInfos: ['getLocation'],
  networkTimeout: {
    request: 30000,
    connectSocket: 60000,
    uploadFile: 60000,
    downloadFile: 60000,
  },
  subPackages: [],
}

export default config
