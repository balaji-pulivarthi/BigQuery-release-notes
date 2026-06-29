// State Management
let state = {
    releases: [],
    filters: {
        search: '',
        type: 'all'
    },
    tweetedIds: new Set(),
    activeTweetRelease: null
};

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = refreshBtn.querySelector('.icon-spin-target');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const typeFilters = document.getElementById('type-filters');
const updatesFeed = document.getElementById('updates-feed');
const loadingSkeleton = document.getElementById('loading-skeleton');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const emptyState = document.getElementById('empty-state');
const resetFiltersBtn = document.getElementById('reset-filters-btn');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statLatest = document.getElementById('stat-latest');
const statShared = document.getElementById('stat-shared');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const tweetSourceDate = document.getElementById('tweet-source-date');
const tweetSourceType = document.getElementById('tweet-source-type');
const tweetSourcePreview = document.getElementById('tweet-source-preview');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const progressCircle = document.getElementById('progress-ring-circle');
const hashtagPillsContainer = document.getElementById('hashtag-pills');
const copyTweetBtn = document.getElementById('copy-tweet-btn');
const postTweetBtn = document.getElementById('post-tweet-btn');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// Progress Circle Calculations
const CIRCLE_RADIUS = 9;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
if (progressCircle) {
    progressCircle.style.strokeDasharray = `${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`;
    progressCircle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Icons
    lucide.createIcons();

    // 2. Load tweeted IDs from LocalStorage
    loadTweetedState();

    // 2.5. Initialize Theme
    initTheme();

    // 3. Fetch Release Notes
    fetchReleaseNotes(false);

    // 4. Setup Event Listeners
    setupEventListeners();
});

