(() => {
    const TEXTURE_COUNT = 34;
    let planets = [];
    let markers = [];
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let offset = { x: 0, y: 0 };

    // Element references
    let scene, container, tooltip;
    let modalOverlay, modalTitle, modalContent, modalClose;

    // Debug
    const params = new URLSearchParams(window.location.search);
    const debugMode = params.get('debug') === 'true';
    let debugDiv = null;

    /**
     * Initialize element references and event listeners
     */
    function initElements() {
        scene = document.getElementById('scene');
        container = document.getElementById('map-container');
        tooltip = document.getElementById('tooltip');
        modalOverlay = document.getElementById('modalOverlay');
        modalTitle = document.getElementById('modalTitle');
        modalContent = document.getElementById('modalContent');
        modalClose = document.getElementById('modalClose');

        // Modal close handlers
        modalClose.addEventListener('click', hideModal);
        modalOverlay.addEventListener('click', e => {
            if (e.target === modalOverlay) hideModal();
        });

        // Drag-to-pan
        container.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        // Mobile Drag-to-pan
        container.addEventListener('touchstart', onTouchStart, { passive: false });
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    /**
     * Load JSON data for planets and markers
     */
    function loadData() {
        Promise.all([
        fetch('data/planets.json').then(res => {
            if (!res.ok) return Promise.reject(res.statusText);
            return res.json();
        }),
        fetch('data/markers.json').then(res => {
            if (!res.ok) return Promise.reject(res.statusText);
            return res.json();
        })
        ])
        .then(([planetData, markerData]) => {
        planets = planetData;
        markers = markerData;
        renderPlanets();
        renderMarkers();
        centerMap();
        })
        .catch(err => console.error('Error loading data:', err));
    }

    /**
     * Centers the map within the container boundaries
     */
    function centerMap() {
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const sw = scene.offsetWidth;
        const sh = scene.offsetHeight;

        offset.x = (cw - sw) / 2;
        offset.y = (ch - sh) / 2;

        // enforce boundaries
        const minX = cw - sw;
        const minY = ch - sh;
        offset.x = Math.min(Math.max(offset.x, minX), 0);
        offset.y = Math.min(Math.max(offset.y, minY), 0);

        scene.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    }

    /**
     * Generate a consistent hash from a string
     */
    function hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // force 32-bit int
        }
        return Math.abs(hash);
    }

    /**
     * Render planet elements based on JSON data
     */
    function renderPlanets() {
        planets.forEach(p => {
        if (!p.visible && !p.unknown) return;
        const el = document.createElement('div');
        el.className = 'planet';
        el.style.width = el.style.height = `${p.radius * 2}px`;
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;

        // Optional anchor border
        if (p.hasAnchor && p.borderColor) {
            el.style.border = `2px solid ${p.borderColor}`;
        }

        // Unknown rendering
        if (p.unknown) {
            el.style.backgroundColor = 'var(--unknown-color)';
        } else {
            // Textured planet with overlays
            el.style.backgroundColor = p.color;
            const idx = (hashCode(p.id) % TEXTURE_COUNT) + 1;
            const url = encodeURI(`img/textures/t (${idx}).png`);
            const highlight = `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 70%)`;
            const shadow = `radial-gradient(circle at 70% 70%, rgba(0,0,0,0.4), transparent 70%)`;
            el.style.backgroundImage = `${highlight}, ${shadow}, url("${url}")`;
            el.style.backgroundBlendMode = 'screen, multiply, multiply';
            el.style.backgroundRepeat = 'repeat';
            el.style.backgroundSize = '128px 128px';
        }

        // Tooltip on hover
        el.addEventListener('mouseenter', () => {
            tooltip.textContent = (debugMode || !p.unknown) ? p.name : '???';
            tooltip.style.display = 'block';
        });
        el.addEventListener('mousemove', e => {
            tooltip.style.left = `${e.pageX + 10}px`;
            tooltip.style.top = `${e.pageY + 10}px`;
        });
        el.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });

        // Modal on click for known planets
        if (!p.unknown) {
            el.addEventListener('click', e => {
            e.stopPropagation();
            showModal(p);
            });
        }

        scene.appendChild(el);
        });
    }

    /**
     * Render marker elements based on JSON data
     */
    function renderMarkers() {
        markers.forEach(m => {
        if (!m.visible || !m.icon) return;
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.left = `${m.x}px`;
        el.style.top = `${m.y}px`;
        el.style.backgroundColor = m.color;
        el.innerHTML = `<i class="fa ${m.icon}" aria-hidden="true" style="color:#fff;font-size:10px"></i>`;

        // Tooltip on hover
        el.addEventListener('mouseenter', () => {
            tooltip.textContent = m.title;
            tooltip.style.display = 'block';
        });
        el.addEventListener('mousemove', e => {
            tooltip.style.left = `${e.pageX + 10}px`;
            tooltip.style.top = `${e.pageY + 10}px`;
        });
        el.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });

        scene.appendChild(el);
        });
    }

    /**
     * Show modal overlay with planet information
     */
    function showModal(p) {
        modalTitle.textContent = p.name;
        modalContent.innerHTML = `
        <p>${p.info}</p>
        <p><strong>Raça dominante:</strong> ${p.race}</p>
        `;
        modalOverlay.style.display = 'flex';
    }

    /**
     * Hide the modal overlay
     */
    function hideModal() {
        modalOverlay.style.display = 'none';
    }

    /**
     * Mouse down handler for pan start
     */
    function onMouseDown(e) {
        // ignore clicks on interactive elements
        if (e.target.closest('.planet') || e.target.closest('.marker')) return;
        isDragging = true;
        dragStart.x = e.clientX - offset.x;
        dragStart.y = e.clientY - offset.y;
        document.body.style.cursor = 'var(--cursor-grabbing)';
    }

    /**
     * Mouse move handler for pan
     */
    function onMouseMove(e) {
        if (!isDragging) return;
        offset.x = e.clientX - dragStart.x;
        offset.y = e.clientY - dragStart.y;

        // enforce boundaries
        const minX = container.clientWidth - scene.offsetWidth;
        const minY = container.clientHeight - scene.offsetHeight;
        offset.x = Math.min(Math.max(offset.x, minX), 0);
        offset.y = Math.min(Math.max(offset.y, minY), 0);

        scene.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    }


    /**
     * Touch start handler for pan
     */
    function onTouchStart(e) {
    if (e.target.closest('.planet, .marker')) return;
    e.preventDefault();

    isDragging = true;
    const touch = e.touches[0];
    dragStart.x = touch.clientX - offset.x;
    dragStart.y = touch.clientY - offset.y;
    document.body.style.cursor = 'var(--cursor-grabbing)';
    }

    /**
     * Touch move handler for pan
     */
    function onTouchMove(e) {
        if (!isDragging) return;
        e.preventDefault();

        const touch = e.touches[0];
        offset.x = touch.clientX - dragStart.x;
        offset.y = touch.clientY - dragStart.y;

        // enforce boundaries
        const minX = container.clientWidth - scene.offsetWidth;
        const minY = container.clientHeight - scene.offsetHeight;
        offset.x = Math.min(Math.max(offset.x, minX), 0);
        offset.y = Math.min(Math.max(offset.y, minY), 0);

        scene.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    }

    /**
     * Touch end handler to end pan
     */
    function onTouchEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.cursor = 'var(--cursor-grab)';
    }

    /**
     * Mouse up handler to end pan
     */
    function onMouseUp() {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.cursor = 'var(--cursor-grab)';
    }

    function startDebug() {
        const mapContainer = document.getElementById('map-container');
        const debugDiv = document.createElement('div');
        debugDiv.id = 'debug-coordinates';
        Object.assign(debugDiv.style, {
            position: 'absolute',
            pointerEvents: 'none',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '2px 6px',
            fontSize: '12px',
            borderRadius: '4px'
        });
        mapContainer.appendChild(debugDiv);

        mapContainer.addEventListener('mousemove', e => {
            const rect = mapContainer.getBoundingClientRect();
            const sceneX = Math.round((e.clientX - rect.left) - offset.x);
            const sceneY = Math.round((e.clientY - rect.top)  - offset.y);
            debugDiv.style.left = `${e.clientX - rect.left + 10}px`;
            debugDiv.style.top  = `${e.clientY - rect.top  + 10}px`;
            debugDiv.textContent = `x: ${sceneX}, y: ${sceneY}`;
        });


        mapContainer.addEventListener('dblclick', e => {
            const rect = mapContainer.getBoundingClientRect();
            const x = Math.round((e.clientX - rect.left) - offset.x);
            const y = Math.round((e.clientY - rect.top)  - offset.y);

            const raw = `${x},${y}`;
            const hash = hashCode(raw).toString(36);

            const color = '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
            const newObj = {
                id: hash,
                x: x,
                y: y,
                radius: Math.floor(Math.random() * (35 - 12 + 1)) + 12,
                color: color,
                borderColor: null,
                name: "",
                info: "",
                visible: true,
                unknown: true,
                race: ""
            };

            // const newObj = {
            //     id: hash,
            //     x: x,
            //     y: y,
            //     color: "#FF4500",
            //     icon : "fa-star",
            //     title : "Âncora",
            //     visible : true
            // };

            navigator.clipboard.writeText(JSON.stringify(newObj, null, 2))
            .then(() => console.log('JSON copiado:', newObj))
            .catch(err => console.error('Falha ao copiar:', err));
        });
    }


    window.addEventListener('load', () => {
        initElements();
        loadData();

        if (debugMode) {
            startDebug()
        }
    });
})();
