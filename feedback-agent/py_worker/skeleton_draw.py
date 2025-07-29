# py_worker/skeleton_draw.py (CORRECTED - note the correct path)
import argparse
import json
import cv2
import numpy as np
from typing import List, Tuple, Optional
import sys

# BlazePose connection pairs for skeleton drawing
POSE_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 7),  # Face
    (0, 4), (4, 5), (5, 6), (6, 8),  # Face
    (9, 10),  # Mouth
    (11, 12), (11, 13), (13, 15),  # Right arm
    (12, 14), (14, 16),  # Left arm
    (11, 23), (12, 24), (23, 24),  # Torso
    (23, 25), (25, 27), (27, 29), (29, 31), (31, 27),  # Right leg
    (24, 26), (26, 28), (28, 30), (30, 32), (32, 28),  # Left leg
]

def draw_skeleton(image_path: str, keypoints: List[Tuple[float, float]], 
                 output_path: str, pose_name: Optional[str] = None, 
                 score: Optional[float] = None) -> None:
    """Draw skeleton overlay on image with keypoints."""
    
    # Load image
    try:
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Failed to load image: {image_path}")
    except Exception as e:
        raise RuntimeError(f"Error loading image: {str(e)}")
    
    h, w = img.shape[:2]
    
    # Create overlay for transparency
    overlay = img.copy()
    
    # Validate keypoints
    if not keypoints or len(keypoints) < 17:
        raise ValueError("Invalid keypoints: minimum 17 points required")
    
    # Convert normalized coordinates to pixel coordinates if needed
    points = []
    for kp in keypoints:
        if 0 <= kp[0] <= 1 and 0 <= kp[1] <= 1:
            # Normalized coordinates
            x = int(kp[0] * w)
            y = int(kp[1] * h)
        else:
            # Already in pixel coordinates
            x = int(kp[0])
            y = int(kp[1])
        points.append((x, y))
    
    # Draw skeleton connections
    for connection in POSE_CONNECTIONS:
        if connection[0] < len(points) and connection[1] < len(points):
            pt1 = points[connection[0]]
            pt2 = points[connection[1]]
            
            # Skip invalid points
            if pt1[0] > 0 and pt1[1] > 0 and pt2[0] > 0 and pt2[1] > 0:
                cv2.line(overlay, pt1, pt2, (0, 255, 0), 3, cv2.LINE_AA)
    
    # Draw keypoints
    for i, point in enumerate(points):
        if point[0] > 0 and point[1] > 0:
            cv2.circle(overlay, point, 5, (0, 0, 255), -1, cv2.LINE_AA)
            cv2.circle(overlay, point, 7, (255, 255, 255), 1, cv2.LINE_AA)
    
    # Add pose name and score if provided
    if pose_name or score is not None:
        font = cv2.FONT_HERSHEY_SIMPLEX
        y_offset = 30
        
        if pose_name:
            text = f"Pose: {pose_name.replace('_', ' ').title()}"
            cv2.putText(overlay, text, (10, y_offset), font, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
            cv2.putText(overlay, text, (10, y_offset), font, 0.7, (0, 0, 0), 1, cv2.LINE_AA)
            y_offset += 30
        
        if score is not None:
            text = f"Score: {score}/100"
            cv2.putText(overlay, text, (10, y_offset), font, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
            cv2.putText(overlay, text, (10, y_offset), font, 0.7, (0, 0, 0), 1, cv2.LINE_AA)
    
    # Blend overlay with original image
    result = cv2.addWeighted(img, 0.3, overlay, 0.7, 0)
    
    # Save as PNG with high quality
    cv2.imwrite(output_path, result, [cv2.IMWRITE_PNG_COMPRESSION, 1])

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--image_path', required=True, help='Path to input image')
    parser.add_argument('--keypoints', required=True, help='JSON string of keypoints')
    parser.add_argument('--output_path', required=True, help='Path to output skeleton image')
    parser.add_argument('--pose_name', default='', help='Name of the detected pose')
    parser.add_argument('--score', type=float, default=-1, help='Pose score')
    
    args = parser.parse_args()
    
    try:
        keypoints = json.loads(args.keypoints)
        draw_skeleton(
            args.image_path,
            keypoints,
            args.output_path,
            args.pose_name if args.pose_name else None,
            args.score if args.score >= 0 else None
        )
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)