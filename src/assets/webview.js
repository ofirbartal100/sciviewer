const vscode = acquireVsCodeApi();
let selectedThumbnailIndex = 0;

// Zoom configuration
const ZOOM_STEP = 0.25;
const MAX_ZOOM = 5;
const MIN_ZOOM = 0.25;
const DEFAULT_ZOOM = 1;

// Zoom and pan state
let zoomLevel = DEFAULT_ZOOM;
let isPanning = false;
let startX, startY;
let translateX = 0, translateY = 0;

// DOM Elements (cached after DOMContentLoaded)
let elements = {};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    initializeUI();
    setupEventListeners();
    setupToolbarButtons();
    setupPanning();
    setupContextMenu();
    updateSelectedThumbnail(selectedThumbnailIndex);
});

function cacheElements() {
    elements = {
        mainImage: document.getElementById('mainImage'),
        mainContainer: document.getElementById('mainContainer'),
        thumbnailsContainer: document.getElementById('thumbnailsContainer'),
        thumbnailContainer: document.getElementById('thumbnailContainer'),
        emptyState: document.getElementById('emptyState'),
        zoomIndicator: document.getElementById('zoomIndicator'),
        zoomLevelText: document.getElementById('zoomLevelText'),
        zoomInBtn: document.getElementById('zoomInBtn'),
        zoomOutBtn: document.getElementById('zoomOutBtn'),
        zoomResetBtn: document.getElementById('zoomResetBtn'),
        downloadBtn: document.getElementById('downloadBtn'),
        copyBtn: document.getElementById('copyBtn')
    };
}

function initializeUI() {
    // Check if there are any thumbnails
    const hasThumbnails = elements.thumbnailContainer && 
                          elements.thumbnailContainer.children.length > 0;
    
    if (hasThumbnails) {
        showPlotView();
    } else {
        showEmptyState();
    }
    
    updateZoomDisplay();
}

function showPlotView() {
    if (elements.emptyState) elements.emptyState.classList.add('hidden');
    if (elements.mainContainer) elements.mainContainer.classList.remove('hidden');
    if (elements.thumbnailsContainer) elements.thumbnailsContainer.classList.remove('hidden');
}

function showEmptyState() {
    if (elements.emptyState) elements.emptyState.classList.remove('hidden');
    if (elements.mainContainer) elements.mainContainer.classList.add('hidden');
    if (elements.thumbnailsContainer) elements.thumbnailsContainer.classList.add('hidden');
}

function setupEventListeners() {
    // Periodically check for new images
    setInterval(() => {
        vscode.postMessage({ command: 'checkImages' });
    }, 1000);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Image zoom via click
    if (elements.mainImage) {
        elements.mainImage.addEventListener('click', handleImageClick);
        elements.mainImage.addEventListener('dblclick', handleImageDoubleClick);
        elements.mainImage.addEventListener('wheel', handleImageWheel);
    }

    // Message handling from extension
    window.addEventListener('message', handleMessage);
}

function setupToolbarButtons() {
    if (elements.zoomInBtn) {
        elements.zoomInBtn.addEventListener('click', zoomIn);
    }
    if (elements.zoomOutBtn) {
        elements.zoomOutBtn.addEventListener('click', zoomOut);
    }
    if (elements.zoomResetBtn) {
        elements.zoomResetBtn.addEventListener('click', resetZoom);
    }
    if (elements.downloadBtn) {
        elements.downloadBtn.addEventListener('click', downloadImage);
    }
    if (elements.copyBtn) {
        elements.copyBtn.addEventListener('click', copyImageToClipboard);
    }
}

