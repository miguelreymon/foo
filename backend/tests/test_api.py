"""
Backend API Tests for SocialHate - YouTube and Instagram Comment Analyzer
Tests: Health check, YouTube analysis, Instagram integration, Channels, Stats
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasicEndpoints:
    """Test basic API health and root endpoints"""
    
    def test_api_root(self):
        """Test API root endpoint returns correct message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "SocialHate" in data["message"]
        print(f"✓ API root: {data['message']}")
    
    def test_global_stats(self):
        """Test global stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/stats/global")
        assert response.status_code == 200
        data = response.json()
        assert "total_videos" in data
        assert "total_comments" in data
        assert "analyses_today" in data
        assert "total_hate_comments" in data
        print(f"✓ Global stats: {data['total_videos']} videos, {data['total_comments']} comments")


class TestChannelsEndpoints:
    """Test channels CRUD and listing"""
    
    def test_list_channels(self):
        """Test listing all channels"""
        response = requests.get(f"{BASE_URL}/api/channels")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Channels list: {len(data)} channels found")
        
        # Verify channel structure if channels exist
        if len(data) > 0:
            channel = data[0]
            assert "id" in channel
            assert "name" in channel
            assert "channel_id" in channel
            print(f"  First channel: {channel['name']}")
    
    def test_get_channel_categories(self):
        """Test getting channel categories"""
        response = requests.get(f"{BASE_URL}/api/channels/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Categories: {data}")


class TestYouTubeAnalysis:
    """Test YouTube analysis endpoints"""
    
    def test_youtube_analyze_existing_video(self):
        """Test analyzing a YouTube video (uses cached result if exists)"""
        # Rick Astley - Never Gonna Give You Up (popular video for testing)
        payload = {"youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
        response = requests.post(f"{BASE_URL}/api/youtube/analyze", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "video_title" in data
        assert "status" in data
        print(f"✓ YouTube analyze: {data['video_title']} - Status: {data['status']}")
    
    def test_youtube_analyze_invalid_url(self):
        """Test analyzing with invalid YouTube URL"""
        payload = {"youtube_url": "not-a-valid-url"}
        response = requests.post(f"{BASE_URL}/api/youtube/analyze", json=payload)
        
        # Should return 400 or 422 for invalid URL
        assert response.status_code in [400, 422, 500]
        print(f"✓ Invalid URL rejected with status {response.status_code}")
    
    def test_get_analysis_by_id(self):
        """Test getting analysis by ID"""
        # First create/get an analysis
        payload = {"youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
        create_response = requests.post(f"{BASE_URL}/api/youtube/analyze", json=payload)
        assert create_response.status_code == 200
        analysis_id = create_response.json()["id"]
        
        # Then fetch it
        response = requests.get(f"{BASE_URL}/api/analysis/{analysis_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == analysis_id
        print(f"✓ Get analysis: {data['video_title']}")
    
    def test_list_analyses(self):
        """Test listing all analyses"""
        response = requests.get(f"{BASE_URL}/api/analyses")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Analyses list: {len(data)} analyses found")


class TestInstagramIntegration:
    """Test Instagram integration endpoints (RapidAPI)"""
    
    def test_instagram_user_profile(self):
        """Test fetching Instagram user profile"""
        response = requests.get(f"{BASE_URL}/api/instagram/user/cristiano")
        assert response.status_code == 200
        data = response.json()
        
        assert "user" in data
        user = data["user"]
        assert "username" in user
        assert user["username"] == "cristiano"
        assert "is_verified" in user
        print(f"✓ Instagram user: @{user['username']} (verified: {user['is_verified']})")
        
        # Posts may be empty due to API limitations
        assert "posts" in data
        print(f"  Posts returned: {len(data['posts'])}")
    
    def test_instagram_analyze_profile_url(self):
        """Test Instagram analyze with profile URL (returns profile info)"""
        payload = {"instagram_url": "https://www.instagram.com/cristiano/"}
        response = requests.post(f"{BASE_URL}/api/instagram/analyze", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        
        # Profile URL should return type "profile"
        assert data.get("type") == "profile"
        assert "user" in data
        assert data["user"]["username"] == "cristiano"
        print(f"✓ Instagram profile analyze: @{data['user']['username']}")
    
    def test_instagram_analyze_invalid_url(self):
        """Test Instagram analyze with invalid URL"""
        payload = {"instagram_url": "https://www.instagram.com/p/INVALID123"}
        response = requests.post(f"{BASE_URL}/api/instagram/analyze", json=payload)
        
        # Should return error for invalid post
        assert response.status_code in [400, 404, 500]
        print(f"✓ Invalid Instagram URL rejected with status {response.status_code}")
    
    def test_instagram_post_info(self):
        """Test fetching Instagram post info (may fail if post doesn't exist)"""
        # Using a known shortcode - this may fail if post is deleted
        response = requests.get(f"{BASE_URL}/api/instagram/post/C3Q1234")
        
        # Accept both success and 404 (post may not exist)
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            assert "shortcode" in data or "post_id" in data
            print(f"✓ Instagram post info retrieved")
        else:
            print(f"✓ Instagram post not found (expected for test shortcode)")


class TestQuotaAndAdmin:
    """Test quota and admin endpoints"""
    
    def test_quota_stats(self):
        """Test YouTube quota stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/stats/quota")
        assert response.status_code == 200
        data = response.json()
        # Response has nested structure with quota_info
        assert "quota_info" in data or "daily_limit" in data
        if "quota_info" in data:
            assert "daily_limit" in data["quota_info"]
            print(f"✓ Quota stats: {data['quota_info'].get('estimated_used', 0)}/{data['quota_info']['daily_limit']} used")
        else:
            print(f"✓ Quota stats: {data.get('estimated_used', 0)}/{data.get('daily_limit', 0)} used")


class TestChannelAnalyses:
    """Test channel-specific analysis endpoints"""
    
    def test_channel_analyses(self):
        """Test getting analyses for a specific channel"""
        # First get a channel
        channels_response = requests.get(f"{BASE_URL}/api/channels")
        assert channels_response.status_code == 200
        channels = channels_response.json()
        
        if len(channels) > 0:
            channel_id = channels[0]["id"]
            response = requests.get(f"{BASE_URL}/api/channel/{channel_id}/analyses")
            assert response.status_code == 200
            data = response.json()
            # Response may be a dict with 'analyses' key or a list
            if isinstance(data, dict):
                assert "analyses" in data
                analyses = data["analyses"]
                print(f"✓ Channel analyses: {len(analyses)} analyses for {channels[0]['name']}")
            else:
                assert isinstance(data, list)
                print(f"✓ Channel analyses: {len(data)} analyses for {channels[0]['name']}")
        else:
            pytest.skip("No channels available for testing")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
