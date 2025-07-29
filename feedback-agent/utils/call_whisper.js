#!/usr/bin/env python3
import os
import tempfile
import logging
from pathlib import Path
from flask import Flask, request, jsonify
import whisper
import numpy as np

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 初始化 Flask 应用
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB 文件大小限制

# 支持的音频格式
ALLOWED_EXTENSIONS = {'mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'webm'}

# 加载 Whisper 模型
MODEL_PATH = "/home/ubuntu/yoga-pose-api/models/whisper"
logger.info(f"Loading Whisper model from {MODEL_PATH}")
try:
    model = whisper.load_model("small", download_root=MODEL_PATH)
    logger.info("Whisper model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load Whisper model: {e}")
    raise


def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/transcribe', methods=['POST'])
def transcribe():
    """处理音频转写请求"""
    temp_file_path = None
    
    try:
        # 检查是否有文件上传
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        file = request.files['audio']
        
        # 检查文件名
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # 检查文件格式
        if not allowed_file(file.filename):
            return jsonify({
                'error': f'Unsupported file format. Allowed formats: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400
        
        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
            temp_file_path = tmp_file.name
            file.save(temp_file_path)
            logger.info(f"Saved temporary file: {temp_file_path}")
        
        # 使用 Whisper 进行转写
        logger.info("Starting transcription...")
        result = model.transcribe(temp_file_path)
        
        # 提取结果
        text = result.get('text', '').strip()
        language = result.get('language', 'unknown')
        
        logger.info(f"Transcription completed. Language: {language}")
        
        # 返回结果
        return jsonify({
            'text': text,
            'language': language
        }), 200
        
    except Exception as e:
        logger.error(f"Error during transcription: {str(e)}")
        return jsonify({'error': f'Transcription failed: {str(e)}'}), 500
        
    finally:
        # 清理临时文件
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.info(f"Cleaned up temporary file: {temp_file_path}")
            except Exception as e:
                logger.error(f"Failed to delete temporary file: {e}")


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({'status': 'healthy', 'model': 'small'}), 200


@app.errorhandler(413)
def request_entity_too_large(error):
    """处理文件过大错误"""
    return jsonify({'error': 'File too large. Maximum size is 100MB'}), 413


@app.errorhandler(500)
def internal_server_error(error):
    """处理内部服务器错误"""
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)