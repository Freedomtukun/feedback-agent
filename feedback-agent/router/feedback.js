/**
 * 通用反馈智能体模块
 * 支持文字输入、图像识别、语音识别三种方式
 */

const { buildFeedbackPrompt } = require('../prompts/feedback_prompt');
const { callLLM } = require('../utils/call_llm');
const { callWhisper } = require('../utils/call_whisper');
const { tts } = require('../utils/tts');

/**
 * 处理通用反馈请求
 * @param {object} params - 请求参数对象
 * @param {string} [params.input] - 用户文字输入
 * @param {string} [params.domain='yoga'] - 业务领域
 * @param {string} [params.intent='score_feedback'] - 意图标识
 * @param {string} [params.poseLabel] - 图像识别的体式名
 * @param {string} [params.audioUrl] - 语音文件URL
 * @param {object} context - 云函数上下文
 * @returns {object} 包含text和audioUrl的响应对象
 */
const handleFeedback = async (params, context) => {
    try {
        console.log('🎯 通用反馈请求开始处理');
        console.log('输入参数:', JSON.stringify({
            hasInput: !!params.input,
            domain: params.domain || 'yoga',
            intent: params.intent || 'score_feedback',
            hasPoseLabel: !!params.poseLabel,
            hasAudioUrl: !!params.audioUrl
        }));

        let input = params.input;
        const domain = params.domain || 'yoga';
        const intent = params.intent || 'score_feedback';
        const poseLabel = params.poseLabel;

        // 处理语音输入
        if (params.audioUrl && !input) {
            console.log('🎤 检测到语音输入，开始语音识别...');
            try {
                input = await callWhisper(params.audioUrl);
                console.log(`✅ 语音识别成功: ${input}`);
            } catch (whisperError) {
                console.error('❌ 语音识别失败:', whisperError);
                return {
                    text: "抱歉，语音识别失败，请尝试重新录制。",
                    audioUrl: null
                };
            }
        }

        // 验证输入
        if (!input && !poseLabel) {
            console.error('❌ 缺少有效输入');
            return {
                text: "请提供文字输入、语音输入或图像识别结果。",
                audioUrl: null
            };
        }

        // 构建提示词
        console.log('📝 构建提示词...');
        let prompt;
        try {
            prompt = buildFeedbackPrompt({
                input: input,
                domain: domain,
                intent: intent,
                poseLabel: poseLabel
            });
        } catch (promptError) {
            console.error('❌ 构建提示词失败:', promptError);
            return {
                text: `无法处理您的请求: ${promptError.message}`,
                audioUrl: null
            };
        }

        // 调用大模型
        console.log('🤖 调用大模型生成反馈...');
        let llmReply;
        try {
            llmReply = await callLLM(prompt);
            if (!llmReply) {
                throw new Error('大模型未返回有效内容');
            }
            llmReply = llmReply.trim();
            console.log('✅ 大模型生成成功');
        } catch (llmError) {
            console.error('❌ 大模型调用失败:', llmError);
            return {
                text: "抱歉，AI助手暂时无法响应，请稍后再试。",
                audioUrl: null
            };
        }

        // 语音合成
        console.log('🔊 开始语音合成...');
        let ttsAudioUrl = null;
        try {
            ttsAudioUrl = await tts(llmReply);
            if (ttsAudioUrl) {
                console.log('✅ 语音合成成功');
            } else {
                console.warn('⚠️ 语音合成未返回URL');
            }
        } catch (ttsError) {
            console.error('❌ 语音合成失败:', ttsError);
            // 语音合成失败不影响文字返回
        }

        // 返回结果
        const response = {
            text: llmReply,
            audioUrl: ttsAudioUrl
        };

        console.log('✅ 通用反馈处理完成');
        return response;

    } catch (error) {
        console.error('❌ 通用反馈处理异常:', error);
        return {
            text: "服务暂时不可用，请稍后重试。",
            audioUrl: null
        };
    }
};

module.exports = { handleFeedback };