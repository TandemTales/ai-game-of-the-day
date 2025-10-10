(function () {
    "use strict";

    const GRID_SIZE = 128;
    const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
    const CELL_PIXELS = 32;
    const MIN_ZOOM = 0.4;
    const MAX_ZOOM = 3;
    const ZOOM_FACTOR = 1.1;

    const canvas = document.getElementById("levelCanvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = false;

    const tileMapInput = document.getElementById("tileMapInput");
    const tileImageInput = document.getElementById("tileImageInput");
    const paletteElement = document.getElementById("palette");
    const selectedTilePreview = document.getElementById("selectedTilePreview");
    const downloadButton = document.getElementById("downloadButton");
    const clearButton = document.getElementById("clearButton");

    const levelData = new Uint8Array(TOTAL_CELLS);
    const tileDefinitions = new Map();
    const tileImages = new Map();

    let selectedTileId = 0;
    let isPainting = false;
    let isPanning = false;
    let lastPaintedKey = null;
    let hoverCell = null;
    let panStart = null;

    const view = {
        offsetX: 0,
        offsetY: 0,
        zoom: 1
    };

    tileDefinitions.set(0, {
        id: 0,
        name: "Empty",
        imageFile: null,
        imageKey: null
    });

    renderPalette();
    setSelectedTile(0);
    draw();

    tileMapInput.addEventListener("change", handleTileMappingUpload);
    tileImageInput.addEventListener("change", handleTileImagesUpload);
    downloadButton.addEventListener("click", handleDownloadLevel);
    clearButton.addEventListener("click", handleClearLevel);

    canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });

    canvas.addEventListener("mousedown", (event) => {
        if (event.button === 0) {
            isPainting = true;
            paintFromEvent(event);
        } else if (event.button === 2) {
            isPanning = true;
            panStart = {
                clientX: event.clientX,
                clientY: event.clientY,
                offsetX: view.offsetX,
                offsetY: view.offsetY
            };
            document.body.classList.add("context-menu-block");
        }
    });

    canvas.addEventListener("mousemove", (event) => {
        if (isPainting) {
            paintFromEvent(event);
        }

        if (isPanning && panStart) {
            const deltaX = (event.clientX - panStart.clientX) / view.zoom;
            const deltaY = (event.clientY - panStart.clientY) / view.zoom;
            view.offsetX = panStart.offsetX - deltaX;
            view.offsetY = panStart.offsetY - deltaY;
            clampOffsets();
            draw();
            return;
        }

        const cell = getCellFromEvent(event);
        if (!cellsAreEqual(cell, hoverCell)) {
            hoverCell = cell;
            draw();
        }
    });

    canvas.addEventListener("mouseleave", () => {
        hoverCell = null;
        isPainting = false;
        isPanning = false;
        panStart = null;
        document.body.classList.remove("context-menu-block");
        lastPaintedKey = null;
        draw();
    });

    window.addEventListener("mouseup", () => {
        if (isPanning || isPainting) {
            isPanning = false;
            isPainting = false;
            panStart = null;
            lastPaintedKey = null;
            document.body.classList.remove("context-menu-block");
        }
    });

    canvas.addEventListener("wheel", (event) => {
        event.preventDefault();

        const { offsetX, offsetY, deltaY } = event;
        const zoomDirection = deltaY < 0 ? 1 : -1;
        const zoomMultiplier = zoomDirection > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        const newZoom = clamp(view.zoom * zoomMultiplier, MIN_ZOOM, MAX_ZOOM);

        if (newZoom === view.zoom) {
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const canvasX = offsetX;
        const canvasY = offsetY;
        const preZoomWorldX = view.offsetX + canvasX / view.zoom;
        const preZoomWorldY = view.offsetY + canvasY / view.zoom;

        view.zoom = newZoom;

        view.offsetX = preZoomWorldX - canvasX / view.zoom;
        view.offsetY = preZoomWorldY - canvasY / view.zoom;

        clampOffsets();
        draw();
    }, { passive: false });

    function handleTileMappingUpload(event) {
        const [file] = event.target.files;
        if (!file) {
            return;
        }

        file.text()
            .then((text) => {
                try {
                    const json = JSON.parse(text);
                    applyTileMapping(json);
                } catch (error) {
                    console.error("Failed to parse tile mapping JSON", error);
                    window.alert("Failed to parse tile mapping JSON. Check console for details.");
                }
            })
            .catch((error) => {
                console.error("Failed to read tile mapping file", error);
                window.alert("Unable to read tile mapping file.");
            })
            .finally(() => {
                tileMapInput.value = "";
            });
    }

    function handleTileImagesUpload(event) {
        const files = Array.from(event.target.files || []);
        if (!files.length) {
            return;
        }

        Promise.all(files.map(loadImageFile))
            .then(() => {
                renderPalette();
                updateSelectedTilePreview();
                draw();
            })
            .catch((error) => {
                console.error("Failed to load one or more images", error);
                window.alert("One or more images failed to load. Check console for details.");
            })
            .finally(() => {
                tileImageInput.value = "";
            });
    }

    function loadImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const key = normalizeFileKey(file.name);
                    tileImages.set(key, {
                        image: img,
                        dataUrl: reader.result
                    });
                    resolve();
                };
                img.onerror = () => {
                    reject(new Error("Unable to decode image: " + file.name));
                };
                img.src = reader.result;
            };

            reader.onerror = () => {
                reject(new Error("Unable to read image: " + file.name));
            };

            reader.readAsDataURL(file);
        });
    }

    function applyTileMapping(data) {
        const entries = normalizeMappingEntries(data);

        tileDefinitions.clear();
        tileDefinitions.set(0, {
            id: 0,
            name: "Empty",
            imageFile: null,
            imageKey: null
        });

        entries.forEach((entry) => {
            const id = Number(entry.id);
            if (!Number.isFinite(id) || id < 0 || id > 255) {
                return;
            }

            const imageFile = entry.image || entry.file || entry.filename || entry.src || null;
            const normalizedKey = imageFile ? normalizeFileKey(imageFile) : null;
            tileDefinitions.set(id, {
                id,
                name: entry.name || entry.label || `Tile ${id}`,
                imageFile: imageFile || null,
                imageKey: normalizedKey
            });
        });

        if (!tileDefinitions.has(selectedTileId)) {
            setSelectedTile(0);
        } else {
            updatePaletteSelection();
            updateSelectedTilePreview();
        }

        renderPalette();
        draw();
    }

    function normalizeMappingEntries(data) {
        if (!data) {
            return [];
        }

        if (Array.isArray(data)) {
            return data;
        }

        if (Array.isArray(data.tiles)) {
            return data.tiles;
        }

        return Object.entries(data).map(([key, value]) => {
            if (typeof value === "string") {
                return {
                    id: Number(key),
                    image: value
                };
            }

            if (value && typeof value === "object") {
                return {
                    id: Number(key),
                    ...value
                };
            }

            return {
                id: Number(key),
                image: null
            };
        });
    }

    function normalizeFileKey(value) {
        if (!value) {
            return null;
        }

        const segments = value.split(/\\|\//);
        const filename = segments[segments.length - 1];
        return filename.trim().toLowerCase();
    }

    function setSelectedTile(tileId) {
        selectedTileId = tileId;
        updatePaletteSelection();
        updateSelectedTilePreview();
    }

    function updatePaletteSelection() {
        const buttons = paletteElement.querySelectorAll("button");
        buttons.forEach((button) => {
            const buttonTileId = Number(button.dataset.tileId);
            button.classList.toggle("active", buttonTileId === selectedTileId);
        });
    }

    function updateSelectedTilePreview() {
        selectedTilePreview.innerHTML = "";
        const definition = tileDefinitions.get(selectedTileId);
        const titleParts = [`Tile #${selectedTileId}`];

        if (definition && definition.name) {
            titleParts.unshift(definition.name);
        }

        selectedTilePreview.title = titleParts.join(" · ");

        const imageRecord = definition && definition.imageKey ? tileImages.get(definition.imageKey) : null;

        if (imageRecord) {
            const img = document.createElement("img");
            img.src = imageRecord.dataUrl;
            img.alt = `Tile ${selectedTileId}`;
            selectedTilePreview.appendChild(img);
            return;
        }

        const placeholder = document.createElement("span");
        placeholder.textContent = definition && definition.name ? `${definition.name} (#${selectedTileId})` : `Tile #${selectedTileId}`;
        selectedTilePreview.appendChild(placeholder);
    }

    function renderPalette() {
        paletteElement.innerHTML = "";

        const definitions = Array.from(tileDefinitions.values()).sort((a, b) => a.id - b.id);

        definitions.forEach((definition) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.tileId = definition.id;
            button.title = `${definition.name || `Tile ${definition.id}`} (#${definition.id})`;

            const imageRecord = definition.imageKey ? tileImages.get(definition.imageKey) : null;

            if (imageRecord) {
                const img = document.createElement("img");
                img.src = imageRecord.dataUrl;
                img.alt = definition.name || `Tile ${definition.id}`;
                button.appendChild(img);
            } else {
                const label = document.createElement("span");
                label.textContent = definition.name ? definition.name : `Tile ${definition.id}`;
                button.appendChild(label);
            }

            button.addEventListener("click", () => {
                setSelectedTile(definition.id);
            });

            paletteElement.appendChild(button);
        });

        updatePaletteSelection();
    }

    function handleClearLevel() {
        levelData.fill(0);
        draw();
    }

    function handleDownloadLevel() {
        const blob = new Blob([levelData], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "level.lvl";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    function paintFromEvent(event) {
        const cell = getCellFromEvent(event);
        if (!cell) {
            return;
        }

        const cellKey = `${cell.x},${cell.y}`;
        if (cellKey === lastPaintedKey) {
            return;
        }

        const index = cell.y * GRID_SIZE + cell.x;
        if (levelData[index] === selectedTileId) {
            lastPaintedKey = cellKey;
            return;
        }

        levelData[index] = selectedTileId;
        lastPaintedKey = cellKey;
        draw();
    }

    function getCellFromEvent(event) {
        const rect = canvas.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;

        const worldX = view.offsetX + canvasX / view.zoom;
        const worldY = view.offsetY + canvasY / view.zoom;

        const cellX = Math.floor(worldX / CELL_PIXELS);
        const cellY = Math.floor(worldY / CELL_PIXELS);

        if (cellX < 0 || cellX >= GRID_SIZE || cellY < 0 || cellY >= GRID_SIZE) {
            return null;
        }

        return { x: cellX, y: cellY };
    }

    function cellsAreEqual(a, b) {
        if (a === b) {
            return true;
        }
        if (!a || !b) {
            return false;
        }
        return a.x === b.x && a.y === b.y;
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.scale(view.zoom, view.zoom);
        ctx.translate(-view.offsetX, -view.offsetY);

        const viewLeft = view.offsetX;
        const viewTop = view.offsetY;
        const viewRight = viewLeft + canvas.width / view.zoom;
        const viewBottom = viewTop + canvas.height / view.zoom;

        const startX = Math.max(0, Math.floor(viewLeft / CELL_PIXELS));
        const endX = Math.min(GRID_SIZE - 1, Math.ceil(viewRight / CELL_PIXELS));
        const startY = Math.max(0, Math.floor(viewTop / CELL_PIXELS));
        const endY = Math.min(GRID_SIZE - 1, Math.ceil(viewBottom / CELL_PIXELS));

        for (let y = startY; y <= endY; y += 1) {
            for (let x = startX; x <= endX; x += 1) {
                const index = y * GRID_SIZE + x;
                const tileId = levelData[index];
                const definition = tileDefinitions.get(tileId);
                const imageRecord = definition && definition.imageKey ? tileImages.get(definition.imageKey) : null;
                const px = x * CELL_PIXELS;
                const py = y * CELL_PIXELS;

                if (imageRecord) {
                    ctx.drawImage(imageRecord.image, px, py, CELL_PIXELS, CELL_PIXELS);
                } else if (tileId !== 0) {
                    ctx.fillStyle = placeholderColor(tileId);
                    ctx.fillRect(px, py, CELL_PIXELS, CELL_PIXELS);
                } else {
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(px, py, CELL_PIXELS, CELL_PIXELS);
                }
            }
        }

        ctx.strokeStyle = "rgba(17, 24, 39, 0.25)";
        ctx.lineWidth = 1 / view.zoom;

        for (let x = startX; x <= endX + 1; x += 1) {
            const px = x * CELL_PIXELS;
            ctx.beginPath();
            ctx.moveTo(px, startY * CELL_PIXELS);
            ctx.lineTo(px, (endY + 1) * CELL_PIXELS);
            ctx.stroke();
        }

        for (let y = startY; y <= endY + 1; y += 1) {
            const py = y * CELL_PIXELS;
            ctx.beginPath();
            ctx.moveTo(startX * CELL_PIXELS, py);
            ctx.lineTo((endX + 1) * CELL_PIXELS, py);
            ctx.stroke();
        }

        if (hoverCell && hoverCell.x >= startX && hoverCell.x <= endX && hoverCell.y >= startY && hoverCell.y <= endY) {
            ctx.strokeStyle = "#22c55e";
            ctx.lineWidth = 2 / view.zoom;
            ctx.strokeRect(hoverCell.x * CELL_PIXELS, hoverCell.y * CELL_PIXELS, CELL_PIXELS, CELL_PIXELS);
        }

        ctx.restore();
    }

    function placeholderColor(tileId) {
        const hue = (tileId * 43) % 360;
        return `hsl(${hue}, 70%, 70%)`;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function clampOffsets() {
        const maxX = Math.max(0, GRID_SIZE * CELL_PIXELS - canvas.width / view.zoom);
        const maxY = Math.max(0, GRID_SIZE * CELL_PIXELS - canvas.height / view.zoom);
        view.offsetX = clamp(view.offsetX, 0, maxX);
        view.offsetY = clamp(view.offsetY, 0, maxY);
    }
})();

