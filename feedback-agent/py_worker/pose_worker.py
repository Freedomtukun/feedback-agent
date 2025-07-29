# py_worker/pose_worker.py (完全修正版)
import argparse
import json
import sys
import cv2
import numpy as np
import mediapipe as mp

# Initialize MediaPipe Pose
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

# Pose classification mapping
POSE_CLASSES = {
    'tree_pose': ['Tree Pose', '树式'],
    'warrior_pose': ['Warrior Pose', '战士式'],
    'downward_dog': ['Downward Dog', '下犬式'],
    'mountain_pose': ['Mountain Pose', '山式'],
    'child_pose': ['Child\'s Pose', '婴儿式'],
    'cobra_pose': ['Cobra Pose', '眼镜蛇式'],
    'triangle_pose': ['Triangle Pose', '三角式'],
    'bridge_pose': ['Bridge Pose', '桥式']
}

def classify_pose(landmarks):
    """
    Simple rule-based pose classification based on key angles.
    In production, use a trained classifier model.
    """
    # Extract key points
    left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
    right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER]
    left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
    right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP]
    left_knee = landmarks[mp_pose.PoseLandmark.LEFT_KNEE]
    right_knee = landmarks[mp_pose.PoseLandmark.RIGHT_KNEE]
    left_ankle = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE]
    right_ankle = landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE]
    
    # Calculate angles
    def calculate_angle(p1, p2, p3):
        v1 = np.array([p1.x - p2.x, p1.y - p2.y])
        v2 = np.array([p3.x - p2.x, p3.y - p2.y])
        cosine = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
        angle = np.arccos(np.clip(cosine, -1.0, 1.0))
        return np.degrees(angle)
    
    # Calculate key angles for classification
    left_hip_angle = calculate_angle(left_shoulder, left_hip, left_knee)
    right_hip_angle = calculate_angle(right_shoulder, right_hip, right_knee)
    left_knee_angle = calculate_angle(left_hip, left_knee, left_ankle)
    
    # Height differences
    knee_height_diff = abs(left_knee.y - right_knee.y)
    ankle_height_diff = abs(left_ankle.y - right_ankle.y)
    
    # Simple classification logic
    if left_hip_angle > 160 and right_hip_angle > 160:
        if knee_height_diff < 0.05:
            return 'mountain_pose'
        elif ankle_height_diff > 0.3:
            return 'tree_pose'
    elif left_hip_angle < 90 and right_hip_angle < 90:
        return 'child_pose'
    elif left_knee_angle > 150 or right_knee_angle > 150:
        if left_hip_angle < 120:
            return 'downward_dog'
        else:
            return 'cobra_pose'
    elif abs(left_knee.x - right_knee.x) > 0.3:
        return 'warrior_pose'
    elif left_hip.y < left_shoulder.y:
        return 'bridge_pose'
    else:
        return 'triangle_pose'

def detect_pose(image_path):
    """Detect pose using MediaPipe."""
    try:
        # Read image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Cannot read image: {image_path}")
        
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        h, w = image.shape[:2]
        
        # Process with MediaPipe
        with mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,
            min_detection_confidence=0.5
        ) as pose:
            results = pose.process(image_rgb)
            
            if not results.pose_landmarks:
                raise ValueError("No pose detected in image")
            
            # Extract keypoints
            keypoints = []
            for landmark in results.pose_landmarks.landmark:
                keypoints.append([landmark.x, landmark.y])
            
            # 修正：只传递一次 landmark
            pose_name = classify_pose(results.pose_landmarks.landmark)
            
            # Calculate confidence score
            avg_visibility = np.mean([lm.visibility for lm in results.pose_landmarks.landmark])
            score = float(avg_visibility)
            
            return {
                "pose_name": pose_name,
                "score": score,
                "keypoints": keypoints[:17]  # Return first 17 keypoints for COCO compatibility
            }
            
    except Exception as e:
        raise RuntimeError(f"Pose detection failed: {str(e)}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--image_path', required=True, help='Path to input image')
    args = parser.parse_args()
    
    try:
        result = detect_pose(args.image_path)
        print(json.dumps(result))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()