"""
ML Microservice - Flask API
Handles Sentiment Analysis and Fake News Detection
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from transformers import pipeline
import torch

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables for models
sentiment_analyzer = None
fake_news_detector = None

def load_models():
    """
    Load pre-trained ML models
    This runs once when the server starts
    """
    global sentiment_analyzer, fake_news_detector
    
    try:
        logger.info("Loading sentiment analysis model...")
        # Using DistilBERT for sentiment analysis (lightweight and fast)
        sentiment_analyzer = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english",
            device=0 if torch.cuda.is_available() else -1
        )
        logger.info("✓ Sentiment analysis model loaded successfully")
        
        logger.info("Loading fake news detection model...")
        # Using a text classification model for fake news detection
        # In production, you would use a specialized fake news detection model
        fake_news_detector = pipeline(
            "text-classification",
            model="hamzab/roberta-fake-news-classification",
            device=0 if torch.cuda.is_available() else -1
        )
        logger.info("✓ Fake news detection model loaded successfully")
        
    except Exception as e:
        logger.error(f"Error loading models: {str(e)}")
        raise

# Load models on startup
with app.app_context():
    load_models()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ML Microservice',
        'models_loaded': {
            'sentiment_analyzer': sentiment_analyzer is not None,
            'fake_news_detector': fake_news_detector is not None
        },
        'gpu_available': torch.cuda.is_available()
    }), 200

@app.route('/api/sentiment', methods=['POST'])
def analyze_sentiment():
    """
    Analyze sentiment of given text
    
    Request body:
    {
        "text": "Your text here"
    }
    
    Response:
    {
        "label": "POSITIVE" or "NEGATIVE",
        "score": 0.95,
        "sentiment": "positive" or "negative",
        "confidence": 95.5
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                'error': 'Text is required in request body'
            }), 400
        
        text = data['text']
        
        if not text or len(text.strip()) == 0:
            return jsonify({
                'error': 'Text cannot be empty'
            }), 400
        
        # Truncate text if too long (model limit is 512 tokens)
        if len(text) > 1000:
            text = text[:1000]
        
        # Perform sentiment analysis
        result = sentiment_analyzer(text)[0]
        
        # Normalize the response
        label = result['label']
        score = result['score']
        
        # Convert to standardized format
        sentiment = 'positive' if label == 'POSITIVE' else 'negative'
        
        # Calculate sentiment score (-1 to 1)
        sentiment_score = score if label == 'POSITIVE' else -score
        
        return jsonify({
            'label': label,
            'score': sentiment_score,
            'sentiment': sentiment,
            'confidence': round(score * 100, 2),
            'text_length': len(text)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in sentiment analysis: {str(e)}")
        return jsonify({
            'error': 'Failed to analyze sentiment',
            'details': str(e)
        }), 500

@app.route('/api/fake-news', methods=['POST'])
def detect_fake_news():
    """
    Detect if news article is fake
    
    Request body:
    {
        "text": "News article text",
        "title": "Article title (optional)"
    }
    
    Response:
    {
        "prediction": "REAL" or "FAKE",
        "confidence": 85.5,
        "is_fake": false,
        "score": 0.855
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                'error': 'Text is required in request body'
            }), 400
        
        text = data['text']
        title = data.get('title', '')
        
        if not text or len(text.strip()) == 0:
            return jsonify({
                'error': 'Text cannot be empty'
            }), 400
        
        # Combine title and text for better prediction
        combined_text = f"{title}. {text}" if title else text
        
        # Truncate if too long
        if len(combined_text) > 1000:
            combined_text = combined_text[:1000]
        
        # Perform fake news detection
        result = fake_news_detector(combined_text)[0]
        
        label = result['label']
        score = result['score']
        
        # Normalize labels (different models may use different labels)
        is_fake = label.upper() in ['FAKE', 'UNRELIABLE', 'FALSE']
        prediction = 'FAKE' if is_fake else 'REAL'
        
        return jsonify({
            'prediction': prediction,
            'confidence': round(score * 100, 2),
            'is_fake': is_fake,
            'score': score,
            'original_label': label,
            'text_length': len(combined_text)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in fake news detection: {str(e)}")
        return jsonify({
            'error': 'Failed to detect fake news',
            'details': str(e)
        }), 500

@app.route('/api/batch-sentiment', methods=['POST'])
def batch_sentiment_analysis():
    """
    Analyze sentiment for multiple texts
    
    Request body:
    {
        "texts": ["text1", "text2", "text3"]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({
                'error': 'Texts array is required in request body'
            }), 400
        
        texts = data['texts']
        
        if not isinstance(texts, list) or len(texts) == 0:
            return jsonify({
                'error': 'Texts must be a non-empty array'
            }), 400
        
        # Limit batch size
        if len(texts) > 50:
            return jsonify({
                'error': 'Maximum batch size is 50 texts'
            }), 400
        
        # Process all texts
        results = sentiment_analyzer(texts)
        
        # Format results
        formatted_results = []
        for i, result in enumerate(results):
            label = result['label']
            score = result['score']
            sentiment = 'positive' if label == 'POSITIVE' else 'negative'
            sentiment_score = score if label == 'POSITIVE' else -score
            
            formatted_results.append({
                'text': texts[i][:50] + '...' if len(texts[i]) > 50 else texts[i],
                'sentiment': sentiment,
                'score': sentiment_score,
                'confidence': round(score * 100, 2)
            })
        
        return jsonify({
            'results': formatted_results,
            'count': len(formatted_results)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in batch sentiment analysis: {str(e)}")
        return jsonify({
            'error': 'Failed to analyze sentiments',
            'details': str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("""
    ╔════════════════════════════════════════╗
    ║     ML Microservice - Flask API       ║
    ╠════════════════════════════════════════╣
    ║   Server: http://localhost:8000       ║
    ║   Status: Running ✓                   ║
    ║   GPU: {}                      ║
    ╚════════════════════════════════════════╝
    """.format('Enabled ✓' if torch.cuda.is_available() else 'Disabled'))
    
    app.run(
        host='0.0.0.0',
        port=8000,
        debug=False  # Set to False in production
    )