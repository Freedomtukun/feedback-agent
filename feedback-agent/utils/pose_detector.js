// utils/pose_detector.js (完全修正版)
const { spawn } = require('child_process');
const path = require('path');

const detectPose = (imagePath) => {
    return new Promise((resolve, reject) => {
        // 修正：确保正确的 Python 脚本路径
        const pythonScript = path.join(__dirname, '../py_worker/pose_worker.py');
        const python = spawn('python3', [pythonScript, '--image_path', imagePath]);
        
        let dataString = '';
        let errorString = '';
        
        python.stdout.on('data', (data) => {
            dataString += data.toString();
        });
        
        // 修正：正确处理 stderr
        python.stderr.on('data', (data) => {
            errorString += data.toString();
        });
        
        python.on('close', (code) => {
            if (code !== 0) {
                // 修正：确保错误信息被正确传递
                reject(new Error(`Pose detection failed with code ${code}: ${errorString}`));
                return;
            }
            
            try {
                const result = JSON.parse(dataString.trim());
                
                if (!result.pose_name || typeof result.score !== 'number' || !Array.isArray(result.keypoints)) {
                    throw new Error('Invalid pose detection result format');
                }
                
                resolve(result);
            } catch (error) {
                reject(new Error(`Failed to parse pose detection result: ${error.message}`));
            }
        });
        
        python.on('error', (error) => {
            reject(new Error(`Failed to spawn Python process: ${error.message}`));
        });
    });
};

module.exports = detectPose;