// utils/advice_prompt.js (完全修正版)
// 修正：在文件顶部定义 poseNameMapping
const poseNameMapping = {
    'tree_pose': { zh: '树式', en: 'Tree Pose' },
    'warrior_pose': { zh: '战士式', en: 'Warrior Pose' },
    'downward_dog': { zh: '下犬式', en: 'Downward Dog' },
    'mountain_pose': { zh: '山式', en: 'Mountain Pose' },
    'child_pose': { zh: '婴儿式', en: 'Child\'s Pose' },
    'cobra_pose': { zh: '眼镜蛇式', en: 'Cobra Pose' },
    'triangle_pose': { zh: '三角式', en: 'Triangle Pose' },
    'bridge_pose': { zh: '桥式', en: 'Bridge Pose' }
};

function buildAdvicePrompt(poseName, score, lang = 'zh') {
    // 现在 poseNameMapping 已定义，不会出现 ReferenceError
    const poseDisplay = poseNameMapping[poseName] || { zh: poseName, en: poseName };
    
    if (lang === 'zh') {
        return `作为一名专业的瑜伽教练，请根据学员练习${poseDisplay.zh}体式的表现（得分：${score}分，满分100分），提供具体的改进建议。请包含：
1. 对当前表现的肯定和鼓励
2. 2-3个具体的改进要点
3. 练习该体式的注意事项
请用温和友善的语气，字数控制在150字以内。`;
    } else {
        return `As a professional yoga instructor, please provide specific improvement advice based on the student's ${poseDisplay.en} performance (score: ${score} out of 100). Please include:
1. Acknowledgment and encouragement for current performance
2. 2-3 specific improvement points
3. Important notes for practicing this pose
Please use a warm and friendly tone, keeping it under 100 words.`;
    }
}

// 修正：导出所有需要的内容
module.exports = {
    buildAdvicePrompt,
    poseNameMapping
};