function handleKeyDown(event) {
    const mainImage = elements.mainImage;
    
    if (document.activeElement === mainImage || document.activeElement === document.body) {
        switch (event.key) {
            case '+':
            case '=':
                zoomIn();
                event.preventDefault();
                break;
            case '-':
            case '_':
                zoomOut();
                event.preventDefault();
                break;
            case '0':
                resetZoom();
                event.preventDefault();
                break;
        }
    }

    // Update cursor for shift key
    if (event.key === 'Shift' && mainImage && !isPanning) {
        mainImage.style.cursor = 'zoom-out';
    }
}

function handleKeyUp(event) {
    if (event.key === 'Shift' && elements.mainImage && !isPanning) {
        elements.mainImage.style.cursor = zoomLevel > 1 ? 'grab' : 'zoom-in';
    }
}

function handleImageClick(event) {
    if (isPanning) return;
    
    if (event.shiftKey) {
        zoomOut();
    } else {
        zoomIn();
    }
    event.preventDefault();
}

function handleImageDoubleClick(event) {
    resetZoom();
    event.preventDefault();
}

function handleImageWheel(event) {
    if (event.ctrlKey || event.metaKey) {
        if (event.deltaY < 0) {
            zoomIn();
        } else {
            zoomOut();
        }
        event.preventDefault();
    }
}

function handleMessage(event) {
    const message = event.data;
    
    switch (message.command) {
        case 'updateThumbnails':
            handleUpdateThumbnails(message);
            break;
        case 'clearThumbnails':
            showEmptyState();
            break;
    }
}

function handleUpdateThumbnails(message) {
    showPlotView();
    
    const firstNewThumbnailUri = message.thumbnailsUris[0];
    const firstCurrentThumbnail = document.getElementById('thumbnail-0');
    
    const isThumbnailChanged = !firstCurrentThumbnail || 
        decodeURIComponent(firstCurrentThumbnail.src) !== decodeURIComponent(firstNewThumbnailUri);

    if (isThumbnailChanged) {
        if (elements.mainImage) {
            elements.mainImage.src = firstNewThumbnailUri;
        }
        
        const thumbnailsHtml = message.thumbnailsUris.map((uri, index) => {
            return `
                <div class="thumbnail-container">
                    <img id="thumbnail-${index}" src="${uri}" 
                        class="thumbnail" 
                        onclick="showImage('${uri}', ${index})"
                        alt="Plot ${index + 1}">
                    <button class="delete-button" onclick="deleteImage(${index}, event)" aria-label="Delete plot">×</button>
                </div>`;
        }).join('');
        
        if (elements.thumbnailContainer) {
            elements.thumbnailContainer.innerHTML = thumbnailsHtml;
        }
        
        updateSelectedThumbnail(0);
        resetZoom();
    }
}

// Zoom functions
function zoomIn() {
    if (zoomLevel < MAX_ZOOM) {
        zoomLevel = Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM);
        applyTransform();
        updateZoomDisplay();
        showZoomIndicator();
    }
}

function zoomOut() {
    if (zoomLevel > MIN_ZOOM) {
        zoomLevel = Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM);
        applyTransform();
        updateZoomDisplay();
        showZoomIndicator();
    }
}

function resetZoom() {
    zoomLevel = DEFAULT_ZOOM;
    translateX = 0;
    translateY = 0;
    applyTransform();
    updateZoomDisplay();
    showZoomIndicator();
}

