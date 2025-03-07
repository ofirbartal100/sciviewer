const vscode = acquireVsCodeApi();
let selectedThumbnailIndex = 0;

// Add zoom functionality
let zoomLevel = 1;
const ZOOM_STEP = 0.3;
const MAX_ZOOM = 5;
const MIN_ZOOM = 0.1;

// Add panning functionality
let isPanning = false;
let startX, startY;
let translateX = 0, translateY = 0;

function showImage(uri, index) {
    document.getElementById('mainImage').src = uri;
    updateSelectedThumbnail(index);
    // Reset zoom and translation
    zoomLevel = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
}

function updateSelectedThumbnail(newIndex) {
    // Remove 'selected' class from previously selected thumbnail
    document.getElementById('thumbnail-' + selectedThumbnailIndex)?.classList.remove('selected');
    // Add 'selected' class to newly selected thumbnail
    document.getElementById('thumbnail-' + newIndex)?.classList.add('selected');
    selectedThumbnailIndex = newIndex;
}

// Initially mark the first thumbnail as selected
updateSelectedThumbnail(selectedThumbnailIndex);

// Periodically check for new images
setInterval(() => {
    vscode.postMessage({ command: 'checkImages' });
}, 1000);

// Add event listener to the copy button
document.getElementById('copyButton').addEventListener('click', () => {
    vscode.postMessage({ command: 'copyPythonContent' });
});

// Add click-based zoom controls
document.addEventListener('DOMContentLoaded', () => {
    const mainImage = document.getElementById('mainImage');
    
    // Single click for zoom in, shift+click for zoom out
    mainImage.addEventListener('click', (event) => {
        if (event.shiftKey) {
            zoomOut();
        } else {
            zoomIn();
        }
        event.preventDefault();
    });
    
    // Double click to reset zoom
    mainImage.addEventListener('dblclick', (event) => {
        resetZoom();
        event.preventDefault();
    });
    
    // Add mouse wheel zoom support as well
    mainImage.addEventListener('wheel', (event) => {
        if (event.ctrlKey) {
            if (event.deltaY < 0) {
                zoomIn();
            } else {
                zoomOut();
            }
            event.preventDefault();
        }
    });

    setupPanning();
    setupContextMenu();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (event) => {
    const mainImage = document.getElementById('mainImage');
    
    // Only process shortcuts when the main image has focus
    if (document.activeElement === mainImage || document.activeElement === document.body) {
        if (event.key === '+' || event.key === '=') {
            zoomIn();
            event.preventDefault();
        } else if (event.key === '-' || event.key === '_') {
            zoomOut();
            event.preventDefault();
        } else if (event.key === '0') {
            resetZoom();
            event.preventDefault();
        }
    }

    // Add event listener to track shift key state and update cursor
    if (event.key === 'Shift') {
        if (!isPanning) {
            mainImage.style.cursor = 'zoom-out';
        }
    }
});

document.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') {
        const mainImage = document.getElementById('mainImage');
        if (!isPanning) {
            mainImage.style.cursor = 'zoom-in';
        }
    }
});

window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'updateThumbnails') {
        document.getElementById('noData').classList.add('hidden');
        document.getElementById('mainContainer').classList.remove('hidden');
        document.getElementById('thumbnailsContainer').classList.remove('hidden');

        const firstNewThumbnailUri = message.thumbnailsUris[0];
        const firstCurrentThumbnail = document.getElementById('thumbnail-0');
        // Compare the src of the current thumbnail-0 with the new incoming one
        // Normalize URIs for comparison by decoding
        const isThumbnailChanged = !firstCurrentThumbnail || 
            decodeURIComponent(firstCurrentThumbnail.src) !== decodeURIComponent(firstNewThumbnailUri);

        if (isThumbnailChanged) {
            document.getElementById('mainImage').src = firstNewThumbnailUri;
            const thumbnailsHtml = message.thumbnailsUris.map((uri, index) => { 
                return `
                    <div class="thumbnail-container">
                        <img id="thumbnail-${index}" src="${uri}" class="thumbnail" style="width: 80px; height: auto;" onclick="showImage('${uri}', ${index})">
                        <button class="delete-button" onclick="deleteImage(${index}, event)">×</button>
                    </div>`;
            }).join('');
                
            document.getElementById('thumbnailContainer').innerHTML = thumbnailsHtml;
            updateSelectedThumbnail(0);
        }
    }
    if (message.command === 'clearThumbnails') {
        document.getElementById('noData').classList.remove('hidden');
        document.getElementById('mainContainer').classList.add('hidden');
        document.getElementById('thumbnailsContainer').classList.add('hidden');
    }
    // Handle the copy button click
    if (message.command === 'copyPythonContent') {
        vscode.env.clipboard.writeText(pythonContent);
        vscode.window.showInformationMessage('Python content copied to clipboard!');
    }
});

