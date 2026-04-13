/**
 * Firebase 配置说明
 * ================
 * 你需要自己创建 Firebase 项目，步骤如下：
 *
 * 1. 访问 https://console.firebase.google.com
 * 2. 点击「添加项目」→ 输入项目名称（比如"幕墙管理系统"）
 * 3. 创建后进入「构建」→「Firestore Database」→「创建数据库」
 *    → 选择「测试模式」→ 选择离你最近的区域（如 Asia-east1）
 * 4. 进入「构建」→「Authentication」→「开始使用」
 *    → 启用「电子邮件/密码」登录方式
 * 5. 进入「项目设置」（齿轮图标）→ 滚动到「你的应用」→ 点击 web 图标
 *    → 注册应用，给它起个名字
 * 6. 复制 Firebase SDK 初始化配置，替换下面 firebaseConfig 的内容
 *
 * ⚠️ 安全规则：Firestore 测试模式下 30 天后需要设置安全规则
 *    正式使用前建议在 Firebase Console 中设置规则，限制只有登录用户才能读写
 *
 * 免费额度：Firestore 1GB 存储，50GB/月的读取/写入，足够小团队使用
 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