function applyTransform() {
    if (elements.mainImage) {
        elements.mainImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomLevel})`;
        elements.mainImage.style.cursor = zoomLevel > 1 ? 'grab' : 'zoom-in';
    }
}

function updateZoomDisplay() {
    const percentage = Math.round(zoomLevel * 100);
    
    if (elements.zoomIndicator) {
        elements.zoomIndicator.textContent = `${percentage}%`;
    }
    if (elements.zoomLevelText) {
        elements.zoomLevelText.textContent = `${percentage}%`;
    }
}

function showZoomIndicator() {
    if (elements.zoomIndicator) {
        elements.zoomIndicator.classList.add('visible');
        
        clearTimeout(elements.zoomIndicator._hideTimeout);
        elements.zoomIndicator._hideTimeout = setTimeout(() => {
            elements.zoomIndicator.classList.remove('visible');
        }, 1500);
    }
}

// Panning
function setupPanning() {
    const mainImage = elements.mainImage;
    if (!mainImage) return;
    
    mainImage.addEventListener('mousedown', (event) => {
        if (zoomLevel > 1) {
            isPanning = true;
            startX = event.clientX - translateX;
            startY = event.clientY - translateY;
            mainImage.style.cursor = 'grabbing';
            event.preventDefault();
        }
    });
    
    document.addEventListener('mousemove', (event) => {
        if (isPanning) {
            translateX = event.clientX - startX;
            translateY = event.clientY - startY;
            applyTransform();
            event.preventDefault();
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            if (elements.mainImage) {
                elements.mainImage.style.cursor = zoomLevel > 1 ? 'grab' : 'zoom-in';
            }
        }
    });
}

// Image display
function showImage(uri, index) {
    if (elements.mainImage) {
        elements.mainImage.src = uri;
    }
    updateSelectedThumbnail(index);
    resetZoom();
}

function updateSelectedThumbnail(newIndex) {
    const prevThumbnail = document.getElementById('thumbnail-' + selectedThumbnailIndex);
    const newThumbnail = document.getElementById('thumbnail-' + newIndex);
    
    if (prevThumbnail) {
        prevThumbnail.classList.remove('selected');
    }
    if (newThumbnail) {
        newThumbnail.classList.add('selected');
    }
    
    selectedThumbnailIndex = newIndex;
}

// Context Menu
function setupContextMenu() {
    const mainImage = elements.mainImage;
    if (!mainImage) return;
    
    const contextMenu = document.createElement('div');
    contextMenu.id = 'contextMenu';
    contextMenu.className = 'context-menu';
    contextMenu.innerHTML = `
        <div class="context-menu-item" id="ctxCopyImage">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            Copy Image
        </div>
        <div class="context-menu-item" id="ctxDownloadImage">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Download Image
        </div>
        <div class="context-menu-item" id="ctxCopyPath">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
            Copy Image Path
        </div>
    `;
    document.body.appendChild(contextMenu);

    mainImage.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        contextMenu.style.display = 'block';
        
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        
        let left = event.clientX;
        let top = event.clientY;
        
        if (left + menuWidth > viewportWidth) {
            left = viewportWidth - menuWidth - 8;
        }
        if (top + menuHeight > viewportHeight) {
            top = viewportHeight - menuHeight - 8;
        }
        
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;
    });

    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });

    document.getElementById('ctxCopyImage').addEventListener('click', copyImageToClipboard);
    document.getElementById('ctxDownloadImage').addEventListener('click', downloadImage);
    document.getElementById('ctxCopyPath').addEventListener('click', copyImagePath);
}

// Image actions
function copyImageToClipboard() {
    const mainImage = elements.mainImage;
    if (!mainImage) return;
    
    vscode.postMessage({ 
        command: 'copyImageToClipboard',
        imageDataUrl: mainImage.src
    });
}

function downloadImage() {
    const mainImage = elements.mainImage;
    if (!mainImage) return;
    
    vscode.postMessage({ 
        command: 'downloadImage',
        imageUrl: mainImage.src
    });
}

function copyImagePath() {
    const mainImage = elements.mainImage;
    if (!mainImage) return;
    
    vscode.postMessage({ 
        command: 'copyImagePath',
        imageUrl: mainImage.src
    });
}

function deleteImage(index, event) {
    event.stopPropagation();
    
    const thumbnail = document.getElementById(`thumbnail-${index}`);
    if (!thumbnail) return;
    
    vscode.postMessage({ 
        command: 'deleteImage',
        imageUri: thumbnail.src
    });
}

// Make functions globally available for inline onclick handlers
window.showImage = showImage;
window.deleteImage = deleteImage;