function zoomIn() {
    if (zoomLevel < MAX_ZOOM) {
        zoomLevel += ZOOM_STEP;
        applyZoom();
    }
}

function zoomOut() {
    if (zoomLevel > MIN_ZOOM) {
        zoomLevel -= ZOOM_STEP;
        applyZoom();
    }
}

function resetZoom() {
    zoomLevel = 1;
    applyZoom();
}

function setupPanning() {
    const mainImage = document.getElementById('mainImage');
    
    mainImage.addEventListener('mousedown', (event) => {
        // Only enable panning when zoomed in
        if (zoomLevel > 1) {
            isPanning = true;
            startX = event.clientX - translateX;
            startY = event.clientY - translateY;
            mainImage.style.cursor = 'grabbing';
            // Prevent default to avoid image dragging behavior
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
            // Set cursor based on shift key state
            mainImage.style.cursor = event.shiftKey ? 'zoom-out' : 'zoom-in';
        }
    });
    
    // Reset panning when zoom is reset
    document.addEventListener('dblclick', () => {
        translateX = 0;
        translateY = 0;
    });
}

function applyTransform() {
    const mainImage = document.getElementById('mainImage');
    mainImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomLevel})`;
}

// Update the applyZoom function to include translation
function applyZoom() {
    applyTransform();
}

// Add context menu functionality for the main image
function setupContextMenu() {
    const mainImage = document.getElementById('mainImage');
    const contextMenu = document.createElement('div');
    contextMenu.id = 'contextMenu';
    contextMenu.className = 'context-menu';
    contextMenu.innerHTML = `
        <div class="context-menu-item" id="copyImage">Copy Image</div>
        <div class="context-menu-item" id="downloadImage">Download Image</div>
        <div class="context-menu-item" id="copyImagePath">Copy Image Path</div>
    `;
    document.body.appendChild(contextMenu);

    // Show context menu on right-click
    mainImage.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        
        // Get the dimensions of the context menu and viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Position the context menu at the mouse position
        contextMenu.style.display = 'block';
        
        // Get the dimensions of the context menu
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        
        // Calculate the position to ensure the menu stays within the viewport
        let left = event.clientX;
        let top = event.clientY;
        
        // Adjust if the menu would go off the right edge
        if (left + menuWidth > viewportWidth) {
            left = viewportWidth - menuWidth - 5;
        }
        
        // Adjust if the menu would go off the bottom edge
        if (top + menuHeight > viewportHeight) {
            top = viewportHeight - menuHeight - 5;
        }
        
        // Set the position
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;
    });

    // Hide context menu when clicking elsewhere
    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });

    // Handle context menu actions
    document.getElementById('copyImage').addEventListener('click', () => {
        copyImageToClipboard();
    });

    document.getElementById('downloadImage').addEventListener('click', () => {
        downloadImage();
    });

    document.getElementById('copyImagePath').addEventListener('click', () => {
        copyImagePath();
    });
}

// Function to copy image to clipboard
function copyImageToClipboard() {
    const mainImage = document.getElementById('mainImage');
    
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to match the image
    canvas.width = mainImage.naturalWidth;
    canvas.height = mainImage.naturalHeight;
    
    // Draw the image onto the canvas
    ctx.drawImage(mainImage, 0, 0);
    
    // Convert canvas to blob and copy to clipboard
    canvas.toBlob((blob) => {
        try {
            // Use the VSCode API to copy to clipboard
            vscode.postMessage({ 
                command: 'copyImageToClipboard',
                imageDataUrl: mainImage.src
            });
        } catch (err) {
            console.error('Failed to copy image to clipboard:', err);
            alert('Failed to copy image to clipboard. This feature may not be supported in your browser.');
        }
    });
}

// Function to download the image
function downloadImage() {
    const mainImage = document.getElementById('mainImage');
    
    // Get the image source URL
    const imageUrl = mainImage.src;
    
    // Send message to extension to handle the download
    vscode.postMessage({ 
        command: 'downloadImage',
        imageUrl: imageUrl
    });
}

// Function to copy the image path
function copyImagePath() {
    const mainImage = document.getElementById('mainImage');
    
    // Get the image source URL
    const imageUrl = mainImage.src;
    
    // Send message to extension to handle copying the actual file path
    vscode.postMessage({ 
        command: 'copyImagePath',
        imageUrl: imageUrl
    });
}

// Add delete image functionality
function deleteImage(index, event) {
    event.stopPropagation(); // Prevent the click from triggering the thumbnail selection
    const thumbnail = document.getElementById(`thumbnail-${index}`);
    const imageUri = thumbnail.src;
    
    // Send message to extension to handle the deletion
    vscode.postMessage({ 
        command: 'deleteImage',
        imageUri: imageUri
    });
}