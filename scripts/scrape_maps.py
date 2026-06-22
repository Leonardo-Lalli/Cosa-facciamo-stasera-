# ===== Google Maps Scraper =====
# Cerca locali mancanti su Google Maps e li salva nei JSON del repo
# Richiede: pip install playwright && playwright install chromium
# Uso: python scripts/scrape_maps.py

import json, time, random, os, re
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from pathlib import Path

REPO_PATH = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_PATH / "data" / "cities"

# Città da arricchire
CITIES = [
    ("Roma", (41.9028, 12.4964)),
    ("Milano", (45.4642, 9.1900)),
    ("Napoli", (40.8518, 14.2681)),
    ("Torino", (45.0703, 7.6869)),
    ("Bologna", (44.4949, 11.3426)),
]

# Tipi di locale da cercare (query Google Maps)
SEARCHES = [
    ("discoteche", "nightclub"),
    ("pub e birrerie", "pub"),
    ("bar cocktail", "bar"),
    ("cinema", "cinema"),
    ("teatri", "theatre"),
    ("ristoranti", "restaurant"),
    ("locali musica dal vivo", "live_music"),
    ("sale giochi bowling", "bowling"),
]

def human_delay(min_s=0.3, max_s=1.5):
    time.sleep(random.uniform(min_s, max_s))

def find_website(page, name, city):
    """Cerca il sito ufficiale di un locale via Google Search"""
    try:
        query = f"{name} {city} sito ufficiale"
        url = f"https://www.google.com/search?q={query.replace(' ', '+')}&hl=it"
        page.goto(url, timeout=15000)
        human_delay(1, 3)

        # Prendi tutti i link organici (non ads)
        links = page.query_selector_all('a[href^="http"]')
        for link in links:
            href = link.get_attribute('href') or ''
            # Salta Google, Facebook, Instagram, TripAdvisor
            if any(skip in href for skip in ['google.com', 'facebook.com', 'instagram.com', 'tripadvisor', 'yelp', 'justeat', 'deliveroo', 'thefork', 'youtube']):
                continue
            try:
                parsed = urlparse(href)
                if parsed.netloc and '.' in parsed.netloc:
                    return f"{parsed.scheme}://{parsed.netloc}"
            except:
                continue
        return None
    except:
        return None

def scrape_venue_photos(page, name, city, max_photos=3):
    """Cerca foto del locale su Google Immagini"""
    photos = []
    try:
        query = f"{name} {city} locale interno"
        url = f"https://www.google.com/search?q={query.replace(' ', '+')}&tbm=isch&hl=it"
        page.goto(url, timeout=15000)
        human_delay(1, 2)

        imgs = page.query_selector_all('img[src^="http"]')
        for img in imgs:
            src = img.get_attribute('src') or ''
            if src and 'http' in src and 'google' not in src and 'gstatic' not in src:
                photos.append(src)
                if len(photos) >= max_photos: break
    except:
        pass
    return photos
    except:
        return None

def enrich_websites(page, venues, city):
    """Arricchisce i locali senza sito cercando su Google"""
    for v in venues:
        if v.get('website'):
            continue
        v['website'] = find_website(page, v['name'], city)
        human_delay(1, 2)
    """Cerca un tipo di locale in una città e estrae i risultati"""
    query = f"{search_query} a {city_name}"
    url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"
    
    try:
        page.goto(url, timeout=30000)
        human_delay(2, 4)
        
        # Aspetta che i risultati compaiano
        page.wait_for_selector('div[role="feed"]', timeout=15000)
        human_delay(1, 2)
        
        venues = []
        seen = set()
        scrolls = 0
        
        while len(venues) < 20 and scrolls < 8:
            # Prendi tutte le card dei risultati visibili
            cards = page.query_selector_all('div[role="feed"] > div > div > a')
            
            for card in cards:
                try:
                    name_el = card.query_selector('div.fontHeadlineSmall')
                    if not name_el:
                        continue
                    name = name_el.inner_text().strip()
                    if name in seen:
                        continue
                    seen.add(name)
                    
                    # Estrai dettagli dalla card
                    details = card.inner_text()
                    rating_match = re.search(r'(\d+[.,]\d+)\s*\((\d+)', details)
                    rating = float(rating_match.group(1).replace(',', '.')) if rating_match else None
                    total_ratings = int(rating_match.group(2)) if rating_match else 0
                    
                    address_match = re.search(r'·\s*([^·]+?)(?:\s*·|$)', details)
                    address = address_match.group(1).strip() if address_match else ""
                    
                    venues.append({
                        "id": f"gm_{abs(hash(name)) % 10**10}",
                        "name": name,
                        "address": address,
                        "type": venue_type,
                        "rating": rating,
                        "totalRatings": total_ratings,
                        "website": None,  # Riempito dopo
                        "source": "google_maps",
                    })
                except:
                    continue
            
            # Scrolla in basso
            feed = page.query_selector('div[role="feed"]')
            if feed:
                feed.evaluate('el => el.scrollBy(0, el.scrollHeight)')
                human_delay(2, 3)
                scrolls += 1
            else:
                break
        
        return venues
    
    except Exception as e:
        print(f"  Errore {city_name}/{search_query}: {e}")
        return []

