"""
Test script to verify analysis data storage in database
"""

import sqlite3
import json

def test_analysis_data():
    """Check if analysis_data column exists and contains data"""

    conn = sqlite3.connect('document_cache.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Check if column exists
    cursor.execute("PRAGMA table_info(documents)")
    columns = [col['name'] for col in cursor.fetchall()]

    print("=" * 80)
    print("DOCUMENT TABLE STRUCTURE")
    print("=" * 80)
    print(f"Columns: {', '.join(columns)}")
    print()

    if 'analysis_data' not in columns:
        print("⚠️  WARNING: analysis_data column not found!")
        print("The database schema needs to be updated.")
        conn.close()
        return

    print("[OK] analysis_data column exists")
    print()

    # Get documents with analysis data
    cursor.execute('''
        SELECT
            filename,
            file_hash,
            page_count,
            provider_name,
            analysis_data
        FROM documents
        ORDER BY updated_at DESC
        LIMIT 5
    ''')

    documents = cursor.fetchall()

    if not documents:
        print("No documents found in database.")
        conn.close()
        return

    print("=" * 80)
    print(f"RECENT DOCUMENTS ({len(documents)})")
    print("=" * 80)

    for doc in documents:
        print(f"\nDocument: {doc['filename']}")
        print(f"  Hash: {doc['file_hash'][:16]}...")
        print(f"  Pages: {doc['page_count']}")
        print(f"  Provider: {doc['provider_name']}")

        if doc['analysis_data']:
            try:
                analysis = json.loads(doc['analysis_data'])
                print(f"  Analysis Data: [OK] Present")
                print(f"    - PDF Type: {analysis.get('pdf_type')}")
                print(f"    - Extraction Method: {analysis.get('extraction_method')}")
                print(f"    - Processing Time: {analysis.get('processing_time', 0):.1f}s")

                if 'layout_analysis' in analysis:
                    layout = analysis['layout_analysis']
                    print(f"    - Layout Analysis: [OK]")
                    print(f"      - Prompt: {layout.get('prompt_name')}")
                    print(f"      - Provider: {layout.get('provider')}")
                    has_error = layout.get('error')
                    if has_error:
                        print(f"      - Error: {has_error[:50]}...")
                    else:
                        analysis_text = layout.get('analysis', '')
                        print(f"      - Analysis: {len(analysis_text)} chars")

                if 'dimensions_extraction' in analysis:
                    dims = analysis['dimensions_extraction']
                    print(f"    - Dimensions Extraction: [OK]")
                    print(f"      - Prompt: {dims.get('prompt_name')}")
                    print(f"      - Provider: {dims.get('provider')}")
                    results = dims.get('results_per_page', {})
                    successful = sum(1 for r in results.values() if r.get('success'))
                    print(f"      - Pages processed: {len(results)}")
                    print(f"      - Successful: {successful}")
            except json.JSONDecodeError as e:
                print(f"  Analysis Data: [ERROR] JSON Parse Error - {e}")
        else:
            print(f"  Analysis Data: [EMPTY] Not present")

        print("-" * 80)

    conn.close()
    print("\n[OK] Test completed")


if __name__ == "__main__":
    test_analysis_data()
