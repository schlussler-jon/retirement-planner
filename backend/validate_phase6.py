#!/usr/bin/env python3
"""
Phase 6 Validation Script

This script validates that Google OAuth and Drive integration is set up correctly.
Note: This validates the code structure, not the OAuth flow (which requires credentials).
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))


def main():
    """Run validation tests."""
    print("="*70)
    print("PHASE 6 VALIDATION - Google OAuth & Drive")
    print("="*70)
    print()

    try:
        print("✓ Testing Imports...")
        
        # Test auth imports
        from auth.config import get_oauth_settings
        from auth.oauth import GoogleUser, configure_oauth
        from auth.session import create_session, get_session, delete_session
        print("  ✓ Auth modules imported")
        
        # Test drive imports
        from drive.client import DriveClient
        print("  ✓ Drive module imported")
        
        # Test endpoint imports
        from api.endpoints.auth import router as auth_router
        from api.endpoints.drive import router as drive_router
        print("  ✓ API endpoints imported")
        
        print()
        print("✓ Testing Configuration...")
        
        # Test settings
        settings = get_oauth_settings()
        print(f"  ✓ OAuth redirect URI: {settings.google_redirect_uri}")
        print(f"  ✓ Session max age: {settings.session_max_age}s")
        print(f"  ✓ Drive folder: {settings.drive_folder_name}")
        
        print()
        print("✓ Testing Session Management...")
        
        # Create mock user
        user_data = {
            'sub': '123456',
            'email': 'test@example.com',
            'name': 'Test User',
            'email_verified': True
        }
        user = GoogleUser(user_data)
        print(f"  ✓ Created user: {user.email}")
        
        # Create session
        session_id = create_session(user, "mock_token")
        print(f"  ✓ Created session: {session_id[:16]}...")
        
        # Retrieve session
        session = get_session(session_id)
        assert session is not None
        assert session['user']['email'] == 'test@example.com'
        print("  ✓ Retrieved session")
        
        # Delete session
        deleted = delete_session(session_id)
        assert deleted is True
        print("  ✓ Deleted session")
        
        # Verify deleted
        session = get_session(session_id)
        assert session is None
        print("  ✓ Verified session deleted")
        
        print()
        print("✓ Testing OAuth Configuration (without credentials)...")
        
        # This won't actually configure OAuth without credentials
        # but will test that the function doesn't crash
        configure_oauth()
        print("  ✓ OAuth configuration callable")
        
        print()
        print("="*70)
        print("✅ PHASE 6 CODE VALIDATION PASSED!")
        print("="*70)
        print()
        print("Note: To fully test OAuth and Drive integration, you need to:")
        print("  1. Set up Google Cloud Project")
        print("  2. Enable Google Drive API")
        print("  3. Create OAuth credentials")
        print("  4. Configure .env with your credentials")
        print("  5. Start server: uvicorn api.main:app --reload")
        print("  6. Login at: http://localhost:8000/api/auth/login")
        print()
        print("See PHASE_6_README.md for detailed setup instructions!")
        print()
        
        return 0
        
    except Exception as e:
        print()
        print("="*70)
        print("❌ VALIDATION FAILED!")
        print("="*70)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