def merge_into_city_json(city_name, new_venues):
    """Unisce i nuovi locali nel JSON della città senza duplicati"""
    safe_name = city_name.lower().replace(" ", "-")
    file_path = DATA_DIR / f"{safe_name}.json"
    
    existing = []
    existing_names = set()
    
    if file_path.exists():
        data = json.loads(file_path.read_text(encoding="utf-8"))
        existing = data.get("venues", [])
        existing_names = {v["name"].lower() for v in existing}
    
    added = 0
    for v in new_venues:
        if v["name"].lower() not in existing_names:
            existing.append(v)
            existing_names.add(v["name"].lower())
            added += 1
    
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    file_path.write_text(json.dumps({
        "updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "city": city_name,
        "count": len(existing),
        "venues": existing,
    }, indent=2, ensure_ascii=False), encoding="utf-8")
    
    return added

def main():
    print("=== Google Maps Scraper ===")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 900},
            locale="it-IT",
        )
        page = context.new_page()
        
        total_added = 0
        for city_name, (lat, lng) in CITIES:
            print(f"\n📍 {city_name}...")
            
            for search_query, venue_type in SEARCHES:
                print(f"  🔍 {search_query}...", end=" ", flush=True)
                venues = scrape_city(page, city_name, search_query, venue_type)
                if venues:
                    print(f"{len(venues)} trovati,", end=" ")
                    enrich_websites(page, venues, city_name)
                    print(f"{sum(1 for v in venues if v.get('website'))} siti,", end=" ")
                added = merge_into_city_json(city_name, venues)
                total_added += added
                print(f"{added} nuovi")
                human_delay(3, 8)  # Pausa tra ricerche per non farsi beccare
            
            human_delay(5, 15)  # Pausa tra città
        
        browser.close()
    
    print(f"\n✅ Totale nuovi locali aggiunti: {total_added}")


# ===== Venue Event Scraper =====
def scrape_venue_events(page, venue_name, website, city):
    """Visita il sito di un locale e cerca la pagina eventi/calendario"""
    if not website:
        return []
    
    events = []
    try:
        # Try common event page URLs
        urls_to_try = []
        base = website.rstrip('/')
        
        # Common Italian event page patterns
        for suffix in ['/eventi', '/calendario', '/programmazione', '/serate', '/events', '/calendar', '/agenda', '/date']:
            urls_to_try.append(base + suffix)
        
        # Also try the homepage
        urls_to_try.append(base)
        
        for url in urls_to_try[:3]:  # Try max 3 URLs
            try:
                page.goto(url, timeout=15000)
                human_delay(1, 2)
                
                # Look for event-like elements
                content = page.inner_text().lower()
                
                # Only process if page seems to have events
                event_keywords = ['event', 'serata', 'concerto', 'dj', 'live', 'programma', 'calendario', 'data', 'orario', 'biglietti']
                if not any(kw in content for kw in event_keywords):
                    continue
                
                # Extract date patterns and nearby text
                import re
                date_pattern = r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
                dates = re.findall(date_pattern, content)
                
                if dates:
                    # Found events! Extract surrounding text as event names
                    lines = page.inner_text().split('\n')
                    for i, line in enumerate(lines):
                        match = re.search(date_pattern, line)
                        if match:
                            event_name = lines[i-1].strip() if i > 0 and len(lines[i-1].strip()) > 3 else venue_name
                            events.append({
                                'name': event_name[:80],
                                'date': match.group(0),
                                'venue': venue_name,
                                'city': city,
                                'url': url,
                                'source': 'scraped',
                            })
                            if len(events) >= 5:
                                break
                break  # Found events, stop trying URLs
            except:
                continue
        
    except Exception as e:
        pass
    
    return events


def scrape_all_venue_events(cities=None):
    """Scrape events from all venues in data/cities JSON files"""
    import json, glob
    
    print("\n=== Venue Event Scraper ===")
    
    data_dir = Path(__file__).resolve().parent.parent / "data" / "cities"
    city_files = list(data_dir.glob("*.json")) if not cities else [data_dir / f"{c.lower().replace(' ', '-')}.json" for c in cities if (data_dir / f"{c.lower().replace(' ', '-')}.json").exists()]
    
    all_events = []
    
    # Load existing events
    events_file = data_dir.parent / "events.json"
    existing = []
    if events_file.exists():
        try: existing = json.loads(events_file.read_text(encoding='utf-8'))
        except: pass
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(locale="it-IT")
        page = context.new_page()
        
        for city_file in city_files[:20]:  # Limit to 20 cities
            try:
                data = json.loads(city_file.read_text(encoding='utf-8'))
                venues = data.get('venues', [])
                city_name = data.get('city', city_file.stem)
                
                venues_with_sites = [v for v in venues if v.get('website') and not any(e.get('venue') == v.get('name') for e in existing)]
                if not venues_with_sites:
                    continue
                
                print(f"\n📍 {city_name}: {len(venues_with_sites)} venues with websites to check")
                
                for venue in venues_with_sites[:10]:  # Max 10 per city
                    print(f"  🌐 {venue['name']}...", end=" ", flush=True)
                    events = scrape_venue_events(page, venue['name'], venue['website'], city_name)
                    if events:
                        all_events.extend(events)
                        print(f"{len(events)} events found")
                    else:
                        print("no events")
                    human_delay(2, 5)
                
            except Exception as e:
                print(f"Error: {e}")
        
        browser.close()
    
    # Merge with existing events and save
    if all_events:
        existing_ids = {e.get('id', '') for e in existing}
        new_events = [e for e in all_events if e.get('id', str(hash(e['name'] + e['date'])))[:10] not in existing_ids]
        existing.extend(new_events)
        events_file.write_text(json.dumps(existing, indent=2, ensure_ascii=False), encoding='utf-8')
        print(f"\n✅ Added {len(new_events)} new events from venue websites")
    
    return all_events


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == '--events':
        scrape_all_venue_events()
    else:
        main()
