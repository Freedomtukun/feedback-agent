// utils/score_rules.js (使用实际权重)
const poseScoreMultipliers = {
    'tree_pose': 1.05,      // 平衡难度较高，给予加分
    'warrior_pose': 1.0,    // 标准体式
    'downward_dog': 1.02,   // 需要柔韧性
    'mountain_pose': 1.1,   // 基础体式，鼓励正确完成
    'child_pose': 1.08,     // 休息体式，鼓励放松
    'cobra_pose': 1.03,     // 后弯体式
    'triangle_pose': 1.0,   // 标准体式
    'bridge_pose': 1.05     // 需要核心力量
};

function normalizeScore(rawScore, poseName) {
    if (typeof rawScore !== 'number' || rawScore < 0 || rawScore > 1) {
        throw new Error('Invalid raw score: must be between 0 and 1');
    }
    
    const multiplier = poseScoreMultipliers[poseName] || 1.0;
    let normalizedScore = rawScore * 100 * multiplier;
    
    // Apply smoothing curve
    if (normalizedScore < 50) {
        normalizedScore = normalizedScore * 0.8;
    } else if (normalizedScore > 85) {
        normalizedScore = 85 + (normalizedScore - 85) * 0.5;
    }
    
    // Ensure score is within bounds
    normalizedScore = Math.max(0, Math.min(100, normalizedScore));
    
    return Math.round(normalizedScore);
}

// Calculate score based on keypoint angles if model score is unavailable
function calculateAngleBasedScore(keypoints, poseName) {
    if (!keypoints || keypoints.length < 17) {
        return 50; // Default fallback score
    }
    
    // Check keypoint detection quality
    let detectedPoints = keypoints.filter(point => point[0] > 0 && point[1] > 0).length;
    let detectionScore = (detectedPoints / keypoints.length) * 100;
    
    // Apply pose-specific adjustments
    const poseAdjustments = {
        'tree_pose': 0.85,      // 平衡体式评分更严格
        'warrior_pose': 0.9,    
        'downward_dog': 0.88,
        'mountain_pose': 0.95,  // 基础体式评分更宽松
        'child_pose': 0.92,
        'cobra_pose': 0.87,
        'triangle_pose': 0.9,
        'bridge_pose': 0.85
    };
    
    const adjustment = poseAdjustments[poseName] || 0.9;
    return Math.round(detectionScore * adjustment);
}

module.exports = {
    normalizeScore,
    calculateAngleBasedScore
};