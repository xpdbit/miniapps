const config = {
  pages: [
    'pages/cards/index',
    'pages/scenario-select/index',
    'pages/chat/index',
    'pages/archive/index',
    'pages/character/index',
    'pages/character/detail/index',
    'pages/creator/index',
    'pages/profile/index',
    'pages/persona/index',
    'pages/chats/index',
    'pages/contacts/index',
    'pages/discover/index',
  ],
  window: {
    navigationBarTitleText: 'AI 酒馆',
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F2F2F7',
  },
  tabBar: {
    custom: true,
    color: '#8E8E93',
    selectedColor: '#007AFF',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/cards/index',
        text: '酒馆',
        iconPath: 'assets/icons/market.png',
        selectedIconPath: 'assets/icons/market-active.png',
      },
      {
        pagePath: 'pages/chat/index',
        text: '酒馆',
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