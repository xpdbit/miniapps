import { View, Text } from '@tarojs/components';
import './index.scss';

/**
 * 隐私政策页面
 * 满足微信小程序审核要求的隐私政策说明
 */
export default function PrivacyPage() {
  return (
    <View className='privacy-page'>
      <View className='privacy-content'>
        {/* ==================== 引言 ==================== */}
        <View className='privacy-section'>
          <Text className='privacy-section-text'>
            食物主题生成器（以下简称&ldquo;本应用&rdquo;）尊重并保护您的隐私。本隐私政策说明我们在您使用本应用时如何收集、使用、存储和保护您的个人信息。
          </Text>
        </View>

        {/* ==================== 信息收集 ==================== */}
        <View className='privacy-section'>
          <Text className='privacy-section-title'>一、我们收集的信息</Text>
          <Text className='privacy-section-text'>
            在您使用本应用的过程中，我们可能会收集以下类型的信息：
          </Text>
          <View className='privacy-list'>
            <Text className='privacy-list-item'>
              1. <Text className='privacy-highlight'>食物照片</Text>：当您使用拍照功能时，我们会拍摄并处理您提供的食物图片，用于进行食物识别和主题生成。
            </Text>
            <Text className='privacy-list-item'>
              2. <Text className='privacy-highlight'>位置信息</Text>：当您使用打卡功能时，我们会收集您的位置信息，用于记录美食打卡位置。您可以在系统设置中关闭位置权限。
            </Text>
            <Text className='privacy-list-item'>
              3. <Text className='privacy-highlight'>设备信息</Text>：我们会收集您的设备型号、操作系统版本等基本信息，用于优化应用兼容性和性能。
            </Text>
            <Text className='privacy-list-item'>
              4. <Text className='privacy-highlight'>使用记录</Text>：我们会记录您的食物识别历史、主题生成记录等使用数据，以提供持续服务。
            </Text>
          </View>
        </View>

        {/* ==================== 信息使用 ==================== */}
        <View className='privacy-section'>
          <Text className='privacy-section-title'>二、信息的使用</Text>
          <Text className='privacy-section-text'>
            我们收集的信息将用于以下目的：
          </Text>
          <View className='privacy-list'>
            <Text className='privacy-list-item'>
              1. 提供食物识别和主题生成的核心功能服务；
            </Text>
            <Text className='privacy-list-item'>
              2. 记录您的打卡和美食记录，提供数据统计功能；
            </Text>
            <Text className='privacy-list-item'>
              3. 优化和改进我们的服务和用户体验；
            </Text>
            <Text className='privacy-list-item'>
              4. 解决技术问题并提供客户支持。
            </Text>
          </View>
        </View>

        {/* ==================== 数据存储 ==================== */}
        <View className='privacy-section'>
          <Text className='privacy-section-title'>三、数据存储与安全</Text>
          <Text className='privacy-section-text'>
            您的数据存储于微信云开发（CloudBase）提供的安全服务器上。我们采用符合行业标准的安全措施保护您的个人信息，包括数据加密传输、访问权限控制等。我们将仅在提供服务所必需的期限内保留您的数据。
          </Text>
        </View>

        {/* ==================== 信息共享 ==================== */}
        <View className='privacy-section'>
          <Text className='privacy-section-title'>四、信息共享与披露</Text>
          <Text className='privacy-section-text'>
            我们不会将您的个人信息出售或分享给第三方，但以下情况除外：
          </Text>
          <View className='privacy-list'>
            <Text className='privacy-list-item'>
              1. 获得您的明确同意；
            </Text>
            <Text className='privacy-list-item'>
              2. 法律法规要求；
            </Text>
            <Text className='privacy-list-item'>
              3. 为保护本应用的权利和财产安全所必需。
            </Text>
          </View>
        </View>

        {/* ==================== 用户权利 ==================== */}
        <View className='privacy-section'>
          <Text className='privacy-section-title'>五、您的权利</Text>
          <Text className='privacy-section-text'>
            您有权查询、更正或删除您的个人信息。您可以通过本应用提供的功能或在微信小程序设置中管理您的数据。如果您有任何疑问，可以通过下方联系方式与我们联系。
          </Text>
        </View>

        {/* ==================== 联系方式 ==================== */}
        <View className='privacy-section'>
          <Text className='privacy-section-title'>六、联系方式</Text>
          <Text className='privacy-section-text'>
            如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：
          </Text>
          <View className='privacy-list'>
            <Text className='privacy-list-item'>
              邮箱：privacy@foodthemegen.com
            </Text>
            <Text className='privacy-list-item'>
              我们将在收到请求后的 15 个工作日内回复。
            </Text>
          </View>
        </View>
      </View>

      {/* ==================== 页脚 ==================== */}
      <View className='privacy-footer'>
        <Text className='privacy-footer-text'>
          最后更新日期：2026 年 5 月 1 日
        </Text>
      </View>
    </View>
  );
}
