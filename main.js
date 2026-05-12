// Configuration
const SHEET_ID = '1dlQ4nOpG3AETWtSfKrr5MtTer-ZvOScy6KT4NFp-LVg';
const ITEMS_GID = '827282190';
const INVENTORY_GID = '495380189';

const ITEMS_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${ITEMS_GID}`;
const INVENTORY_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${INVENTORY_GID}`;
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzZ13GLyyUWFgFEg5FHOxc7C_wjbOg7Wmq9rUrcJb8s7yh612P7ds4XDYDG76PIFdpr/exec';

// State Management
let items = [];
let inventory = [];
let currentStock = {};

// Unified Image Mapping Configuration
const IMAGE_MAPPING = {
    'item-Hdd': 'hdd ssd.png',
    'item-M.2': 'hdd m2.png',
    'item-Ram': 'ram.png',
    'item-Ram NB': 'ram nb.png',
    'item-Psu': 'psu.png',
    'item-Keyboard': 'kb.png',
    'item-Mouse': 'mouse.png',
    'item-Mouse chi': 'mouse kid.jpg',
    'item-KB+Mo': 'kb mouse wired.png',
    'item-Batt': 'batt.png',
    'item-Switch': 'hub switch2.png',
    'item-Wifi': 'wifi dongle.png'
};

// Fuzzy name mapping for the Edit Modal
const NAME_IMAGE_MAPPING = {
    'Hdd': 'hdd ssd.png',
    'SSD': 'hdd ssd.png',
    'M.2': 'hdd m2.png',
    'RAM': 'ram.png',
    'RAM NB': 'ram nb.png',
    'PSU': 'psu.png',
    'KB+Mo': 'kb mouse wired.png',
    'Keyboard': 'kb.png',
    'Mouse': 'mouse.png',
    'Mouse chi': 'mouse kid.jpg',
    'Batt': 'batt.png',
    'Switch': 'hub switch2.png',
    'Wifi': 'wifi dongle.png'
};

// UI Elements
const pages = ['dashboard', 'inventory', 'transactions'];
const navLinks = document.querySelectorAll('.nav-links li');
const views = document.querySelectorAll('.view');
const loadingOverlay = document.getElementById('loading-overlay');
const refreshBtn = document.getElementById('refresh-data');
const searchInput = document.getElementById('global-search');
const menuToggle = document.getElementById('menu-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebar = document.querySelector('.sidebar');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupNavigation();
    setupSearch();
    setupModalListeners();
    setupMobileMenu();
    await refreshData();

    refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('fa-spin');
        await refreshData();
        refreshBtn.classList.remove('fa-spin');
    });
}

// Navigation Logic
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const page = link.getAttribute('data-page');
            switchPage(page);
        });
    });
}

function switchPage(pageId) {
    // Update Nav
    navLinks.forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

    // Update View
    views.forEach(v => v.classList.add('hidden'));
    document.getElementById(`${pageId}-view`).classList.remove('hidden');
}

// Data Fetching & Parsing
async function refreshData() {
    showLoading(true);
    try {
        const responses = await Promise.all([
            fetch(ITEMS_URL),
            fetch(INVENTORY_URL)
        ]);

        // Check if any request failed (e.g., 404, 403)
        for (const res of responses) {
            if (!res.ok) {
                if (res.status === 403 || res.status === 404) {
                    throw new Error(`Google Sheets Access Denied (Status ${res.status}).\nPlease ensure the sheet is shared as "Anyone with the link can view".`);
                }
                throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
            }
        }

        const itemsCsv = await responses[0].text();
        const inventoryCsv = await responses[1].text();

        // Check if we got HTML instead of CSV (Google redirects to login for private sheets)
        if (itemsCsv.trim().startsWith('<!DOCTYPE') || inventoryCsv.trim().startsWith('<!DOCTYPE')) {
            throw new Error('Received HTML instead of data. This usually means the Google Sheet is NOT shared publicly.\nPlease check your Sharing settings.');
        }

        items = parseCSV(itemsCsv);
        inventory = parseCSV(inventoryCsv);
        
        calculateStock();
        renderAll();
    } catch (error) {
        console.error('Error fetching data:', error);
        alert('Sync Error: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).filter(line => line.trim()).map(line => {
        const values = parseCSVLine(line);
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = values[i] ? values[i].trim() : '';
        });
        return obj;
    });
}

