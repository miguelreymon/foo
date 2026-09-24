from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import re
import secrets
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google import genai
from google.genai import types
import json
import math
import asyncio
import httpx

# Firebase imports
import firebase_admin
from firebase_admin import credentials, firestore

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Firebase/Firestore connection
# Build credentials from environment variables
firebase_project_id = os.environ.get('FIREBASE_PROJECT_ID')
firebase_private_key = os.environ.get('FIREBASE_PRIVATE_KEY')
firebase_client_email = os.environ.get('FIREBASE_CLIENT_EMAIL')

if firebase_project_id and firebase_private_key and firebase_client_email:
    # Build credentials dict from environment variables
    cred_dict = {
        "type": os.environ.get('FIREBASE_TYPE', 'service_account'),
        "project_id": firebase_project_id,
        "private_key_id": os.environ.get('FIREBASE_PRIVATE_KEY_ID'),
        "private_key": firebase_private_key,
        "client_email": firebase_client_email,
        "client_id": os.environ.get('FIREBASE_CLIENT_ID'),
        "auth_uri": os.environ.get('FIREBASE_AUTH_URI', 'https://accounts.google.com/o/oauth2/auth'),
        "token_uri": os.environ.get('FIREBASE_TOKEN_URI', 'https://oauth2.googleapis.com/token'),
        "auth_provider_x509_cert_url": os.environ.get('FIREBASE_AUTH_PROVIDER_CERT_URL', 'https://www.googleapis.com/oauth2/v1/certs'),
        "client_x509_cert_url": os.environ.get('FIREBASE_CLIENT_CERT_URL'),
        "universe_domain": os.environ.get('FIREBASE_UNIVERSE_DOMAIN', 'googleapis.com')
    }
    cred = credentials.Certificate(cred_dict)
    logger.info("🔥 Firebase credentials loaded from environment variables")
else:
    # Fallback: try to load from JSON string or file
    firebase_creds_json = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS_JSON')
    if firebase_creds_json:
        import json
        cred_dict = json.loads(firebase_creds_json)
        cred = credentials.Certificate(cred_dict)
        logger.info("🔥 Firebase credentials loaded from GOOGLE_APPLICATION_CREDENTIALS_JSON")
    else:
        # Last resort: use file (for local development)
        cred = credentials.Certificate(ROOT_DIR / 'firebase-credentials.json')
        logger.info("🔥 Firebase credentials loaded from firebase-credentials.json file")

firebase_admin.initialize_app(cred)
firestore_db = firestore.client()

# Firestore collections
analyses_ref = firestore_db.collection('analyses')
channels_ref = firestore_db.collection('channels')
reports_ref = firestore_db.collection('reports')
tracked_channels_ref = firestore_db.collection('tracked_channels')
scheduled_analyses_ref = firestore_db.collection('scheduled_analyses')
youtube_cache_ref = firestore_db.collection('youtube_cache')
channel_cards_ref = firestore_db.collection('channel_cards')
medusa_batches_ref = firestore_db.collection('medusa_batches')

# ============= YOUTUBE CACHE SYSTEM =============

class YouTubeCache:
    """Cache system for YouTube API responses to reduce quota usage"""
    
    CACHE_DURATION_HOURS = 6  # Cache videos list for 6 hours
    
    @staticmethod
    async def get_channel_videos(channel_id: str):
        """Get cached channel videos"""
        try:
            cache_key = f"channel_videos_{channel_id}"
            doc = youtube_cache_ref.document(cache_key).get()
            if doc.exists:
                data = doc.to_dict()
                cached_at = data.get("cached_at", "")
                if cached_at:
                    cached_time = datetime.fromisoformat(cached_at.replace('Z', '+00:00'))
                    hours_old = (datetime.now(timezone.utc) - cached_time).total_seconds() / 3600
                    if hours_old < YouTubeCache.CACHE_DURATION_HOURS:
                        logger.info(f"Cache HIT for channel videos: {channel_id}")
                        return data.get("videos", [])
            return None
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
    
    @staticmethod
    async def set_channel_videos(channel_id: str, videos: list):
        """Cache channel videos"""
        try:
            cache_key = f"channel_videos_{channel_id}"
            youtube_cache_ref.document(cache_key).set({
                "channel_id": channel_id,
                "videos": videos,
                "cached_at": datetime.now(timezone.utc).isoformat(),
                "video_count": len(videos)
            })
            logger.info(f"Cache SET for channel videos: {channel_id} ({len(videos)} videos)")
        except Exception as e:
            logger.error(f"Cache set error: {e}")
    
    @staticmethod
    async def get_video_info(video_id: str):
        """Get cached video info"""
        try:
            cache_key = f"video_info_{video_id}"
            doc = youtube_cache_ref.document(cache_key).get()
            if doc.exists:
                data = doc.to_dict()
                cached_at = data.get("cached_at", "")
                if cached_at:
                    cached_time = datetime.fromisoformat(cached_at.replace('Z', '+00:00'))
                    hours_old = (datetime.now(timezone.utc) - cached_time).total_seconds() / 3600
                    if hours_old < 24:  # Video info cached for 24 hours
                        logger.info(f"Cache HIT for video info: {video_id}")
                        return data.get("info")
            return None
        except Exception as e:
            logger.error(f"Cache get video error: {e}")
            return None
    
    @staticmethod
    async def set_video_info(video_id: str, info: dict):
        """Cache video info"""
        try:
            cache_key = f"video_info_{video_id}"
            youtube_cache_ref.document(cache_key).set({
                "video_id": video_id,
                "info": info,
                "cached_at": datetime.now(timezone.utc).isoformat()
            })
            logger.info(f"Cache SET for video info: {video_id}")
        except Exception as e:
            logger.error(f"Cache set video error: {e}")
    
    @staticmethod
    async def get_channel_info(channel_id: str):
        """Get cached channel info"""
        try:
            cache_key = f"channel_info_{channel_id}"
            doc = youtube_cache_ref.document(cache_key).get()
            if doc.exists:
                data = doc.to_dict()
                cached_at = data.get("cached_at", "")
                if cached_at:
                    cached_time = datetime.fromisoformat(cached_at.replace('Z', '+00:00'))
                    hours_old = (datetime.now(timezone.utc) - cached_time).total_seconds() / 3600
                    if hours_old < 24:  # Channel info cached for 24 hours
                        logger.info(f"Cache HIT for channel info: {channel_id}")
                        return data.get("info")
            return None
        except Exception as e:
            logger.error(f"Cache get channel error: {e}")
            return None
    
    @staticmethod
    async def set_channel_info(channel_id: str, info: dict):
        """Cache channel info"""
        try:
            cache_key = f"channel_info_{channel_id}"
            youtube_cache_ref.document(cache_key).set({
                "channel_id": channel_id,
                "info": info,
                "cached_at": datetime.now(timezone.utc).isoformat()
            })
            logger.info(f"Cache SET for channel info: {channel_id}")
        except Exception as e:
            logger.error(f"Cache set channel error: {e}")

# ============= FIRESTORE HELPER FUNCTIONS =============

class FirestoreDB:
    """Wrapper class to provide MongoDB-like interface for Firestore"""
    
    def __init__(self, collection_ref):
        self.collection = collection_ref
    
    async def find_one(self, query: dict, projection: dict = None, sort: list = None):
        """Find a single document matching the query"""
        try:
            ref = self.collection
            
            # Apply query filters (without combining with sort to avoid index requirements)
            for key, value in query.items():
                if key != "_id" and not isinstance(value, dict):
                    ref = ref.where(filter=firestore.FieldFilter(key, "==", value))
            
            # Get documents and sort in memory if needed
            docs = list(ref.stream())
            
            if not docs:
                return None
            
            # Sort in memory if sort is provided
            if sort and docs:
                results = [doc.to_dict() for doc in docs]
                for field, direction in reversed(sort):
                    reverse = direction == -1
                    results.sort(key=lambda x: x.get(field, ""), reverse=reverse)
                return results[0] if results else None
            
            return docs[0].to_dict()
        except Exception as e:
            logger.error(f"Firestore find_one error: {e}")
            return None
    
    async def insert_one(self, data: dict):
        """Insert a single document"""
        try:
            doc_id = data.get("id", str(uuid.uuid4()))
            self.collection.document(doc_id).set(data)
            return {"inserted_id": doc_id}
        except Exception as e:
            logger.error(f"Firestore insert_one error: {e}")
            raise
    
    async def update_one(self, query: dict, update: dict):
        """Update a single document"""
        try:
            # Find the document first
            doc_id = query.get("id")
            if not doc_id:
                # Search by other fields
                docs = self.collection.limit(1)
                for key, value in query.items():
                    if key != "_id":
                        docs = docs.where(key, "==", value)
                for doc in docs.stream():
                    doc_id = doc.id
                    break
            
            if doc_id:
                # Handle $set operator
                if "$set" in update:
                    self.collection.document(doc_id).update(update["$set"])
                else:
                    self.collection.document(doc_id).update(update)
                return {"modified_count": 1}
            return {"modified_count": 0}
        except Exception as e:
            logger.error(f"Firestore update_one error: {e}")
            return {"modified_count": 0}
    
    async def delete_one(self, query: dict):
        """Delete a single document"""
        try:
            doc_id = query.get("id")
            if not doc_id:
                # Search by other fields
                docs = self.collection.limit(1)
                for key, value in query.items():
                    if key != "_id":
                        docs = docs.where(key, "==", value)
                for doc in docs.stream():
                    doc_id = doc.id
                    break
            
            if doc_id:
                self.collection.document(doc_id).delete()
                return {"deleted_count": 1}
            return {"deleted_count": 0}
        except Exception as e:
            logger.error(f"Firestore delete_one error: {e}")
            return {"deleted_count": 0}
    
    async def count_documents(self, query: dict):
        """Count documents matching the query"""
        try:
            ref = self.collection
            for key, value in query.items():
                if key != "_id" and not isinstance(value, dict):
                    ref = ref.where(key, "==", value)
                elif isinstance(value, dict) and "$gte" in value:
                    ref = ref.where(key, ">=", value["$gte"])
            
            count = 0
            for _ in ref.stream():
                count += 1
            return count
        except Exception as e:
            logger.error(f"Firestore count_documents error: {e}")
            return 0
    
    def find(self, query: dict = None, projection: dict = None):
        """Return a cursor-like object for iteration"""
        return FirestoreCursor(self.collection, query or {})
    
    async def distinct(self, field: str):
        """Get distinct values for a field"""
        try:
            values = set()
            for doc in self.collection.stream():
                data = doc.to_dict()
                if field in data:
                    values.add(data[field])
            return list(values)
        except Exception as e:
            logger.error(f"Firestore distinct error: {e}")
            return []
    
    def aggregate(self, pipeline: list):
        """Basic aggregation support - returns cursor-like object"""
        return FirestoreAggregation(self.collection, pipeline)

class FirestoreCursor:
    """Cursor-like object for Firestore queries"""
    
    def __init__(self, collection, query):
        self.collection = collection
        self.query = query
        self._sort_field = None
        self._sort_direction = None
        self._limit_val = None
    
    def sort(self, field_or_list, direction=None):
        """Sort results"""
        if isinstance(field_or_list, list):
            # Handle list of tuples [(field, direction), ...]
            if field_or_list:
                self._sort_field = field_or_list[0][0]
                self._sort_direction = field_or_list[0][1]
        elif isinstance(field_or_list, str):
            self._sort_field = field_or_list
            self._sort_direction = direction if direction else firestore.Query.DESCENDING
        return self
    
    def limit(self, n):
        """Limit results"""
        self._limit_val = n
        return self
    
    async def to_list(self, length=None):
        """Convert to list"""
        try:
            ref = self.collection
            
            # Apply query filters
            for key, value in self.query.items():
                if key == "_id":
                    continue
                if isinstance(value, dict):
                    if "$exists" in value:
                        continue  # Skip $exists queries
                else:
                    ref = ref.where(filter=firestore.FieldFilter(key, "==", value))
            
            # Get all docs first
            docs = list(ref.stream())
            results = [doc.to_dict() for doc in docs]
            
            # Sort in memory to avoid index requirements
            if self._sort_field and results:
                reverse = self._sort_direction == -1
                # Handle mixed types by converting to comparable values
                def sort_key(x):
                    val = x.get(self._sort_field)
                    if val is None:
                        return (0, 0)  # Put None values first/last
                    if isinstance(val, (int, float)):
                        return (1, val)
                    return (1, str(val))
                results.sort(key=sort_key, reverse=reverse)
            
            # Apply limit
            limit = self._limit_val or length or 100
            return results[:limit]
        except Exception as e:
            logger.error(f"Firestore to_list error: {e}")
            return []

class FirestoreAggregation:
    """Basic aggregation support for Firestore"""
    
    def __init__(self, collection, pipeline):
        self.collection = collection
        self.pipeline = pipeline
    
    async def to_list(self, length=None):
        """Execute aggregation and return results"""
        try:
            ref = self.collection
            
            # Apply $match stage
            for stage in self.pipeline:
                if "$match" in stage:
                    match_conditions = stage["$match"]
                    
                    # Skip $or queries entirely - process in memory
                    if "$or" in match_conditions:
                        continue
                    
                    for key, value in match_conditions.items():
                        if key.startswith("$"):
                            continue  # Skip MongoDB operators
                        if not isinstance(value, dict):
                            ref = ref.where(filter=firestore.FieldFilter(key, "==", value))
            
            # Collect all documents
            docs_data = [doc.to_dict() for doc in ref.stream()]
            
            # Apply $or filter in memory if present
            for stage in self.pipeline:
                if "$match" in stage and "$or" in stage["$match"]:
                    or_conditions = stage["$match"]["$or"]
                    filtered_docs = []
                    for doc in docs_data:
                        for condition in or_conditions:
                            match = True
                            for field, expected in condition.items():
                                if isinstance(expected, dict):
                                    # Handle operators like $gte
                                    if "$gte" in expected:
                                        if doc.get(field, 0) < expected["$gte"]:
                                            match = False
                                            break
                                else:
                                    if doc.get(field) != expected:
                                        match = False
                                        break
                            if match:
                                filtered_docs.append(doc)
                                break
                    docs_data = filtered_docs
            
            count = len(docs_data)
            
            if count == 0:
                return []
            
            # Process $group stage
            for stage in self.pipeline:
                if "$group" in stage:
                    group_result = {"_id": None}
                    group_spec = stage["$group"]
                    
                    for key, value in group_spec.items():
                        if key == "_id":
                            continue
                        
                        if isinstance(value, dict):
                            # $sum
                            if "$sum" in value:
                                if value["$sum"] == 1:
                                    group_result[key] = count
                                else:
                                    field = value["$sum"].replace("$", "")
                                    group_result[key] = sum(d.get(field, 0) or 0 for d in docs_data)
                            
                            # $avg
                            elif "$avg" in value:
                                field = value["$avg"].replace("$", "")
                                values = [d.get(field, 0) or 0 for d in docs_data]
                                group_result[key] = sum(values) / len(values) if values else 0
                    
                    return [group_result]
            
            # Handle $count stage
            for stage in self.pipeline:
                if "$count" in stage:
                    return [{"total": count}]
            
            # Handle $unwind and nested queries (for hate comments count)
            for stage in self.pipeline:
                if "$unwind" in stage:
                    # For counting comments with specific conditions
                    hate_count = 0
                    for doc in docs_data:
                        comments = doc.get("comments", [])
                        for comment in comments:
                            if comment.get("is_hate") or comment.get("hate_score", 0) >= 0.5:
                                hate_count += 1
                    return [{"total": hate_count}]
            
            return docs_data
        except Exception as e:
            logger.error(f"Firestore aggregation error: {e}")
            return []

# Create MongoDB-compatible interface for Firestore
class DB:
    def __init__(self):
        self.analyses = FirestoreDB(analyses_ref)
        self.channels = FirestoreDB(channels_ref)
        self.reports = FirestoreDB(reports_ref)
        self.tracked_channels = FirestoreDB(tracked_channels_ref)
        self.scheduled_analyses = FirestoreDB(scheduled_analyses_ref)
        self.channel_cards = FirestoreDB(channel_cards_ref)
        self.medusa_batches = FirestoreDB(medusa_batches_ref)

db = DB()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Admin security
security = HTTPBasic()
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'socialhate2024')

def verify_admin(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, ADMIN_USERNAME)
    correct_password = secrets.compare_digest(credentials.password, ADMIN_PASSWORD)
    if not (correct_username and correct_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return credentials.username

# ============= MODELS =============

class AdminLogin(BaseModel):
    username: str
    password: str

class CommentReport(BaseModel):
    comment_id: str
    comment_text: str
    comment_author: str
    video_id: str
    video_title: str
    current_sentiment: str
    current_is_hate: bool
    hate_score: float

class ReportResolution(BaseModel):
    status: str  # approved, corrected
    corrected_sentiment: Optional[str] = None
    corrected_is_hate: Optional[bool] = None

class ChannelSearch(BaseModel):
    query: str
    max_results: int = 10

class TrackedChannel(BaseModel):
    channel_id: str
    channel_name: str
    thumbnail_url: Optional[str] = None
    category: str = "general"
    auto_analyze: bool = True
    delay_hours: int = 24

class ScheduledAnalysis(BaseModel):
    video_id: str
    video_title: str
    channel_id: str
    channel_name: str
    scheduled_for: datetime
    status: str = "pending"  # pending, completed, failed

class AnalyzeRequest(BaseModel):
    youtube_url: str
    channel_id: Optional[str] = None  # Link to a channel if provided

class ChannelCreate(BaseModel):
    name: str
    youtube_channel_id: str
    category: str = "general"  # foodies, gaming, tech, etc.
    thumbnail_url: Optional[str] = None
    description: Optional[str] = None

class Channel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    youtube_channel_id: str
    category: str
    thumbnail_url: Optional[str] = None
    description: Optional[str] = None
    total_videos_analyzed: int = 0
    avg_hate_percentage: float = 0
    avg_positive_percentage: float = 0
    avg_negative_percentage: float = 0
    total_comments_analyzed: int = 0
    toxicity_level: str = "low"
    last_analysis_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommentAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore")
    comment_id: str
    author: str
    text: str
    likes: int
    published_at: str
    sentiment_score: float  # -1 to 1
    hate_score: float  # 0 to 1
    sentiment_label: str  # positive, negative, neutral
    is_hate: bool

class WordRanking(BaseModel):
    word: str
    count: int
    category: str  # hate, positive, negative, neutral

class TrendingTopic(BaseModel):
    topic: str
    mentions: int
    sentiment: str

class EngagementMetrics(BaseModel):
    engagement_rate: float  # (likes + comments) / views * 100
    like_to_view_ratio: float
    comment_to_view_ratio: float
    avg_comment_length: float
    most_active_commenters: List[Dict[str, Any]]

class EmotionAnalysis(BaseModel):
    joy: float
    anger: float
    sadness: float
    fear: float
    surprise: float
    disgust: float

class ContentInsights(BaseModel):
    questions_count: int
    suggestions_count: int
    complaints_count: int
    praise_count: int
    spam_count: int
    key_themes: List[str]
    audience_requests: List[str]

class AnalysisResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    video_id: str
    video_title: str
    channel_name: str
    thumbnail_url: str
    view_count: int
    like_count: int
    comment_count: int
    total_comments_analyzed: int
    hate_percentage: float
    positive_percentage: float
    negative_percentage: float
    neutral_percentage: float
    average_sentiment: float
    word_rankings: List[WordRanking]
    trending_topics: List[TrendingTopic]
    comments: List[CommentAnalysis]
    # New enhanced metrics
    toxicity_level: str = "low"  # low, moderate, high, severe
    engagement_metrics: Optional[Dict[str, Any]] = None
    emotion_breakdown: Optional[Dict[str, float]] = None
    content_insights: Optional[Dict[str, Any]] = None
    controversial_comments: List[Dict[str, Any]] = []
    top_supporters: List[Dict[str, Any]] = []
    top_critics: List[Dict[str, Any]] = []
    spam_percentage: float = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "pending"  # pending, processing, completed, error

class AnalysisSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    video_title: Optional[str] = None
    channel_name: Optional[str] = None
    thumbnail_url: Optional[str] = None
    hate_percentage: Optional[float] = None
    comment_count: Optional[int] = None
    created_at: datetime
    status: str
    platform: Optional[str] = None
    error: Optional[str] = None

# ============= YOUTUBE SERVICE =============

def get_youtube_api_key():
    """Get YouTube API key from environment"""
    key = os.environ.get('YOUTUBE_API_KEY')
    if not key:
        raise HTTPException(status_code=500, detail="YouTube API key not configured")
    return key

def extract_video_id(url: str) -> str:
    """Extract video ID from various YouTube URL formats"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=)([^&\s]+)',
        r'(?:youtu\.be\/)([^?\s]+)',
        r'(?:youtube\.com\/embed\/)([^?\s]+)',
        r'(?:youtube\.com\/v\/)([^?\s]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError("Invalid YouTube URL")

def get_youtube_service(api_key: str = None):
    if api_key is None:
        api_key = get_youtube_api_key()
    return build("youtube", "v3", developerKey=api_key, cache_discovery=False)

async def search_youtube_channels(query: str, max_results: int = 5) -> List[Dict]:
    """Search for YouTube channels by name"""
    youtube = get_youtube_service()
    try:
        request = youtube.search().list(
            part="snippet",
            q=query,
            type="channel",
            maxResults=max_results
        )
        response = request.execute()
        
        channels = []
        for item in response.get("items", []):
            channels.append({
                "channel_id": item["id"]["channelId"],
                "name": item["snippet"]["title"],
                "description": item["snippet"]["description"][:200] if item["snippet"]["description"] else "",
                "thumbnail_url": item["snippet"]["thumbnails"]["default"]["url"]
            })
        return channels
    except HttpError as e:
        logger.error(f"YouTube search error: {e}")
        return []

async def fetch_channel_info(channel_id: str) -> Dict[str, Any]:
    """Fetch channel info from YouTube"""
    youtube = get_youtube_service()
    try:
        request = youtube.channels().list(
            part="snippet,statistics",
            id=channel_id
        )
        response = request.execute()
        
        if not response.get("items"):
            return None
        
        item = response["items"][0]
        snippet = item["snippet"]
        stats = item["statistics"]
        
        return {
            "channel_id": channel_id,
            "name": snippet.get("title", ""),
            "description": snippet.get("description", "")[:300],
            "thumbnail_url": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
            "subscriber_count": int(stats.get("subscriberCount", 0)),
            "video_count": int(stats.get("videoCount", 0))
        }
    except HttpError as e:
        logger.error(f"YouTube channel info error: {e}")
        return None

async def fetch_video_details(youtube, video_id: str) -> Dict[str, Any]:
    """Fetch video metadata"""
    request = youtube.videos().list(
        part="snippet,statistics",
        id=video_id
    )
    response = request.execute()
    
    if not response.get("items"):
        raise HTTPException(status_code=404, detail="Video not found")
    
    item = response["items"][0]
    snippet = item["snippet"]
    stats = item["statistics"]
    
    return {
        "video_id": video_id,
        "title": snippet.get("title", ""),
        "channel": snippet.get("channelTitle", ""),
        "channel_id": snippet.get("channelId", ""),
        "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
        "views": int(stats.get("viewCount", 0)),
        "likes": int(stats.get("likeCount", 0)),
        "comment_count": int(stats.get("commentCount", 0))
    }

async def fetch_comments(youtube, video_id: str, max_results: int = 500) -> List[Dict]:
    """Fetch comments from video - mix of relevant and recent for better hate detection"""
    comments = []
    seen_ids = set()
    
    # First get comments by TIME (recent) - these often have more hate
    try:
        request = youtube.commentThreads().list(
            part="snippet",
            videoId=video_id,
            maxResults=min(max_results // 2, 100),
            order="time",
            textFormat="plainText"
        )
        response = request.execute()
        
        for item in response.get("items", []):
            if item["id"] not in seen_ids:
                comment = item["snippet"]["topLevelComment"]["snippet"]
                comments.append({
                    "id": item["id"],
                    "author": comment.get("authorDisplayName", "Anonymous"),
                    "text": comment.get("textDisplay", ""),
                    "likes": comment.get("likeCount", 0),
                    "published_at": comment.get("publishedAt", "")
                })
                seen_ids.add(item["id"])
    except HttpError:
        pass
    
    # Then get comments by RELEVANCE (popular)
    try:
        request = youtube.commentThreads().list(
            part="snippet",
            videoId=video_id,
            maxResults=min(max_results, 100),
            order="relevance",
            textFormat="plainText"
        )
        response = request.execute()
        
        for item in response.get("items", []):
            if item["id"] not in seen_ids:
                comment = item["snippet"]["topLevelComment"]["snippet"]
                comments.append({
                    "id": item["id"],
                    "author": comment.get("authorDisplayName", "Anonymous"),
                    "text": comment.get("textDisplay", ""),
                    "likes": comment.get("likeCount", 0),
                    "published_at": comment.get("publishedAt", "")
                })
                seen_ids.add(item["id"])
            
        # Get more comments if available
        while "nextPageToken" in response and len(comments) < max_results:
            request = youtube.commentThreads().list(
                part="snippet",
                videoId=video_id,
                maxResults=min(max_results - len(comments), 100),
                order="relevance",
                textFormat="plainText",
                pageToken=response["nextPageToken"]
            )
            response = request.execute()
            
            for item in response.get("items", []):
                if item["id"] not in seen_ids:
                    comment = item["snippet"]["topLevelComment"]["snippet"]
                    comments.append({
                        "id": item["id"],
                        "author": comment.get("authorDisplayName", "Anonymous"),
                        "text": comment.get("textDisplay", ""),
                        "likes": comment.get("likeCount", 0),
                        "published_at": comment.get("publishedAt", "")
                    })
                    seen_ids.add(item["id"])
                
    except HttpError as e:
        if "commentsDisabled" in str(e):
            logger.warning(f"Comments disabled for video {video_id}")
        else:
            logger.error(f"Error fetching comments: {e}")
    
    return comments

# ============= AI ANALYSIS SERVICE =============

async def analyze_single_batch(batch_comments: List[Dict], batch_start: int, batch_size: int, api_key: str) -> Dict:
    """Analyze a single batch of comments - used for parallel processing"""
    client = genai.Client(api_key=api_key)
    
    comments_text = "\n".join([f"[{i}] {c['text'][:300]}" for i, c in enumerate(batch_comments)])
    
    system_message = """Eres un analizador de toxicidad experto. Detecta odio, acoso y negatividad en redes sociales.

DETECCIÓN DE ODIO - Sé AGRESIVO:
- Insultos/términos despectivos = is_hate: true, hate_score >= 0.7
- Sarcasmo negativo = hate_score >= 0.4
- Ataques personales = is_hate: true
- Trolling/provocación = is_hate: true, hate_score >= 0.6
- Blasfemias/vulgaridades = hate_score >= 0.5

SENTIMIENTO:
- Positivo/apoyo = sentiment_score: 0.6 a 1.0
- Neutral = sentiment_score: -0.2 a 0.2
- Negativo/crítico = sentiment_score: -0.6 a -0.2
- Hostil/odioso = sentiment_score: -1.0 a -0.6

En duda, detecta negatividad. Devuelve SOLO JSON sin markdown. Textos EN ESPAÑOL."""
    
    prompt = f"""Analiza estos comentarios. Detecta negatividad, odio, toxicidad y spam.

JSON requerido (textos EN ESPAÑOL):
{{
    "comments": [{{"index": 0, "sentiment_score": -0.8, "hate_score": 0.7, "sentiment_label": "negative", "is_hate": true, "is_spam": false, "emotion": "anger", "comment_type": "criticism"}}],
    "word_rankings": [{{"word": "palabra", "count": 5, "category": "hate"}}],
    "trending_topics": [{{"topic": "tema EN ESPAÑOL", "mentions": 10, "sentiment": "negative"}}],
    "emotion_breakdown": {{"joy": 20.0, "anger": 30.0, "sadness": 10.0, "fear": 5.0, "surprise": 15.0, "disgust": 20.0}},
    "content_insights": {{"questions_count": 5, "suggestions_count": 3, "complaints_count": 8, "praise_count": 10, "spam_count": 2, "key_themes": ["tema1 ES"], "audience_requests": ["petición1 ES"]}},
    "controversial_indices": [1, 5], "supporter_indices": [0, 3], "critic_indices": [2, 4]
}}

IMPORTANTE: trending_topics, key_themes, audience_requests en ESPAÑOL.

Comentarios:
{comments_text}"""

    max_retries = 3
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                await asyncio.sleep(0.3)  # Minimal backoff
            
            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_message,
                    temperature=0.1
                )
            )
            
            clean_response = response.text.strip()
            if clean_response.startswith("```"):
                lines = clean_response.split("```")
                if len(lines) > 1:
                    clean_response = lines[1]
                    if clean_response.startswith("json"):
                        clean_response = clean_response[4:]
            clean_response = clean_response.strip()
            
            # Find JSON boundaries
            json_start = clean_response.find('{')
            if json_start == -1:
                continue
                
            brace_count = 0
            json_end = -1
            for i, char in enumerate(clean_response[json_start:], start=json_start):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        json_end = i + 1
                        break
            
            if json_end > json_start:
                clean_response = clean_response[json_start:json_end]
            
            batch_result = json.loads(clean_response)
            
            # Adjust indices to global position
            for comment_data in batch_result.get("comments", []):
                comment_data["index"] = batch_start + comment_data.get("index", 0)
            
            logger.info(f"✅ Batch {batch_start//batch_size + 1} completed: {len(batch_result.get('comments', []))} comments")
            return {"batch_start": batch_start, "result": batch_result}
            
        except Exception as e:
            logger.warning(f"Batch {batch_start//batch_size + 1} attempt {attempt + 1} failed: {str(e)[:100]}")
            if attempt == max_retries - 1:
                return {"batch_start": batch_start, "result": None, "error": str(e)}
    
    return {"batch_start": batch_start, "result": None}


async def analyze_comments_with_ai(comments: List[Dict]) -> Dict[str, Any]:
    """Analyze comments using Google Gemini - PARALLEL batch processing for speed"""
    
    gemini_keys = [
        os.environ.get('GEMINI_API_KEY'),
        os.environ.get('GEMINI_API_KEY_BACKUP'),
        os.environ.get('GEMINI_API_KEY_BACKUP2')
    ]
    gemini_keys = [k for k in gemini_keys if k]  # Filter None values
    
    if not gemini_keys:
        raise HTTPException(status_code=500, detail="No GEMINI_API_KEY configured")
    
    batch_size = 50
    total_comments_to_analyze = min(len(comments), 200)
    
    # Prepare all batches
    batches = []
    for batch_start in range(0, total_comments_to_analyze, batch_size):
        batch_end = min(batch_start + batch_size, total_comments_to_analyze)
        batch_comments = comments[batch_start:batch_end]
        # Distribute batches across available API keys (round-robin)
        key_index = len(batches) % len(gemini_keys)
        batches.append((batch_comments, batch_start, batch_size, gemini_keys[key_index]))
    
    logger.info(f"🚀 Starting PARALLEL analysis: {len(batches)} batches, {total_comments_to_analyze} comments, {len(gemini_keys)} API keys")
    
    # Process ALL batches in parallel
    tasks = [analyze_single_batch(b[0], b[1], b[2], b[3]) for b in batches]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Collect results
    all_analyzed_comments = []
    combined_word_rankings = []
    combined_trending_topics = []
    combined_content_insights = {}
    combined_controversial = []
    combined_supporters = []
    combined_critics = []
    
    for res in results:
        if isinstance(res, Exception):
            logger.error(f"Batch failed with exception: {res}")
            continue
        if not res or not res.get("result"):
            continue
            
        batch_result = res["result"]
        batch_start = res["batch_start"]
        
        all_analyzed_comments.extend(batch_result.get("comments", []))
        
        # Merge word rankings
        for word in batch_result.get("word_rankings", []):
            existing = next((w for w in combined_word_rankings if w["word"] == word["word"]), None)
            if existing:
                existing["count"] += word.get("count", 1)
            else:
                combined_word_rankings.append(word)
        
        # Merge trending topics
        for topic in batch_result.get("trending_topics", []):
            existing = next((t for t in combined_trending_topics if t["topic"] == topic["topic"]), None)
            if existing:
                existing["mentions"] += topic.get("mentions", 1)
            else:
                combined_trending_topics.append(topic)
        
        # Merge content insights
        batch_insights = batch_result.get("content_insights", {})
        combined_content_insights["questions_count"] = combined_content_insights.get("questions_count", 0) + batch_insights.get("questions_count", 0)
        combined_content_insights["suggestions_count"] = combined_content_insights.get("suggestions_count", 0) + batch_insights.get("suggestions_count", 0)
        combined_content_insights["complaints_count"] = combined_content_insights.get("complaints_count", 0) + batch_insights.get("complaints_count", 0)
        combined_content_insights["praise_count"] = combined_content_insights.get("praise_count", 0) + batch_insights.get("praise_count", 0)
        combined_content_insights["spam_count"] = combined_content_insights.get("spam_count", 0) + batch_insights.get("spam_count", 0)
        combined_content_insights["key_themes"] = list(set(combined_content_insights.get("key_themes", []) + batch_insights.get("key_themes", [])))
        combined_content_insights["audience_requests"] = list(set(combined_content_insights.get("audience_requests", []) + batch_insights.get("audience_requests", [])))
        
        # Collect indices (already adjusted in analyze_single_batch)
        combined_controversial.extend(batch_result.get("controversial_indices", []))
        combined_supporters.extend(batch_result.get("supporter_indices", []))
        combined_critics.extend(batch_result.get("critic_indices", []))
    
    # Sort and limit
    combined_word_rankings = sorted(combined_word_rankings, key=lambda x: x.get("count", 0), reverse=True)[:30]
    combined_trending_topics = sorted(combined_trending_topics, key=lambda x: x.get("mentions", 0), reverse=True)[:15]
    
    # Build final result
    combined_result = {
        "comments": all_analyzed_comments,
        "word_rankings": combined_word_rankings,
        "trending_topics": combined_trending_topics,
        "emotion_breakdown": {"joy": 0, "anger": 0, "sadness": 0, "fear": 0, "surprise": 0, "disgust": 0},
        "content_insights": combined_content_insights,
        "controversial_indices": combined_controversial,
        "supporter_indices": combined_supporters,
        "critic_indices": combined_critics
    }
    
    # Aggregate emotion breakdown
    emotion_counts = {"joy": 0, "anger": 0, "sadness": 0, "fear": 0, "surprise": 0, "disgust": 0}
    for comment in all_analyzed_comments:
        emotion = comment.get("emotion", "neutral")
        if emotion in emotion_counts:
            emotion_counts[emotion] += 1
    
    total = len(all_analyzed_comments) if all_analyzed_comments else 1
    combined_result["emotion_breakdown"] = {k: round(v/total*100, 1) for k, v in emotion_counts.items()}
    
    logger.info(f"✅ PARALLEL analysis completed: {len(all_analyzed_comments)} comments in {len(batches)} parallel batches")
    return combined_result


def generate_default_analysis(comments: List[Dict]) -> Dict[str, Any]:
    """Generate a basic analysis when AI is unavailable"""
    import random
    
    # Simple keyword-based analysis as fallback
    hate_keywords = ['odio', 'asco', 'malo', 'terrible', 'horrible', 'basura', 'idiota', 'estupido', 'tonto', 'hate', 'sucks', 'awful', 'worst', 'stupid', 'idiot', 'trash']
    positive_keywords = ['genial', 'increible', 'amazing', 'love', 'great', 'best', 'awesome', 'excellent', 'bueno', 'fantastico', 'maravilloso']
    
    analyzed = []
    hate_count = 0
    positive_count = 0
    negative_count = 0
    
    for i, comment in enumerate(comments):
        text_lower = comment.get('text', '').lower()
        
        is_hate = any(kw in text_lower for kw in hate_keywords)
        is_positive = any(kw in text_lower for kw in positive_keywords)
        
        if is_hate:
            hate_count += 1
            sentiment = "negative"
            score = -0.7
            hate_score = 0.8
        elif is_positive:
            positive_count += 1
            sentiment = "positive"
            score = 0.7
            hate_score = 0.1
        else:
            negative_count += 1
            sentiment = "neutral"
            score = 0
            hate_score = 0.2
        
        analyzed.append({
            "index": i,
            "sentiment_score": score,
            "hate_score": hate_score,
            "sentiment_label": sentiment,
            "is_hate": is_hate,
            "is_spam": False,
            "emotion": "neutral",
            "comment_type": "neutral"
        })
    
    return {
        "comments": analyzed,
        "word_rankings": [],
        "trending_topics": [],
        "emotion_breakdown": {"joy": 30, "anger": 20, "sadness": 10, "fear": 5, "surprise": 20, "disgust": 15},
        "content_insights": {"questions_count": 0, "suggestions_count": 0, "complaints_count": 0, "praise_count": positive_count, "spam_count": 0, "key_themes": [], "audience_requests": []},
        "controversial_indices": [],
        "supporter_indices": [],
        "critic_indices": []
    }

async def generate_complaints_summary(negative_comments: List[str], lang: str = "es") -> str:
    """Generate AI summary of what's failing based on negative comments"""
    if not negative_comments:
        return ""
    
    gemini_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_key:
        return ""
    
    try:
        client = genai.Client(api_key=gemini_key)
        
        comments_text = "\n".join([f"- {c[:200]}" for c in negative_comments[:30]])
        
        if lang == "en":
            prompt = f"""Analyze these negative YouTube comments and generate A CONCISE SUMMARY (max 2 sentences) explaining WHAT users are complaining about.

Expected format: "Negative comments focus on: [topic 1], [topic 2] and [topic 3]"

Keep these terms in English (don't translate): hate, spam, Engagement, trending, like, views, hashtag, influencer, viral, feedback, hater, troll, bot, fake

Negative comments:
{comments_text}

Respond ONLY with the summary, no additional explanations. In English."""
        else:
            prompt = f"""Analiza estos comentarios negativos de YouTube y genera UN RESUMEN CONCISO (máximo 2 frases) explicando DE QUÉ SE QUEJAN los usuarios.

Formato esperado: "Los comentarios negativos se centran en: [tema 1], [tema 2] y [tema 3]"

Mantén estos términos en inglés (no traducir): hate, spam, Engagement, trending, like, views, hashtag, influencer, viral, feedback, hater, troll, bot, fake

Comentarios negativos:
{comments_text}

Responde SOLO con el resumen, sin explicaciones adicionales. En español."""

        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        return response.text.strip()
    except Exception as e:
        logger.warning(f"Failed to generate complaints summary: {e}")
        return ""

async def generate_hate_forecast(channel_analyses: List[Dict]) -> Dict[str, Any]:
    """Generate hate forecast based on channel's historical data"""
    if len(channel_analyses) < 2:
        return {
            "forecast": "neutral",
            "message": "Se necesitan más videos para predecir tendencias",
            "trend": "stable",
            "risk_level": 50
        }
    
    # Calculate trend from recent videos
    recent = sorted(channel_analyses, key=lambda x: x.get("created_at", ""), reverse=True)[:5]
    
    if len(recent) < 2:
        return {
            "forecast": "neutral", 
            "message": "Datos insuficientes para pronóstico",
            "trend": "stable",
            "risk_level": 50
        }
    
    # Calculate hate trend
    hate_values = [a.get("hate_percentage", 0) for a in recent]
    avg_hate = sum(hate_values) / len(hate_values)
    
    # Check if trending up or down
    recent_avg = sum(hate_values[:2]) / 2 if len(hate_values) >= 2 else hate_values[0]
    older_avg = sum(hate_values[2:]) / len(hate_values[2:]) if len(hate_values) > 2 else recent_avg
    
    trend_diff = recent_avg - older_avg
    
    gemini_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_key:
        # Fallback without AI
        if trend_diff > 5:
            return {
                "forecast": "storm",
                "message": f"⛈️ Se pronostica TORMENTA DE HATE - Tendencia alcista del {trend_diff:.1f}%",
                "trend": "rising",
                "risk_level": min(90, int(avg_hate + trend_diff * 2))
            }
        elif trend_diff > 2:
            return {
                "forecast": "cloudy",
                "message": f"🌧️ Cielos nublados - El hate está aumentando ligeramente",
                "trend": "rising",
                "risk_level": min(75, int(avg_hate + trend_diff))
            }
        elif trend_diff < -3:
            return {
                "forecast": "sunny",
                "message": f"☀️ Cielos despejados - El hate está disminuyendo",
                "trend": "falling",
                "risk_level": max(20, int(avg_hate + trend_diff))
            }
        else:
            return {
                "forecast": "stable",
                "message": f"🌤️ Tiempo estable - Niveles de hate consistentes ({avg_hate:.1f}%)",
                "trend": "stable",
                "risk_level": int(avg_hate)
            }
    
    try:
        client = genai.Client(api_key=gemini_key)
        
        # Prepare data for AI
        video_data = "\n".join([
            f"- Video {i+1}: {a.get('video_title', 'Unknown')[:50]} - Hate: {a.get('hate_percentage', 0)}%"
            for i, a in enumerate(recent)
        ])
        
        prompt = f"""Eres un meteorólogo del HATE en redes sociales. Analiza la evolución de estos videos y genera un PRONÓSTICO DEL HATE.

Datos de videos recientes (del más nuevo al más antiguo):
{video_data}

Promedio de hate: {avg_hate:.1f}%
Tendencia: {"subiendo" if trend_diff > 0 else "bajando" if trend_diff < 0 else "estable"} ({abs(trend_diff):.1f}%)

Genera una respuesta JSON con:
{{
    "forecast": "storm/cloudy/stable/sunny",
    "message": "Mensaje tipo pronóstico del tiempo pero sobre hate (usa emojis de clima)",
    "trend": "rising/falling/stable",
    "risk_level": 0-100
}}

Solo responde con el JSON válido."""

        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        clean = response.text.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1].replace("json", "").strip()
        
        return json.loads(clean)
    except Exception as e:
        logger.warning(f"Failed to generate hate forecast: {e}")
        # Fallback
        return {
            "forecast": "stable",
            "message": f"🌤️ Pronóstico no disponible - Hate promedio: {avg_hate:.1f}%",
            "trend": "stable",
            "risk_level": int(avg_hate)
        }

