import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request
import time

app = Flask(__name__)

# Simple in-memory cache
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_TTL = 300  # 5 minutes

def parse_feed_content(html_content):
    """
    Parses the HTML content inside the Atom feed entry
    and splits it by <h3> sections.
    """
    if not html_content:
        return []
        
    soup = BeautifulSoup(html_content, 'html.parser')
    updates = []
    
    current_type = "Update"
    current_html_blocks = []
    
    # Iterate through child nodes of soup
    for child in soup.contents:
        if child.name == 'h3':
            # Save previous update if there was one
            if current_html_blocks:
                content_str = "".join(str(c) for c in current_html_blocks)
                text_str = BeautifulSoup(content_str, 'html.parser').get_text(separator=' ', strip=True)
                updates.append({
                    'type': current_type,
                    'content_html': content_str,
                    'content_text': text_str
                })
                current_html_blocks = []
            current_type = child.get_text().strip()
        else:
            # Only append tags and non-empty navigable strings
            if child.name or (isinstance(child, str) and child.strip()):
                current_html_blocks.append(child)
                
    # Add the last update
    if current_html_blocks:
        content_str = "".join(str(c) for c in current_html_blocks)
        text_str = BeautifulSoup(content_str, 'html.parser').get_text(separator=' ', strip=True)
        updates.append({
            'type': current_type,
            'content_html': content_str,
            'content_text': text_str
        })
        
    # If there are no h3 tags at all, treat the whole content as one update
    if not updates and html_content.strip():
        text_str = soup.get_text(separator=' ', strip=True)
        updates.append({
            'type': 'Update',
            'content_html': html_content,
            'content_text': text_str
        })
        
    return updates

def fetch_releases():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()
    
    # Parse XML
    root = ET.fromstring(response.content)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    
    for entry in root.findall('atom:entry', ns):
        title_elem = entry.find('atom:title', ns)
        date_str = title_elem.text.strip() if title_elem is not None else "Unknown Date"
        
        updated_elem = entry.find('atom:updated', ns)
        updated_iso = updated_elem.text.strip() if updated_elem is not None else ""
        
        id_elem = entry.find('atom:id', ns)
        base_id = id_elem.text.strip() if id_elem is not None else f"tag:bigquery-release-notes:{time.time()}"
        
        link_elem = entry.find('atom:link[@rel="alternate"]', ns)
        if link_elem is None:
            link_elem = entry.find('atom:link', ns)
        link = link_elem.get('href') if link_elem is not None else "https://docs.cloud.google.com/bigquery/docs/release-notes"
        
        content_elem = entry.find('atom:content', ns)
        html_content = content_elem.text if content_elem is not None else ""
        
        # Split updates by h3
        updates = parse_feed_content(html_content)
        
        for idx, upd in enumerate(updates):
            entries.append({
                'id': f"{base_id}_{idx}",
                'date': date_str,
                'updated_iso': updated_iso,
                'type': upd['type'],
                'content_html': upd['content_html'],
                'content_text': upd['content_text'],
                'link': link
            })
            
    return entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Return from cache if available and not expired/forced
    if not force_refresh and cache['data'] is not None and (current_time - cache['last_fetched'] < CACHE_TTL):
        return jsonify({
            'status': 'success',
            'cached': True,
            'last_fetched': cache['last_fetched'],
            'data': cache['data']
        })
        
    try:
        data = fetch_releases()
        cache['data'] = data
        cache['last_fetched'] = current_time
        return jsonify({
            'status': 'success',
            'cached': False,
            'last_fetched': current_time,
            'data': data
        })
    except Exception as e:
        print(f"Error fetching release notes: {e}")
        # If fetch fails but we have cached data, return cache with a warning
        if cache['data'] is not None:
            return jsonify({
                'status': 'warning',
                'message': f"Failed to refresh. Showing cached data from {time.ctime(cache['last_fetched'])}. Error: {str(e)}",
                'cached': True,
                'last_fetched': cache['last_fetched'],
                'data': cache['data']
            })
        return jsonify({
            'status': 'error',
            'message': f"Failed to fetch release notes: {str(e)}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