// Helper to handle commas inside quotes in CSV
function parseCSVLine(line) {
    const result = [];
    let curValue = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(curValue);
            curValue = '';
        } else {
            curValue += char;
        }
    }
    result.push(curValue);
    return result;
}

function calculateStock() {
    currentStock = {};
    // Initialize with 0 for all items
    items.forEach(item => {
        currentStock[item['Item ID']] = 0;
    });

    // Aggregate from inventory
    inventory.forEach(entry => {
        const id = entry['Item ID'];
        const amount = parseInt(entry['Amount']) || 0;
        if (currentStock[id] !== undefined) {
            currentStock[id] += amount;
        }
    });
}

// Rendering Logic
function renderAll() {
    renderDashboard();
    renderInventory();
    renderHistory();
}

function renderDashboard() {
    // Stats
    document.getElementById('total-items-count').textContent = items.length;
    
    const totalStock = Object.values(currentStock).reduce((a, b) => a + b, 0);
    document.getElementById('total-stock-count').textContent = totalStock;

    const lowStockItems = Object.values(currentStock).filter(s => s > 0 && s < 5);
    document.getElementById('low-stock-count').textContent = lowStockItems.length;

    // 4. Critical Alerts (Items with 0 or negative stock)
    renderCriticalAlerts();

    // 5. Top Borrowers (Summary from Drawer column)
    renderTopBorrowers();

    // Recent Activity (Last 10 entries)
    const recent = [...inventory].reverse().slice(0, 10);
    const list = document.getElementById('recent-activity-list');
    list.innerHTML = recent.map(entry => {
        const item = items.find(i => i['Item ID'] === entry['Item ID']);
        const itemName = item ? item['Name'] : 'Unknown';
        const amount = parseInt(entry['Amount']);
        const typeText = amount > 0 ? 'Added' : 'Removed';
        
        return `
            <li class="activity-item">
                <div class="activity-dot" style="background: ${amount > 0 ? '#3498db' : '#e74c3c'}"></div>
                <div class="activity-details">
                    <p><strong>${itemName}</strong>: ${typeText} ${Math.abs(amount)} units</p>
                    <span>${entry['DateTime']} • ${entry['Place'] || 'Storage'}</span>
                </div>
            </li>
        `;
    }).join('');
}

function renderCriticalAlerts() {
    const alertList = document.getElementById('critical-alerts-list');
    const criticals = items.filter(item => (currentStock[item['Item ID']] || 0) <= 0);

    if (criticals.length === 0) {
        alertList.innerHTML = '<p style="color: var(--text-dim); font-size: 0.9rem">No critical alerts</p>';
        return;
    }

    alertList.innerHTML = criticals.map(item => `
        <div class="alert-item" onclick="openEditModal('${item['Item ID']}')">
            <i class="fas fa-exclamation-circle" style="color: #e74c3c"></i>
            <div class="alert-info">
                <h4>${item['Name']}</h4>
                <p>Stock level: ${currentStock[item['Item ID']] || 0}</p>
            </div>
        </div>
    `).join('');
}