async def predict_topic_risk(topic: str, channel_history: List[Dict]) -> Dict[str, Any]:
    """Predict hate risk for a potential video topic"""
    gemini_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_key:
        return {"risk": "medium", "score": 50, "message": "Predicción no disponible"}
    
    try:
        client = genai.Client(api_key=gemini_key)
        
        # Get channel context
        channel_context = ""
        if channel_history:
            high_hate_videos = [v for v in channel_history if v.get("hate_percentage", 0) > 10]
            if high_hate_videos:
                channel_context = f"Videos con más hate en este canal: {', '.join([v.get('video_title', '')[:30] for v in high_hate_videos[:3]])}"
        
        prompt = f"""Eres un experto en predicción de hate en YouTube. Analiza este tema propuesto para un video y predice el riesgo de hate.

Tema propuesto: "{topic}"

{channel_context}

Considera:
- Temas polémicos (política, religión, dinero) = alto riesgo
- Colaboraciones con personas controversiales = alto riesgo
- Contenido educativo/neutro = bajo riesgo
- Temas de actualidad polémicos = alto riesgo

Responde SOLO con JSON válido:
{{
    "risk": "low/medium/high/extreme",
    "score": 0-100,
    "message": "Explicación breve del riesgo",
    "warning_topics": ["tema1", "tema2"]
}}"""

        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt
        )
        
        clean = response.text.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1].replace("json", "").strip()
        
        return json.loads(clean)
    except Exception as e:
        logger.warning(f"Failed to predict topic risk: {e}")
        return {"risk": "medium", "score": 50, "message": "No se pudo analizar el tema"}

# ============= ROUTES =============

@api_router.get("/")
async def root():
    return {"message": "SocialHate API - Analyze your social media hate"}

@api_router.get("/stats/global")
async def get_global_stats():
    """Get global statistics for the landing page"""
    try:
        # Get all completed analyses
        all_analyses = await db.analyses.find({"status": "completed"}).to_list(100)
        
        total_videos = len(all_analyses)
        total_comments = sum(a.get("total_comments_analyzed", 0) for a in all_analyses)
        
        # Analyses today - calculate in memory
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        analyses_today = 0
        for a in all_analyses:
            created_at = a.get("created_at", "")
            if isinstance(created_at, str):
                try:
                    created_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    if created_dt >= today_start:
                        analyses_today += 1
                except:
                    pass
        
        # Last analysis
        last_analysis_info = None
        if all_analyses:
            # Sort by created_at descending
            sorted_analyses = sorted(all_analyses, key=lambda x: x.get("created_at", ""), reverse=True)
            last_analysis = sorted_analyses[0]
            
            created_at = last_analysis.get("created_at", "")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                except:
                    created_at = datetime.now(timezone.utc)
            
            # Calculate time ago
            now = datetime.now(timezone.utc)
            diff = now - created_at
            
            if diff.total_seconds() < 60:
                time_ago = "Hace unos segundos"
            elif diff.total_seconds() < 3600:
                minutes = int(diff.total_seconds() / 60)
                time_ago = f"Hace {minutes} minuto{'s' if minutes > 1 else ''}"
            elif diff.total_seconds() < 86400:
                hours = int(diff.total_seconds() / 3600)
                time_ago = f"Hace {hours} hora{'s' if hours > 1 else ''}"
            else:
                days = int(diff.total_seconds() / 86400)
                time_ago = f"Hace {days} día{'s' if days > 1 else ''}"
            
            last_analysis_info = {
                "time_ago": time_ago,
                "video_title": last_analysis.get("video_title", "Video")[:50]
            }
        
        # Total hate comments - count from all analyses
        total_hate_comments = 0
        for a in all_analyses:
            comments = a.get("comments", [])
            for c in comments:
                if c.get("is_hate") or c.get("hate_score", 0) >= 0.5:
                    total_hate_comments += 1
        
        return {
            "total_videos": total_videos,
            "total_comments": total_comments,
            "analyses_today": analyses_today,
            "last_analysis": last_analysis_info,
            "total_hate_comments": total_hate_comments
        }
    except Exception as e:
        logger.error(f"Error getting global stats: {e}")
        return {
            "total_videos": 0,
            "total_comments": 0,
            "analyses_today": 0,
            "last_analysis": None,
            "total_hate_comments": 0
        }

@api_router.get("/stats/quota")
async def get_api_quota_stats():
    """Get YouTube API quota usage estimates and cache stats"""
    try:
        # Count cached items
        cache_docs = list(youtube_cache_ref.stream())
        
        channel_videos_cached = 0
        video_info_cached = 0
        channel_info_cached = 0
        
        for doc in cache_docs:
            doc_id = doc.id
            if doc_id.startswith("channel_videos_"):
                channel_videos_cached += 1
            elif doc_id.startswith("video_info_"):
                video_info_cached += 1
            elif doc_id.startswith("channel_info_"):
                channel_info_cached += 1
        
        # Estimate quota savings
        # Each channel videos fetch = 3 units, cached = 0 units
        estimated_savings = channel_videos_cached * 3
        
        return {
            "cache_stats": {
                "channel_videos_cached": channel_videos_cached,
                "video_info_cached": video_info_cached,
                "channel_info_cached": channel_info_cached,
                "total_cached_items": len(cache_docs)
            },
            "quota_info": {
                "daily_limit": 10000,
                "units_per_analysis": 6,
                "units_per_video_list": 3,
                "estimated_savings_today": estimated_savings,
                "max_analyses_per_day": 1666
            },
            "cache_duration": {
                "channel_videos_hours": 6,
                "video_info_hours": 24,
                "channel_info_hours": 24
            }
        }
    except Exception as e:
        logger.error(f"Error getting quota stats: {e}")
        return {"error": str(e)}

@api_router.post("/youtube/analyze", response_model=AnalysisSummary)
async def analyze_youtube_video(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """Start analysis of a YouTube video"""
    try:
        video_id = extract_video_id(request.youtube_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Check if video was already analyzed
    existing_analysis = await db.analyses.find_one(
        {"video_id": video_id, "status": "completed"},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if existing_analysis:
        return AnalysisSummary(
            id=existing_analysis["id"],
            video_title=existing_analysis.get("video_title", ""),
            channel_name=existing_analysis.get("channel_name", ""),
            thumbnail_url=existing_analysis.get("thumbnail_url", ""),
            hate_percentage=existing_analysis.get("hate_percentage", 0),
            comment_count=existing_analysis.get("comment_count", 0),
            created_at=datetime.fromisoformat(existing_analysis["created_at"].replace('Z', '+00:00')) if isinstance(existing_analysis.get("created_at"), str) else existing_analysis.get("created_at", datetime.now(timezone.utc)),
            status="completed"
        )
    
    # Create initial analysis record
    analysis_id = str(uuid.uuid4())
    initial_data = {
        "id": analysis_id,
        "video_id": video_id,
        "video_title": "Loading...",
        "channel_name": "",
        "thumbnail_url": "",
        "view_count": 0,
        "like_count": 0,
        "comment_count": 0,
        "total_comments_analyzed": 0,
        "hate_percentage": 0,
        "positive_percentage": 0,
        "negative_percentage": 0,
        "neutral_percentage": 0,
        "average_sentiment": 0,
        "word_rankings": [],
        "trending_topics": [],
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "processing"
    }
    
    await db.analyses.insert_one(initial_data)
    
    # Run analysis in background (using env API key)
    background_tasks.add_task(
        run_full_analysis, 
        analysis_id, 
        video_id
    )
    
    return AnalysisSummary(
        id=analysis_id,
        video_title="Processing...",
        channel_name="",
        thumbnail_url="",
        hate_percentage=0,
        comment_count=0,
        created_at=datetime.now(timezone.utc),
        status="processing"
    )

async def run_full_analysis(analysis_id: str, video_id: str):
    """Run the full analysis pipeline with enhanced metrics"""
    try:
        youtube = get_youtube_service()  # Uses env API key
        
        # Fetch video details
        video_details = await fetch_video_details(youtube, video_id)
        
        channel_id = video_details.get("channel_id", "")
        channel_name = video_details["channel"]
        
        # Create or update channel in database
        if channel_id:
            existing_channel = await db.channels.find_one({"channel_id": channel_id})
            if not existing_channel:
                # Check if there's a TikTok channel with same name to merge
                normalized_name = channel_name.lower().strip()
                
                # Firestore doesn't support $or, so search all channels and filter
                all_channels = await db.channels.find({"platforms": "tiktok"}).to_list(length=500)
                tiktok_channel = None
                for ch in all_channels:
                    ch_name = ch.get("name", "").lower().strip()
                    tk_username = ch.get("tiktok_username", "").lower().strip()
                    if ch_name == normalized_name or tk_username == normalized_name:
                        tiktok_channel = ch
                        break
                
                if tiktok_channel:
                    # Merge YouTube into existing TikTok channel
                    existing_platforms = tiktok_channel.get("platforms", ["tiktok"])
                    if "youtube" not in existing_platforms:
                        existing_platforms.append("youtube")
                    
                    await db.channels.update_one(
                        {"id": tiktok_channel.get("id")},
                        {"$set": {
                            "channel_id": channel_id,  # YouTube channel ID
                            "youtube_channel_id": channel_id,
                            "platforms": existing_platforms,
                            "subscriber_count": 0,
                            "video_count": 0,
                            "youtube_stats": {
                                "videos_analyzed": 0,
                                "avg_hate_percentage": 0,
                                "total_comments_analyzed": 0
                            }
                        }}
                    )
                    logger.info(f"Merged YouTube channel {channel_name} with existing TikTok channel")
                else:
                    # Create new channel entry
                    channel_data = {
                        "id": str(uuid.uuid4()),
                        "channel_id": channel_id,
                        "youtube_channel_id": channel_id,
                        "name": channel_name,
                        "platforms": ["youtube"],
                        "thumbnail_url": "",
                        "subscriber_count": 0,
                        "video_count": 0,
                        "total_videos_analyzed": 0,
                        "avg_hate_percentage": 0,
                        "avg_positive_percentage": 0,
                        "total_comments_analyzed": 0,
                        "youtube_stats": {
                            "videos_analyzed": 0,
                            "avg_hate_percentage": 0,
                            "total_comments_analyzed": 0
                        },
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    # Try to get channel thumbnail
                    try:
                        yt = get_youtube_service()
                        ch_response = yt.channels().list(part="snippet,statistics", id=channel_id).execute()
                        if ch_response.get("items"):
                            ch_data = ch_response["items"][0]
                            channel_data["thumbnail_url"] = ch_data["snippet"].get("thumbnails", {}).get("medium", {}).get("url", "")
                            channel_data["subscriber_count"] = int(ch_data["statistics"].get("subscriberCount", 0))
                            channel_data["video_count"] = int(ch_data["statistics"].get("videoCount", 0))
                    except:
                        pass
                    await db.channels.insert_one(channel_data)
                    logger.info(f"Created new YouTube channel: {channel_name}")
        
        # Update with video info including channel_id
        await db.analyses.update_one(
            {"id": analysis_id},
            {"$set": {
                "video_title": video_details["title"],
                "channel_name": channel_name,
                "channel_id": channel_id,
                "thumbnail_url": video_details["thumbnail"],
                "view_count": video_details["views"],
                "like_count": video_details["likes"],
                "comment_count": video_details["comment_count"]
            }}
        )
        
        # Fetch comments - increased to 200 for better analysis
        comments = await fetch_comments(youtube, video_id, max_results=200)
        
        if not comments:
            await db.analyses.update_one(
                {"id": analysis_id},
                {"$set": {"status": "completed", "total_comments_analyzed": 0}}
            )
            return
        
        # Analyze with AI
        ai_analysis = await analyze_comments_with_ai(comments)
        
        # Process results
        analyzed_comments = []
        hate_count = 0
        positive_count = 0
        negative_count = 0
        neutral_count = 0
        spam_count = 0
        total_sentiment = 0
        total_comment_length = 0
        author_counts = {}
        
        controversial_comments = []
        top_supporters = []
        top_critics = []
        
        # Get all AI analyzed comments - create a dict by index for fast lookup
        ai_comments = ai_analysis.get("comments", [])
        ai_by_index = {c.get("index", -999): c for c in ai_comments}
        
        # Process only the comments we have (up to 200)
        max_to_process = min(len(comments), 200)
        
        for i in range(max_to_process):
            comment = comments[i]
            
            # Find AI data by index
            ai_data = ai_by_index.get(i)
            
            # If not found by index, use position in the list if available
            if not ai_data and i < len(ai_comments):
                ai_data = ai_comments[i]
            
            # Default fallback - use keyword detection
            if not ai_data or ai_data.get("sentiment_label") is None:
                text_lower = comment["text"].lower()
                # Simple keyword detection for fallback
                positive_words = ['grande', 'crack', 'genial', 'brutal', 'leyenda', 'top', 'mejor', 'gracias', 'increible', 'jajaja', '😂', '🤣', '👏', '❤️', '🔥']
                negative_words = ['malo', 'aburrido', 'meh', 'pesado', 'flojo']
                hate_words = ['idiota', 'estupido', 'imbecil', 'basura', 'mierda', 'subnormal', 'gilipollas', 'payaso']
                
                is_positive = any(w in text_lower for w in positive_words)
                is_negative = any(w in text_lower for w in negative_words)
                is_hate = any(w in text_lower for w in hate_words)
                
                if is_hate:
                    ai_data = {"sentiment_score": -0.8, "hate_score": 0.8, "sentiment_label": "negative", "is_hate": True, "is_spam": False, "emotion": "anger", "comment_type": "criticism"}
                elif is_positive:
                    ai_data = {"sentiment_score": 0.7, "hate_score": 0, "sentiment_label": "positive", "is_hate": False, "is_spam": False, "emotion": "joy", "comment_type": "praise"}
                elif is_negative:
                    ai_data = {"sentiment_score": -0.5, "hate_score": 0.2, "sentiment_label": "negative", "is_hate": False, "is_spam": False, "emotion": "sadness", "comment_type": "criticism"}
                else:
                    ai_data = {"sentiment_score": 0.3, "hate_score": 0, "sentiment_label": "positive", "is_hate": False, "is_spam": False, "emotion": "neutral", "comment_type": "neutral"}
            
            # Track comment lengths
            total_comment_length += len(comment["text"])
            
            # Track author activity
            author = comment["author"]
            author_counts[author] = author_counts.get(author, 0) + 1
            
            analyzed_comment = {
                "comment_id": comment["id"],
                "author": author,
                "text": comment["text"],
                "likes": comment["likes"],
                "published_at": comment["published_at"],
                "sentiment_score": ai_data.get("sentiment_score", 0),
                "hate_score": ai_data.get("hate_score", 0),
                "sentiment_label": ai_data.get("sentiment_label", "neutral"),
                "is_hate": ai_data.get("is_hate", False),
                "is_spam": ai_data.get("is_spam", False),
                "emotion": ai_data.get("emotion", "neutral"),
                "comment_type": ai_data.get("comment_type", "neutral")
            }
            analyzed_comments.append(analyzed_comment)
            
            # Count categories
            if ai_data.get("is_spam"):
                spam_count += 1
            if ai_data.get("is_hate") or ai_data.get("hate_score", 0) >= 0.5:
                hate_count += 1
            if ai_data.get("sentiment_label") == "positive":
                positive_count += 1
            elif ai_data.get("sentiment_label") == "negative":
                negative_count += 1
            else:
                neutral_count += 1
            
            total_sentiment += ai_data.get("sentiment_score", 0)
            
            # Track controversial (high engagement + negative)
            if i in ai_analysis.get("controversial_indices", []):
                controversial_comments.append(analyzed_comment)
            
            # Track supporters and critics
            if i in ai_analysis.get("supporter_indices", []):
                top_supporters.append(analyzed_comment)
            if i in ai_analysis.get("critic_indices", []):
                top_critics.append(analyzed_comment)
        
        total = len(analyzed_comments)
        
        # Calculate engagement metrics using REAL video data
        views = video_details["views"]
        likes = video_details["likes"]
        comment_count = video_details["comment_count"]  # REAL total comments from video
        
        # Weighted Sentiment (likes-weighted average of ANALYZED comments)
        total_weight = sum(c["likes"] + 1 for c in analyzed_comments)
        weighted_sentiment = sum(
            c["sentiment_score"] * (c["likes"] + 1) for c in analyzed_comments
        ) / total_weight if total_weight > 0 else 0
        
        engagement_metrics = {
            # Use REAL comment_count instead of analyzed sample
            "engagement_rate": round(((likes + comment_count) / views * 100) if views > 0 else 0, 1),
            "like_to_view_ratio": round((likes / views * 100) if views > 0 else 0, 1),
            "comment_to_view_ratio": round((comment_count / views * 100) if views > 0 else 0, 1),
            "avg_comment_length": round(total_comment_length / total if total > 0 else 0, 1),
            "weighted_sentiment": round(weighted_sentiment * 100, 1),
            "most_active_commenters": sorted(
                [{"author": k, "comments": v} for k, v in author_counts.items()],
                key=lambda x: x["comments"],
                reverse=True
            )[:10]
        }
        
        # Determine toxicity level
        hate_pct = (hate_count / total * 100) if total > 0 else 0
        if hate_pct >= 30:
            toxicity_level = "severe"
        elif hate_pct >= 20:
            toxicity_level = "high"
        elif hate_pct >= 10:
            toxicity_level = "moderate"
        else:
            toxicity_level = "low"
        
        # Process word rankings
        word_rankings = [
            {"word": w.get("word", ""), "count": w.get("count", 0), "category": w.get("category", "neutral")}
            for w in ai_analysis.get("word_rankings", [])[:30]
        ]
        
        # Process trending topics
        trending_topics = [
            {"topic": t.get("topic", ""), "mentions": t.get("mentions", 0), "sentiment": t.get("sentiment", "neutral")}
            for t in ai_analysis.get("trending_topics", [])[:15]
        ]
        
        # Get emotion breakdown
        emotion_breakdown = ai_analysis.get("emotion_breakdown", {
            "joy": 0, "anger": 0, "sadness": 0, "fear": 0, "surprise": 0, "disgust": 0
        })
        
        # Get content insights
        content_insights = ai_analysis.get("content_insights", {
            "questions_count": 0,
            "suggestions_count": 0,
            "complaints_count": 0,
            "praise_count": 0,
            "spam_count": spam_count,
            "key_themes": [],
            "audience_requests": []
        })
        content_insights["spam_count"] = spam_count
        
        # Update final results with all enhanced data
        await db.analyses.update_one(
            {"id": analysis_id},
            {"$set": {
                "total_comments_analyzed": total,
                "hate_percentage": round(hate_pct, 1),
                "positive_percentage": round((positive_count / total * 100) if total > 0 else 0, 1),
                "negative_percentage": round((negative_count / total * 100) if total > 0 else 0, 1),
                "neutral_percentage": round((neutral_count / total * 100) if total > 0 else 0, 1),
                "average_sentiment": round(total_sentiment / total if total > 0 else 0, 2),
                "toxicity_level": toxicity_level,
                "spam_percentage": round((spam_count / total * 100) if total > 0 else 0, 1),
                "word_rankings": word_rankings,
                "trending_topics": trending_topics,
                "comments": analyzed_comments,
                "engagement_metrics": engagement_metrics,
                "emotion_breakdown": emotion_breakdown,
                "content_insights": content_insights,
                "controversial_comments": controversial_comments[:10],
                "top_supporters": top_supporters[:10],
                "top_critics": top_critics[:10],
                "status": "completed"
            }}
        )
        
        # Update channel statistics
        if channel_id:
            # Get all completed YouTube analyses for this channel
            youtube_analyses = await db.analyses.find(
                {"channel_id": channel_id, "status": "completed", "platform": {"$in": ["youtube", None]}},
                {"hate_percentage": 1, "positive_percentage": 1, "total_comments_analyzed": 1}
            ).to_list(length=1000)
            
            # Also check for analyses without platform field (legacy)
            legacy_analyses = await db.analyses.find(
                {"channel_id": channel_id, "status": "completed", "platform": {"$exists": False}},
                {"hate_percentage": 1, "positive_percentage": 1, "total_comments_analyzed": 1}
            ).to_list(length=1000)
            
            channel_analyses = youtube_analyses + legacy_analyses
            
            if channel_analyses:
                total_videos = len(channel_analyses)
                avg_hate = sum(a.get("hate_percentage", 0) for a in channel_analyses) / total_videos
                avg_positive = sum(a.get("positive_percentage", 0) for a in channel_analyses) / total_videos
                total_comments = sum(a.get("total_comments_analyzed", 0) for a in channel_analyses)
                
                youtube_stats = {
                    "videos_analyzed": total_videos,
                    "avg_hate_percentage": round(avg_hate, 1),
                    "total_comments_analyzed": total_comments
                }
                
                # Check if this channel also has TikTok (multi-platform)
                existing_channel = await db.channels.find_one({"channel_id": channel_id})
                existing_platforms = existing_channel.get("platforms", ["youtube"]) if existing_channel else ["youtube"]
                
                if "youtube" not in existing_platforms:
                    existing_platforms.append("youtube")
                
                # Calculate combined stats if multi-platform
                tiktok_channel_id = existing_channel.get("tiktok_channel_id") if existing_channel else None
                if tiktok_channel_id and "tiktok" in existing_platforms:
                    tiktok_analyses = await db.analyses.find(
                        {"channel_id": tiktok_channel_id, "status": "completed", "platform": "tiktok"}
                    ).to_list(length=1000)
                    
                    all_analyses = channel_analyses + tiktok_analyses
                    combined_videos = len(all_analyses)
                    combined_hate = sum(a.get("hate_percentage", 0) for a in all_analyses) / combined_videos if combined_videos > 0 else 0
                    combined_positive = sum(a.get("positive_percentage", 0) for a in all_analyses) / combined_videos if combined_videos > 0 else 0
                    combined_comments = sum(a.get("total_comments_analyzed", 0) for a in all_analyses)
                else:
                    combined_videos = total_videos
                    combined_hate = avg_hate
                    combined_positive = avg_positive
                    combined_comments = total_comments
                
                await db.channels.update_one(
                    {"channel_id": channel_id},
                    {"$set": {
                        "platforms": existing_platforms,
                        "youtube_channel_id": channel_id,
                        "youtube_stats": youtube_stats,
                        "total_videos_analyzed": combined_videos,
                        "avg_hate_percentage": round(combined_hate, 1),
                        "avg_positive_percentage": round(combined_positive, 1),
                        "total_comments_analyzed": combined_comments,
                        "last_analysis": datetime.now(timezone.utc).isoformat()
                    }}
                )
                logger.info(f"Updated channel {channel_name} stats: {total_videos} YouTube videos, {avg_hate:.1f}% avg hate")
        
        logger.info(f"Analysis {analysis_id} completed successfully with {total} comments analyzed, {hate_count} hate detected")
        
    except Exception as e:
        logger.error(f"Analysis {analysis_id} failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        await db.analyses.update_one(
            {"id": analysis_id},
            {"$set": {"status": "error"}}
        )

@api_router.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str):
    """Get analysis results by ID"""
    result = await db.analyses.find_one({"id": analysis_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return result

@api_router.get("/analyses", response_model=List[AnalysisSummary])
async def list_analyses(limit: int = 20):
    """List all analyses"""
    cursor = db.analyses.find({}, {
        "_id": 0,
        "id": 1,
        "video_title": 1,
        "channel_name": 1,
        "channel_id": 1,
        "thumbnail_url": 1,
        "hate_percentage": 1,
        "comment_count": 1,
        "created_at": 1,
        "status": 1
    }).sort("created_at", -1).limit(limit)
    
    analyses = await cursor.to_list(length=limit)
    
    for analysis in analyses:
        if isinstance(analysis.get('created_at'), str):
            analysis['created_at'] = datetime.fromisoformat(analysis['created_at'].replace('Z', '+00:00'))
    
    return analyses

@api_router.get("/channel/{channel_id}/analyses")
async def get_channel_analyses(channel_id: str):
    """Get all analyses for a specific channel"""
    # Get channel info
    channel = await db.channels.find_one({"channel_id": channel_id}, {"_id": 0})
    
    # Get all analyses for this channel
    cursor = db.analyses.find(
        {"channel_id": channel_id},
        {"_id": 0}
    ).sort("created_at", -1)
    
    all_analyses = await cursor.to_list(length=100)
    
    # Remove heavy fields like comments array to reduce payload
    analyses = []
    for a in all_analyses:
        analyses.append({
            "id": a.get("id"),
            "video_id": a.get("video_id"),
            "video_title": a.get("video_title"),
            "thumbnail_url": a.get("thumbnail_url"),
            "channel_id": a.get("channel_id"),
            "channel_name": a.get("channel_name"),
            "channel_db_id": a.get("channel_db_id"),
            "status": a.get("status"),
            "hate_percentage": a.get("hate_percentage"),
            "positive_percentage": a.get("positive_percentage"),
            "negative_percentage": a.get("negative_percentage"),
            "total_comments_analyzed": a.get("total_comments_analyzed"),
            "comment_count": a.get("comment_count"),
            "view_count": a.get("view_count"),
            "like_count": a.get("like_count"),
            "created_at": a.get("created_at"),
            "platform": a.get("platform", "youtube")
        })
    
    return {
        "channel": channel,
        "analyses": analyses,
        "total": len(analyses)
    }

@api_router.get("/analysis/{analysis_id}/complaints-summary")
async def get_complaints_summary(analysis_id: str, lang: str = "es"):
    """Get AI-generated summary of complaints from negative comments"""
    analysis = await db.analyses.find_one({"id": analysis_id}, {"_id": 0})
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # Check if summary already exists for this language
    cache_key = f"complaints_summary_{lang}"
    if analysis.get(cache_key):
        return {"summary": analysis[cache_key]}
    
    # Get negative comments
    comments = analysis.get("comments", [])
    negative_comments = [
        c.get("text", "") for c in comments 
        if c.get("sentiment_label") in ["negative", "hate"] or c.get("is_hate")
    ]
    
    no_negative_msg = "No significant negative comments detected" if lang == "en" else "No se detectaron comentarios negativos significativos"
    
    if not negative_comments:
        return {"summary": no_negative_msg}
    
    summary = await generate_complaints_summary(negative_comments, lang)
    
    # Cache the summary
    if summary:
        await db.analyses.update_one(
            {"id": analysis_id},
            {"$set": {cache_key: summary}}
        )
    
    error_msg = "Could not generate summary" if lang == "en" else "No se pudo generar el resumen"
    return {"summary": summary or error_msg}

@api_router.get("/channel/{channel_id}/hate-forecast")
async def get_channel_hate_forecast(channel_id: str):
    """Get hate forecast for a channel based on historical data"""
    # Get channel analyses
    cursor = db.analyses.find(
        {"channel_id": channel_id, "status": "completed"},
        {"_id": 0, "video_title": 1, "hate_percentage": 1, "created_at": 1}
    ).sort("created_at", -1)
    
    analyses = await cursor.to_list(length=20)
    
    forecast = await generate_hate_forecast(analyses)
    return forecast

@api_router.get("/channel/{channel_id}/evolution")
async def get_channel_evolution(channel_id: str):
    """Get channel evolution data for charts"""
    cursor = db.analyses.find(
        {"channel_id": channel_id, "status": "completed"},
        {"_id": 0, "video_title": 1, "hate_percentage": 1, "positive_percentage": 1, 
         "negative_percentage": 1, "total_comments_analyzed": 1, "view_count": 1,
         "created_at": 1}
    ).sort("created_at", 1)  # Oldest first for timeline
    
    analyses = await cursor.to_list(length=50)
    
    # Format for chart
    evolution_data = []
    for i, a in enumerate(analyses):
        evolution_data.append({
            "index": i + 1,
            "title": a.get("video_title", "")[:25] + "..." if len(a.get("video_title", "")) > 25 else a.get("video_title", ""),
            "hate": a.get("hate_percentage", 0),
            "positive": a.get("positive_percentage", 0),
            "negative": a.get("negative_percentage", 0),
            "comments": a.get("total_comments_analyzed", 0),
            "views": a.get("view_count", 0),
            "date": a.get("created_at", "")[:10]
        })
    
    return {"evolution": evolution_data}

@api_router.post("/channel/{channel_id}/predict-topic")
async def predict_topic_hate_risk(channel_id: str, topic: str):
    """Predict hate risk for a potential video topic"""
    # Get channel history for context
    cursor = db.analyses.find(
        {"channel_id": channel_id, "status": "completed"},
        {"_id": 0, "video_title": 1, "hate_percentage": 1}
    ).sort("created_at", -1)
    
    history = await cursor.to_list(length=10)
    
    prediction = await predict_topic_risk(topic, history)
    return prediction

@api_router.delete("/analysis/{analysis_id}")
async def delete_analysis(analysis_id: str):
    """Delete an analysis"""
    result = await db.analyses.delete_one({"id": analysis_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"message": "Analysis deleted"}

@api_router.get("/analysis/{analysis_id}/pdf")
async def download_analysis_pdf(analysis_id: str):
    """Generate and download PDF report for analysis"""
    from fastapi.responses import StreamingResponse
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.lib.units import inch
    from reportlab.graphics.shapes import Drawing, Rect, String, Circle, Line
    from reportlab.graphics.charts.piecharts import Pie
    from reportlab.graphics import renderPDF
    import io
    
    # Get analysis data
    result = await db.analyses.find_one({"id": analysis_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # Get complaints summary if available
    complaints_summary = result.get('complaints_summary', '')
    if not complaints_summary:
        # Try to generate it
        comments = result.get("comments", [])
        negative_comments = [c.get("text", "") for c in comments if c.get("sentiment_label") in ["negative"] or c.get("is_hate")]
        if negative_comments:
            complaints_summary = await generate_complaints_summary(negative_comments[:20])
    
    # Create PDF in memory
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=20, textColor=colors.HexColor('#DC2626'))
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Heading2'], fontSize=14, spaceAfter=10, textColor=colors.HexColor('#71717A'))
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=16, spaceBefore=20, spaceAfter=10, textColor=colors.HexColor('#DC2626'))
    subsection_style = ParagraphStyle('Subsection', parent=styles['Heading3'], fontSize=13, spaceBefore=15, spaceAfter=8, textColor=colors.HexColor('#18181B'))
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, spaceAfter=8)
    small_style = ParagraphStyle('Small', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#71717A'))
    premium_style = ParagraphStyle('Premium', parent=styles['Normal'], fontSize=11, spaceAfter=8, textColor=colors.HexColor('#F59E0B'), alignment=1)
    
    elements = []
    
    # ===== HEADER =====
    elements.append(Paragraph("SOCIALHATE", title_style))
    elements.append(Paragraph("Informe de Análisis de Comentarios", subtitle_style))
    elements.append(Spacer(1, 10))
    
    # Video Info
    elements.append(Paragraph(f"<b>Video:</b> {result.get('video_title', 'Sin título')}", body_style))
    elements.append(Paragraph(f"<b>Canal:</b> {result.get('channel_name', 'Desconocido')}", body_style))
    elements.append(Paragraph(f"<b>Fecha de análisis:</b> {str(result.get('created_at', ''))[:10]}", body_style))
    elements.append(Spacer(1, 20))
    
    # ===== ESCALA DE HATE =====
    elements.append(Paragraph("ESCALA DE HATE", section_style))
    hate_pct = result.get('hate_percentage', 0)
    
    # Determine hate level
    if hate_pct <= 3:
        hate_level = "LOW (0-3%)"
        hate_desc = "Tu contenido tiene niveles saludables de interacción. La comunidad es mayormente positiva."
        hate_color = '#10B981'
    elif hate_pct <= 15:
        hate_level = "MODERATE (3-15%)"
        hate_desc = "Hay cierto nivel de negatividad. Se recomienda monitorear los comentarios regularmente."
        hate_color = '#F59E0B'
    else:
        hate_level = "HIGH (+15%)"
        hate_desc = "Alto nivel de toxicidad detectado. Se recomienda moderar activamente los comentarios."
        hate_color = '#DC2626'
    
    scale_data = [
        ['Low (0-3%)', 'Moderate (3-15%)', 'High (+15%)'],
        ['Saludable', 'Precaución', 'Crítico']
    ]
    scale_table = Table(scale_data, colWidths=[1.7*inch, 1.7*inch, 1.7*inch])
    scale_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#10B981')),
        ('BACKGROUND', (1, 0), (1, -1), colors.HexColor('#F59E0B')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#DC2626')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(scale_table)
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(f"<b>Tu nivel actual: {hate_pct}% - {hate_level}</b>", 
                             ParagraphStyle('HateLevel', parent=body_style, textColor=colors.HexColor(hate_color))))
    elements.append(Paragraph(hate_desc, small_style))
    elements.append(Spacer(1, 20))
    
    # ===== MÉTRICAS PRINCIPALES =====
    elements.append(Paragraph("MÉTRICAS DEL VIDEO", section_style))
    
    engagement = result.get('engagement_metrics', {})
    engagement_rate = engagement.get('engagement_rate', 0) if engagement else 0
    weighted_sentiment = engagement.get('weighted_sentiment', 0) if engagement else 0
    
    metrics_data = [
        ['Métrica', 'Valor'],
        ['Views', f"{result.get('view_count', 0):,}"],
        ['Likes', f"{result.get('like_count', 0):,}"],
        ['Comentarios Analizados', f"{result.get('total_comments_analyzed', 0):,}"],
        ['Engagement Rate', f"{engagement_rate}%"],
        ['Weighted Sentiment', f"{weighted_sentiment}%"],
        ['Nivel de Toxicidad', result.get('toxicity_level', 'N/A').upper()],
    ]
    
    metrics_table = Table(metrics_data, colWidths=[2.5*inch, 2.5*inch])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#18181B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F4F4F5')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E4E4E7')),
        ('FONTSIZE', (0, 1), (-1, -1), 11),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))
    elements.append(metrics_table)
    elements.append(Spacer(1, 20))
    
    # ===== SENTIMENT DISTRIBUTION =====
    elements.append(Paragraph("DISTRIBUCIÓN DE SENTIMIENTO", section_style))
    
    positive_pct = result.get('positive_percentage', 0)
    negative_pct = result.get('negative_percentage', 0)
    neutral_pct = result.get('neutral_percentage', 0)
    
    sentiment_data = [
        ['Sentimiento', 'Porcentaje', 'Barra Visual'],
        ['Positivo', f"{positive_pct}%", '█' * int(positive_pct / 5) if positive_pct > 0 else ''],
        ['Negativo', f"{negative_pct}%", '█' * int(negative_pct / 5) if negative_pct > 0 else ''],
        ['Neutro', f"{neutral_pct}%", '█' * int(neutral_pct / 5) if neutral_pct > 0 else ''],
        ['HATE', f"{hate_pct}%", '█' * int(hate_pct / 5) if hate_pct > 0 else ''],
    ]
    
    sentiment_table = Table(sentiment_data, colWidths=[1.5*inch, 1.2*inch, 2.3*inch])
    sentiment_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#18181B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (1, -1), 'CENTER'),
        ('ALIGN', (2, 1), (2, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E4E4E7')),
        ('TEXTCOLOR', (2, 1), (2, 1), colors.HexColor('#10B981')),  # Positive green
        ('TEXTCOLOR', (2, 2), (2, 2), colors.HexColor('#F59E0B')),  # Negative amber
        ('TEXTCOLOR', (2, 3), (2, 3), colors.HexColor('#71717A')),  # Neutral gray
        ('TEXTCOLOR', (2, 4), (2, 4), colors.HexColor('#DC2626')),  # Hate red
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(sentiment_table)
    elements.append(Spacer(1, 20))
    
    # ===== ¿QUÉ ESTÁ FALLANDO? =====
    elements.append(Paragraph("¿QUÉ ESTÁ FALLANDO?", section_style))
    if complaints_summary:
        elements.append(Paragraph(complaints_summary, body_style))
    else:
        elements.append(Paragraph("No se detectaron suficientes comentarios negativos para generar un resumen.", small_style))
    elements.append(Spacer(1, 20))
    
    # ===== EMOTION RADAR =====
    emotions = result.get('emotion_breakdown', {})
    if emotions:
        elements.append(Paragraph("RADAR DE EMOCIONES", section_style))
        emotion_data = [['Emoción', 'Porcentaje', 'Intensidad']]
        emotion_icons = {
            'joy': '😊', 'anger': '😠', 'sadness': '😢', 
            'fear': '😨', 'surprise': '😲', 'disgust': '🤢'
        }
        for emo, val in emotions.items():
            intensity = '🔴' * min(5, int(val / 20)) if val > 0 else '⚪'
            emotion_data.append([f"{emo.capitalize()}", f"{val}%", intensity])
        
        emotion_table = Table(emotion_data, colWidths=[1.8*inch, 1.2*inch, 2*inch])
        emotion_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7C3AED')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E4E4E7')),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(emotion_table)
        elements.append(Spacer(1, 20))
    
    # ===== ENGAGEMENT METRICS =====
    if engagement:
        elements.append(Paragraph("MÉTRICAS DE ENGAGEMENT", section_style))
        eng_data = [
            ['Métrica', 'Valor'],
            ['Engagement Rate', f"{engagement.get('engagement_rate', 0)}%"],
            ['Like/View Ratio', f"{engagement.get('like_to_view_ratio', 0)}%"],
            ['Comment/View Ratio', f"{engagement.get('comment_to_view_ratio', 0)}%"],
            ['Avg Comment Length', f"{engagement.get('avg_comment_length', 0)} chars"],
            ['Weighted Sentiment', f"{engagement.get('weighted_sentiment', 0)}%"],
        ]
        
        eng_table = Table(eng_data, colWidths=[2.5*inch, 2.5*inch])
        eng_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0EA5E9')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E4E4E7')),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(eng_table)
        elements.append(Spacer(1, 20))
    
    # ===== COMMENT TYPES =====
    content_insights = result.get('content_insights', {})
    if content_insights:
        elements.append(Paragraph("TIPOS DE COMENTARIOS", section_style))
        types_data = [
            ['Tipo', 'Cantidad'],
            ['Preguntas', str(content_insights.get('questions_count', 0))],
            ['Sugerencias', str(content_insights.get('suggestions_count', 0))],
            ['Quejas', str(content_insights.get('complaints_count', 0))],
            ['Elogios', str(content_insights.get('praise_count', 0))],
            ['Spam', str(content_insights.get('spam_count', 0))],
        ]
        
        types_table = Table(types_data, colWidths=[2.5*inch, 2.5*inch])
        types_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#18181B')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E4E4E7')),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(types_table)
        
        # Key themes
        themes = content_insights.get('key_themes', [])
        if themes:
            elements.append(Spacer(1, 10))
            elements.append(Paragraph("<b>Temas clave detectados:</b> " + ", ".join(themes[:5]), body_style))
        elements.append(Spacer(1, 20))
    
    # ===== TRENDING TOPICS =====
    topics = result.get('trending_topics', [])
    if topics:
        elements.append(Paragraph("TRENDING TOPICS", section_style))
        topic_data = [['Tema', 'Menciones', 'Sentimiento']]
        for t in topics[:10]:
            topic_data.append([t.get('topic', '')[:30], str(t.get('mentions', 0)), t.get('sentiment', '')])
        
        topic_table = Table(topic_data, colWidths=[2.5*inch, 1.2*inch, 1.3*inch])
        topic_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#18181B')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E4E4E7')),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
        ]))
        elements.append(topic_table)
        elements.append(Spacer(1, 20))
    
    # ===== SAMPLE HATE COMMENTS =====
    hate_comments = [c for c in result.get('comments', []) if c.get('is_hate') or c.get('hate_score', 0) >= 0.5][:5]
    if hate_comments:
        elements.append(Paragraph("EJEMPLOS DE COMENTARIOS CON HATE", section_style))
        for c in hate_comments:
            text = c.get('text', '')[:150] + ('...' if len(c.get('text', '')) > 150 else '')
            elements.append(Paragraph(f"• {text}", body_style))
        elements.append(Spacer(1, 20))
    
    # ===== PREMIUM UPGRADE MESSAGE =====
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("─" * 60, small_style))
    elements.append(Spacer(1, 15))
    
    premium_box_data = [[
        Paragraph(
            "<b>¿QUIERES EL INFORME COMPLETO?</b><br/><br/>"
            "Este informe analiza una muestra representativa de 200 comentarios.<br/><br/>"
            "<b>Con SOCIALHATE PREMIUM obtienes:</b><br/>"
            "• Análisis del 100% de los comentarios<br/>"
            "• Estadísticas avanzadas y tendencias<br/>"
            "• Identificación de trolls y spam<br/>"
            "• Alertas automáticas de toxicidad<br/>"
            "• Exportación de datos completos<br/>"
            "• Soporte prioritario<br/><br/>"
            "<b>Upgrade a Premium en socialhate.com/premium</b>",
            ParagraphStyle('PremiumBox', parent=body_style, alignment=1, textColor=colors.HexColor('#18181B'))
        )
    ]]
    premium_table = Table(premium_box_data, colWidths=[5*inch])
    premium_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FEF3C7')),
        ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#F59E0B')),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
    ]))
    elements.append(premium_table)
    
    # ===== FOOTER =====
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(
        f"Generado por SOCIALHATE | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", 
        ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#A1A1AA'), alignment=1)
    ))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    # Return as downloadable file
    safe_title = "".join(c for c in result.get('video_title', 'analysis')[:30] if c.isalnum() or c in (' ', '-', '_')).strip()
    filename = f"socialhate_{safe_title.replace(' ', '_')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ============= CHANNEL ENDPOINTS =====

