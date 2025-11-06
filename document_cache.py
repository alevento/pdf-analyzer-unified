"""
Document Cache Manager using SQLite
Stores PDF analysis results to avoid re-processing
"""

import sqlite3
import hashlib
import json
from datetime import datetime
from typing import Optional, Dict, List
import os


class DocumentCache:
    def __init__(self, db_path='document_cache.db'):
        """Initialize document cache with SQLite database"""
        self.db_path = db_path
        self.init_database()

    def init_database(self):
        """Create database tables if they don't exist"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Documents table - stores main document info
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_hash TEXT UNIQUE NOT NULL,
                filename TEXT NOT NULL,
                file_path TEXT,
                page_count INTEGER NOT NULL,
                estimated_time REAL,
                actual_processing_time REAL,
                provider_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Add file_path column if it doesn't exist (for existing databases)
        try:
            cursor.execute("ALTER TABLE documents ADD COLUMN file_path TEXT")
            conn.commit()
            print("[Cache] Added file_path column to documents table")
        except sqlite3.OperationalError:
            # Column already exists
            pass

        # Add analysis_data column if it doesn't exist (for existing databases)
        try:
            cursor.execute("ALTER TABLE documents ADD COLUMN analysis_data TEXT")
            conn.commit()
            print("[Cache] Added analysis_data column to documents table")
        except sqlite3.OperationalError:
            # Column already exists
            pass

        # Page dimensions table - stores extraction results per page
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS page_dimensions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL,
                page_number INTEGER NOT NULL,
                dimensions_text TEXT,
                error TEXT,
                retry_count INTEGER DEFAULT 0,
                final_temperature REAL,
                success BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
                UNIQUE(document_id, page_number)
            )
        ''')

        # Layout analysis table - stores layout analysis results
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS layout_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL,
                analysis_text TEXT,
                provider_name TEXT,
                prompt_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            )
        ''')

        # Create indexes for faster queries
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_file_hash ON documents(file_hash)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_document_page ON page_dimensions(document_id, page_number)')

        conn.commit()
        conn.close()

    def calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA256 hash of file for unique identification"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            # Read file in chunks to handle large files
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def get_document(self, file_hash: str) -> Optional[Dict]:
        """Get document by file hash"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM documents WHERE file_hash = ?
        ''', (file_hash,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return dict(row)
        return None

    def save_document(self, file_hash: str, filename: str, page_count: int,
                     estimated_time: Optional[float] = None,
                     actual_processing_time: Optional[float] = None,
                     provider_name: Optional[str] = None,
                     file_path: Optional[str] = None,
                     analysis_data: Optional[Dict] = None) -> int:
        """Save or update document info, returns document_id"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Convert analysis_data dict to JSON string
        analysis_json = json.dumps(analysis_data, ensure_ascii=False) if analysis_data else None

        # Check if document exists
        cursor.execute('SELECT id FROM documents WHERE file_hash = ?', (file_hash,))
        existing = cursor.fetchone()

        if existing:
            # Update existing document
            document_id = existing[0]
            cursor.execute('''
                UPDATE documents
                SET filename = ?, file_path = ?, page_count = ?, estimated_time = ?,
                    actual_processing_time = ?, provider_name = ?, analysis_data = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (filename, file_path, page_count, estimated_time, actual_processing_time,
                  provider_name, analysis_json, document_id))
        else:
            # Insert new document
            cursor.execute('''
                INSERT INTO documents (file_hash, filename, file_path, page_count, estimated_time,
                                     actual_processing_time, provider_name, analysis_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (file_hash, filename, file_path, page_count, estimated_time,
                  actual_processing_time, provider_name, analysis_json))
            document_id = cursor.lastrowid

        conn.commit()
        conn.close()
        return document_id

    def save_page_dimension(self, document_id: int, page_number: int,
                          dimensions_text: Optional[str] = None,
                          error: Optional[str] = None,
                          retry_count: int = 0,
                          final_temperature: Optional[float] = None,
                          success: bool = True):
        """Save dimension extraction result for a page"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT OR REPLACE INTO page_dimensions
            (document_id, page_number, dimensions_text, error, retry_count,
             final_temperature, success)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (document_id, page_number, dimensions_text, error, retry_count,
              final_temperature, success))

        conn.commit()
        conn.close()

    def get_page_dimensions(self, document_id: int) -> List[Dict]:
        """Get all page dimension results for a document"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM page_dimensions
            WHERE document_id = ?
            ORDER BY page_number
        ''', (document_id,))

        rows = cursor.fetchall()
        conn.close()

        return [dict(row) for row in rows]

    def get_failed_pages(self, document_id: int) -> List[int]:
        """Get list of page numbers that failed extraction (SAFETY errors)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT page_number FROM page_dimensions
            WHERE document_id = ? AND success = 0
            ORDER BY page_number
        ''', (document_id,))

        rows = cursor.fetchall()
        conn.close()

        return [row[0] for row in rows]

    def save_layout_analysis(self, document_id: int, analysis_text: str,
                            provider_name: str, prompt_name: str):
        """Save layout analysis result"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Delete old analysis for this document
        cursor.execute('DELETE FROM layout_analysis WHERE document_id = ?', (document_id,))

        # Insert new analysis
        cursor.execute('''
            INSERT INTO layout_analysis (document_id, analysis_text, provider_name, prompt_name)
            VALUES (?, ?, ?, ?)
        ''', (document_id, analysis_text, provider_name, prompt_name))

        conn.commit()
        conn.close()

    def get_layout_analysis(self, document_id: int) -> Optional[Dict]:
        """Get layout analysis for a document"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM layout_analysis WHERE document_id = ?
        ''', (document_id,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return dict(row)
        return None

    def get_analysis_data(self, file_hash: str) -> Optional[Dict]:
        """Get structured analysis data for a document"""
        cached_doc = self.get_document(file_hash)
        if not cached_doc:
            return None

        analysis_json = cached_doc.get('analysis_data')
        if not analysis_json:
            return None

        try:
            return json.loads(analysis_json)
        except json.JSONDecodeError:
            print(f"[Cache] Error parsing analysis_data JSON for document {file_hash}")
            return None

    def delete_document(self, file_hash: str):
        """Delete document and all associated data from cache"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Get document_id
        cursor.execute('SELECT id FROM documents WHERE file_hash = ?', (file_hash,))
        result = cursor.fetchone()

        if result:
            document_id = result[0]
            # CASCADE delete will remove page_dimensions and layout_analysis
            cursor.execute('DELETE FROM documents WHERE id = ?', (document_id,))
            conn.commit()
            print(f"Deleted document cache for hash: {file_hash}")

        conn.close()

    def get_cache_stats(self) -> Dict:
        """Get statistics about cache"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('SELECT COUNT(*) FROM documents')
        total_docs = cursor.fetchone()[0]

        cursor.execute('SELECT SUM(page_count) FROM documents')
        total_pages = cursor.fetchone()[0] or 0

        cursor.execute('SELECT COUNT(*) FROM page_dimensions WHERE success = 1')
        successful_extractions = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM page_dimensions WHERE success = 0')
        failed_extractions = cursor.fetchone()[0]

        conn.close()

        return {
            'total_documents': total_docs,
            'total_pages': total_pages,
            'successful_extractions': successful_extractions,
            'failed_extractions': failed_extractions
        }

    def get_all_documents(self) -> List[Dict]:
        """Get all documents with statistics"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get all documents with basic page statistics
        cursor.execute('''
            SELECT
                d.*,
                COALESCE(SUM(CASE WHEN pd.success = 0 THEN 1 ELSE 0 END), 0) as failed_pages
            FROM documents d
            LEFT JOIN page_dimensions pd ON d.id = pd.document_id
            GROUP BY d.id
            ORDER BY d.updated_at DESC
        ''')

        rows = cursor.fetchall()

        documents = []
        for row in rows:
            doc = dict(row)
            doc_id = doc['id']

            # Get all page dimensions with text for this document
            cursor.execute('''
                SELECT dimensions_text, success
                FROM page_dimensions
                WHERE document_id = ? AND success = 1
            ''', (doc_id,))

            pages = cursor.fetchall()

            # Count valid technical drawings by checking content
            drawing_count = 0
            for page in pages:
                dimensions_text = page['dimensions_text']
                if dimensions_text and self._is_valid_technical_drawing(dimensions_text):
                    drawing_count += 1

            doc['drawing_count'] = drawing_count

            documents.append(doc)

        conn.close()
        return documents

    def _is_valid_technical_drawing(self, dimensions_text):
        """
        Check if the AI response contains valid technical drawing dimensions
        Returns False if the response indicates it's not a technical drawing
        """
        if not dimensions_text:
            return False

        # Convert to lowercase for case-insensitive matching
        text_lower = dimensions_text.lower()

        # Patterns that indicate the page is NOT a valid technical drawing
        invalid_patterns = [
            "non è un disegno tecnico",
            "non è un disegno",
            "non contiene dimensioni",
            "material data sheet",
            "scheda dati",
            "non presenta dimensioni",
            "non sono presenti dimensioni",
            "impossibile estrarre dimensioni",
            "l'immagine fornita non è",
            "il documento fornito non è",
            "il documento fornito è",
            "non posso fornire dimensioni",
            "pagina vuota",
            "copertina",
            "frontespizio",
            "indice",
            "sommario"
        ]

        # Check if any invalid pattern is present
        for pattern in invalid_patterns:
            if pattern in text_lower:
                return False

        # Additional validation: check if there are actual dimension patterns
        import re
        dimension_patterns = [
            r'\d+\s*x\s*\d+',  # 123x456 or 123 x 456
            r'\d+\s*mm',       # 123mm or 123 mm
            r'\d+\s*cm',       # 123cm or 123 cm
            r'\d+\.\d+',       # 123.45 (decimal numbers)
            r'∅\s*\d+',        # ∅123 (diameter symbol)
            r'Ø\s*\d+'         # Ø123 (alternative diameter)
        ]

        for pattern in dimension_patterns:
            if re.search(pattern, dimensions_text):
                return True

        # If no dimension patterns found and text is long (explanatory), mark as invalid
        if len(dimensions_text) > 100:
            return False

        # Default to True for short responses (might be dimension values)
        return True

    def clear_all_cache(self):
        """Clear all cached data (for debugging/testing)"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('DELETE FROM page_dimensions')
        cursor.execute('DELETE FROM layout_analysis')
        cursor.execute('DELETE FROM documents')

        conn.commit()
        conn.close()
        print("All cache cleared")