function renderTopBorrowers() {
    const borrowerList = document.getElementById('top-borrowers-list');
    const borrowerCounts = {};

    inventory.forEach(entry => {
        if (parseInt(entry['Amount']) < 0) { // Only count removals/borrowing
            const name = entry['Drawer'] || 'Unknown';
            borrowerCounts[name] = (borrowerCounts[name] || 0) + 1;
        }
    });

    const sortedBorrowers = Object.entries(borrowerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (sortedBorrowers.length === 0) {
        borrowerList.innerHTML = '<p style="color: var(--text-dim); font-size: 0.9rem">No data available</p>';
        return;
    }

    borrowerList.innerHTML = sortedBorrowers.map(([name, count]) => `
        <div class="borrower-item" onclick="openBorrowerModal('${name}')">
            <span class="borrower-name">${name}</span>
            <span class="borrower-count">${count} times</span>
        </div>
    `).join('');
}

function openBorrowerModal(name) {
    const modal = document.getElementById('borrower-modal');
    document.getElementById('borrower-modal-title').textContent = `History: ${name}`;
    renderBorrowerHistory(name);
    modal.classList.remove('hidden');
}

function renderBorrowerHistory(name) {
    const body = document.getElementById('borrower-history-body');
    const filteredHistory = inventory.filter(entry => 
        (entry['Drawer'] || 'Unknown') === name && parseInt(entry['Amount']) < 0
    ).reverse();
    
    body.innerHTML = filteredHistory.map(entry => {
        const item = items.find(i => i['Item ID'] === entry['Item ID']);
        const itemName = item ? item['Name'] : 'Unknown';
        const amount = parseInt(entry['Amount']);
        
        return `
            <tr>
                <td>${entry['DateTime'].split(' ')[0]}</td>
                <td><strong>${itemName}</strong></td>
                <td style="color: #e74c3c">${amount}</td>
            </tr>
        `;
    }).join('');
}

function renderInventory(filter = '') {
    const grid = document.getElementById('inventory-grid');
    const filteredItems = items.filter(item => 
        item['Name'].toLowerCase().includes(filter.toLowerCase()) ||
        item['Description'].toLowerCase().includes(filter.toLowerCase())
    );

    grid.innerHTML = filteredItems.map(item => {
        const stock = currentStock[item['Item ID']] || 0;
        const statusClass = stock > 10 ? 'stock-in' : (stock > 0 ? 'stock-low' : 'stock-out');
        const statusText = stock > 10 ? 'In Stock' : (stock > 0 ? 'Low Stock' : 'Out of Stock');
        
        let imageUrl = BASE64_PLACEHOLDER;
        const localImg = IMAGE_MAPPING[item['Item ID']];
        
        if (localImg) {
            imageUrl = `./img/${localImg}`;
        } else if (item['Image']) {
            imageUrl = `https://www.appsheet.com/template/gettablefileurl?appName=Inventory-43814408&tableName=Items&fileName=${encodeURIComponent(item['Image'])}`;
        }
        
        return `
            <div class="item-card glass" onclick="openEditModal('${item['Item ID']}')">
                <div class="item-image" id="img-container-${item['Item ID']}">
                    <img src="${imageUrl}" onerror="handleImageError(this, '${item['Item ID']}')">
                </div>
                <div class="item-info">
                    <h3>${item['Name']}</h3>
                    <p>${item['Description']}</p>
                    <div class="item-meta">
                        <span class="stock-badge ${statusClass}">${statusText}: ${stock}</span>
                        <span class="item-id" style="font-size: 0.7rem; color: var(--text-dim)">${item['Item ID']}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderHistory() {
    const body = document.getElementById('history-body');
    const sortedHistory = [...inventory].reverse();
    
    body.innerHTML = sortedHistory.map(entry => {
        const item = items.find(i => i['Item ID'] === entry['Item ID']);
        const amount = parseInt(entry['Amount']);
        const amountColor = amount > 0 ? '#2ecc71' : '#e74c3c';
        
        return `
            <tr>
                <td>${entry['DateTime']}</td>
                <td><strong>${item ? item['Name'] : 'Unknown'}</strong></td>
                <td style="color: ${amountColor}; font-weight: 600">${amount > 0 ? '+' : ''}${amount}</td>
                <td>${entry['Place'] || '-'}</td>
                <td>${entry['Drawer'] || 'System'}</td>
            </tr>
        `;
    }).join('');
}

// UI Helpers
function showLoading(show) {
    loadingOverlay.style.opacity = show ? '1' : '0';
    loadingOverlay.style.pointerEvents = show ? 'all' : 'none';
}

function setupSearch() {
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        // Search across inventory grid
        renderInventory(val);
    });
}

function setupMobileMenu() {
    if (!menuToggle || !sidebarOverlay || !sidebar) return;

    const menuIcon = menuToggle.querySelector('i');

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
        if (menuIcon) {
            menuIcon.className = sidebar.classList.contains('active') ? 'fas fa-times' : 'fas fa-bars';
        }
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        if (menuIcon) menuIcon.className = 'fas fa-bars';
    });

    // Close sidebar when clicking nav link on mobile
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                if (menuIcon) menuIcon.className = 'fas fa-bars';
            }
        });
    });
}


// Base64 Placeholder Image (Generic box icon)
const BASE64_PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAABX0lEQVR4nO3bS04CQRCA4a8RE0XArS7cmAt3Xo8n8XgSryfAnRsX7oAL9SREByMkaPrp6p6uX6pS86SbtKq/qq6u6m4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPyx97IDfOn98unm6uY+O8h/unv9vD0YfV0uF08P/8Zf/zxO+8Nx9/D007Mv1pM8v3x89v8F68n98ukmO8CHPr99fO4PJ3mczvL6+fUoZ/vDXm7uX0Y5z3N/vUv5XJ/6fLnePzzp69pDIn7tZ37v53pYRLSHe0S0h3tEtId7RLSHe0S0h3tEtId7RLSHe0S0h3tEtId7RLSHe0S0h3tEtId7RLSHe0S0h3tEtId7RLSHe0S0h3tEtId7RLSHe0S0h3tEtId7RLSHe0S0h3tEtId7RLSHe0S0h3tEtId7RLSHe0S0h3tEtId7RLSHe0S0h3tEtId7RLSHe0S0h3tEtId7RLSHe0R96O718/Zg9LWzAAAAAAAAAAAAAMD/8Q0vM7v9XbE23AAAAABJRU5ErkJggg==';

// Image Error Handler
window.handleImageError = function(img, itemId) {
    if (img.src === BASE64_PLACEHOLDER) return; // Stop the loop
    
    if (img.dataset.triedFallback) {
        img.src = BASE64_PLACEHOLDER;
        return;
    }
    
    const originalUrl = img.src;
    if (originalUrl && originalUrl.includes('gettablefileurl')) {
        const fileName = new URL(originalUrl).searchParams.get('fileName');
        const altUrl = `https://www.appsheet.com/fsimage.php?appName=Inventory-43814408&appId=04ed1ec3-378a-44b2-9409-e18a3e89d4c6&fileName=${encodeURIComponent(fileName)}`;
        img.dataset.triedFallback = 'true';
        img.src = altUrl;
    } else {
        img.src = BASE64_PLACEHOLDER;
    }
};

// Make functions global so they're accessible from onclick
window.openEditModal = openEditModal;
window.openBorrowerModal = openBorrowerModal;
window.openLowStockModal = openLowStockModal;

// Modal Logic
function setupModalListeners() {
    const modal = document.getElementById('item-modal');
    const closeBtn = document.getElementById('modal-close');
    const form = document.getElementById('item-form');

    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    const borrowerModal = document.getElementById('borrower-modal');
    const closeBorrowerBtn = document.getElementById('close-borrower-modal');

    if (closeBorrowerBtn) {
        closeBorrowerBtn.addEventListener('click', () => {
            borrowerModal.classList.add('hidden');
        });
    }

    const lowStockModal = document.getElementById('low-stock-modal');
    const closeLowStockBtn = document.getElementById('close-low-stock-modal');

    if (closeLowStockBtn) {
        closeLowStockBtn.addEventListener('click', () => {
            lowStockModal.classList.add('hidden');
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
        if (e.target === borrowerModal) {
            borrowerModal.classList.add('hidden');
        }
        if (e.target === lowStockModal) {
            lowStockModal.classList.add('hidden');
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemId = document.getElementById('modal-item-id').value;
        const amount = document.getElementById('modal-amount').value;
        const drawer = document.getElementById('modal-drawer').value;
        const place = document.getElementById('modal-place').value;
        
        await handleStockUpdate(itemId, amount, drawer, place);
        modal.classList.add('hidden');
        form.reset();
    });
}

function openEditModal(itemId) {
    const item = items.find(i => i['Item ID'] === itemId);
    if (!item) return;

    const modal = document.getElementById('item-modal');
    document.getElementById('modal-item-id').value = itemId;
    document.getElementById('modal-item-name').value = item['Name'];
    document.getElementById('modal-current-stock').value = currentStock[itemId] || 0;
    document.getElementById('modal-amount').value = '';
    document.getElementById('modal-drawer').value = '';
    document.getElementById('modal-place').value = '';
    
    // Set Modal Image
    const modalImg = document.getElementById('modal-item-image');
    
    // 1. Try Item ID mapping first
    let localImg = IMAGE_MAPPING[itemId];
    
    // 2. If not found by ID, try fuzzy name matching
    if (!localImg) {
        const name = item['Name'] || '';
        const key = Object.keys(NAME_IMAGE_MAPPING).find(k => name.includes(k));
        if (key) localImg = NAME_IMAGE_MAPPING[key];
    }
    
    if (localImg) {
        modalImg.src = `img/${localImg}`;
    } else if (item['Image']) {
        modalImg.src = `https://www.appsheet.com/template/gettablefileurl?appName=Inventory-43814408&tableName=Items&fileName=${encodeURIComponent(item['Image'])}`;
    } else {
        modalImg.src = BASE64_PLACEHOLDER;
    }

    modalImg.onerror = () => { modalImg.src = BASE64_PLACEHOLDER; };

    renderItemHistory(itemId);
    modal.classList.remove('hidden');
}

function renderItemHistory(itemId) {
    const body = document.getElementById('item-history-body');
    const filteredHistory = inventory.filter(entry => entry['Item ID'] === itemId).reverse();
    
    if (filteredHistory.length === 0) {
        body.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-dim)">No records found</td></tr>';
        return;
    }

    body.innerHTML = filteredHistory.map(entry => {
        const amount = parseInt(entry['Amount']);
        const amountColor = amount > 0 ? '#2ecc71' : '#e74c3c';
        
        return `
            <tr>
                <td>${entry['DateTime'].split(' ')[0]}</td>
                <td style="color: ${amountColor}">${amount > 0 ? '+' : ''}${amount}</td>
                <td>${entry['Drawer'] || 'System'}</td>
            </tr>
        `;
    }).join('');
}

async function handleStockUpdate(itemId, amount, drawer, place) {
    showLoading(true);
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                itemId: itemId,
                amount: parseInt(amount),
                drawer: drawer,
                place: place
            })
        });

        // Manually update local state for immediate feedback
        const now = new Date();
        const d = String(now.getDate()).padStart(2, '0');
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const y = now.getFullYear();
        const time = now.toTimeString().split(' ')[0]; // HH:mm:ss
        const timestamp = `${d}/${m}/${y} ${time}`;

        inventory.push({
            'Item ID': itemId,
            'Amount': amount,
            'DateTime': timestamp,
            'Place': place,
            'Drawer': drawer
        });

        calculateStock();
        renderAll();

    } catch (error) {
        console.error('Update failed:', error);
        alert('Update failed. Please try again.');
    } finally {
        showLoading(false);
    }
}

function openLowStockModal() {
    const modal = document.getElementById('low-stock-modal');
    renderLowStockList();
    modal.classList.remove('hidden');
}

function renderLowStockList() {
    const body = document.getElementById('low-stock-list-body');
    const lowStockItems = items.filter(item => {
        const stock = currentStock[item['Item ID']] || 0;
        return stock > 0 && stock < 5;
    });

    if (lowStockItems.length === 0) {
        body.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--text-dim)">No low stock items</td></tr>';
        return;
    }

    body.innerHTML = lowStockItems.map(item => `
        <tr onclick="openEditModal('${item['Item ID']}'); document.getElementById('low-stock-modal').classList.add('hidden');" style="cursor: pointer">
            <td><strong>${item['Name']}</strong></td>
            <td style="color: #f1c40f; font-weight: 600">${currentStock[item['Item ID']]}</td>
        </tr>
    `).join('');
}