@api_router.post("/channels")
async def create_channel(channel: ChannelCreate):
    """Create a new channel to track"""
    channel_data = {
        "id": str(uuid.uuid4()),
        "name": channel.name,
        "youtube_channel_id": channel.youtube_channel_id,
        "category": channel.category,
        "thumbnail_url": channel.thumbnail_url,
        "description": channel.description,
        "total_videos_analyzed": 0,
        "avg_hate_percentage": 0,
        "avg_positive_percentage": 0,
        "avg_negative_percentage": 0,
        "total_comments_analyzed": 0,
        "toxicity_level": "low",
        "last_analysis_date": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.channels.insert_one(channel_data)
    # Return the channel data without MongoDB's _id
    return {k: v for k, v in channel_data.items() if k != "_id"}

# ============= CHANNEL CARDS (VERIFIED BADGES) =============

def calculate_community_grade(hate_percentage: float) -> str:
    """Calculate community grade based on hate percentage"""
    if hate_percentage <= 1:
        return "A+"
    elif hate_percentage <= 3:
        return "A"
    elif hate_percentage <= 5:
        return "B+"
    elif hate_percentage <= 8:
        return "B"
    elif hate_percentage <= 12:
        return "C+"
    elif hate_percentage <= 15:
        return "C"
    elif hate_percentage <= 20:
        return "D"
    else:
        return "F"

def get_grade_color(grade: str) -> str:
    """Get color for grade"""
    if grade.startswith("A"):
        return "#10B981"  # Green
    elif grade.startswith("B"):
        return "#3B82F6"  # Blue
    elif grade.startswith("C"):
        return "#F59E0B"  # Amber
    elif grade == "D":
        return "#F97316"  # Orange
    else:
        return "#EF4444"  # Red

@api_router.post("/channels/{channel_db_id}/card")
async def create_or_update_channel_card(channel_db_id: str):
    """Create or update a verified channel card"""
    # Get channel from database
    channel = await db.channels.find_one({"id": channel_db_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Get channel stats
    youtube_channel_id = channel.get("youtube_channel_id") or channel.get("channel_id")
    
    # Get all analyses for this channel
    analyses = await db.analyses.find({"channel_id": youtube_channel_id, "status": "completed"}).to_list(100)
    
    if not analyses:
        raise HTTPException(status_code=400, detail="No analyses found. Analyze at least one video first.")
    
    # Calculate stats
    total_comments = sum(a.get("total_comments_analyzed", 0) for a in analyses)
    total_hate = sum(
        sum(1 for c in a.get("comments", []) if c.get("is_hate") or c.get("hate_score", 0) >= 0.5)
        for a in analyses
    )
    
    avg_hate_percentage = (total_hate / total_comments * 100) if total_comments > 0 else 0
    avg_hate_percentage = round(avg_hate_percentage, 1)
    
    # Calculate hate trend (last 30 days vs previous)
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    
    recent_analyses = [a for a in analyses if a.get("created_at", "") > thirty_days_ago.isoformat()]
    older_analyses = [a for a in analyses if a.get("created_at", "") <= thirty_days_ago.isoformat()]
    
    recent_hate = sum(a.get("hate_percentage", 0) for a in recent_analyses) / len(recent_analyses) if recent_analyses else avg_hate_percentage
    older_hate = sum(a.get("hate_percentage", 0) for a in older_analyses) / len(older_analyses) if older_analyses else recent_hate
    
    hate_trend = round(recent_hate - older_hate, 1)
    
    # Calculate grade
    grade = calculate_community_grade(avg_hate_percentage)
    
    # Generate unique slug from channel name
    channel_name = channel.get("name", "Unknown")
    slug = channel_name.lower().replace(" ", "").replace(".", "").replace("_", "")[:30]
    
    # Check if slug already exists for different channel
    existing_card = await db.channel_cards.find_one({"slug": slug})
    if existing_card and existing_card.get("channel_db_id") != channel_db_id:
        # Add random suffix
        slug = f"{slug}{str(uuid.uuid4())[:4]}"
    
    # Create card data
    card_data = {
        "id": str(uuid.uuid4()),
        "channel_db_id": channel_db_id,
        "youtube_channel_id": youtube_channel_id,
        "slug": slug,
        "channel_name": channel_name,
        "channel_avatar": channel.get("thumbnail_url", ""),
        "subscriber_count": channel.get("subscriber_count", 0),
        "hate_score": avg_hate_percentage,
        "community_grade": grade,
        "grade_color": get_grade_color(grade),
        "hate_trend": hate_trend,
        "trend_direction": "down" if hate_trend < 0 else "up" if hate_trend > 0 else "stable",
        "total_videos_analyzed": len(analyses),
        "total_comments_analyzed": total_comments,
        "verified_date": datetime.now(timezone.utc).isoformat(),
        "is_verified": avg_hate_percentage <= 15,  # Verified if hate <= 15%
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Check if card already exists for this channel
    existing = await db.channel_cards.find_one({"channel_db_id": channel_db_id})
    if existing:
        # Update existing card
        card_data["id"] = existing.get("id")
        card_data["slug"] = existing.get("slug")  # Keep same slug
        card_data["created_at"] = existing.get("created_at")
        await db.channel_cards.update_one(
            {"channel_db_id": channel_db_id},
            {"$set": card_data}
        )
    else:
        # Create new card
        await db.channel_cards.insert_one(card_data)
    
    return card_data

@api_router.get("/channels/{channel_db_id}/card")
async def get_channel_card_by_id(channel_db_id: str):
    """Get channel card by channel database ID"""
    card = await db.channel_cards.find_one({"channel_db_id": channel_db_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found. Create one first.")
    return card

@api_router.get("/card/{slug}")
async def get_channel_card_by_slug(slug: str):
    """Get channel card by public slug (for sharing) - always with fresh data"""
    card = await db.channel_cards.find_one({"slug": slug.lower()}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Get fresh channel data to update the card with current stats
    channel_db_id = card.get("channel_db_id")
    if channel_db_id:
        channel = await db.channels.find_one({"id": channel_db_id}, {"_id": 0})
        if channel:
            # Update card with fresh data
            card["hate_score"] = round(channel.get("avg_hate_percentage", 0), 1)
            card["subscriber_count"] = channel.get("subscriber_count", 0)
            card["total_videos_analyzed"] = channel.get("total_videos_analyzed", 0)
            card["total_comments_analyzed"] = channel.get("total_comments_analyzed", 0)
            card["channel_avatar"] = channel.get("thumbnail_url", card.get("channel_avatar"))
            
            # Recalculate community grade based on current hate score
            hate = card["hate_score"]
            if hate <= 3:
                card["community_grade"] = "A+"
            elif hate <= 5:
                card["community_grade"] = "A"
            elif hate <= 8:
                card["community_grade"] = "B+"
            elif hate <= 12:
                card["community_grade"] = "B"
            elif hate <= 18:
                card["community_grade"] = "C+"
            elif hate <= 25:
                card["community_grade"] = "C"
            elif hate <= 35:
                card["community_grade"] = "D"
            else:
                card["community_grade"] = "F"
            
            # Calculate trend from recent analyses using Firestore query
            try:
                analyses_list = await db.analyses.find_many(
                    {"channel_id": channel.get("channel_id"), "status": "completed"},
                    {"_id": 0}
                )
                # Sort by created_at descending and take last 10
                analyses_list = sorted(analyses_list, key=lambda x: x.get("created_at", ""), reverse=True)[:10]
                
                if len(analyses_list) >= 2:
                    recent = analyses_list[:len(analyses_list)//2]
                    older = analyses_list[len(analyses_list)//2:]
                    recent_avg = sum(a.get("hate_percentage", 0) for a in recent) / len(recent)
                    older_avg = sum(a.get("hate_percentage", 0) for a in older) / len(older)
                    trend = recent_avg - older_avg
                    card["hate_trend"] = round(abs(trend), 1)
                    if trend < -1:
                        card["trend_direction"] = "down"
                    elif trend > 1:
                        card["trend_direction"] = "up"
                    else:
                        card["trend_direction"] = "stable"
            except Exception as e:
                # If trend calculation fails, keep existing values
                pass
    
    return card

@api_router.get("/youtube/search")
async def search_youtube(q: str, limit: int = 5):
    """Search YouTube channels by name"""
    if not q or len(q) < 2:
        return []
    channels = await search_youtube_channels(q, limit)
    return channels

@api_router.get("/youtube/channel/{channel_id}")
async def get_youtube_channel(channel_id: str):
    """Get YouTube channel info by ID"""
    info = await fetch_channel_info(channel_id)
    if not info:
        raise HTTPException(status_code=404, detail="YouTube channel not found")
    return info

@api_router.get("/channels")
async def list_channels(category: Optional[str] = None, limit: int = 20):
    """List all channels, optionally filtered by category"""
    query = {}
    if category:
        query["category"] = category
    
    # Sort by avg_hate_percentage descending, but put channels without analyses at the end
    cursor = db.channels.find(query, {"_id": 0}).sort([
        ("total_videos_analyzed", -1),  # Channels with videos first
        ("avg_hate_percentage", -1)
    ]).limit(limit)
    channels = await cursor.to_list(length=limit)
    return channels

@api_router.get("/channels/categories")
async def list_categories():
    """List all unique categories"""
    categories = await db.channels.distinct("category")
    return categories

@api_router.get("/channels/{channel_id}")
async def get_channel(channel_id: str):
    """Get channel details with its analyses"""
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Get analyses for this channel
    analyses = await db.analyses.find(
        {"channel_db_id": channel_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Filter to only needed fields
    filtered_analyses = []
    for a in analyses:
        filtered_analyses.append({
            "id": a.get("id"),
            "video_title": a.get("video_title"),
            "thumbnail_url": a.get("thumbnail_url"),
            "hate_percentage": a.get("hate_percentage"),
            "status": a.get("status"),
            "created_at": a.get("created_at")
        })
    
    channel["analyses"] = filtered_analyses
    return channel

@api_router.delete("/channels/{channel_id}")
async def delete_channel(channel_id: str):
    """Delete a channel"""
    result = await db.channels.delete_one({"id": channel_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Channel not found")
    return {"message": "Channel deleted"}

@api_router.get("/channels/{channel_id}/stats")
async def get_channel_stats(channel_id: str):
    """Get aggregated stats for a channel"""
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Get YouTube channel ID for matching analyses
    youtube_channel_id = channel.get("channel_id")
    
    # Aggregate stats from all analyses
    pipeline = [
        {"$match": {"channel_id": youtube_channel_id, "status": "completed"}},
        {"$group": {
            "_id": None,
            "total_videos": {"$sum": 1},
            "avg_hate": {"$avg": "$hate_percentage"},
            "avg_positive": {"$avg": "$positive_percentage"},
            "avg_negative": {"$avg": "$negative_percentage"},
            "total_comments": {"$sum": "$total_comments_analyzed"},
            "total_views": {"$sum": "$view_count"},
            "total_likes": {"$sum": "$like_count"}
        }}
    ]
    
    result = await db.analyses.aggregate(pipeline).to_list(1)
    
    if result:
        stats = result[0]
        return {
            "channel": channel,
            "stats": {
                "total_videos_analyzed": stats.get("total_videos", 0),
                "avg_hate_percentage": round(stats.get("avg_hate", 0) or 0, 1),
                "avg_positive_percentage": round(stats.get("avg_positive", 0) or 0, 1),
                "avg_negative_percentage": round(stats.get("avg_negative", 0) or 0, 1),
                "total_comments_analyzed": stats.get("total_comments", 0),
                "total_views": stats.get("total_views", 0),
                "total_likes": stats.get("total_likes", 0)
            }
        }
    
    return {"channel": channel, "stats": {}}

@api_router.post("/channels/{channel_id}/analyze")
async def analyze_channel_video(channel_id: str, youtube_url: str, background_tasks: BackgroundTasks):
    """Analyze a video and link it to a channel"""
    channel = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    try:
        video_id = extract_video_id(youtube_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Create initial analysis record linked to channel
    analysis_id = str(uuid.uuid4())
    initial_data = {
        "id": analysis_id,
        "video_id": video_id,
        "channel_db_id": channel_id,  # Link to our channel
        "video_title": "Loading...",
        "channel_name": channel["name"],
        "thumbnail_url": "",
        "view_count": 0,
        "like_count": 0,
        "comment_count": 0,
        "total_comments_analyzed": 0,
        "hate_percentage": 0,
        "positive_percentage": 0,
        "negative_percentage": 0,
        "neutral_percentage": 0,
        "average_sentiment": 0,
        "word_rankings": [],
        "trending_topics": [],
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "processing"
    }
    
    await db.analyses.insert_one(initial_data)
    
    # Run analysis in background (uses env API key)
    background_tasks.add_task(
        run_full_analysis_with_channel_update,
        analysis_id,
        video_id,
        channel_id
    )
    
    return {"id": analysis_id, "status": "processing", "channel_id": channel_id}

async def run_full_analysis_with_channel_update(analysis_id: str, video_id: str, channel_id: str):
    """Run analysis and update channel stats"""
    await run_full_analysis(analysis_id, video_id)
    
    # Update channel stats after analysis
    await update_channel_stats(channel_id)

async def update_channel_stats(channel_id: str):
    """Update channel aggregate statistics"""
    pipeline = [
        {"$match": {"channel_db_id": channel_id, "status": "completed"}},
        {"$group": {
            "_id": None,
            "total_videos": {"$sum": 1},
            "avg_hate": {"$avg": "$hate_percentage"},
            "avg_positive": {"$avg": "$positive_percentage"},
            "avg_negative": {"$avg": "$negative_percentage"},
            "total_comments": {"$sum": "$total_comments_analyzed"}
        }}
    ]
    
    result = await db.analyses.aggregate(pipeline).to_list(1)
    
    if result:
        stats = result[0]
        hate_pct = stats.get("avg_hate", 0)
        
        # Determine toxicity level
        if hate_pct >= 30:
            toxicity = "severe"
        elif hate_pct >= 20:
            toxicity = "high"
        elif hate_pct >= 10:
            toxicity = "moderate"
        else:
            toxicity = "low"
        
        await db.channels.update_one(
            {"id": channel_id},
            {"$set": {
                "total_videos_analyzed": stats.get("total_videos", 0),
                "avg_hate_percentage": round(stats.get("avg_hate", 0), 1),
                "avg_positive_percentage": round(stats.get("avg_positive", 0), 1),
                "avg_negative_percentage": round(stats.get("avg_negative", 0), 1),
                "total_comments_analyzed": stats.get("total_comments", 0),
                "toxicity_level": toxicity,
                "last_analysis_date": datetime.now(timezone.utc).isoformat()
            }}
        )

@api_router.get("/ranking/{category}")
async def get_category_ranking(category: str, limit: int = 10):
    """Get hate ranking for a specific category"""
    cursor = db.channels.find(
        {"category": category, "total_videos_analyzed": {"$gt": 0}},
        {"_id": 0}
    ).sort("avg_hate_percentage", -1).limit(limit)
    
    channels = await cursor.to_list(length=limit)
    
    # Add rank
    for i, channel in enumerate(channels):
        channel["rank"] = i + 1
    
    return {
        "category": category,
        "total_channels": len(channels),
        "ranking": channels
    }

@api_router.get("/admin/channel-videos/{channel_id}")
async def get_channel_videos(channel_id: str, max_results: int = 20):
    """Get recent videos from a channel"""
    key = os.environ.get('YOUTUBE_API_KEY')
    if not key:
        raise HTTPException(status_code=500, detail="YouTube API key not configured")
    
    try:
        youtube = build('youtube', 'v3', developerKey=key)
        
        # Get channel's uploads playlist
        channel_response = youtube.channels().list(
            part="contentDetails,snippet",
            id=channel_id
        ).execute()
        
        if not channel_response.get("items"):
            raise HTTPException(status_code=404, detail="Canal no encontrado")
        
        channel_data = channel_response["items"][0]
        channel_name = channel_data["snippet"]["title"]
        uploads_playlist = channel_data["contentDetails"]["relatedPlaylists"]["uploads"]
        
        # Get videos from uploads playlist
        playlist_response = youtube.playlistItems().list(
            part="snippet,contentDetails",
            playlistId=uploads_playlist,
            maxResults=max_results
        ).execute()
        
        videos = []
        video_ids = []
        
        for item in playlist_response.get("items", []):
            video_id = item["snippet"]["resourceId"]["videoId"]
            video_ids.append(video_id)
            videos.append({
                "video_id": video_id,
                "title": item["snippet"]["title"],
                "thumbnail_url": item["snippet"]["thumbnails"].get("medium", {}).get("url", ""),
                "published_at": item["snippet"]["publishedAt"],
                "channel_id": channel_id,
                "channel_name": channel_name
            })
        
        # Get video statistics
        if video_ids:
            stats_response = youtube.videos().list(
                part="statistics",
                id=",".join(video_ids)
            ).execute()
            
            stats_map = {item["id"]: item["statistics"] for item in stats_response.get("items", [])}
            
            for video in videos:
                stats = stats_map.get(video["video_id"], {})
                video["view_count"] = int(stats.get("viewCount", 0))
                video["like_count"] = int(stats.get("likeCount", 0))
                video["comment_count"] = int(stats.get("commentCount", 0))
        
        return {"channel_name": channel_name, "videos": videos}
    
    except HttpError as e:
        raise HTTPException(status_code=500, detail=f"YouTube API error: {str(e)}")

@api_router.get("/channels/{channel_db_id}/youtube-videos")
async def get_channel_youtube_videos(channel_db_id: str, max_results: int = 50, search: str = None, force_refresh: bool = False):
    """Get YouTube videos from a channel for the video selector (with cache)"""
    # Get channel from database
    channel = await db.channels.find_one({"id": channel_db_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Try both field names for YouTube channel ID
    youtube_channel_id = channel.get("youtube_channel_id") or channel.get("channel_id")
    if not youtube_channel_id:
        raise HTTPException(status_code=400, detail="No YouTube channel ID associated")
    
    # Check cache first (unless force refresh)
    if not force_refresh and not search:
        cached_videos = await YouTubeCache.get_channel_videos(youtube_channel_id)
        if cached_videos:
            # Apply search filter to cached results if needed
            filtered = cached_videos[:max_results]
            return {
                "channel_name": channel.get("name", "Unknown"),
                "videos": filtered,
                "total": len(filtered),
                "from_cache": True
            }
    
    key = os.environ.get('YOUTUBE_API_KEY')
    if not key:
        raise HTTPException(status_code=500, detail="YouTube API key not configured")
    
    try:
        youtube = build('youtube', 'v3', developerKey=key)
        
        # Get channel's uploads playlist
        channel_response = youtube.channels().list(
            part="contentDetails,snippet",
            id=youtube_channel_id
        ).execute()
        
        if not channel_response.get("items"):
            raise HTTPException(status_code=404, detail="YouTube channel not found")
        
        channel_data = channel_response["items"][0]
        channel_name = channel_data["snippet"]["title"]
        uploads_playlist = channel_data["contentDetails"]["relatedPlaylists"]["uploads"]
        
        # Get videos from uploads playlist
        playlist_response = youtube.playlistItems().list(
            part="snippet,contentDetails",
            playlistId=uploads_playlist,
            maxResults=max_results
        ).execute()
        
        videos = []
        video_ids = []
        
        for item in playlist_response.get("items", []):
            video_id = item["snippet"]["resourceId"]["videoId"]
            title = item["snippet"]["title"]
            
            video_ids.append(video_id)
            videos.append({
                "video_id": video_id,
                "title": title,
                "thumbnail_url": item["snippet"]["thumbnails"].get("medium", {}).get("url", ""),
                "published_at": item["snippet"]["publishedAt"],
                "channel_id": youtube_channel_id,
                "channel_name": channel_name
            })
        
        # Get video statistics
        if video_ids:
            stats_response = youtube.videos().list(
                part="statistics",
                id=",".join(video_ids[:50])  # API limit
            ).execute()
            
            stats_map = {item["id"]: item["statistics"] for item in stats_response.get("items", [])}
            
            for video in videos:
                stats = stats_map.get(video["video_id"], {})
                video["view_count"] = int(stats.get("viewCount", 0))
                video["like_count"] = int(stats.get("likeCount", 0))
                video["comment_count"] = int(stats.get("commentCount", 0))
        
        # Sort by published date (most recent first)
        videos.sort(key=lambda x: x.get("published_at", ""), reverse=True)
        
        # Save to cache (only if not searching)
        if not search:
            await YouTubeCache.set_channel_videos(youtube_channel_id, videos)
        
        # Apply search filter after caching
        if search:
            videos = [v for v in videos if search.lower() in v["title"].lower()]
        
        return {"channel_name": channel_name, "videos": videos, "total": len(videos), "from_cache": False}
    
    except HttpError as e:
        raise HTTPException(status_code=500, detail=f"YouTube API error: {str(e)}")

@api_router.post("/admin/analyze-videos")
async def analyze_multiple_videos(video_urls: List[str], background_tasks: BackgroundTasks):
    """Queue multiple videos for analysis with intelligent rate limiting"""
    results = []
    
    # Calculate optimal delay based on number of videos
    # Each video = 4 Gemini calls (4 batches of 50 comments)
    # Limit: 15 RPM = 1 call every 4 seconds
    # For 50 videos = 200 calls total
    # Spread over 13-14 minutes to stay under 15 RPM
    
    total_videos = len(video_urls)
    total_calls = total_videos * 4  # 4 batches per video
    
    # Calculate delay to spread calls over time (safe for 15 RPM)
    # Target: ~12 calls per minute (80% of limit for safety)
    if total_videos > 10:
        delay_between_videos = 20  # 20s = 3 videos/min = 12 calls/min
        logger.info(f"📊 Analyzing {total_videos} videos with 20s delay (safe rate limiting)")
    elif total_videos > 5:
        delay_between_videos = 10  # 10s = 6 videos/min
        logger.info(f"📊 Analyzing {total_videos} videos with 10s delay")
    else:
        delay_between_videos = 5   # 5s for small batches
        logger.info(f"📊 Analyzing {total_videos} videos with 5s delay")
    
    estimated_time = (total_videos * delay_between_videos + total_videos * 16) / 60  # minutes
    logger.info(f"⏱️ Estimated completion: ~{estimated_time:.1f} minutes")
    logger.info(f"📞 Total Gemini calls: {total_calls} (Quota: {(total_calls/1500*100):.1f}% of daily limit)")
    
    for idx, url in enumerate(video_urls):
        try:
            analysis_id = str(uuid.uuid4())
            
            # Extract video ID
            video_id = None
            if "v=" in url:
                video_id = url.split("v=")[1].split("&")[0]
            elif "youtu.be/" in url:
                video_id = url.split("youtu.be/")[1].split("?")[0]
            
            if not video_id:
                results.append({"url": url, "success": False, "error": "Invalid URL"})
                continue
            
            initial_data = {
                "id": analysis_id,
                "video_id": video_id,
                "video_title": "Processing...",
                "video_url": url,
                "channel_name": "",
                "thumbnail_url": "",
                "view_count": 0,
                "like_count": 0,
                "comment_count": 0,
                "total_comments_analyzed": 0,
                "hate_percentage": 0,
                "positive_percentage": 0,
                "negative_percentage": 0,
                "neutral_percentage": 0,
                "average_sentiment": 0,
                "word_rankings": [],
                "trending_topics": [],
                "comments": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "processing"
            }
            await db.analyses.insert_one(initial_data)
            
            # Add intelligent delay based on batch size
            if idx > 0:
                logger.info(f"⏳ Video {idx + 1}/{total_videos} queued. Waiting {delay_between_videos}s before next...")
                await asyncio.sleep(delay_between_videos)
            
            background_tasks.add_task(run_full_analysis, analysis_id, video_id)
            
            results.append({"url": url, "success": True, "analysis_id": analysis_id})
            
        except Exception as e:
            results.append({"url": url, "success": False, "error": str(e)})
    
    return {"queued": len([r for r in results if r.get("success")]), "results": results}

@api_router.post("/admin/migrate-channels")
async def migrate_channels():
    """Migrate existing analyses to add channel_id and create channel entries"""
    key = os.environ.get('YOUTUBE_API_KEY')
    if not key:
        raise HTTPException(status_code=500, detail="YouTube API key not configured")
    
    youtube = build('youtube', 'v3', developerKey=key)
    
    # Get all analyses without channel_id
    cursor = db.analyses.find({"channel_id": {"$exists": False}}, {"_id": 0, "id": 1, "video_url": 1, "channel_name": 1})
    analyses = await cursor.to_list(length=500)
    
    migrated = 0
    errors = 0
    
    for analysis in analyses:
        try:
            # Extract video ID
            video_url = analysis.get("video_url", "")
            video_id = None
            if "v=" in video_url:
                video_id = video_url.split("v=")[1].split("&")[0]
            elif "youtu.be/" in video_url:
                video_id = video_url.split("youtu.be/")[1].split("?")[0]
            
            if not video_id:
                continue
            
            # Get video details to get channel_id
            response = youtube.videos().list(part="snippet", id=video_id).execute()
            if not response.get("items"):
                continue
            
            snippet = response["items"][0]["snippet"]
            channel_id = snippet.get("channelId", "")
            channel_name = snippet.get("channelTitle", "")
            
            if not channel_id:
                continue
            
            # Update analysis with channel_id
            await db.analyses.update_one(
                {"id": analysis["id"]},
                {"$set": {"channel_id": channel_id, "channel_name": channel_name}}
            )
            
            # Create or update channel entry
            existing_channel = await db.channels.find_one({"channel_id": channel_id})
            if not existing_channel:
                try:
                    ch_response = youtube.channels().list(part="snippet,statistics", id=channel_id).execute()
                    if ch_response.get("items"):
                        ch_data = ch_response["items"][0]
                        channel_data = {
                            "id": str(uuid.uuid4()),
                            "channel_id": channel_id,
                            "name": channel_name,
                            "thumbnail_url": ch_data["snippet"].get("thumbnails", {}).get("medium", {}).get("url", ""),
                            "subscriber_count": int(ch_data["statistics"].get("subscriberCount", 0)),
                            "video_count": int(ch_data["statistics"].get("videoCount", 0)),
                            "total_videos_analyzed": 0,
                            "avg_hate_percentage": 0,
                            "avg_positive_percentage": 0,
                            "total_comments_analyzed": 0,
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                        await db.channels.insert_one(channel_data)
                except:
                    pass
            
            migrated += 1
            
        except Exception as e:
            logger.error(f"Migration error for analysis {analysis.get('id')}: {e}")
            errors += 1
    
    # Recalculate all channel stats
    channels = await db.channels.find({}, {"_id": 0, "channel_id": 1}).to_list(length=100)
    for channel in channels:
        channel_id = channel["channel_id"]
        channel_analyses = await db.analyses.find(
            {"channel_id": channel_id, "status": "completed"},
            {"hate_percentage": 1, "positive_percentage": 1, "total_comments_analyzed": 1}
        ).to_list(length=1000)
        
        if channel_analyses:
            total_videos = len(channel_analyses)
            avg_hate = sum(a.get("hate_percentage", 0) for a in channel_analyses) / total_videos
            avg_positive = sum(a.get("positive_percentage", 0) for a in channel_analyses) / total_videos
            total_comments = sum(a.get("total_comments_analyzed", 0) for a in channel_analyses)
            
            await db.channels.update_one(
                {"channel_id": channel_id},
                {"$set": {
                    "total_videos_analyzed": total_videos,
                    "avg_hate_percentage": round(avg_hate, 1),
                    "avg_positive_percentage": round(avg_positive, 1),
                    "total_comments_analyzed": total_comments
                }}
            )
    
    return {"migrated": migrated, "errors": errors, "message": "Migration completed"}

# ============= ADMIN ENDPOINTS =============

@api_router.post("/admin/login")
async def admin_login(login: AdminLogin):
    """Simple admin login"""
    if login.username == ADMIN_USERNAME and login.password == ADMIN_PASSWORD:
        return {"success": True, "message": "Login correcto", "role": "admin"}
    # Medusa advanced user
    if login.username == "medusa" and login.password == "medusa":
        return {"success": True, "message": "Login correcto", "role": "medusa"}
    raise HTTPException(status_code=401, detail="Credenciales incorrectas")

# ============= MEDUSA ADVANCED ANALYSIS =============

class MedusaChannelRequest(BaseModel):
    platform: str  # youtube or tiktok
    channel_id: str  # YouTube channel ID or TikTok username

class MedusaAnalyzeRequest(BaseModel):
    platform: str
    channel_id: str
    video_ids: List[str] = []
    date_from: Optional[str] = None
    date_to: Optional[str] = None

@api_router.post("/medusa/fetch-videos")
async def medusa_fetch_videos(request: MedusaChannelRequest):
    """Fetch all videos from a YouTube or TikTok channel for Medusa analysis"""
    try:
        if request.platform == "youtube":
            # Fetch YouTube videos
            youtube = get_youtube_service()
            
            # First get the uploads playlist ID
            # Check if it's a channel ID (starts with UC) or a channel name
            channel_id = request.channel_id
            
            # If not a channel ID, search for the channel by name
            if not channel_id.startswith("UC"):
                search_response = youtube.search().list(
                    part="snippet",
                    q=channel_id,
                    type="channel",
                    maxResults=1
                ).execute()
                
                if not search_response.get("items"):
                    raise HTTPException(status_code=404, detail=f"No se encontró ningún canal con el nombre '{channel_id}'")
                
                channel_id = search_response["items"][0]["snippet"]["channelId"]
            
            channel_response = youtube.channels().list(
                part="contentDetails,snippet,statistics",
                id=channel_id
            ).execute()
            
            if not channel_response.get("items"):
                raise HTTPException(status_code=404, detail="Canal de YouTube no encontrado")
            
            channel_data = channel_response["items"][0]
            uploads_playlist_id = channel_data["contentDetails"]["relatedPlaylists"]["uploads"]
            channel_name = channel_data["snippet"]["title"]
            channel_thumbnail = channel_data["snippet"]["thumbnails"]["default"]["url"]
            subscriber_count = int(channel_data["statistics"].get("subscriberCount", 0))
            
            # Fetch all videos from uploads playlist
            videos = []
            next_page_token = None
            
            while True:
                playlist_response = youtube.playlistItems().list(
                    part="snippet,contentDetails",
                    playlistId=uploads_playlist_id,
                    maxResults=50,
                    pageToken=next_page_token
                ).execute()
                
                for item in playlist_response.get("items", []):
                    video_id = item["contentDetails"]["videoId"]
                    snippet = item["snippet"]
                    videos.append({
                        "video_id": video_id,
                        "title": snippet.get("title", ""),
                        "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
                        "published_at": snippet.get("publishedAt", ""),
                        "description": snippet.get("description", "")[:200]
                    })
                
                next_page_token = playlist_response.get("nextPageToken")
                if not next_page_token or len(videos) >= 500:  # Max 500 videos
                    break
            
            return {
                "platform": "youtube",
                "channel_id": channel_id,
                "channel_name": channel_name,
                "channel_thumbnail": channel_thumbnail,
                "subscriber_count": subscriber_count,
                "total_videos": len(videos),
                "videos": videos
            }
            
        elif request.platform == "tiktok":
            # Fetch TikTok videos using RapidAPI
            rapidapi_key = os.environ.get('RAPIDAPI_KEY')
            if not rapidapi_key:
                raise HTTPException(status_code=500, detail="RapidAPI key not configured")
            
            headers = {
                "X-RapidAPI-Key": rapidapi_key,
                "X-RapidAPI-Host": "tiktok-scraper7.p.rapidapi.com"
            }
            
            videos = []
            cursor = 0
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                # First get user info
                user_response = await client.get(
                    "https://tiktok-scraper7.p.rapidapi.com/user/info",
                    headers=headers,
                    params={"unique_id": request.channel_id}
                )
                
                user_data = {}
                if user_response.status_code == 200:
                    user_json = user_response.json()
                    if user_json.get("code") == 0:
                        user_data = user_json.get("data", {}).get("user", {})
                
                # Fetch user's videos
                while len(videos) < 200:  # Max 200 TikTok videos
                    response = await client.get(
                        "https://tiktok-scraper7.p.rapidapi.com/user/posts",
                        headers=headers,
                        params={"unique_id": request.channel_id, "count": 30, "cursor": cursor}
                    )
                    
                    if response.status_code != 200:
                        break
                    
                    data = response.json()
                    if data.get("code") != 0:
                        break
                    
                    video_list = data.get("data", {}).get("videos", [])
                    if not video_list:
                        break
                    
                    for video in video_list:
                        title = video.get("title") or video.get("desc") or ""
                        videos.append({
                            "video_id": str(video.get("id", "")),
                            "title": str(title)[:100] if title else "",
                            "thumbnail": video.get("cover", ""),
                            "published_at": datetime.fromtimestamp(video.get("create_time", 0)).isoformat() if video.get("create_time") else "",
                            "play_count": video.get("play_count", 0),
                            "comment_count": video.get("comment_count", 0),
                            "url": f"https://www.tiktok.com/@{request.channel_id}/video/{video.get('id', '')}"
                        })
                    
                    if not data.get("data", {}).get("hasMore"):
                        break
                    new_cursor = data.get("data", {}).get("cursor")
                    cursor = int(new_cursor) if new_cursor else cursor + 30
            
            return {
                "platform": "tiktok",
                "channel_id": request.channel_id,
                "channel_name": user_data.get("nickname", request.channel_id),
                "channel_thumbnail": user_data.get("avatar_thumb", ""),
                "follower_count": user_data.get("follower_count", 0),
                "total_videos": len(videos),
                "videos": videos
            }
        else:
            raise HTTPException(status_code=400, detail="Plataforma no soportada")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching videos for Medusa: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/medusa/analyze-batch")
async def medusa_analyze_batch(request: MedusaAnalyzeRequest, background_tasks: BackgroundTasks):
    """Start batch analysis for Medusa - analyzes multiple videos"""
    try:
        # Create a batch analysis record
        batch_id = str(uuid.uuid4())
        
        batch_data = {
            "id": batch_id,
            "platform": request.platform,
            "channel_id": request.channel_id,
            "video_ids": request.video_ids,
            "date_from": request.date_from,
            "date_to": request.date_to,
            "status": "processing",
            "progress": 0,
            "total_videos": len(request.video_ids),
            "completed_videos": 0,
            "results": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.medusa_batches.insert_one(batch_data)
        
        # Start background analysis
        background_tasks.add_task(process_medusa_batch, batch_id, request)
        
        return {"batch_id": batch_id, "status": "processing", "total_videos": len(request.video_ids)}
        
    except Exception as e:
        logger.error(f"Error starting Medusa batch analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_medusa_batch(batch_id: str, request: MedusaAnalyzeRequest):
    """Process batch analysis for Medusa in background"""
    try:
        results = []
        total = len(request.video_ids)
        
        for i, video_id in enumerate(request.video_ids):
            try:
                if request.platform == "youtube":
                    # Analyze YouTube video
                    video_url = f"https://www.youtube.com/watch?v={video_id}"
                    
                    # Create analysis record
                    analysis_id = str(uuid.uuid4())
                    analysis_data = {
                        "id": analysis_id,
                        "video_url": video_url,
                        "video_id": video_id,
                        "platform": "youtube",
                        "status": "processing",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "medusa_batch_id": batch_id
                    }
                    await db.analyses.insert_one(analysis_data)
                    
                    # Fetch video details and comments
                    youtube = get_youtube_service()
                    video_response = youtube.videos().list(
                        part="snippet,statistics",
                        id=video_id
                    ).execute()
                    
                    if video_response.get("items"):
                        video_data = video_response["items"][0]
                        snippet = video_data["snippet"]
                        stats = video_data["statistics"]
                        
                        # Fetch comments
                        comments = await fetch_comments(youtube, video_id, max_results=100)
                        
                        if comments:
                            # Analyze with AI
                            ai_analysis = await analyze_comments_with_ai(comments)
                            
                            # Calculate metrics
                            ai_comments = ai_analysis.get("comments", [])
                            total_comments = len(ai_comments)
                            hate_count = sum(1 for c in ai_comments if c.get("is_hate") or c.get("hate_score", 0) >= 0.5)
                            positive_count = sum(1 for c in ai_comments if c.get("sentiment_label") == "positive")
                            negative_count = sum(1 for c in ai_comments if c.get("sentiment_label") == "negative")
                            
                            hate_pct = round(hate_count / total_comments * 100, 1) if total_comments > 0 else 0
                            positive_pct = round(positive_count / total_comments * 100, 1) if total_comments > 0 else 0
                            negative_pct = round(negative_count / total_comments * 100, 1) if total_comments > 0 else 0
                            
                            result = {
                                "video_id": video_id,
                                "analysis_id": analysis_id,
                                "title": snippet.get("title", ""),
                                "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
                                "view_count": int(stats.get("viewCount", 0)),
                                "like_count": int(stats.get("likeCount", 0)),
                                "comment_count": int(stats.get("commentCount", 0)),
                                "total_analyzed": total_comments,
                                "hate_percentage": hate_pct,
                                "positive_percentage": positive_pct,
                                "negative_percentage": negative_pct,
                                "word_rankings": ai_analysis.get("word_rankings", [])[:10],
                                "trending_topics": ai_analysis.get("trending_topics", [])[:5],
                                "status": "completed"
                            }
                            
                            # Update analysis in DB
                            await db.analyses.update_one(
                                {"id": analysis_id},
                                {"$set": {
                                    "video_title": snippet.get("title"),
                                    "thumbnail_url": snippet.get("thumbnails", {}).get("medium", {}).get("url"),
                                    "hate_percentage": hate_pct,
                                    "positive_percentage": positive_pct,
                                    "negative_percentage": negative_pct,
                                    "total_comments_analyzed": total_comments,
                                    "status": "completed"
                                }}
                            )
                        else:
                            result = {
                                "video_id": video_id,
                                "analysis_id": analysis_id,
                                "title": snippet.get("title", ""),
                                "status": "no_comments"
                            }
                    else:
                        result = {"video_id": video_id, "status": "not_found"}
                        
                elif request.platform == "tiktok":
                    # Analyze TikTok video
                    video_url = f"https://www.tiktok.com/@{request.channel_id}/video/{video_id}"
                    
                    analysis_id = str(uuid.uuid4())
                    
                    # Get video info
                    video_info = await get_tiktok_video_info(video_url)
                    comments = await get_tiktok_comments(video_url, max_results=100)
                    
                    if comments:
                        ai_analysis = await analyze_comments_with_ai(comments)
                        
                        ai_comments = ai_analysis.get("comments", [])
                        total_comments = len(ai_comments)
                        hate_count = sum(1 for c in ai_comments if c.get("is_hate") or c.get("hate_score", 0) >= 0.5)
                        positive_count = sum(1 for c in ai_comments if c.get("sentiment_label") == "positive")
                        negative_count = sum(1 for c in ai_comments if c.get("sentiment_label") == "negative")
                        
                        hate_pct = round(hate_count / total_comments * 100, 1) if total_comments > 0 else 0
                        positive_pct = round(positive_count / total_comments * 100, 1) if total_comments > 0 else 0
                        negative_pct = round(negative_count / total_comments * 100, 1) if total_comments > 0 else 0
                        
                        result = {
                            "video_id": video_id,
                            "analysis_id": analysis_id,
                            "title": video_info.get("title", ""),
                            "thumbnail": video_info.get("thumbnail_url", ""),
                            "view_count": video_info.get("views", 0),
                            "like_count": video_info.get("likes", 0),
                            "comment_count": video_info.get("comment_count", 0),
                            "total_analyzed": total_comments,
                            "hate_percentage": hate_pct,
                            "positive_percentage": positive_pct,
                            "negative_percentage": negative_pct,
                            "word_rankings": ai_analysis.get("word_rankings", [])[:10],
                            "trending_topics": ai_analysis.get("trending_topics", [])[:5],
                            "status": "completed"
                        }
                    else:
                        result = {
                            "video_id": video_id,
                            "analysis_id": analysis_id,
                            "title": video_info.get("title", ""),
                            "status": "no_comments"
                        }
                
                results.append(result)
                
            except Exception as e:
                logger.error(f"Error analyzing video {video_id}: {e}")
                results.append({"video_id": video_id, "status": "error", "error": str(e)})
            
            # Update progress
            progress = round((i + 1) / total * 100)
            await db.medusa_batches.update_one(
                {"id": batch_id},
                {"$set": {
                    "progress": progress,
                    "completed_videos": i + 1,
                    "results": results
                }}
            )
        
        # Generate summary statistics
        completed_results = [r for r in results if r.get("status") == "completed"]
        
        summary = {
            "total_videos_analyzed": len(completed_results),
            "total_comments_analyzed": sum(r.get("total_analyzed", 0) for r in completed_results),
            "avg_hate_percentage": round(sum(r.get("hate_percentage", 0) for r in completed_results) / len(completed_results), 1) if completed_results else 0,
            "avg_positive_percentage": round(sum(r.get("positive_percentage", 0) for r in completed_results) / len(completed_results), 1) if completed_results else 0,
            "highest_hate_video": max(completed_results, key=lambda x: x.get("hate_percentage", 0)) if completed_results else None,
            "lowest_hate_video": min(completed_results, key=lambda x: x.get("hate_percentage", 0)) if completed_results else None,
            "total_views": sum(r.get("view_count", 0) for r in completed_results),
            "total_likes": sum(r.get("like_count", 0) for r in completed_results)
        }
        
        # Aggregate word rankings
        all_words = {}
        for r in completed_results:
            for word in r.get("word_rankings", []):
                w = word.get("word", "")
                if w:
                    all_words[w] = all_words.get(w, 0) + word.get("count", 1)
        
        top_words = sorted(all_words.items(), key=lambda x: x[1], reverse=True)[:20]
        summary["top_words"] = [{"word": w, "count": c} for w, c in top_words]
        
        # Aggregate topics
        all_topics = {}
        for r in completed_results:
            for topic in r.get("trending_topics", []):
                all_topics[topic] = all_topics.get(topic, 0) + 1
        
        top_topics = sorted(all_topics.items(), key=lambda x: x[1], reverse=True)[:10]
        summary["top_topics"] = [t[0] for t in top_topics]
        
        # Final update
        await db.medusa_batches.update_one(
            {"id": batch_id},
            {"$set": {
                "status": "completed",
                "progress": 100,
                "results": results,
                "summary": summary,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"Medusa batch {batch_id} completed: {len(completed_results)} videos analyzed")
        
    except Exception as e:
        logger.error(f"Error in Medusa batch {batch_id}: {e}")
        await db.medusa_batches.update_one(
            {"id": batch_id},
            {"$set": {"status": "error", "error": str(e)}}
        )

@api_router.get("/medusa/batch/{batch_id}")
async def get_medusa_batch(batch_id: str):
    """Get Medusa batch analysis status and results"""
    batch = await db.medusa_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch

@api_router.get("/medusa/batches")
async def list_medusa_batches(limit: int = 20):
    """List all Medusa batch analyses"""
    batches = await db.medusa_batches.find({}, {"_id": 0, "results": 0}).sort("created_at", -1).to_list(length=limit)
    return batches

# ============= MEDUSA SIMPLIFIED ENDPOINTS =============

class MedusaSimpleRequest(BaseModel):
    platform: str
    channel_name: str
    date_from: str
    date_to: str

@api_router.post("/medusa/preview")
async def medusa_preview(request: MedusaSimpleRequest):
    """Preview videos in date range before analysis"""
    try:
        from_date = datetime.fromisoformat(request.date_from)
        to_date = datetime.fromisoformat(request.date_to + "T23:59:59")
        
        if request.platform == "youtube":
            youtube = get_youtube_service()
            
            # Search for channel
            channel_id = request.channel_name
            if not channel_id.startswith("UC"):
                search_response = youtube.search().list(
                    part="snippet",
                    q=request.channel_name,
                    type="channel",
                    maxResults=1
                ).execute()
                
                if not search_response.get("items"):
                    raise HTTPException(status_code=404, detail=f"Canal '{request.channel_name}' no encontrado")
                
                channel_id = search_response["items"][0]["snippet"]["channelId"]
            
            # Get channel info
            channel_response = youtube.channels().list(
                part="contentDetails,snippet,statistics",
                id=channel_id
            ).execute()
            
            if not channel_response.get("items"):
                raise HTTPException(status_code=404, detail="Canal no encontrado")
            
            channel_data = channel_response["items"][0]
            uploads_playlist_id = channel_data["contentDetails"]["relatedPlaylists"]["uploads"]
            
            # Fetch videos and filter by date
            videos = []
            next_page_token = None
            total_comments = 0
            
            while len(videos) < 200:
                playlist_response = youtube.playlistItems().list(
                    part="snippet,contentDetails",
                    playlistId=uploads_playlist_id,
                    maxResults=50,
                    pageToken=next_page_token
                ).execute()
                
                for item in playlist_response.get("items", []):
                    published_at = datetime.fromisoformat(item["snippet"]["publishedAt"].replace("Z", "+00:00")).replace(tzinfo=None)
                    
                    if from_date <= published_at <= to_date:
                        videos.append({
                            "video_id": item["contentDetails"]["videoId"],
                            "title": item["snippet"].get("title", ""),
                            "published_at": item["snippet"]["publishedAt"]
                        })
                
                next_page_token = playlist_response.get("nextPageToken")
                if not next_page_token:
                    break
            
            # Estimate comments (rough estimate)
            estimated_comments = len(videos) * 150  # Average estimate
            
            return {
                "platform": "youtube",
                "channel_id": channel_id,
                "channel_name": channel_data["snippet"]["title"],
                "thumbnail": channel_data["snippet"]["thumbnails"]["default"]["url"],
                "subscribers": int(channel_data["statistics"].get("subscriberCount", 0)),
                "video_count": len(videos),
                "videos": videos,
                "estimated_comments": estimated_comments
            }
            
        elif request.platform == "tiktok":
            rapidapi_key = os.environ.get('RAPIDAPI_KEY')
            if not rapidapi_key:
                raise HTTPException(status_code=500, detail="RapidAPI key not configured")
            
            headers = {
                "X-RapidAPI-Key": rapidapi_key,
                "X-RapidAPI-Host": "tiktok-scraper7.p.rapidapi.com"
            }
            
            videos = []
            cursor = 0
            user_data = {}
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Get user info
                user_response = await client.get(
                    "https://tiktok-scraper7.p.rapidapi.com/user/info",
                    headers=headers,
                    params={"unique_id": request.channel_name}
                )
                
                if user_response.status_code == 200:
                    user_json = user_response.json()
                    if user_json.get("code") == 0:
                        user_data = user_json.get("data", {}).get("user", {})
                
                # Fetch videos
                while len(videos) < 200:
                    response = await client.get(
                        "https://tiktok-scraper7.p.rapidapi.com/user/posts",
                        headers=headers,
                        params={"unique_id": request.channel_name, "count": 30, "cursor": cursor}
                    )
                    
                    if response.status_code != 200:
                        break
                    
                    data = response.json()
                    if data.get("code") != 0:
                        break
                    
                    video_list = data.get("data", {}).get("videos", [])
                    if not video_list:
                        break
                    
                    for video in video_list:
                        create_time = video.get("create_time", 0)
                        if create_time:
                            video_date = datetime.fromtimestamp(create_time)
                            if from_date <= video_date <= to_date:
                                videos.append({
                                    "video_id": str(video.get("id", "")),
                                    "title": video.get("title") or video.get("desc") or "",
                                    "published_at": video_date.isoformat(),
                                    "comment_count": video.get("comment_count", 0)
                                })
                    
                    if not data.get("data", {}).get("hasMore"):
                        break
                    new_cursor = data.get("data", {}).get("cursor")
                    cursor = int(new_cursor) if new_cursor else cursor + 30
            
            estimated_comments = sum(v.get("comment_count", 50) for v in videos)
            
            return {
                "platform": "tiktok",
                "channel_id": request.channel_name,
                "channel_name": user_data.get("nickname", request.channel_name),
                "thumbnail": user_data.get("avatar_thumb", ""),
                "followers": user_data.get("follower_count", 0),
                "video_count": len(videos),
                "videos": videos,
                "estimated_comments": estimated_comments
            }
        else:
            raise HTTPException(status_code=400, detail="Plataforma no soportada")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in Medusa preview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/medusa/analyze")
async def medusa_analyze(request: MedusaSimpleRequest, background_tasks: BackgroundTasks):
    """Start simplified Medusa analysis"""
    try:
        analysis_id = str(uuid.uuid4())
        
        # First get the preview to have the video list
        preview = await medusa_preview(request)
        
        analysis_data = {
            "id": analysis_id,
            "platform": request.platform,
            "channel_name": preview["channel_name"],
            "channel_id": preview["channel_id"],
            "date_from": request.date_from,
            "date_to": request.date_to,
            "video_count": preview["video_count"],
            "videos": preview["videos"],
            "status": "processing",
            "progress": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.medusa_batches.insert_one(analysis_data)
        
        # Start background analysis
        background_tasks.add_task(process_medusa_simple, analysis_id, request.platform, preview)
        
        return {"analysis_id": analysis_id, "status": "processing"}
        
    except Exception as e:
        logger.error(f"Error starting Medusa analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_medusa_simple(analysis_id: str, platform: str, preview: dict):
    """Process simplified Medusa analysis"""
    try:
        videos = preview.get("videos", [])
        total_videos = len(videos)
        
        all_comments = []
        video_results = []
        
        for i, video in enumerate(videos[:50]):  # Limit to 50 videos
            try:
                video_id = video.get("video_id")
                if not video_id:
                    continue
                    
                comments = []
                
                if platform == "youtube":
                    youtube = get_youtube_service()
                    comments = await fetch_comments(youtube, video_id, max_results=100)
                elif platform == "tiktok":
                    video_url = f"https://www.tiktok.com/@{preview['channel_id']}/video/{video_id}"
                    try:
                        comments = await get_tiktok_comments(video_url, max_results=100)
                    except Exception as tk_err:
                        logger.warning(f"Could not get TikTok comments for {video_id}: {tk_err}")
                        continue
                
                if comments:
                    # Analyze with AI
                    ai_analysis = await analyze_comments_with_ai(comments)
                    ai_comments = ai_analysis.get("comments", [])
                    
                    # Calculate video stats
                    video_total = len(ai_comments)
                    video_hate = sum(1 for c in ai_comments if c.get("is_hate") or c.get("hate_score", 0) >= 0.5)
                    video_positive = sum(1 for c in ai_comments if c.get("sentiment_label") == "positive")
                    video_negative = sum(1 for c in ai_comments if c.get("sentiment_label") == "negative")
                    
                    hate_pct = round(video_hate / video_total * 100, 1) if video_total > 0 else 0
                    positive_pct = round(video_positive / video_total * 100, 1) if video_total > 0 else 0
                    
                    video_results.append({
                        "video_id": video_id,
                        "title": video.get("title", ""),
                        "comments": video_total,
                        "hate_percentage": hate_pct,
                        "positive_percentage": positive_pct
                    })
                    
                    # Add to all comments for aggregation
                    all_comments.extend(ai_comments)
                    
                    # Also store word rankings per video for aggregation
                    if "word_rankings" in ai_analysis:
                        for word in ai_analysis["word_rankings"]:
                            word["video_id"] = video_id
                
            except Exception as e:
                logger.error(f"Error analyzing video {video_id}: {e}")
            
            # Update progress
            progress = round((i + 1) / min(total_videos, 50) * 100)
            await db.medusa_batches.update_one(
                {"id": analysis_id},
                {"$set": {"progress": progress}}
            )
        
        # Calculate aggregated stats
        total_comments = len(all_comments)
        total_hate = sum(1 for c in all_comments if c.get("is_hate") or c.get("hate_score", 0) >= 0.5)
        total_positive = sum(1 for c in all_comments if c.get("sentiment_label") == "positive")
        total_negative = sum(1 for c in all_comments if c.get("sentiment_label") == "negative")
        total_neutral = total_comments - total_positive - total_negative
        
        hate_percentage = round(total_hate / total_comments * 100, 1) if total_comments > 0 else 0
        positive_percentage = round(total_positive / total_comments * 100, 1) if total_comments > 0 else 0
        negative_percentage = round(total_negative / total_comments * 100, 1) if total_comments > 0 else 0
        neutral_percentage = round(total_neutral / total_comments * 100, 1) if total_comments > 0 else 0
        
        # Aggregate word frequencies
        word_counts = {}
        for comment in all_comments:
            # Simple word extraction from comments
            pass
        
        # Sort videos by hate percentage
        top_hate_videos = sorted(video_results, key=lambda x: x.get("hate_percentage", 0), reverse=True)
        low_hate_videos = sorted(video_results, key=lambda x: x.get("hate_percentage", 0))
        
        # Get word rankings and topics from last AI analysis (or aggregate)
        # For now, do a final aggregated analysis
        all_texts = [{"text": c.get("text", "")} for c in all_comments if c.get("text")]
        word_rankings = []
        trending_topics = []
        
        if all_texts:
            # Simple word frequency
            from collections import Counter
            words = []
            for item in all_texts:
                text = item.get("text", "").lower()
                for word in text.split():
                    if len(word) > 3 and word.isalpha():
                        words.append(word)
            
            word_freq = Counter(words).most_common(30)
            word_rankings = [{"word": w, "count": c} for w, c in word_freq]
            
            # Extract topics (simplified)
            trending_topics = list(set([w for w, c in word_freq[:10] if c > 5]))
        
        # Final update
        final_data = {
            "status": "completed",
            "progress": 100,
            "total_videos": len(video_results),
            "total_comments": total_comments,
            "hate_percentage": hate_percentage,
            "positive_percentage": positive_percentage,
            "negative_percentage": negative_percentage,
            "neutral_percentage": neutral_percentage,
            "word_rankings": word_rankings,
            "trending_topics": trending_topics,
            "top_hate_videos": top_hate_videos[:10],
            "low_hate_videos": low_hate_videos[:10],
            "video_results": video_results,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.medusa_batches.update_one(
            {"id": analysis_id},
            {"$set": final_data}
        )
        
        logger.info(f"Medusa analysis {analysis_id} completed: {len(video_results)} videos, {total_comments} comments")
        
    except Exception as e:
        logger.error(f"Error in Medusa analysis {analysis_id}: {e}")
        await db.medusa_batches.update_one(
            {"id": analysis_id},
            {"$set": {"status": "error", "error": str(e)}}
        )

@api_router.get("/medusa/analysis/{analysis_id}")
async def get_medusa_analysis(analysis_id: str):
    """Get Medusa analysis status and results"""
    analysis = await db.medusa_batches.find_one({"id": analysis_id}, {"_id": 0})
    if not analysis:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    return analysis

@api_router.post("/reports")
async def create_report(report: CommentReport):
    """Create a new comment report"""
    report_data = {
        "id": str(uuid.uuid4()),
        "comment_id": report.comment_id,
        "comment_text": report.comment_text,
        "comment_author": report.comment_author,
        "video_id": report.video_id,
        "video_title": report.video_title,
        "current_sentiment": report.current_sentiment,
        "current_is_hate": report.current_is_hate,
        "hate_score": report.hate_score,
        "status": "pending",  # pending, approved, corrected
        "corrected_sentiment": None,
        "corrected_is_hate": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": None
    }
    await db.reports.insert_one(report_data)
    return {"id": report_data["id"], "message": "Reporte creado correctamente"}

@api_router.get("/admin/reports")
async def get_reports(status: Optional[str] = None):
    """Get all comment reports"""
    query = {}
    if status:
        query["status"] = status
    
    cursor = db.reports.find(query, {"_id": 0}).sort("created_at", -1)
    reports = await cursor.to_list(length=100)
    return reports

@api_router.put("/admin/reports/{report_id}")
async def resolve_report(report_id: str, resolution: ReportResolution):
    """Resolve a comment report"""
    update_data = {
        "status": resolution.status,
        "resolved_at": datetime.now(timezone.utc).isoformat()
    }
    
    if resolution.status == "corrected":
        update_data["corrected_sentiment"] = resolution.corrected_sentiment
        update_data["corrected_is_hate"] = resolution.corrected_is_hate
    
    result = await db.reports.update_one(
        {"id": report_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    
    return {"message": "Reporte actualizado correctamente"}

@api_router.delete("/admin/reports/{report_id}")
async def delete_report(report_id: str):
    """Delete a comment report"""
    result = await db.reports.delete_one({"id": report_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return {"message": "Reporte eliminado"}

@api_router.get("/admin/search-channels")
async def search_youtube_channels(query: str, max_results: int = 10):
    """Search YouTube channels by query"""
    key = os.environ.get('YOUTUBE_API_KEY')
    if not key:
        raise HTTPException(status_code=500, detail="YouTube API key not configured")
    
    try:
        youtube = build('youtube', 'v3', developerKey=key)
        
        # Search for channels
        search_response = youtube.search().list(
            q=query,
            part="snippet",
            type="channel",
            maxResults=max_results,
            order="relevance"
        ).execute()
        
        channels = []
        for item in search_response.get("items", []):
            channel_id = item["snippet"]["channelId"]
            
            # Get channel stats
            channel_response = youtube.channels().list(
                part="statistics,snippet",
                id=channel_id
            ).execute()
            
            if channel_response.get("items"):
                channel_data = channel_response["items"][0]
                stats = channel_data.get("statistics", {})
                snippet = channel_data.get("snippet", {})
                
                channels.append({
                    "channel_id": channel_id,
                    "channel_name": snippet.get("title", ""),
                    "description": snippet.get("description", "")[:200],
                    "thumbnail_url": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
                    "subscriber_count": int(stats.get("subscriberCount", 0)),
                    "video_count": int(stats.get("videoCount", 0)),
                    "view_count": int(stats.get("viewCount", 0))
                })
        
        # Sort by subscribers
        channels.sort(key=lambda x: x["subscriber_count"], reverse=True)
        
        return {"query": query, "channels": channels}
    
    except HttpError as e:
        raise HTTPException(status_code=500, detail=f"YouTube API error: {str(e)}")

@api_router.post("/admin/track-channel")
async def track_channel(channel: TrackedChannel):
    """Add a channel to tracking list"""
    existing = await db.tracked_channels.find_one({"channel_id": channel.channel_id})
    if existing:
        raise HTTPException(status_code=400, detail="Canal ya está siendo seguido")
    
    channel_data = {
        "id": str(uuid.uuid4()),
        "channel_id": channel.channel_id,
        "channel_name": channel.channel_name,
        "thumbnail_url": channel.thumbnail_url,
        "category": channel.category,
        "auto_analyze": channel.auto_analyze,
        "delay_hours": channel.delay_hours,
        "last_video_id": None,
        "last_check": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tracked_channels.insert_one(channel_data)
    del channel_data["_id"]
    
    return {"success": True, "channel": channel_data}

@api_router.get("/admin/tracked-channels")
async def get_tracked_channels():
    """Get all tracked channels"""
    cursor = db.tracked_channels.find({}, {"_id": 0})
    channels = await cursor.to_list(length=100)
    return {"channels": channels}

@api_router.delete("/admin/tracked-channel/{channel_id}")
async def untrack_channel(channel_id: str):
    """Remove a channel from tracking"""
    result = await db.tracked_channels.delete_one({"channel_id": channel_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Canal no encontrado")
    return {"success": True}

@api_router.get("/admin/scheduled-analyses")
async def get_scheduled_analyses():
    """Get all scheduled analyses"""
    cursor = db.scheduled_analyses.find({}, {"_id": 0}).sort("scheduled_for", 1)
    analyses = await cursor.to_list(length=100)
    return {"analyses": analyses}

@api_router.post("/admin/check-new-videos")
async def check_new_videos_endpoint(background_tasks: BackgroundTasks):
    """Manually trigger check for new videos"""
    background_tasks.add_task(check_new_videos)
    return {"success": True, "message": "Verificación de nuevos videos iniciada"}

@api_router.post("/admin/run-scheduled")
async def run_scheduled_endpoint(background_tasks: BackgroundTasks):
    """Manually trigger scheduled analyses"""
    background_tasks.add_task(run_scheduled_analyses)
    return {"success": True, "message": "Análisis programados iniciados"}

async def check_new_videos():
    """Check all tracked channels for new videos"""
    logger.info("Checking for new videos on tracked channels...")
    
    key = os.environ.get('YOUTUBE_API_KEY')
    if not key:
        logger.error("YouTube API key not configured")
        return
    
    youtube = build('youtube', 'v3', developerKey=key)
    
    cursor = db.tracked_channels.find({"auto_analyze": True}, {"_id": 0})
    channels = await cursor.to_list(length=100)
    
    for channel in channels:
        try:
            # Get channel's uploads playlist
            channel_response = youtube.channels().list(
                part="contentDetails",
                id=channel["channel_id"]
            ).execute()
            
            if not channel_response.get("items"):
                continue
            
            uploads_playlist = channel_response["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
            
            # Get latest videos
            playlist_response = youtube.playlistItems().list(
                part="snippet",
                playlistId=uploads_playlist,
                maxResults=5
            ).execute()
            
            for item in playlist_response.get("items", []):
                video_id = item["snippet"]["resourceId"]["videoId"]
                video_title = item["snippet"]["title"]
                published_at = item["snippet"]["publishedAt"]
                
                # Check if we already scheduled this video
                existing = await db.scheduled_analyses.find_one({"video_id": video_id})
                if existing:
                    continue
                
                # Check if video was published recently (within last 48 hours)
                published_date = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
                now = datetime.now(timezone.utc)
                
                if (now - published_date).total_seconds() < 48 * 3600:
                    # Schedule analysis
                    scheduled_for = published_date + timedelta(hours=channel.get("delay_hours", 24))
                    
                    schedule_data = {
                        "id": str(uuid.uuid4()),
                        "video_id": video_id,
                        "video_title": video_title,
                        "video_url": f"https://www.youtube.com/watch?v={video_id}",
                        "channel_id": channel["channel_id"],
                        "channel_name": channel["channel_name"],
                        "category": channel.get("category", "general"),
                        "scheduled_for": scheduled_for.isoformat(),
                        "status": "pending",
                        "created_at": now.isoformat()
                    }
                    
                    await db.scheduled_analyses.insert_one(schedule_data)
                    logger.info(f"Scheduled analysis for video: {video_title} at {scheduled_for}")
            
            # Update last check
            await db.tracked_channels.update_one(
                {"channel_id": channel["channel_id"]},
                {"$set": {"last_check": datetime.now(timezone.utc).isoformat()}}
            )
            
        except Exception as e:
            logger.error(f"Error checking channel {channel['channel_name']}: {e}")

async def run_scheduled_analyses():
    """Run analyses that are due"""
    logger.info("Running scheduled analyses...")
    
    now = datetime.now(timezone.utc)
    
    cursor = db.scheduled_analyses.find({
        "status": "pending",
        "scheduled_for": {"$lte": now.isoformat()}
    }, {"_id": 0})
    
    pending = await cursor.to_list(length=20)
    
    for item in pending:
        try:
            logger.info(f"Running scheduled analysis for: {item['video_title']}")
            
            # Update status to processing
            await db.scheduled_analyses.update_one(
                {"id": item["id"]},
                {"$set": {"status": "processing"}}
            )
            
            # Run the analysis
            video_url = item["video_url"]
            
            # Extract video_id from URL
            video_id = None
            if "v=" in video_url:
                video_id = video_url.split("v=")[1].split("&")[0]
            elif "youtu.be/" in video_url:
                video_id = video_url.split("youtu.be/")[1].split("?")[0]
            
            if not video_id:
                raise ValueError("Invalid video URL")
            
            # Create analysis entry with all required fields
            analysis_id = str(uuid.uuid4())
            initial_data = {
                "id": analysis_id,
                "video_id": video_id,
                "video_title": item["video_title"],
                "video_url": video_url,
                "channel_name": item.get("channel_name", ""),
                "thumbnail_url": "",
                "view_count": 0,
                "like_count": 0,
                "comment_count": 0,
                "total_comments_analyzed": 0,
                "hate_percentage": 0,
                "positive_percentage": 0,
                "negative_percentage": 0,
                "neutral_percentage": 0,
                "average_sentiment": 0,
                "word_rankings": [],
                "trending_topics": [],
                "comments": [],
                "category": item.get("category", "general"),
                "scheduled": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "processing"
            }
            await db.analyses.insert_one(initial_data)
            
            # Run analysis (not awaiting - runs in background)
            asyncio.create_task(run_full_analysis(analysis_id, video_id))
            
            # Update scheduled status
            await db.scheduled_analyses.update_one(
                {"id": item["id"]},
                {"$set": {"status": "completed", "analysis_id": analysis_id}}
            )
            
            logger.info(f"Completed scheduled analysis: {item['video_title']}")
            
        except Exception as e:
            logger.error(f"Error running scheduled analysis: {e}")
            await db.scheduled_analyses.update_one(
                {"id": item["id"]},
                {"$set": {"status": "failed", "error": str(e)}}
            )

# Background task runner (runs every hour)
async def background_scheduler():
    """Background task that runs periodically"""
    while True:
        try:
            await asyncio.sleep(3600)  # Every hour
            await check_new_videos()
            await run_scheduled_analyses()
        except Exception as e:
            logger.error(f"Background scheduler error: {e}")

@app.on_event("startup")
async def startup_event():
    """Start background scheduler on app startup"""
    asyncio.create_task(background_scheduler())
    logger.info("Background scheduler started")

# ============= INSTAGRAM SERVICE (RapidAPI - Instagram Social) =============

class InstagramAnalyzeRequest(BaseModel):
    instagram_url: str  # Can be post URL or username

class InstagramPostInfo(BaseModel):
    post_id: str
    shortcode: str
    caption: str
    like_count: int
    comment_count: int
    media_url: str
    owner_username: str
    timestamp: str

def get_rapidapi_headers_instagram_social():
    """Get RapidAPI headers for Instagram Social API"""
    rapidapi_key = os.environ.get('RAPIDAPI_KEY')
    if not rapidapi_key:
        raise HTTPException(status_code=500, detail="RAPIDAPI_KEY not configured")
    return {
        "x-rapidapi-key": rapidapi_key,
        "x-rapidapi-host": "instagram-social.p.rapidapi.com"
    }

def extract_instagram_shortcode(url: str) -> str:
    """Extract Instagram post shortcode from URL"""
    patterns = [
        r'instagram\.com/p/([A-Za-z0-9_-]+)',
        r'instagram\.com/reel/([A-Za-z0-9_-]+)',
        r'instagram\.com/tv/([A-Za-z0-9_-]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError("Invalid Instagram URL. Please provide a valid post, reel, or IGTV URL.")

def extract_instagram_username(url: str) -> Optional[str]:
    """Extract Instagram username from profile URL"""
    pattern = r'instagram\.com/([A-Za-z0-9_.]+)/?$'
    match = re.search(pattern, url)
    if match:
        username = match.group(1)
        if username not in ['p', 'reel', 'tv', 'stories', 'explore']:
            return username
    return None

async def fetch_instagram_post_info(shortcode: str) -> Dict[str, Any]:
    """Fetch Instagram post info using Instagram Social API"""
    headers = get_rapidapi_headers_instagram_social()
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://instagram-social.p.rapidapi.com/api/v1/instagram/info",
                params={"code": shortcode},
                headers=headers,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            
            body = data.get("body", {})
            if not body:
                raise HTTPException(status_code=404, detail="Post not found")
            
            user = body.get("user", {})
            caption = body.get("caption", "")
            
            return {
                "post_id": body.get("id", ""),
                "shortcode": body.get("shortcode", shortcode),
                "caption": caption[:500] if caption else "",
                "like_count": body.get("like_count", 0),
                "comment_count": body.get("comment_count", 0),
                "media_url": body.get("thumbnail_url", "") or body.get("media_url", ""),
                "owner_username": user.get("username", ""),
                "owner_full_name": user.get("full_name", ""),
                "owner_profile_pic": user.get("profile_pic_url", ""),
                "timestamp": body.get("taken_at", ""),
                "permalink": body.get("permalink", f"https://instagram.com/p/{shortcode}/")
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"Instagram API error: {e}")
            raise HTTPException(status_code=e.response.status_code, detail=f"Instagram API error: {str(e)}")
        except Exception as e:
            logger.error(f"Error fetching Instagram post: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch post: {str(e)}")

async def fetch_instagram_comments(shortcode: str, max_comments: int = 200) -> List[Dict]:
    """Fetch Instagram comments using Instagram Social API"""
    headers = get_rapidapi_headers_instagram_social()
    comments = []
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://instagram-social.p.rapidapi.com/api/v1/instagram/comments",
                params={"code": shortcode},
                headers=headers,
                timeout=60.0
            )
            response.raise_for_status()
            data = response.json()
            
            # Handle Instagram Social API response format
            body = data.get("body", [])
            comments_list = body if isinstance(body, list) else []
            
            # Check if comments are empty (plan limitation)
            if not comments_list:
                logger.warning(f"No comments returned for {shortcode} - may be a plan limitation")
                return []
            
            for item in comments_list[:max_comments]:
                if isinstance(item, dict):
                    user = item.get("user", {})
                    comments.append({
                        "id": item.get("id", str(uuid.uuid4())),
                        "author": user.get("username", "Anonymous") if isinstance(user, dict) else "Anonymous",
                        "text": item.get("text", ""),
                        "likes": item.get("like_count", 0),
                        "published_at": item.get("created_at", "")
                    })
            
            logger.info(f"Fetched {len(comments)} Instagram comments for {shortcode}")
            return comments
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Instagram comments API error: {e}")
            # Return empty list instead of raising error for plan limitations
            return []
        except Exception as e:
            logger.error(f"Error fetching Instagram comments: {e}")
            return []

async def fetch_instagram_user_info(username: str) -> Dict[str, Any]:
    """Fetch Instagram user info using Instagram Social API"""
    headers = get_rapidapi_headers_instagram_social()
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://instagram-social.p.rapidapi.com/api/v1/instagram/profile",
                params={"username": username},
                headers=headers,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            
            body = data.get("body", {})
            return {
                "user_id": body.get("id", ""),
                "username": body.get("username", username),
                "full_name": body.get("full_name", ""),
                "biography": body.get("biography", ""),
                "profile_pic_url": body.get("profile_pic_url_hd", "") or body.get("profile_pic_url", ""),
                "follower_count": body.get("follower_count", 0),
                "following_count": body.get("following_count", 0),
                "post_count": body.get("media_count", 0),
                "is_verified": body.get("is_verified", False)
            }
        except Exception as e:
            logger.error(f"Error fetching Instagram user: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch user: {str(e)}")

async def fetch_instagram_user_posts(username: str, max_posts: int = 12) -> List[Dict]:
    """Fetch Instagram user's recent posts using Instagram Social API"""
    headers = get_rapidapi_headers_instagram_social()
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://instagram-social.p.rapidapi.com/api/v1/instagram/posts",
                params={"username": username},
                headers=headers,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            
            posts = []
            body = data.get("body", [])
            posts_list = body if isinstance(body, list) else []
            
            for item in posts_list[:max_posts]:
                if isinstance(item, dict):
                    posts.append({
                        "shortcode": item.get("shortcode", ""),
                        "caption": (item.get("caption", "") or "")[:100],
                        "like_count": item.get("like_count", 0),
                        "comment_count": item.get("comment_count", 0),
                        "media_url": item.get("thumbnail_url", "") or item.get("media_url", ""),
                        "timestamp": item.get("taken_at", ""),
                        "permalink": item.get("permalink", "")
                    })
            
            return posts
        except Exception as e:
            logger.error(f"Error fetching user posts: {e}")
            return []



# ============================================
# TikTok Analysis Functions
# ============================================

class TikTokAnalyzeRequest(BaseModel):
    url: str = Field(..., description="TikTok video URL")

def extract_tiktok_video_id(url: str) -> Optional[str]:
    """
    Extract TikTok video ID from various URL formats:
    - https://www.tiktok.com/@username/video/1234567890
    - https://vm.tiktok.com/ZMabcdefg/
    - https://m.tiktok.com/v/1234567890.html
    """
    patterns = [
        r'tiktok\.com/@[\w\.-]+/video/(\d+)',
        r'tiktok\.com/v/(\d+)',
        r'vm\.tiktok\.com/([\w]+)',
        r'm\.tiktok\.com/v/(\d+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None

async def get_tiktok_video_info(video_url: str) -> Dict[str, Any]:
    """
    Fetch TikTok video information using RapidAPI TikTok Scraper7
    """
    rapidapi_key = os.environ.get('RAPIDAPI_KEY')
    if not rapidapi_key:
        raise HTTPException(status_code=500, detail="RapidAPI key not configured")
    
    headers = {
        "X-RapidAPI-Key": rapidapi_key,
        "X-RapidAPI-Host": "tiktok-scraper7.p.rapidapi.com"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # TikTok Scraper7 root endpoint for video info
            response = await client.get(
                "https://tiktok-scraper7.p.rapidapi.com/",
                headers=headers,
                params={"url": video_url}
            )
            
            if response.status_code != 200:
                logger.error(f"TikTok Scraper7 error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to fetch TikTok video info: {response.text}"
                )
            
            data = response.json()
            
            # TikTok Scraper7 returns data directly in the response
            if not data or data.get('code') != 0:
                error_msg = data.get('msg', 'Video not found or is private')
                raise HTTPException(status_code=404, detail=error_msg)
            
            video_data = data.get('data', {})
            author_data = video_data.get('author', {})
            
            # Stats are directly in video_data, NOT in a nested 'statistics' object
            return {
                "video_id": video_data.get('id', ''),
                "title": video_data.get('title', video_data.get('desc', 'TikTok Video')),
                "description": video_data.get('title', ''),
                "author": author_data.get('unique_id', ''),
                "author_name": author_data.get('nickname', ''),
                "thumbnail_url": video_data.get('cover', ''),
                "views": video_data.get('play_count', 0),
                "likes": video_data.get('digg_count', 0),
                "shares": video_data.get('share_count', 0),
                "comment_count": video_data.get('comment_count', 0),
                "created_at": video_data.get('create_time', 0),
                "duration": video_data.get('duration', 0)
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="TikTok API request timed out")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching TikTok video info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch video info: {str(e)}")

async def get_tiktok_comments(video_url: str, max_results: int = 200) -> List[Dict[str, Any]]:
    """
    Fetch comments from a TikTok video using RapidAPI TikTok Scraper7
    Uses the /comment/list endpoint which requires video URL
    """
    rapidapi_key = os.environ.get('RAPIDAPI_KEY')
    if not rapidapi_key:
        raise HTTPException(status_code=500, detail="RapidAPI key not configured")
    
    headers = {
        "X-RapidAPI-Key": rapidapi_key,
        "X-RapidAPI-Host": "tiktok-scraper7.p.rapidapi.com"
    }
    
    comments = []
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Use the dedicated /comment/list endpoint
            response = await client.get(
                "https://tiktok-scraper7.p.rapidapi.com/comment/list",
                headers=headers,
                params={"url": video_url, "count": min(max_results, 100)}
            )
            
            if response.status_code != 200:
                logger.error(f"TikTok Scraper7 comments error: {response.status_code} - {response.text}")
                return []
            
            data = response.json()
            
            if data.get('code') != 0:
                logger.warning(f"TikTok Scraper7 comments returned error: {data.get('msg')}")
                return []
            
            # Comments are in data.comments array
            comment_list = data.get('data', {}).get('comments', [])
            
            if not comment_list:
                logger.warning("No comments found for this TikTok video")
                return []
            
            # Process comments - use correct field names from API response
            for comment in comment_list[:max_results]:
                user_data = comment.get('user', {})
                comments.append({
                    "id": comment.get('id', str(comment.get('create_time', ''))),
                    "text": comment.get('text', ''),
                    "author": user_data.get('unique_id', 'Anonymous'),
                    "author_name": user_data.get('nickname', 'Anonymous'),
                    "likes": comment.get('digg_count', 0),
                    "created_at": comment.get('create_time', 0),
                    "reply_count": comment.get('reply_total', 0)
                })
        
        logger.info(f"Fetched {len(comments)} comments from TikTok")
        return comments[:max_results]
        
    except Exception as e:
        logger.error(f"Error fetching TikTok comments: {e}")
        return []

# TikTok Analysis Endpoint
@api_router.post("/tiktok/analyze")
async def analyze_tiktok_video(request: TikTokAnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Analyze a TikTok video for hate speech, sentiment, and engagement metrics
    """
    try:
        video_url = request.url.strip()
        
        # Validate TikTok URL
        if 'tiktok.com' not in video_url:
            raise HTTPException(status_code=400, detail="Invalid TikTok URL")
        
        # Extract video ID
        video_id = extract_tiktok_video_id(video_url)
        if not video_id:
            raise HTTPException(status_code=400, detail="Could not extract video ID from URL")
        
        logger.info(f"Starting TikTok analysis for video: {video_url}")
        
        # Check if already analyzed
        existing = analyses_ref.where('video_url', '==', video_url).limit(1).stream()
        for doc in existing:
            logger.info(f"Video already analyzed: {doc.id}")
            return {"id": doc.id, "status": "already_analyzed", "message": "This video has already been analyzed"}
        
        # Create analysis record
        analysis_id = str(uuid.uuid4())
        analysis_data = {
            "id": analysis_id,
            "platform": "tiktok",
            "video_url": video_url,
            "video_id": video_id,
            "status": "processing",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        analyses_ref.document(analysis_id).set(analysis_data)
        
        # Process in background
        background_tasks.add_task(process_tiktok_analysis, analysis_id, video_url)
        
        return {
            "id": analysis_id,
            "status": "processing",
            "message": "TikTok video analysis started. This may take a few minutes."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in analyze_tiktok_video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_tiktok_analysis(analysis_id: str, video_url: str):
    """
    Background task to process TikTok video analysis
    """
    try:
        logger.info(f"Processing TikTok analysis {analysis_id}")
        
        # 1. Get video information
        video_info = await get_tiktok_video_info(video_url)
        
        # 2. Get comments (up to 200)
        comments = await get_tiktok_comments(video_url, max_results=200)
        
        if not comments:
            analyses_ref.document(analysis_id).update({
                "status": "completed",
                "error": "No comments found or video is private",
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
            return
        
        # 3. Analyze comments with AI (same function as YouTube)
        ai_analysis = await analyze_comments_with_ai(comments)
        
        # 4. Calculate metrics
        total_comments = len(comments)
        
        # Count sentiments - use sentiment_label (from AI) not sentiment
        positive_count = sum(1 for c in ai_analysis.get("comments", []) if c.get("sentiment_label") == "positive")
        negative_count = sum(1 for c in ai_analysis.get("comments", []) if c.get("sentiment_label") == "negative")
        neutral_count = sum(1 for c in ai_analysis.get("comments", []) if c.get("sentiment_label") == "neutral")
        # Count hate: is_hate=True OR hate_score >= 0.5
        hate_count = sum(1 for c in ai_analysis.get("comments", []) if c.get("is_hate", False) or c.get("hate_score", 0) >= 0.5)
        
        # Calculate percentages
        positive_pct = round((positive_count / total_comments * 100) if total_comments > 0 else 0, 1)
        negative_pct = round((negative_count / total_comments * 100) if total_comments > 0 else 0, 1)
        neutral_pct = round((neutral_count / total_comments * 100) if total_comments > 0 else 0, 1)
        hate_pct = round((hate_count / total_comments * 100) if total_comments > 0 else 0, 1)
        
        # Engagement metrics for TikTok
        views = video_info.get("views", 0)
        likes = video_info.get("likes", 0)
        comment_count = video_info.get("comment_count", total_comments)
        
        engagement_metrics = {
            "engagement_rate": round(((likes + comment_count) / views * 100) if views > 0 else 0, 1),
            "like_to_view_ratio": round((likes / views * 100) if views > 0 else 0, 1),
            "comment_to_view_ratio": round((comment_count / views * 100) if views > 0 else 0, 1),
            "avg_comment_length": round(sum(len(c.get("text", "")) for c in comments) / len(comments) if comments else 0, 1),
            "weighted_sentiment": round(sum(c.get("sentiment_score", 0) for c in ai_analysis.get("comments", [])) / len(ai_analysis.get("comments", [])) * 100 if ai_analysis.get("comments") else 0, 1)
        }
        
        # Prepare final analysis data
        # Combine original comments with AI analysis
        analyzed_comments = []
        ai_comments = ai_analysis.get("comments", [])
        
        for i, original_comment in enumerate(comments[:50]):
            # Find matching AI analysis by index
            ai_data = next((c for c in ai_comments if c.get("index") == i), {})
            
            analyzed_comments.append({
                "comment_id": original_comment.get("id", str(i)),
                "author": original_comment.get("author_name", original_comment.get("author", "Anonymous")),
                "text": original_comment.get("text", ""),
                "likes": original_comment.get("likes", 0),
                "published_at": original_comment.get("created_at", ""),
                "sentiment_score": ai_data.get("sentiment_score", 0),
                "hate_score": ai_data.get("hate_score", 0),
                "sentiment_label": ai_data.get("sentiment_label", "neutral"),
                "is_hate": ai_data.get("is_hate", False),
                "emotion": ai_data.get("emotion", "neutral"),
                "is_spam": ai_data.get("is_spam", False)
            })
        
        # Calculate top supporters (most positive comments)
        top_supporters = sorted(
            [c for c in analyzed_comments if c.get("sentiment_label") == "positive"],
            key=lambda x: x.get("sentiment_score", 0),
            reverse=True
        )[:10]
        
        # Calculate top critics (most negative/hate comments)
        top_critics = sorted(
            [c for c in analyzed_comments if c.get("sentiment_label") == "negative" or c.get("is_hate")],
            key=lambda x: x.get("hate_score", 0),
            reverse=True
        )[:10]
        
        # Calculate most active commenters (by author)
        author_counts = {}
        for c in analyzed_comments:
            author = c.get("author", "Anonymous")
            if author not in author_counts:
                author_counts[author] = {"author": author, "comments": 0}
            author_counts[author]["comments"] += 1
        most_active = sorted(author_counts.values(), key=lambda x: x["comments"], reverse=True)[:10]
        
        # Update engagement metrics with most active
        engagement_metrics["most_active_commenters"] = most_active
        
        # Calculate controversial comments (high engagement + negative sentiment)
        controversial_comments = sorted(
            [c for c in analyzed_comments if c.get("hate_score", 0) > 0.3 or c.get("likes", 0) > 10],
            key=lambda x: (x.get("hate_score", 0) * 0.5 + (x.get("likes", 0) / 100) * 0.5),
            reverse=True
        )[:10]
        
        final_data = {
            "video_title": video_info.get("title"),
            "video_url": video_url,
            "video_id": video_info.get("video_id"),
            "platform": "tiktok",
            "thumbnail_url": video_info.get("thumbnail_url"),
            "channel_name": video_info.get("author_name"),
            "channel_id": video_info.get("author"),
            "views": views,
            "likes": likes,
            "shares": video_info.get("shares", 0),
            "comment_count": comment_count,
            "total_comments_analyzed": total_comments,
            "positive_percentage": positive_pct,
            "negative_percentage": negative_pct,
            "neutral_percentage": neutral_pct,
            "hate_percentage": hate_pct,
            "engagement_metrics": engagement_metrics,
            "word_rankings": ai_analysis.get("word_rankings", []),
            "trending_topics": ai_analysis.get("trending_topics", []),
            "emotion_breakdown": ai_analysis.get("emotion_breakdown", {}),
            "content_insights": ai_analysis.get("content_insights", {}),
            "comments": analyzed_comments,
            "top_supporters": top_supporters,
            "top_critics": top_critics,
            "controversial_comments": controversial_comments,
            "status": "completed",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Update Firestore
        analyses_ref.document(analysis_id).update(final_data)
        
        # Create or update channel - with fusion support for multi-platform creators
        tiktok_channel_id = video_info.get("author", "")
        tiktok_channel_name = video_info.get("author_name", tiktok_channel_id)
        
        if tiktok_channel_id:
            # First check if channel exists by TikTok ID
            existing_channel = await db.channels.find_one({"tiktok_channel_id": tiktok_channel_id})
            
            if not existing_channel:
                # Check if there's a channel with similar name (for fusion)
                # Normalize name for comparison (lowercase, remove spaces)
                normalized_name = tiktok_channel_name.lower().strip()
                all_channels = await db.channels.find({}).to_list(length=500)
                
                # Find matching channel by name
                matching_channel = None
                for ch in all_channels:
                    ch_name = ch.get("name", "").lower().strip()
                    if ch_name == normalized_name or normalized_name in ch_name or ch_name in normalized_name:
                        matching_channel = ch
                        break
                
                if matching_channel:
                    # Fusion: Add TikTok to existing channel
                    existing_platforms = matching_channel.get("platforms", [])
                    if not existing_platforms:
                        # Migrate old format to new
                        old_platform = matching_channel.get("platform", "youtube")
                        existing_platforms = [old_platform]
                    
                    if "tiktok" not in existing_platforms:
                        existing_platforms.append("tiktok")
                    
                    # Get TikTok-specific stats
                    tiktok_analyses = await db.analyses.find(
                        {"channel_id": tiktok_channel_id, "status": "completed", "platform": "tiktok"},
                        {"hate_percentage": 1, "positive_percentage": 1, "total_comments_analyzed": 1}
                    ).to_list(length=1000)
                    
                    tiktok_stats = {
                        "videos_analyzed": len(tiktok_analyses) if tiktok_analyses else 1,
                        "avg_hate_percentage": round(sum(a.get("hate_percentage", 0) for a in tiktok_analyses) / len(tiktok_analyses), 1) if tiktok_analyses else hate_pct,
                        "total_comments_analyzed": sum(a.get("total_comments_analyzed", 0) for a in tiktok_analyses) if tiktok_analyses else total_comments
                    }
                    
                    # Calculate combined stats - Firestore doesn't support $or, so query separately
                    youtube_channel_id = matching_channel.get("channel_id")
                    yt_analyses = await db.analyses.find(
                        {"channel_id": youtube_channel_id, "status": "completed"}
                    ).to_list(length=1000)
                    
                    tk_analyses = await db.analyses.find(
                        {"channel_id": tiktok_channel_id, "status": "completed"}
                    ).to_list(length=1000)
                    
                    all_platform_analyses = yt_analyses + tk_analyses
                    
                    combined_videos = len(all_platform_analyses)
                    combined_hate = sum(a.get("hate_percentage", 0) for a in all_platform_analyses) / combined_videos if combined_videos > 0 else 0
                    combined_positive = sum(a.get("positive_percentage", 0) for a in all_platform_analyses) / combined_videos if combined_videos > 0 else 0
                    combined_comments = sum(a.get("total_comments_analyzed", 0) for a in all_platform_analyses)
                    
                    await db.channels.update_one(
                        {"id": matching_channel.get("id")},
                        {"$set": {
                            "platforms": existing_platforms,
                            "tiktok_channel_id": tiktok_channel_id,
                            "tiktok_username": tiktok_channel_id,
                            "tiktok_stats": tiktok_stats,
                            "total_videos_analyzed": combined_videos,
                            "avg_hate_percentage": round(combined_hate, 1),
                            "avg_positive_percentage": round(combined_positive, 1),
                            "total_comments_analyzed": combined_comments,
                            "last_analysis": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    logger.info(f"Fused TikTok channel {tiktok_channel_name} with existing channel {matching_channel.get('name')}")
                    
                    # Update analysis with the merged channel_id for proper linking
                    analyses_ref.document(analysis_id).update({
                        "merged_channel_id": matching_channel.get("id")
                    })
                else:
                    # Create new channel entry for TikTok
                    channel_data = {
                        "id": str(uuid.uuid4()),
                        "channel_id": tiktok_channel_id,
                        "tiktok_channel_id": tiktok_channel_id,
                        "tiktok_username": tiktok_channel_id,
                        "name": tiktok_channel_name,
                        "platforms": ["tiktok"],
                        "thumbnail_url": video_info.get("thumbnail_url", ""),
                        "subscriber_count": 0,
                        "video_count": 0,
                        "total_videos_analyzed": 1,
                        "avg_hate_percentage": hate_pct,
                        "avg_positive_percentage": positive_pct,
                        "total_comments_analyzed": total_comments,
                        "tiktok_stats": {
                            "videos_analyzed": 1,
                            "avg_hate_percentage": hate_pct,
                            "total_comments_analyzed": total_comments
                        },
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "last_analysis": datetime.now(timezone.utc).isoformat()
                    }
                    await db.channels.insert_one(channel_data)
                    logger.info(f"Created new TikTok channel: {tiktok_channel_name}")
            else:
                # Update existing TikTok channel statistics
                tiktok_analyses = await db.analyses.find(
                    {"channel_id": tiktok_channel_id, "status": "completed"},
                    {"hate_percentage": 1, "positive_percentage": 1, "total_comments_analyzed": 1}
                ).to_list(length=1000)
                
                if tiktok_analyses:
                    total_videos_count = len(tiktok_analyses)
                    avg_hate_calc = sum(a.get("hate_percentage", 0) for a in tiktok_analyses) / total_videos_count
                    avg_positive_calc = sum(a.get("positive_percentage", 0) for a in tiktok_analyses) / total_videos_count
                    total_comments_calc = sum(a.get("total_comments_analyzed", 0) for a in tiktok_analyses)
                    
                    tiktok_stats = {
                        "videos_analyzed": total_videos_count,
                        "avg_hate_percentage": round(avg_hate_calc, 1),
                        "total_comments_analyzed": total_comments_calc
                    }
                    
                    # Check if this channel is fused (has youtube too)
                    existing_platforms = existing_channel.get("platforms", ["tiktok"])
                    
                    # Calculate combined stats if multi-platform
                    if "youtube" in existing_platforms:
                        youtube_channel_id = existing_channel.get("channel_id")
                        yt_analyses = await db.analyses.find(
                            {"channel_id": youtube_channel_id, "status": "completed"}
                        ).to_list(length=1000)
                        
                        tk_analyses = await db.analyses.find(
                            {"channel_id": tiktok_channel_id, "status": "completed"}
                        ).to_list(length=1000)
                        
                        all_analyses = yt_analyses + tk_analyses
                        
                        combined_videos = len(all_analyses)
                        combined_hate = sum(a.get("hate_percentage", 0) for a in all_analyses) / combined_videos if combined_videos > 0 else 0
                        combined_positive = sum(a.get("positive_percentage", 0) for a in all_analyses) / combined_videos if combined_videos > 0 else 0
                        combined_comments = sum(a.get("total_comments_analyzed", 0) for a in all_analyses)
                    else:
                        combined_videos = total_videos_count
                        combined_hate = avg_hate_calc
                        combined_positive = avg_positive_calc
                        combined_comments = total_comments_calc
                    
                    await db.channels.update_one(
                        {"tiktok_channel_id": tiktok_channel_id},
                        {"$set": {
                            "platforms": existing_platforms if existing_platforms else ["tiktok"],
                            "tiktok_stats": tiktok_stats,
                            "total_videos_analyzed": combined_videos,
                            "avg_hate_percentage": round(combined_hate, 1),
                            "avg_positive_percentage": round(combined_positive, 1),
                            "total_comments_analyzed": combined_comments,
                            "last_analysis": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    logger.info(f"Updated TikTok channel {tiktok_channel_name} stats: {total_videos_count} videos")
        
        logger.info(f"TikTok analysis {analysis_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Error processing TikTok analysis {analysis_id}: {e}")
        analyses_ref.document(analysis_id).update({
            "status": "failed",
            "error": str(e),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

# Instagram Analysis Endpoints

@api_router.post("/instagram/analyze")
async def analyze_instagram_post(request: InstagramAnalyzeRequest, background_tasks: BackgroundTasks):
    """Start analysis of an Instagram post"""
    url = request.instagram_url.strip()
    
    # Check if it's a username (profile) or a post URL
    username = extract_instagram_username(url)
    if username:
        # Return user info and recent posts
        user_info = await fetch_instagram_user_info(username)
        posts = await fetch_instagram_user_posts(username, max_posts=12)
        return {
            "type": "profile",
            "user": user_info,
            "posts": posts,
            "message": f"Found {len(posts)} recent posts. Select one to analyze comments."
        }
    
    # It's a post URL
    try:
        shortcode = extract_instagram_shortcode(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Check if already analyzed
    existing = await db.analyses.find_one(
        {"video_id": f"ig_{shortcode}", "status": "completed"},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if existing:
        return {
            "type": "analysis",
            "id": existing["id"],
            "status": "completed",
            "message": "Analysis already exists"
        }
    
    # Fetch post info
    post_info = await fetch_instagram_post_info(shortcode)
    
    # Create analysis record
    analysis_id = str(uuid.uuid4())
    initial_data = {
        "id": analysis_id,
        "video_id": f"ig_{shortcode}",
        "video_title": post_info.get("caption", "")[:100] or f"Instagram Post by @{post_info.get('owner_username', 'unknown')}",
        "channel_name": f"@{post_info.get('owner_username', 'unknown')}",
        "channel_id": f"ig_user_{post_info.get('owner_username', '')}",
        "thumbnail_url": post_info.get("media_url", ""),
        "view_count": 0,
        "like_count": post_info.get("like_count", 0),
        "comment_count": post_info.get("comment_count", 0),
        "total_comments_analyzed": 0,
        "hate_percentage": 0,
        "positive_percentage": 0,
        "negative_percentage": 0,
        "neutral_percentage": 0,
        "average_sentiment": 0,
        "word_rankings": [],
        "trending_topics": [],
        "comments": [],
        "platform": "instagram",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "processing"
    }
    
    await db.analyses.insert_one(initial_data)
    
    # Run analysis in background
    background_tasks.add_task(run_instagram_analysis, analysis_id, shortcode, post_info)
    
    return {
        "type": "analysis",
        "id": analysis_id,
        "status": "processing",
        "post_info": post_info,
        "message": "Analysis started"
    }

async def run_instagram_analysis(analysis_id: str, shortcode: str, post_info: Dict):
    """Run full Instagram comment analysis"""
    try:
        # Fetch comments
        comments = await fetch_instagram_comments(shortcode, max_comments=200)
        
        if not comments:
            # No comments available - could be plan limitation or no comments on post
            comment_count = post_info.get("comment_count", 0)
            message = "No comments available"
            if comment_count > 0:
                message = f"Post has {comment_count} comments but access requires Instagram Social PRO plan ($14.95/month)"
            
            await db.analyses.update_one(
                {"id": analysis_id},
                {"$set": {
                    "status": "completed",
                    "total_comments_analyzed": 0,
                    "comments": [],
                    "hate_percentage": 0,
                    "positive_percentage": 0,
                    "negative_percentage": 0,
                    "neutral_percentage": 100,
                    "error_message": message,
                    "plan_limitation": comment_count > 0
                }}
            )
            logger.info(f"Instagram analysis {analysis_id} completed: {message}")
            return
        
        # Analyze with AI
        ai_results = await analyze_comments_with_ai(comments)
        
        # Process results
        analyzed_comments = []
        hate_count = 0
        positive_count = 0
        negative_count = 0
        neutral_count = 0
        total_sentiment = 0
        spam_count = 0
        
        for i, comment in enumerate(comments):
            ai_data = next((c for c in ai_results.get("comments", []) if c.get("index") == i), {})
            
            sentiment_score = ai_data.get("sentiment_score", 0)
            hate_score = ai_data.get("hate_score", 0)
            sentiment_label = ai_data.get("sentiment_label", "neutral")
            is_hate = ai_data.get("is_hate", False)
            is_spam = ai_data.get("is_spam", False)
            
            if is_spam:
                spam_count += 1
            if is_hate or hate_score >= 0.5:
                hate_count += 1
            if sentiment_label == "positive":
                positive_count += 1
            elif sentiment_label == "negative":
                negative_count += 1
            else:
                neutral_count += 1
            
            total_sentiment += sentiment_score
            
            analyzed_comments.append({
                "comment_id": comment["id"],
                "author": comment["author"],
                "text": comment["text"],
                "likes": comment["likes"],
                "published_at": comment["published_at"],
                "sentiment_score": sentiment_score,
                "hate_score": hate_score,
                "sentiment_label": sentiment_label,
                "is_hate": is_hate,
                "is_spam": is_spam,
                "emotion": ai_data.get("emotion", "neutral"),
                "comment_type": ai_data.get("comment_type", "neutral")
            })
        
        total = len(analyzed_comments)
        hate_pct = round((hate_count / total) * 100, 1) if total > 0 else 0
        positive_pct = round((positive_count / total) * 100, 1) if total > 0 else 0
        negative_pct = round((negative_count / total) * 100, 1) if total > 0 else 0
        neutral_pct = round((neutral_count / total) * 100, 1) if total > 0 else 0
        avg_sentiment = round(total_sentiment / total, 2) if total > 0 else 0
        spam_pct = round((spam_count / total) * 100, 1) if total > 0 else 0
        
        # Determine toxicity level
        if hate_pct >= 30:
            toxicity = "severe"
        elif hate_pct >= 20:
            toxicity = "high"
        elif hate_pct >= 10:
            toxicity = "moderate"
        else:
            toxicity = "low"
        
        # Update analysis
        await db.analyses.update_one(
            {"id": analysis_id},
            {"$set": {
                "status": "completed",
                "total_comments_analyzed": total,
                "comments": analyzed_comments,
                "hate_percentage": hate_pct,
                "positive_percentage": positive_pct,
                "negative_percentage": negative_pct,
                "neutral_percentage": neutral_pct,
                "average_sentiment": avg_sentiment,
                "spam_percentage": spam_pct,
                "toxicity_level": toxicity,
                "word_rankings": ai_results.get("word_rankings", []),
                "trending_topics": ai_results.get("trending_topics", []),
                "emotion_breakdown": ai_results.get("emotion_breakdown", {}),
                "content_insights": ai_results.get("content_insights", {})
            }}
        )
        
        logger.info(f"Instagram analysis {analysis_id} completed: {total} comments, {hate_pct}% hate")
        
    except Exception as e:
        logger.error(f"Instagram analysis error: {e}")
        await db.analyses.update_one(
            {"id": analysis_id},
            {"$set": {"status": "error", "error": str(e)}}
        )

@api_router.get("/instagram/user/{username}")
async def get_instagram_user(username: str):
    """Get Instagram user profile info"""
    user_info = await fetch_instagram_user_info(username)
    posts = await fetch_instagram_user_posts(username, max_posts=12)
    return {
        "user": user_info,
        "posts": posts
    }

@api_router.get("/instagram/post/{shortcode}")
async def get_instagram_post(shortcode: str):
    """Get Instagram post info"""
    post_info = await fetch_instagram_post_info(shortcode)
    return post_info


# ============== VIDEO VOICE GENERATION (Edge TTS) ==============

import edge_tts
from fastapi.responses import FileResponse
import tempfile

def generate_sensationalist_script(data: dict) -> str:
    """Generate a sensationalist script based on analysis data"""
    
    video_title = data.get('video_title', 'este video')[:50]
    channel_name = data.get('channel_name', 'este canal')
    hate_pct = round(data.get('hate_percentage', 0))
    positive_pct = round(data.get('positive_percentage', 0))
    negative_pct = round(data.get('negative_percentage', 0))
    total_comments = data.get('total_comments_analyzed', 0)
    view_count = data.get('view_count', 0)
    toxicity = data.get('toxicity_level', 'unknown')
    
    # Emotions
    emotions = data.get('emotion_breakdown', {})
    top_emotion = max(emotions.items(), key=lambda x: x[1])[0] if emotions else None
    emotion_names = {
        'anger': 'ira',
        'disgust': 'asco', 
        'joy': 'alegría',
        'sadness': 'tristeza',
        'surprise': 'sorpresa',
        'fear': 'miedo'
    }
    
    # Word rankings
    words = data.get('word_rankings', [])[:3]
    top_words = ', '.join([w.get('word', '') for w in words]) if words else None
    
    # Topics
    topics = data.get('trending_topics', [])[:2]
    top_topics = ', '.join([t.get('topic', '')[:20] for t in topics]) if topics else None
    
    # Insights
    insights = data.get('content_insights', {})
    complaints = insights.get('complaints_count', 0)
    praise = insights.get('praise_count', 0)
    
    # Build script
    script_parts = []
    
    # Intro - sensationalist hook
    if hate_pct >= 40:
        script_parts.append(f"¡Increíble! El video de {channel_name} tiene un {hate_pct} por ciento de odio puro en los comentarios.")
    elif hate_pct >= 20:
        script_parts.append(f"¡Atención! Casi uno de cada cuatro comentarios en el video de {channel_name} es de odio.")
    else:
        script_parts.append(f"Análisis del video de {channel_name}. Veamos qué dicen los comentarios.")
    
    # Stats
    script_parts.append(f"De {total_comments} comentarios analizados, solo el {positive_pct} por ciento son positivos, mientras que el {negative_pct} por ciento son negativos.")
    
    # Toxicity
    if toxicity == 'severe':
        script_parts.append("El nivel de toxicidad es severo. ¡Cuidado con leer los comentarios!")
    elif toxicity == 'moderate':
        script_parts.append("La toxicidad es moderada, pero hay comentarios bastante fuertes.")
    
    # Emotions
    if top_emotion:
        emotion_es = emotion_names.get(top_emotion, top_emotion)
        script_parts.append(f"La emoción predominante es la {emotion_es}.")
    
    # Top words
    if top_words:
        script_parts.append(f"Las palabras más repetidas son: {top_words}.")
    
    # Topics  
    if top_topics:
        script_parts.append(f"Los temas más comentados son: {top_topics}.")
    
    # Insights
    if complaints > praise:
        script_parts.append(f"Los haters están en modo ataque con {complaints} quejas contra solo {praise} elogios.")
    elif praise > complaints:
        script_parts.append(f"A pesar del hate, hay {praise} elogios en los comentarios.")
    
    # Outro
    script_parts.append("Esto ha sido Social Hate, analizando el odio en las redes sociales.")
    
    return " ".join(script_parts)


class VoiceGenerationRequest(BaseModel):
    analysis_id: str
    voice: str = "es-ES-AlvaroNeural"  # Default: Spanish male voice
    
    
@api_router.post("/generate-voice/{analysis_id}")
async def generate_voice_for_analysis(analysis_id: str, voice: str = "es-ES-AlvaroNeural"):
    """Generate voice narration for a video analysis using Edge TTS (FREE)"""
    
    # Get analysis data
    analysis = await db.analyses.find_one({"id": analysis_id}, {"_id": 0})
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # Generate script
    script = generate_sensationalist_script(analysis)
    
    # Generate audio with Edge TTS
    try:
        # Create temp file for audio
        audio_filename = f"voice_{analysis_id}.mp3"
        audio_path = f"/tmp/{audio_filename}"
        
        # Generate voice
        communicate = edge_tts.Communicate(script, voice)
        await communicate.save(audio_path)
        
        logger.info(f"Voice generated for analysis {analysis_id}: {len(script)} chars")
        
        return {
            "success": True,
            "script": script,
            "audio_url": f"/api/voice-audio/{analysis_id}",
            "voice": voice,
            "duration_estimate": len(script.split()) / 2.5  # Rough estimate: 2.5 words per second
        }
        
    except Exception as e:
        logger.error(f"Voice generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Voice generation failed: {str(e)}")


@api_router.get("/voice-audio/{analysis_id}")
async def get_voice_audio(analysis_id: str):
    """Get the generated voice audio file"""
    audio_path = f"/tmp/voice_{analysis_id}.mp3"
    
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Audio not found. Generate it first.")
    
    return FileResponse(
        audio_path, 
        media_type="audio/mpeg",
        filename=f"socialhate_voice_{analysis_id}.mp3"
    )


@api_router.get("/voice-script/{analysis_id}")
async def get_voice_script(analysis_id: str):
    """Get just the script without generating audio"""
    
    analysis = await db.analyses.find_one({"id": analysis_id}, {"_id": 0})
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    script = generate_sensationalist_script(analysis)
    
    return {
        "script": script,
        "word_count": len(script.split()),
        "duration_estimate": len(script.split()) / 2.5
    }


# ============================================
# REALITY CHECK - Influencer vs Reality
# ============================================

import subprocess
import tempfile
import shutil

class RealityCheckRequest(BaseModel):
    video_url: str
    restaurant_name: str
    restaurant_location: Optional[str] = ""

class RealityCheckResponse(BaseModel):
    id: str
    status: str
    video_title: Optional[str] = None
    channel_name: Optional[str] = None
    restaurant_name: str
    coherence_index: Optional[float] = None
    influencer_sentiment: Optional[Dict] = None
    community_sentiment: Optional[Dict] = None
    analysis_summary: Optional[str] = None
    created_at: str

async def transcribe_with_whisper(video_id: str) -> Optional[str]:
    """Download YouTube audio and transcribe with Whisper (local, free)"""
    temp_dir = None
    try:
        import whisper
        
        # Create temp directory
        temp_dir = tempfile.mkdtemp()
        audio_path = os.path.join(temp_dir, f"{video_id}")
        
        logger.info(f"🎤 Downloading audio for video {video_id}...")
        
        # Find yt-dlp path
        yt_dlp_path = shutil.which("yt-dlp") or "/root/.venv/bin/yt-dlp"
        
        # Download audio with yt-dlp
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        
        # Find node path for JS runtime and ffmpeg
        node_path = shutil.which("node") or "/usr/bin/node"
        ffmpeg_path = shutil.which("ffmpeg") or "/usr/bin/ffmpeg"
        
        cmd = [
            yt_dlp_path,
            "--js-runtimes", f"node:{node_path}",  # Specify node runtime
            "--ffmpeg-location", ffmpeg_path,  # Specify ffmpeg location
            "-x",  # Extract audio
            "--audio-format", "mp3",
            "--audio-quality", "5",  # Medium quality (faster)
            "-o", f"{audio_path}.%(ext)s",
            "--max-filesize", "50M",  # Limit file size
            "--no-playlist",
            video_url
        ]

        # Attach YouTube cookies if available (bypasses cloud-IP blocks)
        cookies_file = ROOT_DIR / 'youtube-cookies.txt'
        if cookies_file.exists():
            cmd = cmd[:1] + ["--cookies", str(cookies_file)] + cmd[1:]
        
        process = await asyncio.to_thread(
            subprocess.run, cmd, capture_output=True, timeout=180
        )
        
        if process.returncode != 0:
            logger.warning(f"yt-dlp failed: {process.stderr.decode()[:200]}")
            return None
        
        # Find the actual file (yt-dlp might add extension)
        actual_file = None
        for f in os.listdir(temp_dir):
            if f.startswith(video_id):
                actual_file = os.path.join(temp_dir, f)
                break
        
        if not actual_file or not os.path.exists(actual_file):
            logger.warning("Audio file not found after download")
            return None
        
        file_size = os.path.getsize(actual_file)
        logger.info(f"🔊 Audio downloaded: {file_size/1024/1024:.1f}MB. Transcribing with Whisper...")
        
        # Load Whisper model (use 'base' for speed, 'small' for better accuracy)
        model = await asyncio.to_thread(whisper.load_model, "tiny")
        
        # Transcribe
        result = await asyncio.to_thread(
            model.transcribe, 
            actual_file, 
            language="es",  # Spanish
            fp16=False  # Use FP32 for CPU compatibility
        )
        
        transcript = result.get("text", "")
        logger.info(f"✅ Transcription complete: {len(transcript)} characters")
        
        return transcript if transcript else None
        
    except ImportError:
        logger.warning("Whisper not installed, falling back to description")
        return None
    except Exception as e:
        logger.error(f"Whisper transcription error: {e}")
        return None
    finally:
        # Cleanup temp directory
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

def _parse_vtt_to_text(vtt_path: str) -> str:
    """Extract plain text from a WebVTT subtitles file, dedupe consecutive lines."""
    try:
        with open(vtt_path, "r", encoding="utf-8", errors="ignore") as f:
            raw = f.read()
    except Exception:
        return ""
    lines_out = []
    last_line = None
    for line in raw.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("WEBVTT") or s.startswith("Kind:") or s.startswith("Language:"):
            continue
        if "-->" in s:
            continue
        if s.isdigit():
            continue
        # Remove inline timing tags like <00:00:00.399><c> text</c>
        s = re.sub(r"<[^>]+>", "", s)
        s = s.strip()
        if not s or s == last_line:
            continue
        lines_out.append(s)
        last_line = s
    return " ".join(lines_out)


def _vtt_ts_to_seconds(ts: str) -> float:
    """Convert WebVTT timestamp HH:MM:SS.mmm to seconds (float)."""
    try:
        ts = ts.strip()
        h, m, rest = "0", "0", ts
        if ts.count(":") == 2:
            h, m, rest = ts.split(":")
        elif ts.count(":") == 1:
            m, rest = ts.split(":")
        s, ms = rest.split(".") if "." in rest else (rest, "0")
        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000
    except Exception:
        return 0.0


def _parse_vtt_with_timestamps(vtt_path: str) -> List[Dict[str, Any]]:
    """Parse a VTT file into a list of {start_s, end_s, text} cues, deduplicated."""
    try:
        with open(vtt_path, "r", encoding="utf-8", errors="ignore") as f:
            raw = f.read()
    except Exception:
        return []

    cues: List[Dict[str, Any]] = []
    lines = raw.splitlines()
    i = 0
    last_text = None
    while i < len(lines):
        line = lines[i].strip()
        if "-->" in line:
            try:
                left, right = line.split("-->")
                start_s = _vtt_ts_to_seconds(left.strip())
                end_s = _vtt_ts_to_seconds(right.strip().split(" ")[0])
            except Exception:
                i += 1
                continue
            i += 1
            text_parts = []
            while i < len(lines) and lines[i].strip():
                t = re.sub(r"<[^>]+>", "", lines[i]).strip()
                if t:
                    text_parts.append(t)
                i += 1
            text = " ".join(text_parts).strip()
            text = re.sub(r"\s+", " ", text)
            if text and text != last_text:
                cues.append({"start_s": start_s, "end_s": end_s, "text": text})
                last_text = text
        else:
            i += 1
    return cues


async def get_subtitles_with_timestamps(video_id: str) -> List[Dict[str, Any]]:
    """Get subtitle cues with timestamps via yt-dlp (returns [] if unavailable)."""
    temp_dir = None
    try:
        temp_dir = tempfile.mkdtemp()
        out_base = os.path.join(temp_dir, video_id)
        yt_dlp_path = shutil.which("yt-dlp") or "/root/.venv/bin/yt-dlp"
        cmd = [
            yt_dlp_path,
            "--write-auto-subs",
            "--write-subs",
            "--skip-download",
            "--sub-langs", "es.*,en.*",
            "--sub-format", "vtt",
            "-o", out_base,
            "--no-playlist",
            "--ignore-no-formats-error",
            "--no-warnings",
            f"https://www.youtube.com/watch?v={video_id}",
        ]
        cookies_file = ROOT_DIR / 'youtube-cookies.txt'
        if cookies_file.exists():
            cmd = cmd[:1] + ["--cookies", str(cookies_file)] + cmd[1:]
        await asyncio.to_thread(subprocess.run, cmd, capture_output=True, timeout=90)
        files = sorted([
            os.path.join(temp_dir, f) for f in os.listdir(temp_dir)
            if f.startswith(video_id) and f.endswith(".vtt")
        ])
        if not files:
            return []
        # prefer Spanish
        def _score(p):
            n = os.path.basename(p).lower()
            return 0 if (".es." in n or "-es" in n) else (1 if ".en." in n else 2)
        files.sort(key=_score)
        return _parse_vtt_with_timestamps(files[0])
    except Exception as e:
        logger.warning(f"timestamps subs failed for {video_id}: {e}")
        return []
    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)


async def get_subtitles_transcript(video_id: str) -> Optional[str]:
    """Get transcript via yt-dlp subtitles (uses cookies to bypass cloud-IP block)."""
    temp_dir = None
    try:
        temp_dir = tempfile.mkdtemp()
        out_base = os.path.join(temp_dir, video_id)
        yt_dlp_path = shutil.which("yt-dlp") or "/root/.venv/bin/yt-dlp"

        cmd = [
            yt_dlp_path,
            "--write-auto-subs",
            "--write-subs",
            "--skip-download",
            "--sub-langs", "es.*,en.*",
            "--sub-format", "vtt",
            "-o", out_base,
            "--no-playlist",
            "--ignore-no-formats-error",
            "--no-warnings",
            f"https://www.youtube.com/watch?v={video_id}",
        ]
        cookies_file = ROOT_DIR / 'youtube-cookies.txt'
        if cookies_file.exists():
            cmd = cmd[:1] + ["--cookies", str(cookies_file)] + cmd[1:]

        process = await asyncio.to_thread(
            subprocess.run, cmd, capture_output=True, timeout=90
        )
        if process.returncode != 0:
            logger.warning(f"yt-dlp subtitles failed for {video_id}: {process.stderr.decode(errors='ignore')[:300]}")
            # Continue: maybe some subs were still written

        # Prefer Spanish, fall back to English
        preferred_order = []
        for fname in sorted(os.listdir(temp_dir)):
            if fname.startswith(video_id) and fname.endswith(".vtt"):
                preferred_order.append(os.path.join(temp_dir, fname))
        if not preferred_order:
            return None

        def score(path):
            name = os.path.basename(path).lower()
            if ".es." in name or name.endswith(".es.vtt"):
                return 0
            if "es-" in name or ".es-" in name:
                return 1
            if ".en." in name or "en-" in name:
                return 2
            return 3
        preferred_order.sort(key=score)

        text = _parse_vtt_to_text(preferred_order[0])
        text = text.strip()
        if len(text) > 100:
            logger.info(f"✅ Got yt-dlp subtitles for {video_id}: {len(text)} chars ({os.path.basename(preferred_order[0])})")
            return text
        return None
    except Exception as e:
        logger.warning(f"yt-dlp subtitles error for {video_id}: {e}")
        return None
    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)


async def get_youtube_transcript(video_id: str) -> Optional[str]:
    """Get transcript: subtitles (fast) -> Whisper (audio download) -> description."""

    # 1) Try subtitles first (fast, no download, works when YouTube blocks audio)
    subs = await get_subtitles_transcript(video_id)
    if subs:
        return f"TRANSCRIPCIÓN DEL AUDIO:\n{subs}"

    # 2) Try Whisper transcription via yt-dlp audio download
    whisper_transcript = await transcribe_with_whisper(video_id)
    if whisper_transcript and len(whisper_transcript) > 100:
        return f"TRANSCRIPCIÓN DEL AUDIO:\n{whisper_transcript}"

    # 3) Fallback to video title + description
    try:
        youtube = get_youtube_service()
        video_response = youtube.videos().list(
            part="snippet",
            id=video_id
        ).execute()
        
        if video_response.get("items"):
            snippet = video_response["items"][0]["snippet"]
            title = snippet.get("title", "")
            description = snippet.get("description", "")[:2000]
            return f"TÍTULO: {title}\n\nDESCRIPCIÓN: {description}"
        
        return None
    except Exception as e:
        logger.error(f"Error getting video info: {e}")
        return None

async def get_google_places_info(restaurant_name: str, location: str = "") -> Optional[Dict[str, Any]]:
    """
    Use Google Places API (New) to get official restaurant info + up to 5 real reviews.
    Requires GOOGLE_PLACES_API_KEY or falls back to YOUTUBE_API_KEY (same Google Cloud project).
    """
    api_key = os.environ.get('GOOGLE_PLACES_API_KEY') or os.environ.get('YOUTUBE_API_KEY')
    if not api_key:
        return None

    query = f"{restaurant_name} {location}".strip()
    field_mask = ",".join([
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.rating",
        "places.userRatingCount",
        "places.priceLevel",
        "places.googleMapsUri",
        "places.websiteUri",
        "places.internationalPhoneNumber",
        "places.regularOpeningHours.weekdayDescriptions",
        "places.types",
        "places.reviews",
    ])

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://places.googleapis.com/v1/places:searchText",
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": api_key,
                    "X-Goog-FieldMask": field_mask,
                },
                json={"textQuery": query, "languageCode": "es"},
            )
        if resp.status_code != 200:
            logger.warning(f"Places API error {resp.status_code}: {resp.text[:200]}")
            return None
        data = resp.json()
        places = data.get("places") or []
        if not places:
            logger.info(f"Places API: no results for '{query}'")
            return None
        place = places[0]

        reviews_raw = place.get("reviews") or []
        reviews_list: List[str] = []
        reviews_detailed: List[Dict[str, Any]] = []
        for r in reviews_raw:
            txt = ((r.get("text") or {}).get("text")
                   or (r.get("originalText") or {}).get("text")
                   or "").strip()
            if not txt:
                continue
            reviews_list.append(txt)
            reviews_detailed.append({
                "author": ((r.get("authorAttribution") or {}).get("displayName")) or "Anónimo",
                "author_photo": (r.get("authorAttribution") or {}).get("photoUri"),
                "rating": r.get("rating"),
                "relative_time": r.get("relativePublishTimeDescription"),
                "publish_time": r.get("publishTime"),
                "text": txt,
            })

        result = {
            "place_id": place.get("id"),
            "display_name": (place.get("displayName") or {}).get("text") or restaurant_name,
            "formatted_address": place.get("formattedAddress"),
            "rating": place.get("rating"),
            "user_rating_count": place.get("userRatingCount"),
            "price_level": place.get("priceLevel"),
            "google_maps_uri": place.get("googleMapsUri"),
            "website_uri": place.get("websiteUri"),
            "phone": place.get("internationalPhoneNumber"),
            "opening_hours": (place.get("regularOpeningHours") or {}).get("weekdayDescriptions"),
            "types": place.get("types"),
            "reviews": reviews_list,
            "reviews_detailed": reviews_detailed,
            "source": "google_places",
        }
        logger.info(
            f"🌍 Places API: {result['display_name']} | "
            f"{result.get('rating')}★ ({result.get('user_rating_count')} reviews) | "
            f"{len(reviews_list)} review texts"
        )
        return result
    except Exception as e:
        logger.warning(f"Places API exception: {e}")
        return None


async def fetch_local_business_data_reviews(place_id: str, language: str = "es", region: str = "es") -> Dict[str, Any]:
    """Fetch up to 100 real Google Maps reviews via RapidAPI Local Business Data (cached 30 days).
    Returns dict with keys: reviews (list normalized), source, rating, total_reviews.
    """
    result = {"reviews": [], "source": "none", "rating": None, "total_reviews": 0}
    if not place_id:
        return result

    rapid_key = os.environ.get('RAPIDAPI_KEY')
    if not rapid_key:
        logger.warning("RAPIDAPI_KEY not configured — skipping Local Business Data")
        return result

    # 30-day Firestore cache by place_id
    cache_ref = firestore_db.collection('reviews_cache').document(f"lbd_{place_id}")
    try:
        cached = cache_ref.get()
        if cached.exists:
            cdata = cached.to_dict()
            ct = cdata.get('cached_at', '')
            if ct:
                cd = datetime.fromisoformat(ct.replace('Z', '+00:00'))
                if datetime.now(timezone.utc) - cd < timedelta(days=30):
                    logger.info(f"📦 Local Business Data cache hit for {place_id}")
                    cdata.pop('cached_at', None)
                    return cdata
    except Exception as e:
        logger.debug(f"LBD cache check failed: {e}")

    headers = {
        "X-RapidAPI-Key": rapid_key,
        "X-RapidAPI-Host": "local-business-data.p.rapidapi.com",
    }
    all_reviews: List[Dict[str, Any]] = []
    seen_ids: set = set()
    last_rating = None

    # Two calls: newest (most informative) + lowest (critical for discrepancy detection)
    for sort_by, limit in [("newest", 100), ("lowest_ranking", 20)]:
        params = {
            "business_id": place_id,
            "limit": limit,
            "sort_by": sort_by,
            "region": region,
            "language": language,
        }
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                r = await client.get(
                    "https://local-business-data.p.rapidapi.com/business-reviews-v2",
                    headers=headers,
                    params=params,
                )
            if r.status_code != 200:
                logger.warning(f"LBD {sort_by} failed: {r.status_code} {r.text[:200]}")
                continue
            data = r.json()
            if data.get("status") != "OK":
                logger.warning(f"LBD {sort_by} non-OK: {str(data)[:200]}")
                continue
            for rv in (data.get("data") or {}).get("reviews", []):
                rid = rv.get("review_id")
                if not rid or rid in seen_ids:
                    continue
                seen_ids.add(rid)
                text = (rv.get("review_text") or "").strip()
                rating = rv.get("rating")
                if not text and rating is None:
                    continue
                all_reviews.append({
                    "review_id": rid,
                    "text": text,
                    "rating": rating,
                    "author": rv.get("author_name"),
                    "author_photo": rv.get("author_photo_url"),
                    "author_local_guide": rv.get("author_is_local_guide"),
                    "datetime_utc": rv.get("review_datetime_utc"),
                    "timestamp": rv.get("review_timestamp"),
                    "relative_time": rv.get("review_time"),
                    "language": rv.get("review_language"),
                    "review_link": rv.get("review_link"),
                    "like_count": rv.get("like_count"),
                    "owner_response": rv.get("owner_response_text"),
                    "source": "local_business_data",
                })
                if last_rating is None and isinstance(rating, (int, float)):
                    last_rating = rating
        except Exception as e:
            logger.warning(f"LBD {sort_by} exception: {e}")
            continue

    if not all_reviews:
        return result

    # Sort: highest like_count first, then most recent
    all_reviews.sort(
        key=lambda x: (x.get("like_count") or 0, x.get("timestamp") or 0),
        reverse=True,
    )
    result = {
        "reviews": all_reviews,
        "source": "local_business_data",
        "rating": last_rating,
        "total_reviews": len(all_reviews),
    }
    # Cache
    try:
        cache_ref.set({**result, "cached_at": datetime.now(timezone.utc).isoformat()})
        logger.info(f"💾 Cached {len(all_reviews)} LBD reviews for {place_id}")
    except Exception as e:
        logger.debug(f"LBD cache save failed: {e}")
    return result


async def scrape_google_reviews(restaurant_name: str, location: str = "") -> Dict:
    """Scrape real reviews using multiple sources with caching and rotation"""
    from bs4 import BeautifulSoup
    import random
    import hashlib
    
    # Generate cache key
    cache_key = hashlib.md5(f"{restaurant_name}_{location}".lower().encode()).hexdigest()
    
    # Check cache first (valid for 7 days)
    try:
        cache_ref = firestore_db.collection('reviews_cache').document(cache_key)
        cached = cache_ref.get()
        if cached.exists:
            cached_data = cached.to_dict()
            cache_time = cached_data.get('cached_at', '')
            if cache_time:
                from datetime import datetime, timedelta
                cache_date = datetime.fromisoformat(cache_time.replace('Z', '+00:00'))
                if datetime.now(timezone.utc) - cache_date < timedelta(days=7):
                    logger.info(f"📦 Using cached reviews for {restaurant_name}")
                    cached_data.pop('cached_at', None)
                    cached_data['source'] = cached_data.get('source', 'cache') + ' (cached)'
                    return cached_data
    except Exception as e:
        logger.debug(f"Cache check failed: {e}")
    
    # Rotating User-Agents to avoid detection
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    ]
    
    reviews_data = {
        "restaurant_name": restaurant_name,
        "location": location,
        "rating": None,
        "total_reviews": 0,
        "reviews": [],
        "source": "multi_source"
    }
    
    all_reviews = []
    found_rating = None
    sources_used = []
    
    async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
        
        # === SOURCE 1: DuckDuckGo (less blocking than Google) ===
        try:
            headers = {
                "User-Agent": random.choice(user_agents),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "es-ES,es;q=0.9",
            }
            query = f"{restaurant_name} {location} opiniones reseñas restaurante"
            ddg_url = f"https://html.duckduckgo.com/html/?q={query.replace(' ', '+')}"
            
            response = await client.get(ddg_url, headers=headers)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'lxml')
                
                # Extract snippets from DuckDuckGo results
                for result in soup.find_all('a', class_='result__snippet'):
                    text = result.get_text(strip=True)
                    if 30 < len(text) < 400:
                        food_keywords = ['comida', 'plato', 'servicio', 'menú', 'cocina', 'delicioso', 
                                        'rico', 'caro', 'barato', 'ambiente', 'atención', 'recomiendo']
                        if any(kw in text.lower() for kw in food_keywords):
                            all_reviews.append(text)
                            
                if all_reviews:
                    sources_used.append("duckduckgo")
                    
            await asyncio.sleep(random.uniform(0.5, 1.5))  # Random delay
            
        except Exception as e:
            logger.debug(f"DuckDuckGo scrape failed: {e}")
        
        # === SOURCE 2: Bing Search ===
        try:
            headers["User-Agent"] = random.choice(user_agents)
            query = f"{restaurant_name} {location} reseñas clientes opiniones"
            bing_url = f"https://www.bing.com/search?q={query.replace(' ', '+')}&setlang=es"
            
            response = await client.get(bing_url, headers=headers)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'lxml')
                
                # Extract rating if found
                import re
                page_text = soup.get_text()
                rating_matches = re.findall(r'(\d[,\.]\d)\s*(?:estrellas?|de\s*5|\/\s*5|puntos?)', page_text)
                for match in rating_matches:
                    try:
                        r = float(match.replace(',', '.'))
                        if 1.0 <= r <= 5.0 and not found_rating:
                            found_rating = r
                            break
                    except:
                        continue
                
                # Extract review snippets
                for p in soup.find_all(['p', 'span', 'li']):
                    text = p.get_text(strip=True)
                    if 40 < len(text) < 350:
                        food_keywords = ['comida', 'plato', 'servicio', 'camarero', 'precio', 
                                        'menú', 'cena', 'reserva', 'cocina', 'calidad', 'espera']
                        skip_keywords = ['iniciar sesión', 'política', 'cookies', 'publicidad']
                        
                        text_lower = text.lower()
                        if any(kw in text_lower for kw in food_keywords):
                            if not any(sk in text_lower for sk in skip_keywords):
                                if text not in all_reviews:
                                    all_reviews.append(text)
                                    
                if "bing" not in sources_used and len(all_reviews) > 0:
                    sources_used.append("bing")
                    
            await asyncio.sleep(random.uniform(0.5, 1.5))
            
        except Exception as e:
            logger.debug(f"Bing scrape failed: {e}")
        
        # === SOURCE 3: TripAdvisor via Bing ===
        try:
            headers["User-Agent"] = random.choice(user_agents)
            ta_query = f"site:tripadvisor.es {restaurant_name} {location} opiniones"
            ta_url = f"https://www.bing.com/search?q={ta_query.replace(' ', '+')}"
            
            response = await client.get(ta_url, headers=headers)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'lxml')
                
                for elem in soup.find_all(['p', 'span']):
                    text = elem.get_text(strip=True)
                    if 40 < len(text) < 300:
                        if any(w in text.lower() for w in ['restaurante', 'comida', 'servicio', 'ambiente']):
                            if text not in all_reviews:
                                all_reviews.append(text)
                                if "tripadvisor" not in sources_used:
                                    sources_used.append("tripadvisor")
                                    
            await asyncio.sleep(random.uniform(0.5, 1.0))
            
        except Exception as e:
            logger.debug(f"TripAdvisor scrape failed: {e}")
        
        # === SOURCE 4: TheFork/ElTenedor via Bing ===
        try:
            headers["User-Agent"] = random.choice(user_agents)
            tf_query = f"site:thefork.es OR site:eltenedor.es {restaurant_name} {location}"
            tf_url = f"https://www.bing.com/search?q={tf_query.replace(' ', '+')}"
            
            response = await client.get(tf_url, headers=headers)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'lxml')
                
                # Look for rating in TheFork results
                page_text = soup.get_text()
                if not found_rating:
                    rating_matches = re.findall(r'(\d[,\.]\d)\s*/\s*10', page_text)
                    for match in rating_matches:
                        try:
                            r = float(match.replace(',', '.'))
                            if 1.0 <= r <= 10.0:
                                found_rating = round(r / 2, 1)  # Convert /10 to /5
                                break
                        except:
                            continue
                
                for elem in soup.find_all(['p', 'span']):
                    text = elem.get_text(strip=True)
                    if 40 < len(text) < 300:
                        if any(w in text.lower() for w in ['restaurante', 'reserva', 'comida', 'menú']):
                            if text not in all_reviews:
                                all_reviews.append(text)
                                if "thefork" not in sources_used:
                                    sources_used.append("thefork")
                                    
        except Exception as e:
            logger.debug(f"TheFork scrape failed: {e}")
        
        # === SOURCE 5: Yelp via Bing ===
        try:
            headers["User-Agent"] = random.choice(user_agents)
            yelp_query = f"site:yelp.es {restaurant_name} {location}"
            yelp_url = f"https://www.bing.com/search?q={yelp_query.replace(' ', '+')}"
            
            response = await client.get(yelp_url, headers=headers)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'lxml')
                
                for elem in soup.find_all(['p', 'span']):
                    text = elem.get_text(strip=True)
                    if 40 < len(text) < 300:
                        if any(w in text.lower() for w in ['restaurante', 'comida', 'servicio']):
                            if text not in all_reviews:
                                all_reviews.append(text)
                                if "yelp" not in sources_used:
                                    sources_used.append("yelp")
                                    
        except Exception as e:
            logger.debug(f"Yelp scrape failed: {e}")
    
    # Deduplicate and clean reviews
    unique_reviews = []
    for review in all_reviews:
        # Skip if too similar to existing
        is_duplicate = False
        for existing in unique_reviews:
            if review in existing or existing in review:
                is_duplicate = True
                break
            # Check similarity
            common_words = set(review.lower().split()) & set(existing.lower().split())
            if len(common_words) > 10:
                is_duplicate = True
                break
        if not is_duplicate:
            unique_reviews.append(review)
    
    reviews_data["reviews"] = unique_reviews[:15]
    reviews_data["rating"] = found_rating
    reviews_data["total_reviews"] = len(unique_reviews)
    reviews_data["source"] = "+".join(sources_used) if sources_used else "none"
    
    # Save to cache
    try:
        cache_data = {**reviews_data, "cached_at": datetime.now(timezone.utc).isoformat()}
        cache_ref = firestore_db.collection('reviews_cache').document(cache_key)
        cache_ref.set(cache_data)
        logger.info(f"💾 Cached reviews for {restaurant_name}")
    except Exception as e:
        logger.debug(f"Cache save failed: {e}")
    
    logger.info(f"📍 Scraped {len(reviews_data['reviews'])} reviews for {restaurant_name} from {reviews_data['source']} (rating: {found_rating})")
    return reviews_data


async def scrape_additional_sources(restaurant_name: str, location: str = "") -> Dict:
    """Legacy function - now integrated into main scraper"""
    return {"reviews": [], "source": "none", "rating": None}


async def analyze_reality_check(video_text: str, restaurant_info: Dict, influencer_channel: str) -> Dict:
    """Use AI to compare influencer content vs REAL reviews"""
    restaurant_name = restaurant_info.get("restaurant_name", "desconocido")
    location = restaurant_info.get("location", "")
    real_rating = restaurant_info.get("rating")
    real_reviews = restaurant_info.get("reviews", [])
    reviews_source = restaurant_info.get("source", "unknown")
    
    # Format real reviews for the prompt
    reviews_text = ""
    if real_reviews:
        reviews_text = "\n".join([f"- {(r if isinstance(r, str) else (r.get('text') or ''))[:200]}" for r in real_reviews[:12]])
    
    prompt = f"""Eres un analista experto en marketing de influencers y gastronomía. Tu tarea es analizar la COHERENCIA entre lo que dice un influencer sobre un restaurante y la experiencia REAL de los clientes.

INFORMACIÓN DEL VIDEO DEL INFLUENCER:
Canal: {influencer_channel}
Contenido (transcripción/descripción):
{video_text[:4000]}

RESTAURANTE A ANALIZAR:
Nombre: {restaurant_name}
Ubicación: {location}
{"Rating real: " + str(real_rating) + "/5" if real_rating else "Rating: No disponible"}
Fuente de reseñas: {reviews_source}

RESEÑAS REALES DE CLIENTES:
{reviews_text if reviews_text else "No se encontraron reseñas específicas. Usa tu conocimiento general."}

INSTRUCCIONES:
1. Analiza el TONO del influencer en su contenido (¿muy positivo? ¿exagerado? ¿neutral? ¿crítico?)
2. Identifica CLAIMS específicos que hace sobre el restaurante (calidad, precio, servicio, ambiente, etc.)
3. COMPARA con las reseñas reales de clientes proporcionadas arriba
4. Calcula un ÍNDICE DE COHERENCIA (0-100) basándote en:
   - 100 = Las opiniones del influencer coinciden perfectamente con las reseñas reales
   - 70-99 = Alta coherencia, algunas diferencias menores
   - 40-69 = Coherencia media, hay discrepancias notables
   - 20-39 = Baja coherencia, el influencer omite o contradice opiniones comunes
   - 0-19 = Muy baja coherencia, contenido parece completamente desconectado de la realidad

IMPORTANTE: 
- NO estamos diciendo que el influencer mienta
- Estamos comparando PERCEPCIÓN del influencer vs OPINIÓN REAL de clientes
- Sé objetivo y usa lenguaje neutral
- Si tenemos reseñas reales, bástate principalmente en ellas

Responde SOLO con JSON válido:
{{
    "coherence_index": 75,
    "influencer_sentiment": {{
        "overall_tone": "muy positivo",
        "score": 0.9,
        "key_claims": ["mejor pizza de Madrid", "precio increíble", "servicio perfecto"],
        "suspicious_patterns": ["todos los adjetivos son superlativos", "no menciona ningún punto negativo"],
        "positive_indicators": ["menciona platos específicos", "da contexto del lugar"]
    }},
    "community_expectation": {{
        "estimated_rating": {real_rating if real_rating else 3.5},
        "common_positives": ["extraído de las reseñas reales"],
        "common_complaints": ["extraído de las reseñas reales"],
        "typical_experience": "Descripción basada en reseñas reales"
    }},
    "gap_analysis": {{
        "perception_gap": "alto/medio/bajo",
        "main_discrepancies": ["diferencias específicas entre influencer y reseñas reales"],
        "aligned_points": ["puntos donde coinciden influencer y clientes"]
    }},
    "summary": "Resumen del análisis comparativo en español.",
    "disclaimer": "Este análisis compara el contenido del influencer con {len(real_reviews)} reseñas reales de clientes.",
    "confidence_level": "{'alto' if real_reviews else 'bajo'}"
}}"""

    try:
        response = await _gemini_generate_with_fallback(
            prompt, temperature=0.3, max_output_tokens=8192, json_mode=True
        )
        
        # Parse response
        clean_response = response.text.strip()
        if clean_response.startswith("```"):
            lines = clean_response.split("```")
            if len(lines) > 1:
                clean_response = lines[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
        clean_response = clean_response.strip()
        
        # Find JSON
        json_start = clean_response.find('{')
        json_end = clean_response.rfind('}') + 1
        if json_start != -1 and json_end > json_start:
            clean_response = clean_response[json_start:json_end]
        
        result = json.loads(clean_response)
        return result
        
    except Exception as e:
        logger.error(f"Reality check AI analysis failed: {e}")
        return {
            "coherence_index": 50,
            "influencer_sentiment": {"overall_tone": "no analizado", "score": 0.5},
            "community_expectation": {"estimated_rating": 0, "typical_experience": "No se pudo analizar"},
            "gap_analysis": {"perception_gap": "desconocido"},
            "summary": f"Error en el análisis: {str(e)}",
            "disclaimer": "Análisis no completado",
            "confidence_level": "bajo"
        }

class SuggestRestaurantRequest(BaseModel):
    video_url: str


@api_router.post("/reality-check/suggest-restaurant")
async def suggest_restaurant_from_video(request: SuggestRestaurantRequest):
    """Detect the restaurant mentioned in a YouTube/TikTok video using title + description + transcript + AI."""
    u = request.video_url

    # ====== TikTok detection path ======
    if _is_tiktok_url(u):
        try:
            info = await extract_tiktok_video_info(u)
        except HTTPException:
            raise
        title = info.get("title") or ""
        description = info.get("description") or ""
        channel_name = info.get("uploader") or ""
        video_id = info.get("video_id") or ""
        thumbnail = info.get("thumbnail") or ""
        try:
            transcript = await transcribe_audio_with_whisper(info["audio_path"], language="es")
        except Exception as e:
            logger.warning(f"Suggest TikTok whisper failed: {e}")
            transcript = ""
        finally:
            try:
                shutil.rmtree(info.get("cleanup_dir") or "", ignore_errors=True)
            except Exception:
                pass
        platform = "tiktok"
    else:
        # ====== YouTube path ======
        video_id = None
        if "youtube.com/watch?v=" in u:
            video_id = u.split("v=")[1].split("&")[0]
        elif "youtu.be/" in u:
            video_id = u.split("youtu.be/")[1].split("?")[0]
        elif "youtube.com/shorts/" in u:
            video_id = u.split("shorts/")[1].split("?")[0]
        if not video_id:
            raise HTTPException(status_code=400, detail="URL no reconocida (pega un link de YouTube o TikTok)")
        title = ""
        description = ""
        channel_name = ""
        thumbnail = ""
        platform = "youtube"
        try:
            youtube = get_youtube_service()
            resp = youtube.videos().list(part="snippet", id=video_id).execute()
            if resp.get("items"):
                snip = resp["items"][0]["snippet"]
                title = snip.get("title", "")
                description = snip.get("description", "") or ""
                channel_name = snip.get("channelTitle", "") or ""
                thumbnail = (snip.get("thumbnails", {}).get("high") or {}).get("url", "")
        except Exception as e:
            logger.warning(f"Suggest: YouTube API failed for {video_id}: {e}")

        transcript = ""
        try:
            t = await get_subtitles_transcript(video_id)
            if t:
                transcript = t
        except Exception:
            pass

    # Build AI prompt
    prompt = f"""Eres un asistente experto en identificar restaurantes mencionados en videos de foodies/influencers gastronómicos.

Tu tarea: analizar los siguientes datos y extraer el NOMBRE del restaurante que se reseña en el video y su ciudad.

CANAL: {channel_name}
TÍTULO DEL VIDEO: {title}
DESCRIPCIÓN: {description[:2000]}
TRANSCRIPCIÓN (primeros 4000 caracteres): {transcript[:4000]}

INSTRUCCIONES:
- Busca UN solo restaurante (el principal que se reseña).
- Si hay varios restaurantes mencionados, elige el que tenga más peso/sea el foco del video.
- La ciudad ayuda a desambiguar (Madrid, Barcelona, etc.).
- Si no puedes identificar con razonable certeza, devuelve null.
- "confidence" en escala 0.0 a 1.0.

Responde SOLO con JSON válido, nada más:
{{
  "restaurant_name": "Nombre del restaurante o null",
  "location": "Ciudad o barrio, o null",
  "confidence": 0.8,
  "reasoning": "Breve explicación (1 frase) de dónde lo sacaste"
}}"""

    try:
        resp = await _gemini_generate_with_fallback(
            prompt, temperature=0.1, max_output_tokens=2048, json_mode=True
        )
        text = (resp.text or "").strip()
        if text.startswith("```"):
            parts = text.split("```")
            if len(parts) > 1:
                text = parts[1]
                if text.startswith("json"):
                    text = text[4:]
        text = text.strip()
        j_start = text.find("{")
        j_end = text.rfind("}") + 1
        if j_start >= 0 and j_end > j_start:
            text = text[j_start:j_end]
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            try:
                import json_repair
                parsed = json_repair.loads(text)
            except Exception:
                parsed = None
        if not isinstance(parsed, dict):
            parsed = {"restaurant_name": None, "location": None, "confidence": 0.0, "reasoning": "Respuesta inválida"}
    except Exception as e:
        logger.warning(f"Suggest AI parse failed: {e}")
        parsed = {"restaurant_name": None, "location": None, "confidence": 0.0, "reasoning": "No se pudo analizar"}

    restaurant_name = parsed.get("restaurant_name") or None
    location = parsed.get("location") or None
    confidence = float(parsed.get("confidence") or 0.0)

    # If we got a name, try to verify with Places API and enrich
    place = None
    if restaurant_name:
        place = await get_google_places_info(restaurant_name, location or "")
        if place:
            # Prefer verified values
            restaurant_name = place.get("display_name") or restaurant_name

    return {
        "video_id": video_id,
        "video_title": title,
        "channel_name": channel_name,
        "thumbnail_url": thumbnail,
        "platform": platform,
        "restaurant_name": restaurant_name,
        "location": location,
        "confidence": confidence,
        "reasoning": parsed.get("reasoning") or "",
        "sources_used": {
            "title": bool(title),
            "description": bool(description),
            "transcript": bool(transcript),
        },
        "verified_place": (
            {
                "display_name": place.get("display_name"),
                "formatted_address": place.get("formatted_address"),
                "rating": place.get("rating"),
                "user_rating_count": place.get("user_rating_count"),
                "place_id": place.get("place_id"),
            }
            if place else None
        ),
    }


@api_router.get("/reality-check/autocomplete")
async def autocomplete_restaurant(q: str, location: str = ""):
    """Places Autocomplete for restaurant names."""
    q = (q or "").strip()
    if len(q) < 2:
        return {"suggestions": []}

    api_key = os.environ.get('GOOGLE_PLACES_API_KEY') or os.environ.get('YOUTUBE_API_KEY')
    if not api_key:
        return {"suggestions": []}

    body = {
        "input": q,
        "includedPrimaryTypes": ["restaurant", "cafe", "bar", "bakery", "meal_takeaway"],
        "languageCode": "es",
        "regionCode": "ES",
    }
    if location:
        body["input"] = f"{q} {location}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://places.googleapis.com/v1/places:autocomplete",
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": api_key,
                },
                json=body,
            )
        if resp.status_code != 200:
            logger.warning(f"Autocomplete error {resp.status_code}: {resp.text[:200]}")
            return {"suggestions": []}
        data = resp.json()
        out = []
        for s in (data.get("suggestions") or [])[:8]:
            pp = s.get("placePrediction") or {}
            sf = pp.get("structuredFormat") or {}
            out.append({
                "place_id": pp.get("placeId"),
                "main_text": (sf.get("mainText") or {}).get("text"),
                "secondary_text": (sf.get("secondaryText") or {}).get("text"),
                "full_text": (pp.get("text") or {}).get("text"),
                "types": pp.get("types") or [],
            })
        return {"suggestions": out}
    except Exception as e:
        logger.warning(f"Autocomplete exception: {e}")
        return {"suggestions": []}


async def _fetch_tiktok_via_rapidapi(url: str, temp_dir: str) -> Optional[Dict[str, Any]]:
    """Fallback: get TikTok video metadata + audio via RapidAPI tiktok-scraper7."""
    rapid_key = os.environ.get('RAPIDAPI_KEY')
    if not rapid_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                "https://tiktok-scraper7.p.rapidapi.com/",
                params={"url": url, "hd": "0"},
                headers={
                    "X-RapidAPI-Key": rapid_key,
                    "X-RapidAPI-Host": "tiktok-scraper7.p.rapidapi.com",
                },
            )
        if r.status_code != 200:
            logger.warning(f"RapidAPI tiktok failed: {r.status_code}")
            return None
        body = r.json()
        if body.get("code") != 0:
            logger.warning(f"RapidAPI tiktok non-ok: {body.get('msg')}")
            return None
        data = body.get("data") or {}
        author = data.get("author") or {}
        video_id = str(data.get("id") or data.get("aweme_id") or "")
        title = (data.get("title") or "").strip()
        duration = data.get("duration") or 0
        uploader = (author.get("unique_id") or author.get("nickname") or "").strip()
        thumbnail = data.get("cover") or data.get("origin_cover") or ""
        # Prefer 'music' (audio only) or 'play' (video no watermark)
        media_url = data.get("music") or data.get("play") or data.get("wmplay")
        if not media_url:
            return None
        # Download media to temp_dir
        audio_path = os.path.join(temp_dir, "audio.mp3" if data.get("music") else "audio.mp4")
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            ar = await client.get(media_url)
        if ar.status_code != 200:
            return None
        with open(audio_path, "wb") as f:
            f.write(ar.content)
        # If it's a video, extract audio using ffmpeg
        if audio_path.endswith(".mp4"):
            mp3_path = os.path.join(temp_dir, "audio.mp3")
            try:
                proc = await asyncio.to_thread(
                    subprocess.run,
                    ["ffmpeg", "-y", "-i", audio_path, "-vn", "-acodec", "libmp3lame", "-q:a", "5", mp3_path],
                    capture_output=True,
                    timeout=90,
                )
                if proc.returncode == 0 and os.path.exists(mp3_path):
                    os.remove(audio_path)
                    audio_path = mp3_path
            except Exception as e:
                logger.warning(f"ffmpeg extract failed: {e}")
        return {
            "video_id": video_id,
            "title": title,
            "description": title,  # TikTok title doubles as description
            "uploader": uploader,
            "thumbnail": thumbnail,
            "duration": duration,
            "audio_path": audio_path,
            "cleanup_dir": temp_dir,
        }
    except Exception as e:
        logger.warning(f"RapidAPI tiktok exception: {e}")
        return None


async def extract_tiktok_video_info(url: str) -> Dict[str, Any]:
    """Download a TikTok video's audio + metadata using yt-dlp.

    Returns {video_id, title, description, uploader, thumbnail, duration, audio_path, cleanup_dir}.
    Caller is responsible for shutil.rmtree(cleanup_dir) after using the audio file.
    """
    temp_dir = tempfile.mkdtemp(prefix="tiktok_")
    yt_dlp_path = shutil.which("yt-dlp") or "/root/.venv/bin/yt-dlp"

    # First: get metadata as JSON
    meta_cmd = [
        yt_dlp_path,
        "--no-warnings",
        "--no-playlist",
        "--dump-single-json",
        "--no-download",
        url,
    ]
    meta = None
    yt_dlp_failed = False
    try:
        proc = await asyncio.to_thread(subprocess.run, meta_cmd, capture_output=True, timeout=45)
        if proc.returncode != 0:
            err = (proc.stderr or b"").decode("utf-8", errors="ignore")[:500]
            logger.warning(f"yt-dlp metadata failed: {err}")
            yt_dlp_failed = True
        else:
            try:
                meta = json.loads(proc.stdout or b"{}")
            except Exception:
                yt_dlp_failed = True
    except subprocess.TimeoutExpired:
        yt_dlp_failed = True
    except Exception as e:
        logger.warning(f"yt-dlp exception: {e}")
        yt_dlp_failed = True

    # If yt-dlp can't access TikTok (IP block etc), fall back to RapidAPI
    if yt_dlp_failed or not meta:
        rapid_result = await _fetch_tiktok_via_rapidapi(url, temp_dir)
        if rapid_result:
            logger.info("✅ TikTok via RapidAPI fallback")
            return rapid_result
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(
            status_code=400,
            detail="No se pudo acceder al TikTok. La IP del servidor puede estar bloqueada y RapidAPI no devolvió datos."
        )

    video_id = str(meta.get("id") or "")
    title = (meta.get("title") or meta.get("fulltitle") or "").strip()
    description = (meta.get("description") or "").strip()
    uploader = (meta.get("uploader") or meta.get("uploader_id") or "").strip()
    thumbnail = meta.get("thumbnail") or ""
    duration = meta.get("duration") or 0

    # Now: download audio (m4a/mp3)
    audio_template = os.path.join(temp_dir, "audio.%(ext)s")
    dl_cmd = [
        yt_dlp_path,
        "--no-warnings",
        "--no-playlist",
        "-x",  # extract audio
        "--audio-format", "mp3",
        "--audio-quality", "5",
        "-o", audio_template,
        url,
    ]
    try:
        proc = await asyncio.to_thread(subprocess.run, dl_cmd, capture_output=True, timeout=120)
        if proc.returncode != 0:
            err = (proc.stderr or b"").decode("utf-8", errors="ignore")[:300]
            logger.warning(f"yt-dlp audio download failed: {err}")
            rapid_result = await _fetch_tiktok_via_rapidapi(url, temp_dir)
            if rapid_result:
                return rapid_result
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise HTTPException(status_code=400, detail=f"No se pudo descargar el audio del TikTok: {err}")
    except subprocess.TimeoutExpired:
        rapid_result = await _fetch_tiktok_via_rapidapi(url, temp_dir)
        if rapid_result:
            return rapid_result
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="Timeout al descargar audio")

    audio_files = [f for f in os.listdir(temp_dir) if f.startswith("audio.")]
    if not audio_files:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="No se generó archivo de audio")

    audio_path = os.path.join(temp_dir, audio_files[0])
    return {
        "video_id": video_id,
        "title": title,
        "description": description,
        "uploader": uploader,
        "thumbnail": thumbnail,
        "duration": duration,
        "audio_path": audio_path,
        "cleanup_dir": temp_dir,
    }


async def transcribe_audio_with_whisper(audio_path: str, language: str = "es") -> str:
    """Transcribe an audio file using OpenAI Whisper-1 via the Emergent LLM Key.

    This is the single source of truth for TikTok / short-form audio transcription.
    No Gemini audio. No fallback experiments. Just Whisper-1 + Emergent key.
    """
    emergent_key = os.environ.get('EMERGENT_LLM_KEY')
    if not emergent_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY no configurada")

    if not os.path.exists(audio_path):
        raise HTTPException(status_code=500, detail=f"Archivo de audio no encontrado: {audio_path}")

    file_size = os.path.getsize(audio_path)
    # Whisper-1 hard limit: 25MB (we use 26214400 from SDK constant)
    if file_size > 26214400:
        raise HTTPException(
            status_code=413,
            detail=f"Audio demasiado grande para Whisper-1 ({file_size / 1024 / 1024:.1f}MB > 25MB)",
        )

    try:
        from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText
        stt = OpenAISpeechToText(api_key=emergent_key)
        # litellm's transcription expects bytes / io.IOBase / PathLike / tuple,
        # NOT a plain str path. Pass a binary file handle so it works on all backends.
        with open(audio_path, "rb") as audio_fp:
            result = await stt.transcribe(
                file=audio_fp,
                model="whisper-1",
                language=language,
                response_format="text",
            )
        # response_format="text" returns plain str; some SDK versions still wrap it
        if isinstance(result, dict):
            text = (result.get("text") or "").strip()
        elif hasattr(result, "text"):
            text = (result.text or "").strip()
        else:
            text = (str(result) if result is not None else "").strip()

        if not text:
            raise HTTPException(status_code=502, detail="Whisper devolvió transcripción vacía")

        logger.info(f"✅ Whisper-1 transcription ({len(text)} chars, audio {file_size / 1024:.0f}KB)")
        return text
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Whisper-1 transcription failed: {e}")
        raise HTTPException(status_code=502, detail=f"Transcripción Whisper-1 falló: {e}")


# Backward-compat alias: any old call to transcribe_audio_with_gemini now uses Whisper-1
transcribe_audio_with_gemini = transcribe_audio_with_whisper


def _is_tiktok_url(url: str) -> bool:
    u = (url or "").lower()
    return ("tiktok.com/" in u) or ("vm.tiktok.com/" in u) or ("vt.tiktok.com/" in u)


@api_router.post("/reality-check/analyze")
async def start_reality_check(request: RealityCheckRequest, background_tasks: BackgroundTasks):
    """Start a Reality Check analysis - compare influencer vs community perception.
    Supports both YouTube and TikTok video URLs.
    """
    # ============ TIKTOK PATH ============
    if _is_tiktok_url(request.video_url):
        # 1) Download audio + metadata
        info = await extract_tiktok_video_info(request.video_url)
        video_id = info["video_id"] or f"tt_{int(datetime.now(timezone.utc).timestamp())}"
        video_title = info["title"] or "Vídeo de TikTok"
        channel_name = info["uploader"] or "Foodie en TikTok"
        thumbnail = info["thumbnail"]
        description = info["description"]

        analysis_id = str(uuid.uuid4())

        # 2) Save initial record
        reality_check_data = {
            "id": analysis_id,
            "video_id": video_id,
            "video_url": request.video_url,
            "video_title": video_title,
            "channel_name": channel_name,
            "thumbnail_url": thumbnail,
            "platform": "tiktok",
            "video_description": description,
            "restaurant_name": request.restaurant_name,
            "restaurant_location": request.restaurant_location or "",
            "status": "processing",
            "coherence_index": None,
            "influencer_sentiment": None,
            "community_sentiment": None,
            "gap_analysis": None,
            "analysis_summary": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        reality_checks_ref = firestore_db.collection('reality_checks')
        reality_checks_ref.document(analysis_id).set(reality_check_data)

        # 3) Run TikTok analysis in background (transcribe + analyze)
        background_tasks.add_task(
            run_tiktok_reality_check,
            analysis_id,
            info["audio_path"],
            info["cleanup_dir"],
            description,
            video_title,
            request.restaurant_name,
            request.restaurant_location or "",
            channel_name,
        )

        return {
            "id": analysis_id,
            "status": "processing",
            "video_title": video_title,
            "channel_name": channel_name,
            "platform": "tiktok",
            "restaurant_name": request.restaurant_name,
            "message": "Análisis de TikTok iniciado. Transcribiendo audio…",
        }

    # ============ YOUTUBE PATH (original) ============
    # Extract video ID
    video_id = None
    if "youtube.com/watch?v=" in request.video_url:
        video_id = request.video_url.split("v=")[1].split("&")[0]
    elif "youtu.be/" in request.video_url:
        video_id = request.video_url.split("youtu.be/")[1].split("?")[0]
    elif "youtube.com/shorts/" in request.video_url:
        video_id = request.video_url.split("shorts/")[1].split("?")[0]

    if not video_id:
        raise HTTPException(status_code=400, detail="URL no reconocida. Pega un link de YouTube o TikTok.")
    
    # Create analysis record
    analysis_id = str(uuid.uuid4())
    
    # Get video info
    try:
        youtube = get_youtube_service()
        video_response = youtube.videos().list(
            part="snippet,statistics",
            id=video_id
        ).execute()
        
        if not video_response.get("items"):
            raise HTTPException(status_code=404, detail="Video no encontrado")
        
        video_data = video_response["items"][0]
        video_title = video_data["snippet"]["title"]
        channel_name = video_data["snippet"]["channelTitle"]
        thumbnail = video_data["snippet"]["thumbnails"].get("high", {}).get("url", "")
        
    except HttpError as e:
        raise HTTPException(status_code=400, detail=f"Error de YouTube: {str(e)}")
    
    # Save initial record
    reality_check_data = {
        "id": analysis_id,
        "video_id": video_id,
        "video_url": request.video_url,
        "video_title": video_title,
        "channel_name": channel_name,
        "thumbnail_url": thumbnail,
        "restaurant_name": request.restaurant_name,
        "restaurant_location": request.restaurant_location or "",
        "status": "processing",
        "coherence_index": None,
        "influencer_sentiment": None,
        "community_sentiment": None,
        "gap_analysis": None,
        "analysis_summary": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Save to Firestore
    reality_checks_ref = firestore_db.collection('reality_checks')
    reality_checks_ref.document(analysis_id).set(reality_check_data)
    
    # Run analysis in background
    background_tasks.add_task(run_reality_check_analysis, analysis_id, video_id, request.restaurant_name, request.restaurant_location or "", channel_name)
    
    return {
        "id": analysis_id,
        "status": "processing",
        "video_title": video_title,
        "channel_name": channel_name,
        "restaurant_name": request.restaurant_name,
        "message": "Análisis iniciado. Consultando fuentes..."
    }

async def run_tiktok_reality_check(
    analysis_id: str,
    audio_path: str,
    cleanup_dir: str,
    description: str,
    video_title: str,
    restaurant_name: str,
    location: str,
    channel_name: str,
):
    """Background pipeline for TikTok videos: whisper → suggest → places → LBD → AI."""
    reality_checks_ref = firestore_db.collection('reality_checks')
    try:
        # 1) Transcribe audio with Whisper-1
        transcript_text = await transcribe_audio_with_whisper(audio_path, language="es")
        # Build the video_text the same way YouTube path does
        prefix = f"TÍTULO: {video_title}\nDESCRIPCIÓN: {description}\n\n"
        video_text = prefix + "TRANSCRIPCIÓN DEL AUDIO:\n" + (transcript_text or "")
        transcription_source = "tiktok_whisper"

        # 2) Get restaurant info (Places + Local Business Data)
        places_info = await get_google_places_info(restaurant_name, location)
        if places_info and (places_info.get("reviews") or places_info.get("rating")):
            restaurant_info = {
                "restaurant_name": places_info.get("display_name") or restaurant_name,
                "location": places_info.get("formatted_address") or location,
                "rating": places_info.get("rating"),
                "total_reviews": places_info.get("user_rating_count") or len(places_info.get("reviews", [])),
                "reviews": list(places_info.get("reviews", [])),
                "source": "google_places",
            }
            place_id_for_lbd = places_info.get("place_id")
            if place_id_for_lbd:
                lbd = await fetch_local_business_data_reviews(place_id_for_lbd, language="es", region="es")
                lbd_reviews = lbd.get("reviews") or []
                if lbd_reviews:
                    existing = {(r if isinstance(r, str) else (r or {}).get("text", "")).strip().lower()[:80]
                                for r in restaurant_info["reviews"]}
                    for rv in lbd_reviews:
                        t = (rv.get("text") or "").strip()
                        if t and t.lower()[:80] not in existing:
                            restaurant_info["reviews"].append(t)
                            existing.add(t.lower()[:80])
                    restaurant_info["lbd_reviews_detailed"] = lbd_reviews
                    restaurant_info["source"] = "google_places+local_business_data"
                    restaurant_info["total_reviews"] = max(
                        restaurant_info.get("total_reviews") or 0,
                        len(restaurant_info["reviews"]),
                    )
        else:
            restaurant_info = await scrape_google_reviews(restaurant_name, location)

        reviews_count = len(restaurant_info.get("reviews", []))
        reviews_source = restaurant_info.get("source", "unknown")

        # 3) AI analysis
        analysis_result = await analyze_reality_check(video_text, restaurant_info, channel_name)

        update_payload = {
            "status": "completed",
            "coherence_index": analysis_result.get("coherence_index", 50),
            "influencer_sentiment": analysis_result.get("influencer_sentiment", {}),
            "community_sentiment": analysis_result.get("community_expectation", {}),
            "gap_analysis": analysis_result.get("gap_analysis", {}),
            "analysis_summary": analysis_result.get("summary", ""),
            "disclaimer": analysis_result.get("disclaimer", ""),
            "confidence_level": analysis_result.get("confidence_level", "medio"),
            "transcription_source": transcription_source,
            "transcript_text": (video_text or "")[:20000],
            "reviews_source": reviews_source,
            "reviews_count": reviews_count,
            "reviews_list": restaurant_info.get("reviews", [])[:15],
            "restaurant_rating": restaurant_info.get("rating"),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

        if places_info:
            merged_detailed: List[Dict[str, Any]] = []
            seen_keys = set()

            def _key(rv: Dict[str, Any]) -> str:
                text = (rv.get("text") or "")
                return ((rv.get("author") or "") + "|" + text[:80]).lower()

            for rv in (places_info.get("reviews_detailed") or []):
                k = _key(rv)
                if k in seen_keys:
                    continue
                seen_keys.add(k)
                merged_detailed.append({**rv, "verified_google": True, "source": rv.get("source") or "google_places"})
            for rv in (restaurant_info.get("lbd_reviews_detailed") or []):
                k = _key(rv)
                if k in seen_keys:
                    continue
                seen_keys.add(k)
                merged_detailed.append({**rv, "verified_google": False})

            update_payload["place_info"] = {
                "place_id": places_info.get("place_id"),
                "display_name": places_info.get("display_name"),
                "formatted_address": places_info.get("formatted_address"),
                "rating": places_info.get("rating"),
                "user_rating_count": places_info.get("user_rating_count"),
                "price_level": places_info.get("price_level"),
                "google_maps_uri": places_info.get("google_maps_uri"),
                "website_uri": places_info.get("website_uri"),
                "phone": places_info.get("phone"),
                "opening_hours": places_info.get("opening_hours"),
                "types": places_info.get("types"),
                "reviews_detailed": merged_detailed[:120],
            }

        reality_checks_ref.document(analysis_id).update(update_payload)
        logger.info(f"✅ TikTok reality-check completed for {analysis_id}")
    except Exception as e:
        logger.error(f"❌ TikTok reality-check failed for {analysis_id}: {e}")
        try:
            reality_checks_ref.document(analysis_id).update({
                "status": "failed",
                "error": str(e)[:500],
                "completed_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass
    finally:
        # Always cleanup downloaded audio
        try:
            if cleanup_dir and os.path.exists(cleanup_dir):
                shutil.rmtree(cleanup_dir, ignore_errors=True)
        except Exception:
            pass


async def run_reality_check_analysis(analysis_id: str, video_id: str, restaurant_name: str, location: str, channel_name: str):
    """Background task to run the full reality check analysis"""
    reality_checks_ref = firestore_db.collection('reality_checks')
    
    try:
        # Step 1: Get video transcript/content
        video_text = await get_youtube_transcript(video_id)
        if video_text and "TRANSCRIPCIÓN DEL AUDIO" in video_text:
            transcription_source = "transcript"
        elif video_text:
            transcription_source = "fallback"
        else:
            transcription_source = "none"

        if not video_text:
            video_text = f"Video del canal {channel_name} sobre {restaurant_name}"
        
        # Step 2: Get restaurant info
        # Try Google Places API first (official + real reviews + full metadata)
        places_info = await get_google_places_info(restaurant_name, location)

        if places_info and (places_info.get("reviews") or places_info.get("rating")):
            restaurant_info = {
                "restaurant_name": places_info.get("display_name") or restaurant_name,
                "location": places_info.get("formatted_address") or location,
                "rating": places_info.get("rating"),
                "total_reviews": places_info.get("user_rating_count") or len(places_info.get("reviews", [])),
                "reviews": places_info.get("reviews", []),
                "source": "google_places",
            }

            # === Enrich with Local Business Data (RapidAPI) up to 100 real reviews ===
            place_id_for_lbd = places_info.get("place_id")
            if place_id_for_lbd:
                lbd = await fetch_local_business_data_reviews(place_id_for_lbd, language="es", region="es")
                lbd_reviews = lbd.get("reviews") or []
                if lbd_reviews:
                    # Merge texts into the AI-input "reviews" list (plain strings), avoiding duplicates
                    existing_texts = {(r if isinstance(r, str) else (r or {}).get("text", "")).strip().lower()[:80]
                                      for r in restaurant_info["reviews"]}
                    for rv in lbd_reviews:
                        t = (rv.get("text") or "").strip()
                        if t and t.lower()[:80] not in existing_texts:
                            restaurant_info["reviews"].append(t)
                            existing_texts.add(t.lower()[:80])
                    # Save detailed reviews + bump source label
                    restaurant_info["lbd_reviews_detailed"] = lbd_reviews
                    restaurant_info["source"] = "google_places+local_business_data"
                    restaurant_info["total_reviews"] = max(
                        restaurant_info.get("total_reviews") or 0,
                        len(restaurant_info["reviews"]),
                    )
                    logger.info(f"✅ Enriched with {len(lbd_reviews)} LBD reviews")
        else:
            # Fallback to legacy scraping
            restaurant_info = await scrape_google_reviews(restaurant_name, location)

        reviews_count = len(restaurant_info.get("reviews", []))
        reviews_source = restaurant_info.get("source", "unknown")

        # Step 3: AI Analysis
        analysis_result = await analyze_reality_check(video_text, restaurant_info, channel_name)

        # Step 4: Update record with source information
        update_payload = {
            "status": "completed",
            "coherence_index": analysis_result.get("coherence_index", 50),
            "influencer_sentiment": analysis_result.get("influencer_sentiment", {}),
            "community_sentiment": analysis_result.get("community_expectation", {}),
            "gap_analysis": analysis_result.get("gap_analysis", {}),
            "analysis_summary": analysis_result.get("summary", ""),
            "disclaimer": analysis_result.get("disclaimer", ""),
            "confidence_level": analysis_result.get("confidence_level", "medio"),
            "transcription_source": transcription_source,
            "transcript_text": (video_text or "")[:20000],
            "reviews_source": reviews_source,
            "reviews_count": reviews_count,
            "reviews_list": restaurant_info.get("reviews", [])[:15],
            "restaurant_rating": restaurant_info.get("rating"),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        if places_info:
            # Merge Google Places' 5 official reviews + Local Business Data extra reviews
            merged_detailed: List[Dict[str, Any]] = []
            seen_keys = set()

            def _key(rv: Dict[str, Any]) -> str:
                text = (rv.get("text") or "")
                return ((rv.get("author") or "") + "|" + text[:80]).lower()

            # Official Google Places first (they have verified author photos)
            for rv in (places_info.get("reviews_detailed") or []):
                k = _key(rv)
                if k in seen_keys:
                    continue
                seen_keys.add(k)
                rv_out = {**rv, "verified_google": True, "source": rv.get("source") or "google_places"}
                merged_detailed.append(rv_out)

            # Then Local Business Data reviews
            for rv in (restaurant_info.get("lbd_reviews_detailed") or []):
                k = _key(rv)
                if k in seen_keys:
                    continue
                seen_keys.add(k)
                rv_out = {**rv, "verified_google": False}
                merged_detailed.append(rv_out)

            update_payload["place_info"] = {
                "place_id": places_info.get("place_id"),
                "display_name": places_info.get("display_name"),
                "formatted_address": places_info.get("formatted_address"),
                "rating": places_info.get("rating"),
                "user_rating_count": places_info.get("user_rating_count"),
                "price_level": places_info.get("price_level"),
                "google_maps_uri": places_info.get("google_maps_uri"),
                "website_uri": places_info.get("website_uri"),
                "phone": places_info.get("phone"),
                "opening_hours": places_info.get("opening_hours"),
                "types": places_info.get("types"),
                "reviews_detailed": merged_detailed[:120],
            }

        reality_checks_ref.document(analysis_id).update(update_payload)
        
        logger.info(f"Reality Check {analysis_id} completed. Coherence: {analysis_result.get('coherence_index')}% | Transcription: {transcription_source} | Reviews: {reviews_count}")
        
    except Exception as e:
        logger.error(f"Reality Check {analysis_id} failed: {e}")
        reality_checks_ref.document(analysis_id).update({
            "status": "failed",
            "error": str(e)
        })

@api_router.get("/reality-check/{analysis_id}")
async def get_reality_check(analysis_id: str):
    """Get Reality Check analysis result"""
    reality_checks_ref = firestore_db.collection('reality_checks')
    doc = reality_checks_ref.document(analysis_id).get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    
    data = doc.to_dict()
    # Remove internal Firestore fields
    data.pop('_id', None)
    return data


@api_router.get("/reality-check/{analysis_id}/invitation")
async def get_reality_check_invitation(analysis_id: str):
    """Detect if the influencer disclosed being invited / sponsored at the restaurant.

    Uses Gemini to scan the transcript for typical phrases like:
    - "nos han invitado", "es una colaboración", "está pagado",
      "invita la casa", "publi", "todo gratis", etc.
    Caches the result on the Firestore document.
    """
    reality_checks_ref = firestore_db.collection('reality_checks')
    doc_ref = reality_checks_ref.document(analysis_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    data = doc.to_dict()

    # Return cached result if present
    if isinstance(data.get('invitation_disclosure'), dict):
        return data['invitation_disclosure']

    transcript = (data.get('transcript_text') or "").strip()
    description = (data.get('video_description') or "").strip()
    title = (data.get('video_title') or "").strip()
    if not transcript and not description:
        result = {
            "level": "unknown",
            "label": "No nos consta",
            "detail": "No hay transcripción ni descripción del vídeo para verificar.",
            "confidence": "low",
            "evidence_quotes": [],
        }
        try:
            doc_ref.update({"invitation_disclosure": result})
        except Exception:
            pass
        return result

    gemini_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    # Trim transcript to keep prompt small but include start + end (most disclosures are at start)
    transcript_clean = transcript.replace('&nbsp;', ' ').replace('\xa0', ' ')
    if len(transcript_clean) > 6000:
        transcript_clean = transcript_clean[:4500] + "\n\n[…]\n\n" + transcript_clean[-1500:]

    prompt = f"""Eres un detector de transparencia para vídeos de foodies en YouTube/Instagram.
Tu única tarea: leer el material y decidir si el influencer DECLARA HABER SIDO INVITADO o patrocinado por el restaurante, y a qué nivel.

NIVELES POSIBLES (devuelve "level" exactamente uno de estos):
- "none" → el influencer dice EXPLÍCITAMENTE que pagó / no fue invitado, o el contenido deja claro que es visita anónima.
- "minor" → solo le invitaron a algo puntual (un café, un chupito, un postre, un detalle de la casa).
- "meal" → le pagaron la comida completa o la mayoría de los platos (cena/comida cubierta por el restaurante).
- "sponsored" → es una COLABORACIÓN pagada, publi declarada, contenido patrocinado, o el restaurante le contrató.
- "unknown" → no menciona nada relevante en el material disponible (es lo que pondrás POR DEFECTO si no hay evidencia clara).

REGLAS DE ORO:
- Si no hay frases claras, responde "unknown" con label "No nos consta" — NO INVENTES.
- Cita LITERALMENTE las frases que te llevaron a la decisión (en "evidence_quotes", máximo 3 frases cortas tal cual aparecen en la transcripción).
- "confidence": "high" si la frase es inequívoca; "medium" si es ambigua pero apunta claramente; "low" si es inferida con dudas.
- Idioma de "label" y "detail": español neutro, conciso, tono periodístico.

EJEMPLOS DE FRASES y a qué nivel suelen corresponder:
- "nos han invitado a probar el menú" → meal
- "esto es publicidad" / "vídeo patrocinado" / "colaboración con [restaurante]" → sponsored
- "el café nos lo invita la casa" / "nos han invitado a un chupito" → minor
- "hemos pagado la cuenta" / "no es publi" / "vinimos por nuestra cuenta" → none
- (sin mención) → unknown

DATOS DEL VÍDEO:
TÍTULO: {title}
DESCRIPCIÓN: {description[:1500]}

TRANSCRIPCIÓN:
{transcript_clean}

Devuelve SOLO JSON válido con esta estructura exacta:
{{
  "level": "none|minor|meal|sponsored|unknown",
  "label": "Texto corto en español para mostrar (max 6 palabras)",
  "detail": "Frase de 1-2 líneas explicando qué encontraste o por qué no consta nada",
  "confidence": "low|medium|high",
  "evidence_quotes": ["cita literal corta 1", "cita literal corta 2"]
}}"""

    try:
        client = genai.Client(api_key=gemini_key)
        resp = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=2048,
                response_mime_type="application/json",
            ),
        )
        text = (resp.text or "").strip()
        if text.startswith("```"):
            parts = text.split("```")
            if len(parts) > 1:
                text = parts[1]
                if text.startswith("json"):
                    text = text[4:]
        text = text.strip()
        j_start = text.find("{")
        j_end = text.rfind("}") + 1
        if j_start >= 0 and j_end > j_start:
            text = text[j_start:j_end]
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            try:
                import json_repair
                parsed = json_repair.loads(text)
            except Exception:
                parsed = None
    except Exception as e:
        logger.error(f"Invitation detection failed for {analysis_id}: {e}")
        parsed = None

    valid_levels = {"none", "minor", "meal", "sponsored", "unknown"}
    if not isinstance(parsed, dict) or parsed.get("level") not in valid_levels:
        parsed = {
            "level": "unknown",
            "label": "No nos consta",
            "detail": "No se ha detectado mención a invitación o patrocinio en el material disponible.",
            "confidence": "low",
            "evidence_quotes": [],
        }
    else:
        # Sanitize fields
        parsed.setdefault("label", "No nos consta")
        parsed.setdefault("detail", "")
        parsed.setdefault("confidence", "low")
        ev = parsed.get("evidence_quotes") or []
        if not isinstance(ev, list):
            ev = []
        parsed["evidence_quotes"] = [str(q)[:280] for q in ev[:3]]

    try:
        doc_ref.update({"invitation_disclosure": parsed})
    except Exception as e:
        logger.warning(f"Could not cache invitation_disclosure: {e}")

    return parsed


async def _gemini_generate_with_fallback(prompt: str, *, temperature: float = 0.4, max_output_tokens: int = 8192, json_mode: bool = True):
    """Try Gemini with main key + 2 backups, fall back to Emergent universal key.
    Returns an object with a `.text` attribute for compatibility with previous calls.
    """
    keys = [
        os.environ.get('GEMINI_API_KEY'),
        os.environ.get('GEMINI_API_KEY_BACKUP'),
        os.environ.get('GEMINI_API_KEY_BACKUP2'),
        os.environ.get('GEMINI_API_KEY_BACKUP3'),
    ]
    keys = [k for k in keys if k]
    last_err = None

    for idx, key in enumerate(keys):
        try:
            client = genai.Client(api_key=key)
            cfg = types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                **({"response_mime_type": "application/json"} if json_mode else {}),
            )
            return await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.5-flash",
                contents=prompt,
                config=cfg,
            )
        except Exception as e:
            last_err = e
            err_text = str(e)
            if any(s in err_text for s in ("PERMISSION_DENIED", "403", "RESOURCE_EXHAUSTED", "429", "quota", "denied")):
                logger.warning(f"Gemini key #{idx + 1} failed ({err_text[:80]}), trying next…")
                continue
            raise

    # Final fallback: Emergent Universal Key
    emergent_key = os.environ.get('EMERGENT_LLM_KEY')
    if emergent_key:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            chat = LlmChat(
                api_key=emergent_key,
                session_id=f"polygraph-{int(datetime.now(timezone.utc).timestamp())}",
                system_message="Eres un asistente que responde EXCLUSIVAMENTE con JSON válido cuando se le pide JSON. Sin markdown, sin texto extra.",
            ).with_model("gemini", "gemini-2.5-flash")
            text = await chat.send_message(UserMessage(text=prompt))
            class _Resp:
                pass
            r = _Resp()
            r.text = text or ""
            logger.info("✅ Used Emergent universal key fallback for Gemini")
            return r
        except Exception as e:
            last_err = e
            logger.error(f"Emergent universal key fallback failed: {e}")

    raise HTTPException(status_code=502, detail=f"All Gemini keys failed: {last_err}")


@api_router.post("/admin/download-project")
async def admin_download_project(
    login: AdminLogin,
    include_secrets: bool = False,
):
    """Download the entire /app project as a zip, streamed.

    - Requires admin credentials in body (same as the existing admin auth).
    - Excludes heavy folders by default (node_modules, .git, build artifacts, caches).
    - Excludes secret files (.env, firebase-credentials.json) unless include_secrets=true.
    """
    if login.username != ADMIN_USERNAME or login.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    import zipfile
    import io
    from fastapi.responses import StreamingResponse

    ROOT = "/app"
    EXCLUDE_DIRS = {
        "node_modules", ".git", ".emergent", "__pycache__", ".pytest_cache",
        ".next", ".turbo", ".cache", "build", "dist", "out", ".vscode",
        "venv", ".venv", "env", ".idea", "tmp", ".ruff_cache", "test_reports",
    }
    EXCLUDE_FILES = {".DS_Store", ".python-version", "yarn-error.log"}
    EXCLUDE_EXTS = {".pyc", ".log", ".lock", ".swp"}
    SECRET_FILES = {".env", "firebase-credentials.json", "youtube-cookies.txt"}

    def _should_skip(rel_path: str, name: str) -> bool:
        parts = rel_path.split(os.sep)
        if any(p in EXCLUDE_DIRS for p in parts):
            return True
        if name in EXCLUDE_FILES:
            return True
        if any(name.endswith(ext) for ext in EXCLUDE_EXTS):
            return True
        if name.endswith(".lock") and name != "yarn.lock":
            return True
        if not include_secrets and name in SECRET_FILES:
            return True
        return False

    buf = io.BytesIO()
    files_added = 0
    total_bytes = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for dirpath, dirnames, filenames in os.walk(ROOT):
            # Prune excluded dirs in-place for efficiency
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
            rel_dir = os.path.relpath(dirpath, ROOT)
            for name in filenames:
                full = os.path.join(dirpath, name)
                rel = os.path.join(rel_dir, name) if rel_dir != "." else name
                if _should_skip(rel_dir if rel_dir != "." else "", name):
                    continue
                try:
                    size = os.path.getsize(full)
                    if size > 25 * 1024 * 1024:  # skip files >25MB
                        continue
                    zf.write(full, arcname=os.path.join("app", rel))
                    files_added += 1
                    total_bytes += size
                except Exception:
                    continue
        # Add a README at the root explaining what's inside
        readme = (
            "# Backup automático del proyecto\n\n"
            f"- Generado: {datetime.now(timezone.utc).isoformat()}\n"
            f"- Archivos incluidos: {files_added}\n"
            f"- Bytes (originales): {total_bytes}\n"
            f"- Secrets incluidos: {include_secrets}\n\n"
            "Excluido: node_modules, .git, build, __pycache__, .env (si no se pidió incluir), firebase-credentials.json.\n"
        )
        zf.writestr("app/BACKUP_README.md", readme)

    buf.seek(0)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"socialhate_project_{'full' if include_secrets else 'safe'}_{stamp}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Files-Count": str(files_added),
        },
    )


@api_router.post("/reality-check/{analysis_id}/reanalyze")
async def reanalyze_reality_check(analysis_id: str):
    """Re-run the AI coherence analysis using previously stored transcript + reviews.
    Useful when the original analysis failed (e.g. Gemini was blocked) but the data was saved.
    Cheap: no scraping, no Places lookup, no RapidAPI calls.
    """
    rc_ref = firestore_db.collection('reality_checks')
    doc_ref = rc_ref.document(analysis_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    data = doc.to_dict()

    video_text = (data.get('transcript_text') or "").strip()
    if not video_text:
        raise HTTPException(status_code=400, detail="Sin transcripción guardada")

    # Build restaurant_info from stored place_info + reviews
    place_info = data.get('place_info') or {}
    reviews_detailed = place_info.get('reviews_detailed') or []
    review_texts = [(r.get('text') or '').strip() for r in reviews_detailed if (r.get('text') or '').strip()]

    restaurant_info = {
        "restaurant_name": data.get('restaurant_name') or place_info.get('display_name') or "",
        "location": place_info.get('formatted_address') or data.get('restaurant_location') or "",
        "rating": place_info.get('rating') or data.get('restaurant_rating'),
        "total_reviews": place_info.get('user_rating_count') or len(review_texts),
        "reviews": review_texts,
        "source": "google_places+local_business_data" if review_texts else "google_places",
    }

    channel_name = data.get('channel_name') or ""

    try:
        result = await analyze_reality_check(video_text, restaurant_info, channel_name)
    except Exception as e:
        logger.error(f"Reanalyze failed for {analysis_id}: {e}")
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    update = {
        "status": "completed",
        "coherence_index": result.get("coherence_index", 50),
        "influencer_sentiment": result.get("influencer_sentiment", {}),
        "community_sentiment": result.get("community_expectation", {}),
        "gap_analysis": result.get("gap_analysis", {}),
        "analysis_summary": result.get("summary", ""),
        "disclaimer": result.get("disclaimer", ""),
        "confidence_level": result.get("confidence_level", "medio"),
        "reanalyzed_at": datetime.now(timezone.utc).isoformat(),
        # Invalidate cached derived data so they rebuild from fresh analysis
        "polygraph_timeline": firestore.DELETE_FIELD,
        "invitation_disclosure": firestore.DELETE_FIELD,
    }
    try:
        doc_ref.update(update)
    except Exception as e:
        logger.warning(f"Could not save reanalysis: {e}")

    return {
        "analysis_id": analysis_id,
        "coherence_index": update["coherence_index"],
        "ok": True,
    }


@api_router.get("/reality-check/{analysis_id}/timeline")
async def get_reality_check_timeline(analysis_id: str, refresh: bool = False):
    """Polygraph timeline: split the video transcript into time-anchored chunks
    and score each chunk's truthfulness against real client reviews.

    Returns:
      {
        "video_id": "...",
        "duration_seconds": int,
        "segments": [
          {
            "start_s": 12.4,
            "end_s": 38.9,
            "text": "lo que dijo el influencer en este tramo (resumido)",
            "score": 78,            # 0=miente, 100=verdad
            "status": "truth|exaggeration|lie|neutral",
            "claim_summary": "frase corta de qué afirma",
            "reason": "qué dicen los clientes sobre esto"
          }, ...
        ]
      }
    """
    reality_checks_ref = firestore_db.collection('reality_checks')
    doc_ref = reality_checks_ref.document(analysis_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    data = doc.to_dict()

    if not refresh and isinstance(data.get('polygraph_timeline'), dict):
        return data['polygraph_timeline']

    video_id = data.get('video_id')
    if not video_id:
        raise HTTPException(status_code=400, detail="No video_id available")

    # 1) Get cues with timestamps
    cues = await get_subtitles_with_timestamps(video_id)
    if not cues:
        # Fallback: distribute the plain transcript across an estimated duration
        plain = (data.get('transcript_text') or "").replace('&nbsp;', ' ')
        # Estimate duration: assume 150 wpm reading speed
        words = plain.split()
        estimated_duration = max(60, int(len(words) / 2.5))  # ~2.5 wps
        chunk_size = max(50, len(words) // 12)
        cues = []
        idx = 0
        per_chunk_seconds = estimated_duration / max(1, math.ceil(len(words) / chunk_size))
        i = 0
        while idx < len(words):
            block = " ".join(words[idx: idx + chunk_size])
            cues.append({
                "start_s": i * per_chunk_seconds,
                "end_s": (i + 1) * per_chunk_seconds,
                "text": block,
            })
            idx += chunk_size
            i += 1
        if not cues:
            raise HTTPException(status_code=400, detail="Sin transcripción disponible para este video")

    total_duration = max((c.get('end_s') or 0) for c in cues) if cues else 0

    # 2) Group cues into ~30s buckets (between 8 and 14 segments total)
    if total_duration <= 0:
        total_duration = sum((c.get('end_s', 0) - c.get('start_s', 0)) for c in cues) or 600
    target_segments = 12 if total_duration > 360 else max(6, int(total_duration / 30))
    bucket_size = total_duration / target_segments
    buckets = []
    for n in range(target_segments):
        b_start = n * bucket_size
        b_end = (n + 1) * bucket_size
        chunk_text = " ".join(c["text"] for c in cues if c["start_s"] >= b_start and c["start_s"] < b_end)
        chunk_text = re.sub(r"\s+", " ", chunk_text).strip()
        if chunk_text:
            buckets.append({"start_s": round(b_start, 1), "end_s": round(b_end, 1), "text": chunk_text})

    if not buckets:
        raise HTTPException(status_code=400, detail="No se pudieron crear segmentos")

    # 3) Build prompt for Gemini
    aligned = data.get('gap_analysis', {}).get('aligned_points') or []
    discrepancies = data.get('gap_analysis', {}).get('main_discrepancies') or []
    positives = data.get('community_sentiment', {}).get('common_positives') or []
    complaints = data.get('community_sentiment', {}).get('common_complaints') or []
    sample_reviews = []
    for r in (data.get('place_info', {}).get('reviews_detailed') or [])[:8]:
        txt = (r.get('text') or '').strip()
        if 30 < len(txt) < 350:
            sample_reviews.append(txt)

    segments_for_ai = [
        {"i": idx, "start": s["start_s"], "end": s["end_s"], "text": s["text"][:600]}
        for idx, s in enumerate(buckets)
    ]

    context_block = {
        "restaurant_name": data.get('restaurant_name'),
        "restaurant_rating": data.get('place_info', {}).get('rating'),
        "aligned_points": aligned[:10],
        "main_discrepancies": discrepancies[:10],
        "client_positives": positives[:10],
        "client_complaints": complaints[:10],
        "sample_reviews": sample_reviews[:6],
    }

    prompt = f"""Eres un detector de mentiras / "polígrafo" para vídeos de influencers gastronómicos.
Te paso TROZOS CRONOLÓGICOS de la transcripción del vídeo (lo que dice el influencer en cada minuto)
y los DATOS REALES del restaurante (lo que opinan los clientes en Google reviews).

Tu tarea: para CADA trozo, decidir si lo que dice cuadra con la realidad.

CONTEXTO REAL DEL RESTAURANTE:
{json.dumps(context_block, ensure_ascii=False, indent=2)}

TROZOS DEL VÍDEO (con su tiempo en segundos):
{json.dumps(segments_for_ai, ensure_ascii=False, indent=2)}

REGLAS:
- "score": 0 (mentira clara) ↔ 100 (totalmente alineado con clientes). Sé estricto, distribuye, no pongas todo a 80-90.
- "status": exactamente uno de: "truth" (cuadra), "exaggeration" (vende humo), "lie" (dice cosas que los clientes contradicen), "neutral" (no afirma nada verificable, intro, intermedio, despedida).
- "claim_summary": 1 frase de máximo 14 palabras resumiendo qué afirma el influencer en ese trozo.
- "reason": 1 frase de máximo 18 palabras explicando por qué lo marcas así, citando si puedes la evidencia (ej. "3 clientes mencionan que el servicio es lento").
- Si en un trozo NO afirma nada verificable (saluda, presenta, agradece, despide), pon status="neutral" y score=50.

Devuelve SOLO JSON válido con esta estructura, sin envolver en markdown:
{{
  "segments": [
    {{ "i": 0, "score": 78, "status": "truth", "claim_summary": "...", "reason": "..." }},
    {{ "i": 1, "score": 35, "status": "lie", "claim_summary": "...", "reason": "..." }}
  ]
}}"""

    gemini_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    try:
        resp = await _gemini_generate_with_fallback(
            prompt, temperature=0.4, max_output_tokens=8192, json_mode=True
        )
        text = (resp.text or "").strip()
        if text.startswith("```"):
            parts = text.split("```")
            if len(parts) > 1:
                text = parts[1]
                if text.startswith("json"):
                    text = text[4:]
        text = text.strip()
        j_start = text.find("{")
        j_end = text.rfind("}") + 1
        if j_start >= 0 and j_end > j_start:
            text = text[j_start:j_end]
        try:
            parsed_ai = json.loads(text)
        except json.JSONDecodeError:
            try:
                import json_repair
                parsed_ai = json_repair.loads(text)
            except Exception:
                parsed_ai = {"segments": []}
    except Exception as e:
        logger.error(f"Polygraph timeline failed: {e}")
        parsed_ai = {"segments": []}

    # Merge AI scoring back into buckets
    ai_by_idx = {s.get("i"): s for s in (parsed_ai.get("segments") or []) if isinstance(s, dict)}
    valid_status = {"truth", "exaggeration", "lie", "neutral"}
    final_segments = []
    for idx, b in enumerate(buckets):
        ai = ai_by_idx.get(idx, {})
        score = ai.get("score")
        if not isinstance(score, (int, float)):
            score = 50
        score = max(0, min(100, int(score)))
        status = ai.get("status") if ai.get("status") in valid_status else (
            "truth" if score >= 70 else "exaggeration" if score >= 45 else "lie" if score < 45 else "neutral"
        )
        final_segments.append({
            "start_s": b["start_s"],
            "end_s": b["end_s"],
            "text": b["text"][:500],
            "score": score,
            "status": status,
            "claim_summary": (ai.get("claim_summary") or "")[:200],
            "reason": (ai.get("reason") or "")[:300],
        })

    result = {
        "video_id": video_id,
        "duration_seconds": int(total_duration),
        "segments": final_segments,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "has_real_timestamps": bool(any("-->" in str(c) for c in [])) or len(cues) > 0 and (cues[0].get('end_s', 0) > 0),
    }

    try:
        doc_ref.update({"polygraph_timeline": result})
    except Exception as e:
        logger.warning(f"Could not cache polygraph_timeline: {e}")

    return result


@api_router.get("/reality-checks")
async def list_reality_checks(limit: int = 20):
    """List recent Reality Check analyses"""
    reality_checks_ref = firestore_db.collection('reality_checks')
    docs = reality_checks_ref.order_by('created_at', direction=firestore.Query.DESCENDING).limit(limit).stream()
    
    results = []
    for doc in docs:
        data = doc.to_dict()
        data.pop('_id', None)
        results.append(data)
    
    return results


@api_router.get("/reality-check-channels")
async def list_reality_check_channels():
    """Aggregated list of influencer channels that have reality checks."""
    reality_checks_ref = firestore_db.collection('reality_checks')
    docs = reality_checks_ref.where('status', '==', 'completed').stream()

    channels: Dict[str, Dict[str, Any]] = {}
    for doc in docs:
        data = doc.to_dict()
        data.pop('_id', None)
        ch = data.get('channel_name') or 'Desconocido'
        entry = channels.setdefault(ch, {
            "channel_name": ch,
            "analyses_count": 0,
            "avg_coherence": 0.0,
            "latest_thumbnail": None,
            "latest_created_at": None,
            "latest_video_title": None,
            "coherence_sum": 0.0,
        })
        entry["analyses_count"] += 1
        entry["coherence_sum"] += float(data.get("coherence_index") or 0)
        created = data.get("created_at") or ""
        if not entry["latest_created_at"] or created > entry["latest_created_at"]:
            entry["latest_created_at"] = created
            entry["latest_thumbnail"] = data.get("thumbnail_url")
            entry["latest_video_title"] = data.get("video_title")

    results = []
    for entry in channels.values():
        count = entry["analyses_count"] or 1
        entry["avg_coherence"] = round(entry["coherence_sum"] / count, 1)
        entry.pop("coherence_sum", None)
        results.append(entry)

    results.sort(key=lambda x: x.get("latest_created_at") or "", reverse=True)
    return results


@api_router.get("/reality-check-channels/{channel_name}")
async def get_reality_check_channel(channel_name: str):
    """Get all reality checks for a specific influencer channel."""
    reality_checks_ref = firestore_db.collection('reality_checks')
    docs = reality_checks_ref.where('channel_name', '==', channel_name).stream()

    analyses = []
    for doc in docs:
        data = doc.to_dict()
        data.pop('_id', None)
        # Strip heavy fields from the list view to keep response light
        data.pop('transcript_text', None)
        data.pop('reviews_list', None)
        analyses.append(data)

    analyses.sort(key=lambda x: x.get("created_at") or "", reverse=True)

    completed = [a for a in analyses if a.get("status") == "completed"]
    avg_coherence = (
        round(sum(float(a.get("coherence_index") or 0) for a in completed) / len(completed), 1)
        if completed else 0.0
    )

    latest_thumb = next((a.get("thumbnail_url") for a in analyses if a.get("thumbnail_url")), None)

    return {
        "channel_name": channel_name,
        "analyses_count": len(analyses),
        "completed_count": len(completed),
        "avg_coherence": avg_coherence,
        "latest_thumbnail": latest_thumb,
        "analyses": analyses,
    }


def _foodie_badge(avg: float) -> Dict[str, str]:
    """Return verdict label + tone + tagline based on coherence average."""
    if avg >= 80:
        return {
            "tier": "top",
            "label": "TOP CREADOR VERIFICADO",
            "tagline": "Sus recomendaciones coinciden casi siempre con la experiencia real.",
            "emoji": "🏆",
            "color": "emerald",
        }
    if avg >= 60:
        return {
            "tier": "reliable",
            "label": "CREADOR FIABLE",
            "tagline": "Sus opiniones son mayoritariamente coherentes con los clientes reales.",
            "emoji": "✅",
            "color": "emerald",
        }
    if avg >= 40:
        return {
            "tier": "mixed",
            "label": "CREADOR IRREGULAR",
            "tagline": "Hay diferencias notables entre lo que dice y lo que opinan los clientes.",
            "emoji": "⚠️",
            "color": "yellow",
        }
    return {
        "tier": "hype",
        "label": "ALTO HYPE · BAJA COHERENCIA",
        "tagline": "Sus reseñas difieren bastante de la experiencia real de los clientes.",
        "emoji": "💥",
        "color": "red",
    }


def _coherence_grade(avg: float) -> str:
    """Letter grade based on coherence index (A+ best → F worst)."""
    if avg >= 90:
        return "A+"
    if avg >= 80:
        return "A"
    if avg >= 70:
        return "B+"
    if avg >= 60:
        return "B"
    if avg >= 50:
        return "C+"
    if avg >= 40:
        return "C"
    if avg >= 25:
        return "D"
    return "F"


@api_router.get("/foodie-card/{channel_slug}")
async def get_foodie_card(channel_slug: str):
    """Public shareable card with a foodie channel's coherence stats."""
    from urllib.parse import unquote
    channel_name = unquote(channel_slug)

    reality_checks_ref = firestore_db.collection('reality_checks')
    docs = list(reality_checks_ref.where('channel_name', '==', channel_name).stream())

    if not docs:
        raise HTTPException(status_code=404, detail="Canal no encontrado")

    analyses = []
    for doc in docs:
        data = doc.to_dict()
        data.pop('_id', None)
        data.pop('transcript_text', None)
        analyses.append(data)

    completed = [a for a in analyses if a.get("status") == "completed" and a.get("coherence_index") is not None]
    if not completed:
        raise HTTPException(status_code=404, detail="Aún no hay análisis completados para este canal")

    avg = round(sum(float(a.get("coherence_index") or 0) for a in completed) / len(completed), 1)
    badge = _foodie_badge(avg)
    grade = _coherence_grade(avg)

    completed_sorted = sorted(completed, key=lambda x: float(x.get("coherence_index") or 0), reverse=True)
    top_3 = completed_sorted[:3]
    bottom_3 = completed_sorted[-3:][::-1] if len(completed_sorted) > 3 else []

    # Trend: compare first half vs second half (by created_at)
    by_date = sorted(completed, key=lambda x: x.get("created_at") or "")
    trend_direction = "stable"
    coherence_trend = 0.0
    if len(by_date) >= 4:
        half = len(by_date) // 2
        first_half_avg = sum(float(a.get("coherence_index") or 0) for a in by_date[:half]) / half
        second_half_avg = sum(float(a.get("coherence_index") or 0) for a in by_date[half:]) / (len(by_date) - half)
        delta = round(second_half_avg - first_half_avg, 1)
        coherence_trend = delta
        if delta >= 5:
            trend_direction = "up"  # improving (more coherent)
        elif delta <= -5:
            trend_direction = "down"  # degrading

    def slim(a):
        return {
            "id": a.get("id"),
            "video_title": a.get("video_title"),
            "thumbnail_url": a.get("thumbnail_url"),
            "restaurant_name": a.get("restaurant_name"),
            "coherence_index": a.get("coherence_index"),
        }

    # Aggregate stats
    total_reviews_contrasted = sum(int(a.get("reviews_count") or 0) for a in completed)
    restaurants_analyzed = len({a.get("restaurant_name") for a in completed if a.get("restaurant_name")})

    latest = max(completed, key=lambda x: x.get("created_at") or "")
    latest_thumbnail = latest.get("thumbnail_url")
    first = min(completed, key=lambda x: x.get("created_at") or "")
    verified_date = first.get("created_at")

    return {
        "channel_name": channel_name,
        "channel_slug": channel_slug,
        "avg_coherence": avg,
        "coherence_grade": grade,
        "analyses_count": len(completed),
        "restaurants_analyzed": restaurants_analyzed,
        "total_reviews_contrasted": total_reviews_contrasted,
        "latest_thumbnail": latest_thumbnail,
        "channel_avatar": latest_thumbnail,
        "badge": badge,
        "trend_direction": trend_direction,
        "coherence_trend": coherence_trend,
        "verified_date": verified_date,
        "is_verified": True,
        "top_3": [slim(a) for a in top_3],
        "bottom_3": [slim(a) for a in bottom_3],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ============= LONG-FORM YOUTUBE SCRIPT (10 MIN) =============

@api_router.post("/long-form-script/{channel_db_id}")
async def generate_long_form_script(channel_db_id: str):
    """Generate a 10-minute YouTube polemic script for a channel using Gemini AI.

    Returns a structured JSON with 8 sections following the retention-optimized
    structure (hook, context, stats, evolution, qualitative, comparison, conclusion, CTA).
    """
    # 1. Load channel
    channel = await db.channels.find_one({"id": channel_db_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    youtube_channel_id = channel.get("channel_id")
    channel_name = channel.get("name", "este canal")

    # 2. Aggregate stats
    pipeline = [
        {"$match": {"channel_id": youtube_channel_id, "status": "completed"}},
        {"$group": {
            "_id": None,
            "total_videos": {"$sum": 1},
            "avg_hate": {"$avg": "$hate_percentage"},
            "avg_positive": {"$avg": "$positive_percentage"},
            "avg_negative": {"$avg": "$negative_percentage"},
            "total_comments": {"$sum": "$total_comments_analyzed"},
            "total_views": {"$sum": "$view_count"},
            "max_hate": {"$max": "$hate_percentage"},
            "min_hate": {"$min": "$hate_percentage"},
        }}
    ]
    agg = await db.analyses.aggregate(pipeline).to_list(1)
    stats = agg[0] if agg else {}

    # 3. Fetch ordered analyses for evolution & top/bottom videos
    cursor = db.analyses.find(
        {"channel_id": youtube_channel_id, "status": "completed"},
        {"_id": 0, "video_title": 1, "hate_percentage": 1, "positive_percentage": 1,
         "total_comments_analyzed": 1, "view_count": 1, "created_at": 1, "id": 1,
         "trending_topics": 1, "top_words": 1}
    ).sort("created_at", 1)
    analyses = await cursor.to_list(length=200)

    if not analyses:
        raise HTTPException(status_code=400, detail="No completed analyses for this channel yet")

    sorted_by_hate = sorted(analyses, key=lambda a: a.get("hate_percentage") or 0, reverse=True)
    top_hate_videos = [{
        "title": a.get("video_title", "")[:120],
        "hate": round(a.get("hate_percentage") or 0, 1),
        "comments": a.get("total_comments_analyzed") or 0,
    } for a in sorted_by_hate[:5]]
    real_max_hate = round(sorted_by_hate[0].get("hate_percentage") or 0, 1) if sorted_by_hate else 0

    # Evolution snapshots (first 3 vs last 3)
    first_three = analyses[:3]
    last_three = analyses[-3:]
    first_avg = sum((a.get("hate_percentage") or 0) for a in first_three) / max(len(first_three), 1)
    last_avg = sum((a.get("hate_percentage") or 0) for a in last_three) / max(len(last_three), 1)
    trend_delta = round(last_avg - first_avg, 1)

    # Aggregate trending topics & words across analyses (top 10)
    topic_counter: Dict[str, int] = {}
    word_counter: Dict[str, int] = {}
    for a in analyses[-30:]:  # most recent 30 to keep it fresh
        for t in (a.get("trending_topics") or [])[:10]:
            name = t if isinstance(t, str) else t.get("topic") or t.get("name")
            if name:
                topic_counter[name] = topic_counter.get(name, 0) + 1
        for w in (a.get("top_words") or [])[:10]:
            name = w if isinstance(w, str) else w.get("word") or w.get("text")
            if name:
                word_counter[name] = word_counter.get(name, 0) + 1
    top_topics = sorted(topic_counter.items(), key=lambda x: -x[1])[:8]
    top_words = sorted(word_counter.items(), key=lambda x: -x[1])[:10]

    # Sample negative/hate comments from top hate video for qualitative section
    sample_comments: List[str] = []
    if sorted_by_hate:
        top_hate_id = sorted_by_hate[0].get("id")
        if top_hate_id:
            full_top = await db.analyses.find_one({"id": top_hate_id}, {"_id": 0, "comments": 1})
            if full_top:
                for c in (full_top.get("comments") or [])[:300]:
                    if c.get("sentiment_label") in ("negative", "hate") or c.get("is_hate"):
                        txt = (c.get("text") or "").strip()
                        if 8 < len(txt) < 220:
                            sample_comments.append(txt)
                        if len(sample_comments) >= 12:
                            break

    # 4. Build prompt for Gemini
    avg_hate = round(stats.get("avg_hate") or 0, 1)
    avg_pos = round(stats.get("avg_positive") or 0, 1)
    avg_neg = round(stats.get("avg_negative") or 0, 1)
    total_comments = int(stats.get("total_comments") or 0)
    total_views = int(stats.get("total_views") or 0)
    total_videos = int(stats.get("total_videos") or len(analyses))
    max_hate = round(stats.get("max_hate") or 0, 1)
    if not max_hate:
        max_hate = real_max_hate

    payload_for_ai = {
        "channel_name": channel_name,
        "subscribers": channel.get("subscriber_count"),
        "category": channel.get("category"),
        "total_videos_analyzed": total_videos,
        "avg_hate_pct": avg_hate,
        "avg_positive_pct": avg_pos,
        "avg_negative_pct": avg_neg,
        "max_hate_pct": max_hate,
        "total_comments_analyzed": total_comments,
        "total_views": total_views,
        "trend_delta_recent_vs_old": trend_delta,
        "top_hate_videos": top_hate_videos,
        "top_topics": [t for t, _ in top_topics],
        "top_words": [w for w, _ in top_words],
        "sample_hate_comments": sample_comments[:10],
    }

    prompt = f"""Eres un guionista de YouTube ESPAÑOL especializado en vídeos polémicos de análisis de influencers, estilo "Quantum Fracture meets True Crime meets Jordi Wild". Tu trabajo es crear un GUIÓN de 10 MINUTOS para un vídeo donde el creador analiza el "hate" de un canal usando datos REALES de SocialHate.

OBJETIVO: máxima retención. Tono provocador pero inteligente. Frases cortas. Cliffhangers. Datos = munición narrativa.

DATOS REALES DEL CANAL "{channel_name}" (úsalos literalmente, no inventes números):
{json.dumps(payload_for_ai, ensure_ascii=False, indent=2)}

ESTRUCTURA OBLIGATORIA (8 secciones, 10 min totales):
1. hook (0:00-1:00) - Dato escandaloso + pregunta sin respuesta. SIN explicar nada todavía.
2. context (1:00-2:30) - Quién es {channel_name}, momento actual, por qué importa AHORA.
3. numbers (2:30-4:30) - Los números brutos de SocialHate. Datos sobre la mesa. Comparación con medias.
4. evolution (4:30-6:30) - Cómo ha cambiado el hate en el tiempo. Conecta con eventos. Storytelling con datos.
5. qualitative (6:30-8:30) - DE QUÉ habla el hate. Lee 2-3 comentarios reales (cita los del payload). Opinión personal.
6. comparison (8:30-9:30) - Compara este canal con la media española / otros del mismo nicho.
7. conclusion (9:30-9:50) - Veredicto en una frase. Lapidario.
8. cta (9:50-10:00) - Pide al espectador que sugiera el siguiente canal en comentarios.

REGLAS IMPORTANTES:
- "script" = lo que el creador LEE en cámara, párrafo continuo, listo para teleprompter, ~150 palabras por minuto.
- "devil_lines" = 3-5 frases CORTÍSIMAS (max 12 palabras cada una) que aparecen en bocadillo del diablito mascota mientras el creador habla. Punzantes, memorables.
- "bullets" = 3-4 datos clave que aparecen en pantalla como overlays.
- "headline" = título grande de la sección (max 6 palabras).
- "b_roll_suggestions" = 2-3 sugerencias de qué mostrar en pantalla (clips, capturas).
- USA los datos del payload literalmente. Si max_hate_pct=44.6 di "44,6%", no redondees a 45.
- NO inventes nombres de vídeos: usa los de top_hate_videos.
- Si no hay datos suficientes para una sección, sé honesto pero mantén el ritmo.

Devuelve SOLO JSON válido, sin markdown:
{{
  "title": "Título del vídeo de YouTube (max 70 caracteres, polémico, con número)",
  "subtitle": "Subtítulo / hook bajo el título",
  "thumbnail_hook": "Texto enorme para la miniatura (max 4 palabras)",
  "sections": [
    {{
      "id": "hook",
      "name": "Gancho",
      "start_time": "0:00",
      "end_time": "1:00",
      "duration_seconds": 60,
      "headline": "...",
      "script": "...",
      "devil_lines": ["...", "..."],
      "bullets": ["...", "..."],
      "b_roll_suggestions": ["...", "..."]
    }},
    {{ "id": "context", ... }},
    {{ "id": "numbers", ... }},
    {{ "id": "evolution", ... }},
    {{ "id": "qualitative", ... }},
    {{ "id": "comparison", ... }},
    {{ "id": "conclusion", ... }},
    {{ "id": "cta", ... }}
  ]
}}"""

    gemini_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    client = genai.Client(api_key=gemini_key)
    import json_repair  # robust JSON repair for AI outputs

    async def _ask(prompt_text: str, temperature: float = 0.9):
        return await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt_text,
            config=types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=16384,
                response_mime_type="application/json",
            ),
        )

    parsed = None
    last_err = None
    for attempt in range(3):
        try:
            resp = await _ask(prompt, temperature=0.85 if attempt == 0 else 0.6)
            text = (resp.text or "").strip()
            if text.startswith("```"):
                parts = text.split("```")
                if len(parts) > 1:
                    text = parts[1]
                    if text.startswith("json"):
                        text = text[4:]
            text = text.strip()
            j_start = text.find("{")
            j_end = text.rfind("}") + 1
            if j_start >= 0 and j_end > j_start:
                text = text[j_start:j_end]
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                # Repair malformed JSON (handles unescaped quotes, trailing commas, etc.)
                parsed = json_repair.loads(text)
            if parsed and isinstance(parsed, dict) and parsed.get("sections"):
                break
            parsed = None
        except Exception as e:
            last_err = e
            logger.warning(f"Long-form attempt {attempt+1} failed: {e}")
            parsed = None

    if not parsed or not parsed.get("sections"):
        logger.error(f"Long-form script generation failed after retries: {last_err}")
        raise HTTPException(
            status_code=500,
            detail="No se pudo generar el guión tras varios intentos. Vuelve a intentarlo en unos segundos."
        )

    # Attach raw stats so the frontend can render overlays
    parsed["channel"] = {
        "id": channel_db_id,
        "name": channel_name,
        "thumbnail": channel.get("thumbnail_url") or channel.get("avatar_url"),
        "subscribers": channel.get("subscriber_count"),
        "category": channel.get("category"),
    }
    parsed["stats"] = {
        "avg_hate_pct": avg_hate,
        "avg_positive_pct": avg_pos,
        "avg_negative_pct": avg_neg,
        "max_hate_pct": max_hate,
        "total_videos": total_videos,
        "total_comments": total_comments,
        "total_views": total_views,
        "trend_delta": trend_delta,
        "top_hate_videos": top_hate_videos,
        "top_topics": [t for t, _ in top_topics],
        "top_words": [w for w, _ in top_words],
    }
    parsed["generated_at"] = datetime.now(timezone.utc).isoformat()

    return parsed


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    # Firebase doesn't need explicit close
    pass
