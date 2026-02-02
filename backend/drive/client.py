"""
Google Drive integration.

Handles saving and loading scenarios to/from Google Drive.
"""

from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload
from google.oauth2.credentials import Credentials
from typing import Optional, List, Dict, Any
import io
import json
import logging

from auth.config import get_oauth_settings
from auth.session import get_session

logger = logging.getLogger(__name__)
settings = get_oauth_settings()


class DriveClient:
    """
    Google Drive client for scenario storage.
    
    Stores scenarios as JSON files in a dedicated folder.
    """
    
    def __init__(self, access_token: str):
        """
        Initialize Drive client with OAuth token.
        
        Args:
            access_token: OAuth access token
        """
        credentials = Credentials(token=access_token)
        self.service = build('drive', 'v3', credentials=credentials)
        self.folder_id: Optional[str] = None
    
    def _get_or_create_folder(self) -> str:
        """
        Get or create the app's folder in Drive.
        
        Returns:
            Folder ID
        """
        if self.folder_id:
            return self.folder_id
        
        # Search for existing folder
        query = (
            f"name='{settings.drive_folder_name}' and "
            f"mimeType='application/vnd.google-apps.folder' and "
            f"trashed=false"
        )
        
        results = self.service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        files = results.get('files', [])
        
        if files:
            # Folder exists
            self.folder_id = files[0]['id']
            logger.info(f"Found existing folder: {self.folder_id}")
        else:
            # Create folder
            file_metadata = {
                'name': settings.drive_folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            
            folder = self.service.files().create(
                body=file_metadata,
                fields='id'
            ).execute()
            
            self.folder_id = folder['id']
            logger.info(f"Created new folder: {self.folder_id}")
        
        return self.folder_id
    
    def save_scenario(self, scenario_id: str, scenario_data: Dict[str, Any]) -> str:
        """
        Save scenario to Google Drive.
        
        Args:
            scenario_id: Scenario identifier
            scenario_data: Complete scenario data
            
        Returns:
            Drive file ID
        """
        folder_id = self._get_or_create_folder()
        
        # Prepare file content
        file_content = json.dumps(scenario_data, indent=2)
        file_name = f"{scenario_id}.json"
        
        # Check if file already exists
        query = (
            f"name='{file_name}' and "
            f"'{folder_id}' in parents and "
            f"trashed=false"
        )
        
        results = self.service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        files = results.get('files', [])
        
        # Prepare file metadata
        file_metadata = {
            'name': file_name,
            'parents': [folder_id]
        }
        
        # Create file content
        media = MediaFileUpload(
            io.BytesIO(file_content.encode('utf-8')),
            mimetype='application/json',
            resumable=True
        )
        
        if files:
            # Update existing file
            file_id = files[0]['id']
            file = self.service.files().update(
                fileId=file_id,
                media_body=media
            ).execute()
            logger.info(f"Updated scenario in Drive: {file_id}")
        else:
            # Create new file
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()
            logger.info(f"Created scenario in Drive: {file['id']}")
        
        return file.get('id')
    
    def load_scenario(self, scenario_id: str) -> Optional[Dict[str, Any]]:
        """
        Load scenario from Google Drive.
        
        Args:
            scenario_id: Scenario identifier
            
        Returns:
            Scenario data if found, None otherwise
        """
        folder_id = self._get_or_create_folder()
        file_name = f"{scenario_id}.json"
        
        # Find file
        query = (
            f"name='{file_name}' and "
            f"'{folder_id}' in parents and "
            f"trashed=false"
        )
        
        results = self.service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        files = results.get('files', [])
        
        if not files:
            logger.warning(f"Scenario not found in Drive: {scenario_id}")
            return None
        
        # Download file content
        file_id = files[0]['id']
        request = self.service.files().get_media(fileId=file_id)
        
        file_content = io.BytesIO()
        downloader = MediaIoBaseDownload(file_content, request)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        # Parse JSON
        file_content.seek(0)
        scenario_data = json.loads(file_content.read().decode('utf-8'))
        
        logger.info(f"Loaded scenario from Drive: {scenario_id}")
        return scenario_data
    
    def list_scenarios(self) -> List[Dict[str, Any]]:
        """
        List all scenarios in Drive.
        
        Returns:
            List of scenario metadata
        """
        folder_id = self._get_or_create_folder()
        
        # Find all JSON files in folder
        query = (
            f"'{folder_id}' in parents and "
            f"mimeType='application/json' and "
            f"trashed=false"
        )
        
        results = self.service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name, modifiedTime, size)'
        ).execute()
        
        files = results.get('files', [])
        
        scenarios = []
        for file in files:
            # Extract scenario ID from filename
            scenario_id = file['name'].replace('.json', '')
            
            scenarios.append({
                'scenario_id': scenario_id,
                'file_id': file['id'],
                'modified_time': file.get('modifiedTime'),
                'size': file.get('size')
            })
        
        return scenarios
    
    def delete_scenario(self, scenario_id: str) -> bool:
        """
        Delete scenario from Google Drive.
        
        Args:
            scenario_id: Scenario identifier
            
        Returns:
            True if deleted, False if not found
        """
        folder_id = self._get_or_create_folder()
        file_name = f"{scenario_id}.json"
        
        # Find file
        query = (
            f"name='{file_name}' and "
            f"'{folder_id}' in parents and "
            f"trashed=false"
        )
        
        results = self.service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        files = results.get('files', [])
        
        if not files:
            return False
        
        # Delete file
        file_id = files[0]['id']
        self.service.files().delete(fileId=file_id).execute()
        
        logger.info(f"Deleted scenario from Drive: {scenario_id}")
        return True


def get_drive_client(session_id: str) -> Optional[DriveClient]:
    """
    Get Drive client for current session.
    
    Args:
        session_id: Session identifier
        
    Returns:
        DriveClient if authenticated, None otherwise
    """
    from auth.session import get_session
    
    session = get_session(session_id)
    if not session:
        return None
    
    access_token = session.get('access_token')
    if not access_token:
        return None
    
    return DriveClient(access_token)
