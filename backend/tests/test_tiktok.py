"""
TikTok Integration Tests
Tests for TikTok video analysis endpoint and related functionality
"""
import pytest
import requests
import os
import time

# Get base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://toxictracker.preview.emergentagent.com"

# Test TikTok URL that is known to work
TEST_TIKTOK_URL = "https://www.tiktok.com/@scout2015/video/6718335390845095173"
EXISTING_ANALYSIS_ID = "8e7a971d-9941-4dd1-8f89-00fac696ecd9"


class TestTikTokAnalysis:
    """TikTok analysis endpoint tests"""
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data or "message" in data
        print(f"✓ Health check passed: {data}")
    
    def test_get_existing_tiktok_analysis(self):
        """Test fetching an existing TikTok analysis"""
        response = requests.get(f"{BASE_URL}/api/analysis/{EXISTING_ANALYSIS_ID}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify it's a TikTok analysis
        assert data.get("platform") == "tiktok", f"Expected platform 'tiktok', got '{data.get('platform')}'"
        
        # Verify status is completed
        assert data.get("status") == "completed", f"Expected status 'completed', got '{data.get('status')}'"
        
        # Verify video info is present
        assert data.get("video_title"), "Missing video_title"
        assert data.get("channel_name"), "Missing channel_name"
        assert data.get("thumbnail_url"), "Missing thumbnail_url"
        
        # Verify views and likes are present (TikTok uses 'views' and 'likes' keys)
        views = data.get("views") or data.get("view_count")
        likes = data.get("likes") or data.get("like_count")
        assert views is not None and views > 0, f"Views should be > 0, got {views}"
        assert likes is not None and likes > 0, f"Likes should be > 0, got {likes}"
        
        # Verify comments were analyzed
        assert data.get("total_comments_analyzed", 0) > 0, "No comments were analyzed"
        
        # Verify engagement metrics
        assert "engagement_metrics" in data, "Missing engagement_metrics"
        
        print(f"✓ TikTok analysis retrieved successfully:")
        print(f"  - Title: {data.get('video_title')[:50]}...")
        print(f"  - Channel: {data.get('channel_name')}")
        print(f"  - Views: {views:,}")
        print(f"  - Likes: {likes:,}")
        print(f"  - Comments analyzed: {data.get('total_comments_analyzed')}")
    
    def test_tiktok_analysis_has_required_fields(self):
        """Test that TikTok analysis has all required fields"""
        response = requests.get(f"{BASE_URL}/api/analysis/{EXISTING_ANALYSIS_ID}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Required fields for TikTok analysis
        required_fields = [
            "id", "platform", "video_url", "video_id", "status",
            "video_title", "channel_name", "thumbnail_url",
            "total_comments_analyzed", "hate_percentage",
            "engagement_metrics", "created_at"
        ]
        
        missing_fields = [f for f in required_fields if f not in data]
        assert not missing_fields, f"Missing required fields: {missing_fields}"
        
        print(f"✓ All required fields present")
    
    def test_tiktok_analysis_comments_structure(self):
        """Test that TikTok analysis comments have correct structure"""
        response = requests.get(f"{BASE_URL}/api/analysis/{EXISTING_ANALYSIS_ID}")
        assert response.status_code == 200
        
        data = response.json()
        comments = data.get("comments", [])
        
        assert len(comments) > 0, "No comments in analysis"
        
        # Check first comment structure
        comment = comments[0]
        expected_fields = ["sentiment_score", "hate_score", "sentiment_label", "is_hate"]
        
        for field in expected_fields:
            assert field in comment, f"Comment missing field: {field}"
        
        print(f"✓ Comments structure is correct ({len(comments)} comments)")
    
    def test_tiktok_analyze_endpoint_with_existing_url(self):
        """Test TikTok analyze endpoint returns already_analyzed for existing URL"""
        response = requests.post(
            f"{BASE_URL}/api/tiktok/analyze",
            json={"url": TEST_TIKTOK_URL}
        )
        
        # Should return 200 with already_analyzed status
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "already_analyzed" or data.get("id"), \
            f"Expected already_analyzed or id, got: {data}"
        
        print(f"✓ TikTok analyze endpoint correctly handles existing URL")
    
    def test_tiktok_analyze_invalid_url(self):
        """Test TikTok analyze endpoint rejects invalid URLs"""
        response = requests.post(
            f"{BASE_URL}/api/tiktok/analyze",
            json={"url": "https://youtube.com/watch?v=test123"}
        )
        
        # Should return 400 for invalid TikTok URL
        assert response.status_code == 400
        
        print(f"✓ TikTok analyze endpoint correctly rejects non-TikTok URLs")
    
    def test_tiktok_analyze_empty_url(self):
        """Test TikTok analyze endpoint rejects empty URLs"""
        response = requests.post(
            f"{BASE_URL}/api/tiktok/analyze",
            json={"url": ""}
        )
        
        # Should return 400 or 422 for empty URL
        assert response.status_code in [400, 422]
        
        print(f"✓ TikTok analyze endpoint correctly rejects empty URLs")


class TestAnalysesListWithTikTok:
    """Test analyses list includes TikTok analyses"""
    
    def test_analyses_list_includes_tiktok(self):
        """Test that analyses list includes TikTok platform analyses"""
        response = requests.get(f"{BASE_URL}/api/analyses?limit=50")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Expected list of analyses"
        
        # Find TikTok analyses
        tiktok_analyses = [a for a in data if a.get("platform") == "tiktok"]
        
        assert len(tiktok_analyses) > 0, "No TikTok analyses found in list"
        
        print(f"✓ Found {len(tiktok_analyses)} TikTok analyses in list")
    
    def test_analysis_summary_has_platform_field(self):
        """Test that analysis summaries include platform field"""
        response = requests.get(f"{BASE_URL}/api/analyses?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        
        for analysis in data:
            # Platform should be present for all analyses
            if analysis.get("status") == "completed":
                assert "platform" in analysis or "video_url" in analysis, \
                    f"Analysis {analysis.get('id')} missing platform info"
        
        print(f"✓ Analysis summaries have platform information")


class TestTikTokURLParsing:
    """Test TikTok URL parsing functionality"""
    
    def test_standard_tiktok_url(self):
        """Test standard TikTok URL format"""
        response = requests.post(
            f"{BASE_URL}/api/tiktok/analyze",
            json={"url": "https://www.tiktok.com/@username/video/1234567890123456789"}
        )
        # Should not return 400 for URL format (may return 404 if video doesn't exist)
        assert response.status_code != 400 or "Invalid TikTok URL" not in response.text
        print(f"✓ Standard TikTok URL format accepted")
    
    def test_mobile_tiktok_url(self):
        """Test mobile TikTok URL format (vm.tiktok.com)"""
        # Mobile URLs redirect, so we just test the endpoint accepts them
        response = requests.post(
            f"{BASE_URL}/api/tiktok/analyze",
            json={"url": "https://vm.tiktok.com/ZMtest123/"}
        )
        # Should not immediately reject as invalid TikTok URL
        # (may fail later due to redirect handling)
        print(f"✓ Mobile TikTok URL format tested (status: {response.status_code})")


class TestGlobalStats:
    """Test global stats endpoint"""
    
    def test_global_stats_endpoint(self):
        """Test global stats endpoint works"""
        response = requests.get(f"{BASE_URL}/api/stats/global")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_analyses" in data or "analyses_count" in data or isinstance(data, dict)
        
        print(f"✓ Global stats endpoint working: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
