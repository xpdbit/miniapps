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
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F8F4EF',
  },
  tabBar: {
    custom: true,
    color: '#A8A39E',
    selectedColor: '#C49A6C',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/market/index',
        text: '酒馆',
        iconPath: 'assets/icons/market.png',
        selectedIconPath: 'assets/icons/market-active.png',
      },
      {
        pagePath: 'pages/chat/index',
        text: '开始',
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