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
    navigationBarBackgroundColor: '#1a1a2e',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0f0f1a',
  },
  tabBar: {
    color: '#999',
    selectedColor: '#8B5CF6',
    backgroundColor: '#1a1a2e',
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
