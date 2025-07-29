# Feedback-Agent 通用反馈智能体

一个模块化、可扩展的云函数智能体，支持多领域的智能反馈功能。可用于瑜伽评分、作业辅导、健康建议等多种场景。

## 🎯 功能特性

- **多模态输入**：支持文字、语音、图像识别结果输入
- **多领域支持**：瑜伽、学习、健康、健身等可扩展领域
- **智能反馈**：基于大语言模型生成个性化建议
- **语音播报**：自动生成语音反馈，支持缓存优化
- **模块化设计**：易于扩展新的业务领域和意图

## 📦 快速开始

### 1. 安装依赖

```bash
# 使用 npm
npm install --production

# 或使用 pnpm
pnpm install --prod
```

### 2. 配置环境变量

创建 `.env` 文件（参考 `.env.example`）：

```bash
# 混元大模型配置
HUNYUAN_API_KEY=sk-your-api-key-here

# 腾讯云密钥
TC_SECRET_ID=AKIDyour-secret-id-here
TC_SECRET_KEY=your-secret-key-here

# COS 存储配置
COS_BUCKET=your-bucket-name

# Whisper 语音识别（可选）
WHISPER_ENDPOINT=http://localhost:5010/transcribe
```

### 3. COS 存储桶配置

- 创建 Standard 存储桶，地域：`ap-shanghai`
- 创建目录 `tts-cache/`，权限：公共读，私有写
- 配置 CORS：允许 `GET, HEAD` 方法

### 4. 部署到云函数

```bash
npm run deploy:tcb
```

## 🔧 使用示例

### 基础调用（文字输入）

```javascript
// 小程序端
wx.cloud.callFunction({
  name: 'feedback-agent',
  data: {
    type: 'feedback',
    domain: 'yoga',
    input: '我的下犬式膝盖总是弯曲'
  }
}).then(res => {
  console.log(res.result.text); // AI 反馈文字
  // 播放语音
  if (res.result.audioUrl) {
    const audio = wx.createInnerAudioContext();
    audio.src = res.result.audioUrl;
    audio.play();
  }
});
```

### 瑜伽评分反馈

```javascript
wx.cloud.callFunction({
  name: 'feedback-agent',
  data: {
    type: 'feedback',
    domain: 'yoga',
    intent: 'score_feedback',
    poseLabel: 'tree_pose',
    input: '得分78分，左膝角度不足'
  }
});
```

### 作业辅导

```javascript
wx.cloud.callFunction({
  name: 'feedback-agent',
  data: {
    type: 'feedback',
    domain: 'study',
    intent: 'ask_homework',
    input: '二次函数的顶点式怎么转换成一般式？'
  }
});
```

### 语音输入

```javascript
wx.cloud.callFunction({
  name: 'feedback-agent',
  data: {
    type: 'feedback',
    domain: 'health',
    audioUrl: 'https://example.com/voice.mp3' // 语音文件URL
  }
});
```

## 📁 项目结构

```
feedback-agent/
├── index.js                 # 云函数入口，路由分发
├── router/
│   └── feedback.js         # 通用反馈处理模块
├── prompts/
│   └── feedback_prompt.js  # 多领域提示词构建
├── utils/
│   ├── call_llm.js        # 大模型调用
│   ├── tts.js             # 语音合成
│   └── call_whisper.js    # 语音识别
├── config.js              # 配置管理
└── package.json
```

## 🚀 扩展新领域

### 1. 在 `prompts/feedback_prompt.js` 中添加新领域：

```javascript
if (domain === 'cooking' && intent === 'recipe_help') {
  return `用户在烹饪时遇到的问题是："${input}"，请提供实用的烹饪建议和技巧。`;
}
```

### 2. 调用时指定新领域：

```javascript
wx.cloud.callFunction({
  name: 'feedback-agent',
  data: {
    type: 'feedback',
    domain: 'cooking',
    intent: 'recipe_help',
    input: '炒菜总是粘锅怎么办？'
  }
});
```

## 📊 API 参数说明

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值：`feedback` |
| domain | string | 否 | 业务领域，默认：`general` |
| intent | string | 否 | 用户意图，默认：`feedback` |
| input | string | 条件必填 | 文字输入内容 |
| audioUrl | string | 条件必填 | 语音文件URL |
| poseLabel | string | 否 | 体式标签（yoga领域专用） |

### 响应格式

```json
{
  "code": 0,
  "data": {
    "text": "AI生成的反馈内容",
    "audioUrl": "https://cos-url/tts-audio.mp3"
  },
  "message": "success"
}
```

## 🔐 安全建议

1. **密钥管理**：
   - 使用环境变量存储敏感信息
   - 定期轮换 API 密钥
   - 创建新密钥后立即禁用旧密钥

2. **访问控制**：
   - 在云函数中配置访问鉴权
   - 限制调用频率防止滥用

3. **数据安全**：
   - 不存储用户敏感信息
   - 语音文件设置合理的过期时间

## 📝 许可证

ISC License

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目！

---

> 💡 **提示**：本项目基于腾讯云函数和混元大模型构建，确保已开通相关服务。