// Initialize color theme (dark/light) from localStorage
function initTheme() {
    const themeCheckbox = document.getElementById('theme-checkbox');
    if (!themeCheckbox) return;
    
    const savedTheme = localStorage.getItem('bq_theme') || 'dark';
    
    if (savedTheme === 'light') {
        themeCheckbox.checked = true;
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        themeCheckbox.checked = false;
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

// Load Tweeted State from LocalStorage
function loadTweetedState() {
    try {
        const saved = localStorage.getItem('bq_tweeted_ids');
        if (saved) {
            const arr = JSON.parse(saved);
            state.tweetedIds = new Set(arr);
        }
    } catch (e) {
        console.error('Failed to load tweeted state:', e);
    }
    updateStats();
}

// Save Tweeted State to LocalStorage
function saveTweetedState() {
    try {
        const arr = Array.from(state.tweetedIds);
        localStorage.setItem('bq_tweeted_ids', JSON.stringify(arr));
    } catch (e) {
        console.error('Failed to save tweeted state:', e);
    }
    updateStats();
}

// Toast System
function showToast(message, type = 'success', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-octagon';
    if (type === 'info') iconName = 'info';

    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <div class="toast-content">${message}</div>
    `;

    toastContainer.appendChild(toast);
    lucide.createIcons({ attrs: { class: 'lucide-icon' } });

    // Remove toast after duration
    setTimeout(() => {
        toast.style.animation = 'toast-out 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Fetch Release Notes
async function fetchReleaseNotes(forceRefresh = false) {
    // UI state: Loading
    showLoading(true);
    refreshIcon.classList.add('icon-spin');
    refreshBtn.disabled = true;

    try {
        const url = `/api/releases?refresh=${forceRefresh}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned HTTP error ${response.status}`);
        }
        
        const res = await response.json();
        
        if (res.status === 'error') {
            throw new Error(res.message);
        }

        if (res.status === 'warning') {
            showToast(res.message, 'info', 6000);
        } else if (forceRefresh) {
            showToast('Release notes successfully refreshed!', 'success');
        }

        state.releases = res.data || [];
        
        // Render
        renderFeed();
        updateStats();

    } catch (err) {
        console.error('Error fetching release notes:', err);
        showError(err.message || 'Network error occurred while fetching release notes.');
    } finally {
        showLoading(false);
        refreshIcon.classList.remove('icon-spin');
        refreshBtn.disabled = false;
    }
}

// UI State Switchers
function showLoading(isLoading) {
    if (isLoading) {
        loadingSkeleton.style.display = 'grid';
        updatesFeed.style.display = 'none';
        errorState.style.display = 'none';
        emptyState.style.display = 'none';
    } else {
        loadingSkeleton.style.display = 'none';
    }
}

function showError(message) {
    showLoading(false);
    errorMessage.textContent = message;
    errorState.style.display = 'flex';
    updatesFeed.style.display = 'none';
    emptyState.style.display = 'none';
}

// Update Dashboard Statistics
function updateStats() {
    statTotal.textContent = state.releases.length || '0';
    
    if (state.releases.length > 0) {
        statLatest.textContent = state.releases[0].date;
    } else {
        statLatest.textContent = '-';
    }

    statShared.textContent = state.tweetedIds.size || '0';
}

// Get currently filtered releases based on active filters
function getFilteredReleases() {
    return state.releases.filter(item => {
        // Filter by Type
        if (state.filters.type !== 'all') {
            if (item.type.toLowerCase() !== state.filters.type.toLowerCase()) {
                return false;
            }
        }

        // Filter by Search Query
        if (state.filters.search) {
            const query = state.filters.search.toLowerCase();
            const textMatch = item.content_text.toLowerCase().includes(query);
            const dateMatch = item.date.toLowerCase().includes(query);
            const typeMatch = item.type.toLowerCase().includes(query);
            return textMatch || dateMatch || typeMatch;
        }

        return true;
    });
}

// Render the updates list
function renderFeed() {
    updatesFeed.innerHTML = '';
    
    const filtered = getFilteredReleases();

    // Check if empty
    if (filtered.length === 0) {
        updatesFeed.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';
    updatesFeed.style.display = 'grid';

    // Build Cards HTML
    filtered.forEach(item => {
        const card = document.createElement('div');
        const isTweeted = state.tweetedIds.has(item.id);
        card.className = `card ${isTweeted ? 'is-tweeted' : ''}`;
        card.setAttribute('data-id', item.id);

        // Get matching badge class
        let badgeClass = 'badge-default';
        const typeLower = item.type.toLowerCase();
        if (typeLower.includes('feature')) badgeClass = 'badge-feature';
        else if (typeLower.includes('change')) badgeClass = 'badge-change';
        else if (typeLower.includes('breaking')) badgeClass = 'badge-breaking';
        else if (typeLower.includes('announcement')) badgeClass = 'badge-announcement';
        else if (typeLower.includes('issue')) badgeClass = 'badge-issue';

        // Prepare icon for badge
        let badgeIcon = 'info';
        if (typeLower.includes('feature')) badgeIcon = 'sparkles';
        else if (typeLower.includes('change')) badgeIcon = 'git-commit';
        else if (typeLower.includes('breaking')) badgeIcon = 'alert-triangle';
        else if (typeLower.includes('announcement')) badgeIcon = 'megaphone';
        else if (typeLower.includes('issue')) badgeIcon = 'bug';

        card.innerHTML = `
            <div class="card-header">
                <div class="card-title-group">
                    <h2 class="card-date">${item.date}</h2>
                    <span class="card-date-sub">
                        <i data-lucide="clock" style="width:12px;height:12px;"></i>
                        <span>Atom Feed Record</span>
                    </span>
                </div>
                <span class="type-badge ${badgeClass}">
                    <i data-lucide="${badgeIcon}" style="width:12px;height:12px;"></i>
                    ${item.type}
                </span>
            </div>
            
            <div class="card-body">
                ${item.content_html}
            </div>
            
            <div class="card-footer">
                <div class="footer-left">
                    <label class="checkbox-label" title="Mark this update as shared on social media">
                        <input type="checkbox" class="tweeted-checkbox" ${isTweeted ? 'checked' : ''}>
                        <span class="checkbox-custom"></span>
                        <span>Mark as Tweeted</span>
                    </label>
                </div>
                <div class="footer-right" style="display: flex; gap: 0.4rem;">
                    <button class="btn btn-secondary btn-sm copy-card-btn" style="padding:0.5rem 0.8rem; font-size:0.75rem;" title="Copy update content to clipboard">
                        <i data-lucide="copy" style="width:14px;height:14px;"></i> Copy
                    </button>
                    <a href="${item.link}" target="_blank" class="btn btn-secondary btn-sm" style="padding:0.5rem 0.8rem; font-size:0.75rem;">
                        <i data-lucide="external-link" style="width:14px;height:14px;"></i> Source
                    </a>
                    <button class="btn btn-tweet btn-sm tweet-trigger-btn" style="padding:0.5rem 0.8rem; font-size:0.75rem;">
                        <i data-lucide="twitter" style="width:14px;height:14px;"></i> Tweet
                    </button>
                </div>
            </div>
        `;

        updatesFeed.appendChild(card);
    });

    // Re-initialize Lucide Icons on the newly injected cards
    lucide.createIcons();

    // Attach Event Listeners to elements inside the feed
    attachFeedEventListeners();
}

// Attach event listeners to card interactive components
function attachFeedEventListeners() {
    // 1. Tweet buttons
    updatesFeed.querySelectorAll('.tweet-trigger-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            const id = card.getAttribute('data-id');
            const release = state.releases.find(r => r.id === id);
            if (release) {
                openTweetModal(release);
            }
        });
    });

    // 2. Tweeted checkboxes
    updatesFeed.querySelectorAll('.tweeted-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const card = e.target.closest('.card');
            const id = card.getAttribute('data-id');
            
            if (e.target.checked) {
                state.tweetedIds.add(id);
                card.classList.add('is-tweeted');
                showToast('Marked as Shared!', 'success');
            } else {
                state.tweetedIds.delete(id);
                card.classList.remove('is-tweeted');
            }
            saveTweetedState();
        });
    });

    // 3. Copy card buttons
    updatesFeed.querySelectorAll('.copy-card-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            const id = card.getAttribute('data-id');
            const release = state.releases.find(r => r.id === id);
            if (release) {
                const textToCopy = `BigQuery Release Update [${release.date}] - ${release.type}:\n\n${release.content_text}\n\nRead more: ${release.link}`;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showToast('Update copied to clipboard!', 'success');
                }).catch(err => {
                    console.error('Failed to copy card text:', err);
                    showToast('Failed to copy. Copy manually.', 'error');
                });
            }
        });
    });
}

// Open Tweet modal and prepare draft
function openTweetModal(release) {
    state.activeTweetRelease = release;
    
    // Set headers
    tweetSourceDate.textContent = release.date;
    tweetSourceType.textContent = release.type;
    
    // Map class for badge in modal
    tweetSourceType.className = 'type-badge';
    const typeLower = release.type.toLowerCase();
    if (typeLower.includes('feature')) tweetSourceType.classList.add('badge-feature');
    else if (typeLower.includes('change')) tweetSourceType.classList.add('badge-change');
    else if (typeLower.includes('breaking')) tweetSourceType.classList.add('badge-breaking');
    else if (typeLower.includes('announcement')) tweetSourceType.classList.add('badge-announcement');
    else if (typeLower.includes('issue')) tweetSourceType.classList.add('badge-issue');
    else tweetSourceType.classList.add('badge-default');

    tweetSourcePreview.textContent = release.content_text;

    // Reset Hashtags State (all pills inactive initially, or auto-selected)
    document.querySelectorAll('.hashtag-pill').forEach(pill => {
        pill.classList.remove('active');
    });

    // Auto-activate #BigQuery and #GCP
    const defaultTags = ['#BigQuery', '#GoogleCloud'];
    document.querySelectorAll('.hashtag-pill').forEach(pill => {
        if (defaultTags.includes(pill.getAttribute('data-tag'))) {
            pill.classList.add('active');
        }
    });

    // Generate initial tweet draft
    generateTweetDraft();

    // Show modal
    tweetModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Lock background scroll
    tweetTextarea.focus();
}

function closeTweetModal() {
    tweetModal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Unlock scroll
    state.activeTweetRelease = null;
}

// Generate the draft tweet based on active release and selected hashtags
function generateTweetDraft() {
    const release = state.activeTweetRelease;
    if (!release) return;

    // Create a clean summary text (up to ~140-150 chars)
    let snippet = release.content_text.trim();
    
    // Truncate snippet if too long
    const maxSnippetLen = 140;
    if (snippet.length > maxSnippetLen) {
        snippet = snippet.substring(0, maxSnippetLen).trim() + '...';
    }

    // Get active hashtags
    const activeHashtags = [];
    document.querySelectorAll('.hashtag-pill.active').forEach(pill => {
        activeHashtags.push(pill.getAttribute('data-tag'));
    });
    
    const tagsString = activeHashtags.join(' ');

    // Construct Tweet Text
    // Note: Twitter counts URL as exactly 23 characters internally, 
    // but in raw text inputs, the length is counted literally, so we track literal length here.
    let draft = `BigQuery Release Update [${release.date}] 🚀\n`;
    draft += `• ${release.type}: ${snippet}\n\n`;
    
    if (tagsString) {
        draft += `${tagsString}\n`;
    }
    
    draft += `Read more: ${release.link}`;

    tweetTextarea.value = draft;
    updateCharCounter();
}

// Update Twitter character counter & progress ring
function updateCharCounter() {
    const text = tweetTextarea.value;
    
    // Twitter link character count adjustment:
    // Any link is counted as 23 characters by Twitter's shortener.
    // Let's count link lengths accurately to mirror Twitter's counting!
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let literalLength = text.length;
    let twitterLength = literalLength;

    // Replace all URLs with a dummy 23-char string to calculate twitter length
    const urls = text.match(urlRegex);
    if (urls) {
        urls.forEach(url => {
            twitterLength = twitterLength - url.length + 23;
        });
    }

    const remaining = 280 - twitterLength;
    charCounter.textContent = remaining;

    // Styling updates based on limit
    if (remaining < 0) {
        charCounter.className = 'char-counter danger';
        postTweetBtn.disabled = true;
        postTweetBtn.style.opacity = 0.5;
        postTweetBtn.style.cursor = 'not-allowed';
    } else if (remaining <= 20) {
        charCounter.className = 'char-counter warning';
        postTweetBtn.disabled = false;
        postTweetBtn.style.opacity = 1;
        postTweetBtn.style.cursor = 'pointer';
    } else {
        charCounter.className = 'char-counter';
        postTweetBtn.disabled = false;
        postTweetBtn.style.opacity = 1;
        postTweetBtn.style.cursor = 'pointer';
    }

    // Update SVG Progress Circle
    const percentage = Math.min(Math.max(twitterLength / 280, 0), 1);
    const offset = CIRCLE_CIRCUMFERENCE - (percentage * CIRCLE_CIRCUMFERENCE);
    progressCircle.style.strokeDashoffset = offset;

    // Color progress circle
    if (remaining < 0) {
        progressCircle.style.stroke = 'var(--color-breaking)';
    } else if (remaining <= 20) {
        progressCircle.style.stroke = 'var(--color-announcement)';
    } else {
        progressCircle.style.stroke = 'var(--primary)';
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // 1. Refresh Button Click
    refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // 2. Retry Button (Error State)
    retryBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // 3. Search Input
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        
        // Show/hide clear search button
        clearSearchBtn.style.display = value ? 'flex' : 'none';
        
        // Debounce search render to avoid lag
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.filters.search = value;
            renderFeed();
        }, 200);
    });

    // Clear Search Input Button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.filters.search = '';
        clearSearchBtn.style.display = 'none';
        renderFeed();
        searchInput.focus();
    });

    // 4. Type Filter Pills Click
    typeFilters.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;

        // Toggle active classes
        typeFilters.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        // Update state and render
        state.filters.type = pill.getAttribute('data-type');
        renderFeed();
    });

    // 5. Reset Filters (Empty State)
    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.filters.search = '';
        clearSearchBtn.style.display = 'none';
        
        typeFilters.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        typeFilters.querySelector('[data-type="all"]').classList.add('active');
        state.filters.type = 'all';

        renderFeed();
    });

    // 6. Modal Close Buttons
    closeModalBtn.addEventListener('click', closeTweetModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeTweetModal();
    });

    // 7. Modal Hashtag Pills Click
    hashtagPillsContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.hashtag-pill');
        if (!pill) return;

        pill.classList.toggle('active');
        generateTweetDraft();
    });

    // 8. Textarea typing
    tweetTextarea.addEventListener('input', updateCharCounter);

    // 9. Copy Tweet to Clipboard
    copyTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Tweet copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy text:', err);
            showToast('Failed to copy. Please manually copy the text.', 'error');
        });
    });

    // 10. Post Tweet to X
    postTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        
        // Open Twitter Web Intent
        window.open(url, '_blank', 'width=550,height=420,toolbar=no,location=no');

        // Mark as Tweeted automatically
        if (state.activeTweetRelease) {
            const id = state.activeTweetRelease.id;
            state.tweetedIds.add(id);
            saveTweetedState();
            
            // Re-render feed to show checked status
            renderFeed();
            
            showToast('Opened Twitter intent! Marked release note as shared.', 'success');
        }
        
        closeTweetModal();
    });

    // 11. Export CSV Button Click
    const exportCsvBtn = document.getElementById('export-csv-btn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            exportToCSV();
        });
    }

    // 12. Theme Switch Toggle
    const themeCheckbox = document.getElementById('theme-checkbox');
    if (themeCheckbox) {
        themeCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('bq_theme', 'light');
                showToast('Light mode enabled', 'info');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('bq_theme', 'dark');
                showToast('Dark mode enabled', 'info');
            }
        });
    }
}

// Export the currently filtered list to CSV format
function exportToCSV() {
    const filtered = getFilteredReleases();
    if (filtered.length === 0) {
        showToast('No releases available to export.', 'error');
        return;
    }
    
    // CSV headers
    const headers = ['ID', 'Date', 'Type', 'Description', 'Link', 'Shared on X'];
    
    // Helper to escape CSV cell value
    const escapeCSV = (val) => {
        if (val === null || val === undefined) return '';
        let str = String(val);
        // Replace internal double quotes with two double quotes
        str = str.replace(/"/g, '""');
        // Wrap in quotes if it contains comma, quotes, newline, or carriage return
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str}"`;
        }
        return str;
    };
    
    // Build CSV content string
    let csvContent = headers.map(h => escapeCSV(h)).join(',') + '\r\n';
    
    filtered.forEach(item => {
        const row = [
            item.id,
            item.date,
            item.type,
            item.content_text,
            item.link,
            state.tweetedIds.has(item.id) ? 'Yes' : 'No'
        ];
        csvContent += row.map(cell => escapeCSV(cell)).join(',') + '\r\n';
    });
    
    // Create Blob object and download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `bigquery_release_notes_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`Exported ${filtered.length} updates to CSV!`, 'success');
}
