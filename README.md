# BigQuery Release Notes Explorer & Tweeter 🚀

A modern, responsive web application that fetches Google Cloud's BigQuery release notes feed, parses/splits them into granular topics, and offers an interactive Tweet Composer to share updates on X (formerly Twitter).

Built with a Python **Flask** backend, and plain vanilla **HTML**, **CSS**, and **JavaScript** on the frontend. It features a premium glassmorphic dark-theme UI with glowing effects.

---

## ✨ Features

- **Granular Update Splitting**: Individual Atom entries are parsed and split by `<h3>` tags (e.g. *Feature*, *Change*, *Breaking*). This allows you to inspect and tweet about one specific change rather than a day's worth of mixed updates.
- **Interactive Tweet Composer**: Click "Tweet" on any card to open a custom draft editor modal. It auto-generates a structured draft, tracks character limits (accounting for X's 23-character URL formatting), and features interactive quick-tag buttons.
- **LocalStorage Sharing History**: Checkboxes let you mark release notes as "Shared" to keep track of posted changes. The list of shared notes is saved in the browser's local storage.
- **Dynamic Filtering & Live Search**: Filter the feed instantly by category badges or search for specific terms with a debounced search bar.
- **Caching Layer**: Features a 5-minute memory cache to prevent rate-limiting from the GCP servers, with a force-refresh option via a spinning sync button.

---

## 🛠️ Tech Stack

- **Backend**: Python 3, Flask, Requests, BeautifulSoup4
- **Frontend**: HTML5, Vanilla CSS3 (Custom variables, flex/grid, transitions), Vanilla ES6 JavaScript
- **Icons**: [Lucide Icons](https://lucide.dev)
- **Typography**: Google Fonts (Inter & Outfit)

---

## 📁 Project Structure

```
bq-releases-notes/
├── app.py                 # Flask server & Atom feed parsing logic
├── requirements.txt       # Python dependencies
├── .gitignore             # Standard Git ignore file
├── templates/
│   └── index.html         # Main dashboard template
└── static/
    ├── css/
    │   └── style.css      # Custom styling, dark mode, & animations
    └── js/
        └── app.js         # Search/filter controls, modal, & X Web Intent
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have **Python 3.8+** installed.

### Installation & Run

1. Clone or download this repository:
   ```bash
   git clone https://github.com/balaji-pulivarthi/BigQuery-release-notes.git
   cd BigQuery-release-notes
   ```

2. Create a virtual environment and activate it:
   ```powershell
   # Windows (PowerShell)
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   ```
   ```bash
   # macOS/Linux
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the Flask application:
   ```bash
   python app.py
   ```

5. Open your browser and navigate to:
   ```text
   http://127.0.0.1:5000
   ```

---

## 📖 How It Works

1. **Backend XML Parsing**: The server fetches the feed at `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml` and runs it through Python's `xml.etree.ElementTree`.
2. **Soup Slicing**: Flask uses BeautifulSoup to split entries by `<h3>` tags. It assigns a unique ID to each sub-entry (e.g. `entry-id_0`, `entry-id_1`) and formats the data for client consumption.
3. **Frontend Rendering**: The client receives the JSON payload, checks the user's local storage for previously tweeted IDs, and renders glassmorphic cards.
4. **X.com Integration**: When you click the **Post to X** button inside the composer, it opens Twitter's web intent composer at `https://twitter.com/intent/tweet?text=...` in a new window containing your formatted draft, and flags the item as tweeted locally.
