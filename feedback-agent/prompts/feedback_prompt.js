/**
 * 通用反馈提示词构建器
 * 支持多领域、多意图的提示词生成
 */

/**
 * 构建跨领域的反馈提示词
 * @param {object} options - 构建选项
 * @param {string} options.input - 用户输入内容
 * @param {string} [options.domain='general'] - 应用领域
 * @param {string} [options.intent='feedback'] - 用户意图
 * @param {string} [options.poseLabel] - 可选体式名称（仅用于yoga场景）
 * @returns {string} 构建好的提示词
 */
function buildFeedbackPrompt(options = {}) {
    const {
        input,
        domain = 'general',
        intent = 'feedback',
        poseLabel
    } = options;

    // 验证必需参数
    if (!input) {
        throw new Error('缺少必需参数: input');
    }

    // 根据domain和intent构建不同的提示词
    if (domain === 'yoga' && intent === 'score_feedback') {
        if (!poseLabel) {
            return `用户说："${input}"，这似乎是关于瑜伽练习的反馈。请根据描述给出温柔和鼓励的练习建议，帮助改进体式动作。`;
        }
        return `用户正在练习瑜伽体式：${poseLabel}，他们说："${input}"，请根据姿势名称和描述给出练习建议，尽量温柔和鼓励。`;
    }

    if (domain === 'study' && intent === 'ask_homework') {
        return `学生的问题是："${input}"，请提供清晰、简洁、适合初中生理解的解释。`;
    }

    if (domain === 'health' && intent === 'ask_advice') {
        return `用户的健康相关问题是："${input}"，请提供科学、谨慎的健康建议，并提醒必要时咨询专业医生。`;
    }

    if (domain === 'fitness' && intent === 'training_feedback') {
        return `用户在健身训练中说："${input}"，请给出专业的运动指导和鼓励，注意安全提示。`;
    }

    if (domain === 'cooking' && intent === 'recipe_help') {
        return `用户在烹饪时遇到的问题是："${input}"，请提供实用的烹饪建议和技巧。`;
    }

    if (domain === 'language' && intent === 'pronunciation_feedback') {
        return `用户在语言学习中说："${input}"，请提供发音纠正和学习建议，保持耐心和鼓励。`;
    }

    // 默认通用格式
    return `用户说："${input}"，请根据上下文提供帮助建议。`;
}

module.exports = { buildFeedbackPrompt };