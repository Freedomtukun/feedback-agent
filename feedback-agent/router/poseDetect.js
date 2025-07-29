// router/poseDetect.js (完全修正版)
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const COS = require('cos-nodejs-sdk-v5');
const detectPose = require('../utils/pose_detector');
const { normalizeScore } = require('../utils/score_rules');
const { buildAdvicePrompt } = require('../utils/advice_prompt');
const { spawn } = require('child_process');

const unlinkAsync = promisify(fs.unlink);

// Initialize COS client
const cos = new COS({
    SecretId: process.env.COS_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY,
});

// 修正：改进的清理函数
async function cleanupTempFiles(...filePaths) {
    for (const filePath of filePaths) {
        try {
            if (fs.existsSync(filePath)) {
                await unlinkAsync(filePath);
                console.log(`Cleaned up: ${filePath}`);
            }
        } catch (error) {
            console.error(`Failed to cleanup ${filePath}:`, error);
        }
    }
}

module.exports = async (req, res) => {
    const { imageKey, needAdvice = false, needSkeleton = false } = req.body;
    
    if (!imageKey) {
        return res.status(400).json({ error: 'imageKey is required' });
    }
    
    const tempDir = '/tmp';
    const tempImagePath = path.join(tempDir, `${uuidv4()}.jpg`);
    const tempSkeletonPath = path.join(tempDir, `${uuidv4()}_skeleton.png`);
    
    try {
        // Download image from COS
        const imageBuffer = await new Promise((resolve, reject) => {
            cos.getObject({
                Bucket: process.env.COS_BUCKET,
                Region: process.env.COS_REGION,
                Key: imageKey,
            }, (err, data) => {
                if (err) reject(err);
                else resolve(data.Body);
            });
        });
        
        await fs.promises.writeFile(tempImagePath, imageBuffer);
        
        // Detect pose
        const poseResult = await detectPose(tempImagePath);
        const { pose_name, score: rawScore, keypoints } = poseResult;
        
        // Normalize score
        const score = normalizeScore(rawScore, pose_name);
        
        const result = {
            pose: pose_name,
            score: score
        };
        
        // Generate skeleton if needed
        if (needSkeleton && keypoints) {
            const skeletonScript = path.join(__dirname, '../py_worker/skeleton_draw.py');
            
            await new Promise((resolve, reject) => {
                const python = spawn('python3', [
                    skeletonScript,
                    '--image_path', tempImagePath,
                    '--keypoints', JSON.stringify(keypoints),
                    '--output_path', tempSkeletonPath,
                    '--pose_name', pose_name,
                    '--score', score.toString()
                ]);
                
                let errorOutput = '';
                
                python.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });
                
                python.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Skeleton drawing failed: ${errorOutput}`));
                    } else {
                        resolve();
                    }
                });
                
                python.on('error', (error) => {
                    reject(new Error(`Failed to spawn skeleton drawing process: ${error.message}`));
                });
            });
            
            // Upload skeleton to CDN
            const skeletonBuffer = await fs.promises.readFile(tempSkeletonPath);
            const skeletonKey = `skeleton/${uuidv4()}.png`;
            
            await new Promise((resolve, reject) => {
                cos.putObject({
                    Bucket: process.env.COS_BUCKET,
                    Region: process.env.COS_REGION,
                    Key: skeletonKey,
                    Body: skeletonBuffer,
                    ContentType: 'image/png',
                }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
            
            // 修正：确保 CDN URL 被正确设置
            const cdnDomain = process.env.CDN_DOMAIN || `${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com`;
            result.skeleton_url = `https://${cdnDomain}/${skeletonKey}`;
        }
        
        // Generate advice if needed
        if (needAdvice) {
            const advicePromptCn = buildAdvicePrompt(pose_name, score, 'zh');
            const advicePromptEn = buildAdvicePrompt(pose_name, score, 'en');
            
            // TODO: 调用 LLM API 生成实际建议
            // const advice = await callLLM(advicePromptCn);
            
            // 暂时返回提示词作为占位
            result.advice_cn = advicePromptCn;
            result.advice_en = advicePromptEn;
        }
        
        // 发送响应
        res.json(result);
        
    } catch (error) {
        console.error('Error in poseDetect:', error);
        res.status(500).json({ error: error.message });
    } finally {
        // 修正：确保临时文件被清理
        await cleanupTempFiles(tempImagePath, tempSkeletonPath);
    }
};