# ===== Google Maps Scraper =====
# Cerca locali mancanti su Google Maps e li salva nei JSON del repo
# Richiede: pip install playwright && playwright install chromium
# Uso: python scripts/scrape_maps.py

import json, time, random, os, re
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

def scrape_city(page, city_name, search_query, venue_type):
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
                        "id": f"gm_{hash(name) % 10**10}",
                        "name": name,
                        "address": address,
                        "type": venue_type,
                        "rating": rating,
                        "totalRatings": total_ratings,
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
                added = merge_into_city_json(city_name, venues)
                total_added += added
                print(f"{len(venues)} trovati, {added} nuovi")
                human_delay(3, 8)  # Pausa tra ricerche per non farsi beccare
            
            human_delay(5, 15)  # Pausa tra città
        
        browser.close()
    
    print(f"\n✅ Totale nuovi locali aggiunti: {total_added}")

if __name__ == "__main__":
    main()
