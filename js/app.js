$(document).ready(function () {

    // Initialize Quill editor
    const quill = new Quill('#prodSpecsEditor', {
        theme: 'snow',
        placeholder: 'Enter product specifications...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link']
            ]
        }
    });

    const loginOverlay = $('#loginOverlay');
    const loadingOverlay = $('#loadingOverlay');
    const mainContent = $('#mainContent');
    const loginForm = $('#loginForm');
    const loginError = $('#loginError');
    const logoutBtn = $('#logoutBtn');

    // Authentication check
    firebaseOps.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in.
            loadingOverlay.fadeOut(300, () => {
                loginOverlay.fadeOut(300);
                mainContent.fadeIn();
            });
        } else {
            // No user is signed in.
            loadingOverlay.fadeOut(300, () => {
                mainContent.fadeOut(300);
                loginOverlay.fadeIn();
            });
        }
    });

    loginForm.on('submit', async function (e) {
        e.preventDefault();
        const user = $('#username').val().trim();
        const pass = $('#password').val().trim();

        // Convert username to email if needed (Firebase requires email)
        const email = user.includes('@') ? user : `${user}@marketchoice.com`;

        firebaseOps.login(email, pass).catch(error => {
            console.error("Login failed:", error);
            let message = "Invalid email or password.";

            // Map common Firebase Auth error codes
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-login-credentials': // Standard in newer SDKs/configs
                    message = "Invalid email or password.";
                    break;
                case 'auth/invalid-email':
                    message = "Please enter a valid email address.";
                    break;
                case 'auth/user-disabled':
                    message = "This account has been disabled.";
                    break;
                case 'auth/too-many-requests':
                    message = "Too many failed attempts. Please try again later.";
                    break;
                default:
                    // If we have a message from the error but it's not a known code, 
                    // try to extract something readable, otherwise stick to default.
                    if (error.message && typeof error.message === 'string' && !error.message.startsWith('{')) {
                        message = error.message;
                    }
                    break;
            }

            loginError.removeClass('d-none').text(message);
        });
    });

    logoutBtn.on('click', () => {
        if (confirm("Are you sure you want to logout?")) {
            firebaseOps.logout().then(() => {
                // onAuthStateChanged will handle the UI redirect
            }).catch(error => {
                console.error("Logout failed:", error.message);
            });
        }
    });

    const categoriesDiv = $('#categories');
    const searchInput = $('#searchInput');
    let data = {};
    let expandedCategories = new Set();

    // -------------------- Utility Functions --------------------
    const saveToFirebase = () => firebaseOps.writeData("products", data);

    const saveLocal = () => {
        localStorage.setItem('adminData', JSON.stringify(data));
        saveToFirebase(); // Auto-sync
    };

    const loadLocal = () => {
        const stored = localStorage.getItem('adminData');
        if (stored) {
            data = JSON.parse(stored);
            return true;
        }
        return false;
    };

    const resetQuill = () => {
        try {
            // Using silent to prevent triggering observers during hidden state
            quill.setContents([], 'silent');
        } catch (e) {
            // Fallback for extreme cases
            quill.root.innerHTML = '';
        }
    };

    // -------------------- Dark Mode --------------------
    const themeToggle = $('#themeToggle');
    const body = $('body');

    if (localStorage.getItem('theme') === 'dark') {
        body.addClass('dark-mode').removeClass('bg-light');
        themeToggle.text('Light Mode');
    }

    themeToggle.click(() => {
        body.toggleClass('dark-mode');
        const isDark = body.hasClass('dark-mode');

        if (isDark) {
            body.removeClass('bg-light');
            themeToggle.text('Light Mode');
            localStorage.setItem('theme', 'dark');
        } else {
            body.addClass('bg-light');
            themeToggle.text('Dark Mode');
            localStorage.setItem('theme', 'light');
        }
    });

    // -------------------- Category Collapsing --------------------
    function expandAllCategories() {
        Object.keys(data).forEach(cat => expandedCategories.add(cat));
        render();
    }

    function collapseAllCategories() {
        expandedCategories.clear();
        render();
    }

    searchInput.on('input', function () {
        const term = $(this).val().toLowerCase();
        // Expand matching categories during search
        if (term) {
            for (let category in data) {
                const hasMatch = data[category].some(p =>
                    p.name.toLowerCase().includes(term)
                );
                if (hasMatch) expandedCategories.add(category);
            }
        }
        render(term);
    });

    $('#expandAllBtn').on('click', expandAllCategories);
    $('#collapseAllBtn').on('click', collapseAllCategories);

    // -------------------- Rendering --------------------
    function render() {
        categoriesDiv.empty();
        const searchTerm = searchInput.val().toLowerCase();

        for (let category in data) {
            // Filter products
            const products = data[category].filter(p =>
                p.name.toLowerCase().includes(searchTerm)
            );

            if (products.length === 0 && searchTerm) continue; // Skip empty categories during search

            const catCard = $('<div>').addClass('card mb-4');
            const catBody = $('<div>').addClass('card-body');

            // Header
            const header = $('<div>').addClass('category-header d-flex justify-content-between align-items-center mb-0');
            const titleContainer = $('<div>').addClass('d-flex align-items-center gap-2');
            const isExpanded = expandedCategories.has(category);

            const chevron = $(`
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="chevron-icon ${!isExpanded ? 'collapsed' : ''}" viewBox="0 0 16 16">
                  <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                </svg>
            `);
            titleContainer.append(chevron, `<h4 class="card-title mb-0">${category}</h4>`);
            header.append(titleContainer);

            const catActions = $('<div>').addClass('category-actions-container d-flex gap-2');

            const renameBtn = $('<button>')
                .addClass('btn btn-sm btn-warning d-flex align-items-center justify-content-center p-2')
                .attr('title', 'Rename')
                .html(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                    </svg>
                `)
                .click((e) => { e.stopPropagation(); renameCategory(category); });

            const deleteBtn = $('<button>')
                .addClass('btn btn-sm btn-danger d-flex align-items-center justify-content-center p-2')
                .attr('title', 'Delete')
                .html(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                      <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                `)
                .click((e) => { e.stopPropagation(); deleteCategory(category); });

            catActions.append(renameBtn, deleteBtn);
            header.append(catActions);
            catBody.append(header);

            // Collapsible Content
            const content = $('<div>').addClass('collapsible-content mt-3');
            if (!isExpanded) content.hide();

            header.on('click', function (e) {
                if ($(e.target).closest('.category-actions-container').length) return;
                content.slideToggle(300);
                chevron.toggleClass('collapsed');
                if (expandedCategories.has(category)) {
                    expandedCategories.delete(category);
                } else {
                    expandedCategories.add(category);
                }
            });

            // Table
            const table = $('<table>').addClass('table table-striped table-hover table-compact table-responsive-cards');
            const thead = $('<thead>').append(`
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Specs</th>
                  <th>Image</th>
                  <th>Links</th>
                  <th>Actions</th>
                </tr>
            `);
            table.append(thead);

            const tbody = $('<tbody>');
            const productsToRender = searchTerm ? products : data[category];

            productsToRender.forEach((product, index) => {
                // Find actual index in original array for actions
                const originalIndex = data[category].indexOf(product);

                const linksHtml = Array.isArray(product.links)
                    ? product.links.map(l => `<a href="${l.url}" target="_blank">${l.store}</a>`).join(', ')
                    : 'No links available';

                // Stock Status
                const stockStatus = product.inStock === false
                    ? '<span class="badge bg-danger">Out of Stock</span>'
                    : '<span class="badge bg-success">In Stock</span>';

                // Build image cell: thumbnail for url: entries, icon for Firebase keys
                let imageHtml = '<span class="text-muted small">—</span>';
                if (Array.isArray(product.image) && product.image.length > 0) {
                    const urlImages = product.image.filter(isUrlImage);
                    const fbImages = product.image.filter(id => !isUrlImage(id));
                    if (urlImages.length > 0) {
                        imageHtml = urlImages.map(id =>
                            `<img src="${getUrl(id)}" style="max-height:48px; max-width:64px; object-fit:contain; border-radius:3px;" alt="img">`
                        ).join('');
                    } else if (fbImages.length > 0) {
                        imageHtml = `<span class="text-muted small">📷 ${fbImages.length} file(s)</span>`;
                    }
                }

                const row = $('<tr>').append(`
                    <td data-label="Name">${product.name} ${stockStatus}</td>
                    <td data-label="Price">${product.currency || ''} ${product.price || ''}</td>
                    <td data-label="Specs"><div class="specs-cell">${product.specs}</div></td>
                    <td data-label="Image">${imageHtml}</td>
                    <td data-label="Links">${linksHtml}</td>
                    <td data-label="Actions">
                        <button class="btn btn-sm btn-primary me-2">Edit</button>
                        <button class="btn btn-sm btn-danger">Delete</button>
                    </td>
                `);

                row.find('.btn-primary').click(() => editProduct(category, originalIndex));
                row.find('.btn-danger').click(() => deleteProduct(category, originalIndex));
                row.find('.specs-cell').click(function (e) {
                    $(this).toggleClass('expanded');
                });
                tbody.append(row);
            });

            table.append(tbody);
            const btnGroup = $('<div>').addClass('d-flex gap-2 mt-2');
            const addBtn = $('<button>').addClass('btn btn-success').text('Add Product').click(() => addProduct(category));
            const fromLinkBtn = $('<button>').addClass('btn btn-info text-white')
                .html(`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="me-1" viewBox="0 0 16 16"><path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9c-.086 0-.17.01-.25.031A2 2 0 0 1 7 10.5H4a2 2 0 1 1 0-4h1.535c.218-.376.495-.714.82-1z"/><path d="M9 5.5a3 3 0 0 0-2.83 4h1.098A2 2 0 0 1 9 6.5h3a2 2 0 1 1 0 4h-1.535a4.02 4.02 0 0 1-.82 1H12a3 3 0 1 0 0-6H9z"/></svg> Add from Link`)
                .click(() => addProductFromLink(category));
            btnGroup.append(addBtn, fromLinkBtn);
            content.append(table, btnGroup);
            catBody.append(content);
            catCard.append(catBody);
            categoriesDiv.append(catCard);
        }
    }

    // -------------------- Product Modal --------------------
    let currentCategory = null;
    let currentIndex = null;
    let isEdit = false;
    const productModal = new bootstrap.Modal(document.getElementById('productModal'));

    // Helper: check if an image array entry is a direct URL vs a Firebase key
    const isUrlImage = (id) => typeof id === 'string' && id.startsWith('url:');
    const getUrl = (id) => id.slice(4); // strip 'url:' prefix

    function showImportedImagePreview(url) {
        $('#prodImageUrl').val(url);
    }

    function clearImportedImagePreview() {
        $('#prodImageUrl').val('');
    }

    function openProductModal(category, index = null) {
        currentCategory = category;
        currentIndex = index;
        isEdit = index !== null;
        $('#modalTitle').text(isEdit ? 'Edit Product' : 'Add Product');

        $('#productForm')[0].reset();
        $('#linksContainer').empty();
        clearImportedImagePreview();
        resetQuill();

        if (isEdit) {
            const product = data[category][index];
            $('#prodName').val(product.name);
            $('#prodPrice').val(product.price);
            $('#prodCurrency').val(product.currency);
            $('#prodInStock').prop('checked', product.inStock !== false);
            // Use standard Quill API instead of innerHTML for better stability
            quill.clipboard.dangerouslyPasteHTML(product.specs || '');

            if (Array.isArray(product.image)) {
                product.image.forEach(id => {
                    if (isUrlImage(id)) {
                        $('#prodImageUrl').val(getUrl(id));
                    }
                });
            }

            if (Array.isArray(product.links)) {
                product.links.forEach(l => addLinkField(l.store, l.url));
            }
        } else {
            addLinkField(); // Default Amazon link field
        }

        productModal.show();
    }

    // Remove imported image button
    $('#removeImportedImageBtn').on('click', clearImportedImagePreview);

    function addLinkField(store = "Amazon", url = "") {
        const row = $('<div>').addClass('input-group mb-2');

        const storeSelect = $('<select>').addClass('form-select').css('max-width', '150px');
        const stores = ["Amazon", "Flipkart"];
        stores.forEach(s => {
            const option = $('<option>').val(s).text(s);
            if (s === store) option.prop('selected', true);
            storeSelect.append(option);
        });

        const urlInput = $('<input>').attr({ type: "url", placeholder: "URL" }).addClass('form-control').val(url);
        const removeBtn = $('<button>').addClass('btn btn-outline-danger').text('Remove').click(() => row.remove());
        row.append(storeSelect, urlInput, removeBtn);
        $('#linksContainer').append(row);
    }

    $('#addLinkBtn').on('click', () => addLinkField());

    // -------------------- Product Form Submit --------------------
    $('#productForm').on('submit', function (e) {
        e.preventDefault();
        const name = $('#prodName').val();
        const price = $('#prodPrice').val();
        const currency = $('#prodCurrency').val();
        const inStock = $('#prodInStock').is(':checked');
        const specs = quill.root.innerHTML;

        const links = [];
        $('#linksContainer .input-group').each(function () {
            const store = $(this).find('select').val();
            const url = $(this).find('input[type="url"]').val().trim();
            if (store && url) links.push({ store, url });
        });

        const imageUrl = $('#prodImageUrl').val().trim();
        const productData = { name, price, currency, inStock, specs, links, image: [] };

        if (imageUrl) {
            productData.image.push('url:' + imageUrl);
        }

        if (isEdit) {
            data[currentCategory][currentIndex] = productData;
        } else {
            data[currentCategory].push(productData);
        }
        saveLocal();
        productModal.hide();
        render();
    });

    // -------------------- Product Actions --------------------
    const addProduct = (category) => openProductModal(category);
    const editProduct = (category, index) => openProductModal(category, index);
    const deleteProduct = (category, index) => {
        if (confirm("Delete this product?")) {
            data[category].splice(index, 1);
            saveLocal();
            render();
        }
    };

    // -------------------- Category Modal --------------------
    let isCategoryEdit = false;
    let currentCategoryName = null;
    const categoryModal = new bootstrap.Modal(document.getElementById('categoryModal'));

    $('#addCategoryBtn').on('click', () => {
        $('#categoryForm')[0].reset();
        $('#categoryModal .modal-title').text('Add Category');
        isCategoryEdit = false;
        currentCategoryName = null;
        categoryModal.show();
    });

    function renameCategory(category) {
        $('#categoryForm')[0].reset();
        $('#catName').val(category);
        $('#categoryModal .modal-title').text('Rename Category');
        isCategoryEdit = true;
        currentCategoryName = category;
        categoryModal.show();
    }

    $('#categoryForm').on('submit', function (e) {
        e.preventDefault();
        const name = $('#catName').val().trim();
        if (!name) return;
        if (isCategoryEdit) {
            if (name === currentCategoryName) {
                categoryModal.hide();
                return;
            }
            if (data[name]) {
                alert("Category already exists!");
                return;
            }

            const newData = {};
            newData[name] = data[currentCategoryName];
            for (let key in data) {
                if (key !== currentCategoryName) newData[key] = data[key];
            }
            data = newData;
        } else {
            if (data[name]) {
                alert("Category already exists!");
                return;
            }

            data[name] = [];
        }

        saveLocal();
        render();
        categoryModal.hide();
    });

    function deleteCategory(category) {
        if (confirm(`Delete category "${category}" and all its products ? `)) {
            delete data[category];
            saveLocal();
            render();
        }
    }

    // -------------------- Reset Data --------------------
    $('#resetDataBtn').on('click', function () {
        if (confirm("Reload data from Firebase? All unsaved local changes will be lost.")) {
            firebaseOps.readData("products", function (snapshotData) {
                if (snapshotData) {
                    data = snapshotData;
                    saveLocal();
                    render();
                    alert("Data refreshed from Firebase.");
                } else {
                    alert("No data found in Firebase.");
                }
            });
        }
    });

    // -------------------- Initial Load --------------------
    firebaseOps.readData("products", function (snapshotData) {
        if (snapshotData) {
            data = snapshotData;
            saveLocal();
            render();
        } else if (loadLocal()) {
            render();
        } else {
            data = {};
            saveLocal();
            render();
        }
    });

    // -------------------- JSON Save --------------------
    $('#saveJsonBtn').on('click', function () {
        try {
            const edited = JSON.parse($('#jsonEditor').val());
            localStorage.setItem('adminData', JSON.stringify(edited));
            data = edited;
            render();
            firebaseOps.writeData("products", edited);
            alert('JSON saved successfully to Firebase!');
        } catch (e) {
            alert('Invalid JSON format. Please fix errors before saving.');
        }
    });

    // -------------------- Review Mode --------------------
    $('#reviewBtn').on('click', function () {
        $('#adminView').hide();
        $('#reviewView').show();
        const stored = localStorage.getItem('adminData');
        $('#jsonEditor').val(stored ? JSON.stringify(JSON.parse(stored), null, 2) : '// No JSON found in localStorage');
    });

    $('#closeReviewBtn').on('click', function () {
        $('#reviewView').hide();
        $('#adminView').show();
    });

    // -------------------- Search Event --------------------
    searchInput.on('input', render);

    // -------------------- Import from Link --------------------
    const importLinkModal = new bootstrap.Modal(document.getElementById('importLinkModal'));
    let importLinkCategory = null;
    let lastScrapedData = null;

    function addProductFromLink(category) {
        importLinkCategory = category;
        lastScrapedData = null;
        // Reset modal state
        $('#importLinkUrl').val('');
        $('#importLinkStatus').addClass('d-none').text('');
        $('#importPreview').addClass('d-none');
        $('#importFillFormBtn').addClass('d-none');
        setFetchBtnLoading(false);
        importLinkModal.show();
    }

    function setFetchBtnLoading(loading) {
        if (loading) {
            $('#fetchBtnText').text('Fetching...');
            $('#fetchBtnSpinner').removeClass('d-none');
            $('#fetchDetailsBtn').prop('disabled', true);
        } else {
            $('#fetchBtnText').text('Fetch Details');
            $('#fetchBtnSpinner').addClass('d-none');
            $('#fetchDetailsBtn').prop('disabled', false);
        }
    }

    function showImportStatus(type, msg) {
        // type: 'success' | 'warning' | 'danger'
        const el = $('#importLinkStatus');
        el.removeClass('d-none alert alert-success alert-warning alert-danger')
            .addClass(`alert alert-${type}`)
            .html(msg);
    }

    // -------------------- Product Fetch via Microlink API + CORS Proxy fallback --------------------

    function detectPlatform(url) {
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.includes('amazon') || hostname === 'amzn.to' || hostname === 'a.co' || hostname.includes('amzn.')) {
            return 'Amazon';
        } else if (hostname.includes('flipkart')) {
            return 'Flipkart';
        }
        return null;
    }

    // Extract ASIN from Amazon URL
    function extractAsin(url) {
        const m = url.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
        return m ? m[1] : null;
    }

    // Primary method: microlink.io API — runs a headless browser, returns structured data
    async function fetchViaMicrolink(url) {
        // Amazon selectors
        const amzPriceSelector = '.a-price-whole, .a-price .a-offscreen, #priceblock_ourprice';
        const amzSpecsSelector = '#feature-bullets ul';

        // Flipkart selectors
        const fkPriceSelector = '._30jeq3, .Nx9bqj, ._16Jk6d';
        const fkSpecsSelector = '._2418kt, ._1mXcCf';

        // Detect platform roughly to pick selectors
        const hostname = new URL(url).hostname.toLowerCase();
        let selectors = '';
        if (hostname.includes('amazon') || hostname.includes('amzn.')) {
            selectors = `&data.price.selector=${encodeURIComponent(amzPriceSelector)}&data.specs.selector=${encodeURIComponent(amzSpecsSelector)}`;
        } else if (hostname.includes('flipkart')) {
            selectors = `&data.price.selector=${encodeURIComponent(fkPriceSelector)}&data.specs.selector=${encodeURIComponent(fkSpecsSelector)}`;
        }

        const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}${selectors}`;
        const r = await fetch(apiUrl, { signal: AbortSignal.timeout(20000) });
        if (!r.ok) throw new Error(`Microlink API returned ${r.status}`);
        const json = await r.json();
        if (json.status !== 'success' || !json.data) {
            throw new Error('Microlink returned no data');
        }
        return json.data;
    }

    // Build a better product image URL for Amazon using the ASIN
    function buildAmazonImageUrl(asin) {
        // Amazon's standard product image URL pattern (large size)
        return `https://m.media-amazon.com/images/P/${asin}.jpg`;
    }

    // Fallback: CORS proxy fetch for HTML scraping
    async function fetchViaProxy(url) {
        const proxies = [
            async (u) => {
                const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(u)}`, { signal: AbortSignal.timeout(12000) });
                if (!r.ok) throw new Error(`corsproxy ${r.status}`);
                return await r.text();
            },
            async (u) => {
                const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, { signal: AbortSignal.timeout(12000) });
                if (!r.ok) throw new Error(`allorigins ${r.status}`);
                const j = await r.json();
                return j.contents || null;
            }
        ];

        for (const proxy of proxies) {
            try {
                const html = await proxy(url);
                if (html && html.length > 500) return html;
            } catch (e) {
                console.warn('Proxy failed:', e.message);
            }
        }
        return null;
    }

    async function fetchProductFromLink(url) {
        const platform = detectPlatform(url);
        if (!platform) {
            throw new Error('Unsupported platform. Only Amazon and Flipkart links are supported.');
        }

        // ===== METHOD 1: Microlink API (works with short links, handles redirects + JS) =====
        let microlinkData = null;
        try {
            console.log('Fetching via Microlink API...');
            microlinkData = await fetchViaMicrolink(url);
            console.log('Microlink data:', microlinkData);
        } catch (e) {
            console.warn('Microlink fetch failed:', e.message);
        }

        if (microlinkData) {
            const resolvedUrl = microlinkData.url || url;
            const resolvedPlatform = detectPlatform(resolvedUrl) || platform;

            // Build result from microlink data
            let name = cleanTitle(microlinkData.title || '');
            let specs = microlinkData.specs || microlinkData.description || '';
            let price = microlinkData.price || '';
            let imageUrl = '';

            // Image: microlink sometimes returns the site logo instead of product image
            const mlImage = microlinkData.image;
            if (mlImage && mlImage.url) {
                const imgUrl = mlImage.url;
                const isLikelyLogo = imgUrl.includes('favicon') || imgUrl.includes('logo') ||
                    imgUrl.includes('Prime_Logo') || imgUrl.includes('brand') ||
                    (mlImage.height && mlImage.width && mlImage.height < 200 && mlImage.width < 200);
                if (!isLikelyLogo) {
                    imageUrl = imgUrl;
                }
            }

            // For Amazon: try to build a direct product image URL using the ASIN
            if (resolvedPlatform === 'Amazon' && !imageUrl) {
                const asin = extractAsin(resolvedUrl);
                if (asin) {
                    imageUrl = buildAmazonImageUrl(asin);
                }
            }

            // ===== METHOD 2: Try CORS proxy to get price & better data from HTML =====
            try {
                console.log('Trying CORS proxy for additional data (price, specs)...');
                const html = await fetchViaProxy(resolvedUrl);
                if (html) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    // Parse structured data from HTML (JSON-LD, OG tags)
                    const structured = parseStructuredData(doc);

                    // Try to get price from structured data
                    price = structured.price || '';
                    // Use better name/image from structured data if available
                    if (!name && structured.name) name = structured.name;
                    if (!imageUrl && structured.imageUrl) imageUrl = structured.imageUrl;
                    if (!specs && structured.specs) specs = structured.specs;

                    // Also try DOM selectors for price (they sometimes work even with partial HTML)
                    if (resolvedPlatform === 'Amazon') {
                        const domData = parseAmazon(doc, resolvedUrl);
                        price = price || domData.price;
                        if (!imageUrl && domData.imageUrl) imageUrl = domData.imageUrl;
                        if (!name && domData.name) name = domData.name;
                        if (!specs && domData.specs) specs = domData.specs;
                    } else {
                        const domData = parseFlipkart(doc, resolvedUrl);
                        price = price || domData.price;
                        if (!imageUrl && domData.imageUrl) imageUrl = domData.imageUrl;
                        if (!name && domData.name) name = domData.name;
                        if (!specs && domData.specs) specs = domData.specs;
                    }
                }
            } catch (e) {
                console.warn('CORS proxy enrichment failed (non-critical):', e.message);
            }

            return {
                platform: resolvedPlatform,
                name: name || 'Unknown Product',
                price: cleanPrice(price),
                imageUrl,
                specs,
                currency: '₹',
                url: resolvedUrl
            };
        }

        // ===== FALLBACK: Pure CORS proxy scraping (if microlink is down) =====
        console.log('Microlink unavailable, falling back to CORS proxy...');
        const html = await fetchViaProxy(url);
        if (!html) {
            throw new Error('Could not fetch product page. Both Microlink API and CORS proxies failed. Please add the product manually.');
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Parse structured data first, then DOM
        const structured = parseStructuredData(doc);
        let result;
        if (platform === 'Amazon') {
            result = parseAmazon(doc, url);
        } else {
            result = parseFlipkart(doc, url);
        }

        // Merge structured data as fallback
        result.name = result.name || structured.name || 'Unknown Product';
        result.imageUrl = result.imageUrl || structured.imageUrl || '';
        result.specs = result.specs || structured.specs || '';
        result.price = result.price || structured.price || '';
        result.platform = platform;
        result.url = url; // Keep original URL in fallback

        return result;
    }

    function cleanPrice(raw) {
        if (!raw) return '';
        return raw.replace(/[^0-9.]/g, '').trim();
    }

    // Clean up title strings — remove platform suffixes and prefixes
    function cleanTitle(raw) {
        if (!raw) return '';
        return raw
            .replace(/^(Amazon\.in|Amazon\.com|Flipkart\.com|Flipkart):\s*/i, '')
            .replace(/[\|\-–—]\s*(Amazon\.in|Amazon\.com|Flipkart\.com|Flipkart).*$/i, '')
            .replace(/:\s*(Amazon\.in|Amazon\.com|Flipkart\.com|Flipkart).*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Parse JSON-LD and OpenGraph meta tags \u2014 always rendered server-side (no JS needed)
    function parseStructuredData(doc) {
        const result = { name: '', price: '', imageUrl: '', specs: '' };

        // --- JSON-LD (richest source: full schema.org Product object) ---
        const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
        for (const script of jsonLdScripts) {
            try {
                let data = JSON.parse(script.textContent || script.innerHTML);
                if (!Array.isArray(data)) data = [data];
                for (const item of data) {
                    // Navigate @graph if present
                    const nodes = item['@graph'] ? item['@graph'] : [item];
                    for (const node of nodes) {
                        if (node['@type'] === 'Product' || String(node['@type']).toLowerCase().includes('product')) {
                            result.name = result.name || cleanTitle(node.name || '');
                            // Image: can be a string, array, or ImageObject
                            if (!result.imageUrl) {
                                const img = node.image;
                                if (typeof img === 'string') result.imageUrl = img;
                                else if (Array.isArray(img)) result.imageUrl = typeof img[0] === 'string' ? img[0] : (img[0] && img[0].url) || '';
                                else if (img && img.url) result.imageUrl = img.url;
                            }
                            result.specs = result.specs || node.description || '';
                            // Offers
                            const offers = node.offers;
                            if (offers && !result.price) {
                                const offerObj = Array.isArray(offers) ? offers[0] : offers;
                                result.price = result.price || String(offerObj.price || offerObj.lowPrice || '');
                            }
                        }
                    }
                }
            } catch (e) { /* skip invalid JSON */ }
        }

        // --- OpenGraph / Twitter Card meta tags ---
        const getMeta = (...selectors) => {
            for (const sel of selectors) {
                const el = doc.querySelector(sel);
                if (el) {
                    const v = el.getAttribute('content') || '';
                    if (v) return v;
                }
            }
            return '';
        };

        result.name = result.name ||
            cleanTitle(getMeta('meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[name="title"]')) ||
            cleanTitle(doc.querySelector('title')?.textContent || '');

        result.imageUrl = result.imageUrl ||
            getMeta('meta[property="og:image"]', 'meta[property="og:image:url"]', 'meta[name="twitter:image"]');

        result.specs = result.specs ||
            getMeta('meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]');

        return result;
    }

    function parseAmazon(doc, url) {
        const getText = (sel) => {
            const el = doc.querySelector(sel);
            return el ? (el.innerText || el.textContent || '').trim() : '';
        };
        const getAttr = (sel, attr) => {
            const el = doc.querySelector(sel);
            return el ? el.getAttribute(attr) || '' : '';
        };

        // Tier 1: JSON-LD + meta tags (always present in server HTML)
        const structured = parseStructuredData(doc);

        // Tier 2: Amazon-specific DOM selectors (present when JS has rendered, or in cached pages)
        const domName = getText('#productTitle') || getText('h1.a-size-large') || '';
        const priceWhole = getText('.a-price-whole').replace(/[^0-9]/g, '');
        const priceFraction = getText('.a-price-fraction').replace(/[^0-9]/g, '') || '00';
        const domPrice = priceWhole
            ? `${priceWhole}.${priceFraction}`
            : cleanPrice(getText('#priceblock_ourprice') || getText('#priceblock_dealprice') || getText('.a-price .a-offscreen'));
        let domImage = getAttr('#landingImage', 'data-old-hires') ||
            getAttr('#landingImage', 'src') ||
            getAttr('#imgBlkFront', 'src') ||
            getAttr('#main-image', 'src');

        // Tier 3: extract image URL from Amazon's JS data blob embedded in the page
        if (!domImage) {
            const imgScript = Array.from(doc.querySelectorAll('script')).find(s => s.textContent.includes('"hiRes"'));
            if (imgScript) {
                const match = imgScript.textContent.match(/"hiRes"\s*:\s*"([^"]+)"/);
                if (match) domImage = match[1];
            }
        }

        // Bullet specs
        const bulletItems = doc.querySelectorAll('#feature-bullets li span.a-list-item');
        let domSpecs = '';
        if (bulletItems.length > 0) {
            domSpecs = '<ul>' + Array.from(bulletItems)
                .map(li => `<li>${li.textContent.trim()}</li>`)
                .join('') + '</ul>';
        } else {
            domSpecs = getText('#productDescription') || '';
        }

        const name = domName || structured.name;
        const price = domPrice || structured.price;
        const imageUrl = domImage || structured.imageUrl;
        const specs = domSpecs || structured.specs;

        return { name: cleanTitle(name), price: cleanPrice(price), imageUrl, specs, currency: '₹', url };
    }

    function parseFlipkart(doc, url) {
        const getText = (sel) => {
            const el = doc.querySelector(sel);
            return el ? (el.innerText || el.textContent || '').trim() : '';
        };
        const getAttr = (sel, attr) => {
            const el = doc.querySelector(sel);
            return el ? el.getAttribute(attr) || '' : '';
        };

        // Tier 1: JSON-LD + meta tags
        const structured = parseStructuredData(doc);

        // Tier 2: Flipkart DOM selectors
        const domName = getText('.B_NuCI') || getText('h1.yhB1nd') || getText('.G6XhRU') ||
            getText('h1[class*="title"]') || getText('h1') || '';
        const domPrice = cleanPrice(getText('._30jeq3') || getText('._1_WHN1') || getText('.Nx9bqj') ||
            getText('div[class*="price"]') || '');
        const domImage = getAttr('._396cs4', 'src') || getAttr('img._2r_T1I', 'src') ||
            getAttr('._2amPTt img', 'src') || getAttr('img.q6DClP', 'src') ||
            getAttr('img[class*="product"]', 'src') || '';

        const highlightItems = doc.querySelectorAll('._1mXcCf li, .RmoJbe li, ._3Rm6K3 li');
        let domSpecs = '';
        if (highlightItems.length > 0) {
            domSpecs = '<ul>' + Array.from(highlightItems)
                .map(li => `<li>${li.textContent.trim()}</li>`)
                .join('') + '</ul>';
        } else {
            domSpecs = getText('._1AN87F') || getText('.X3BRps') || '';
        }

        const name = domName || structured.name;
        const price = domPrice || structured.price;
        const imageUrl = domImage || structured.imageUrl;
        const specs = domSpecs || structured.specs;

        return { name: cleanTitle(name), price: cleanPrice(price), imageUrl, specs, currency: '₹', url };
    }

    $('#fetchDetailsBtn').on('click', async function () {
        const url = $('#importLinkUrl').val().trim();
        if (!url) {
            showImportStatus('warning', 'Please enter a product URL.');
            return;
        }
        let urlObj;
        try {
            urlObj = new URL(url);
        } catch (e) {
            showImportStatus('danger', 'Invalid URL. Please enter a full product URL including https://');
            return;
        }

        setFetchBtnLoading(true);
        $('#importFillFormBtn').addClass('d-none');
        $('#importLinkStatus').addClass('d-none');

        try {
            const result = await fetchProductFromLink(url);
            // Ensure the URL matches exactly what the user input initially
            result.url = url;
            lastScrapedData = result;

            // If success, open the product form directly
            $('#importFillFormBtn').trigger('click');
        } catch (err) {
            console.error('Import from link error:', err);
            const isCaptcha = err.message.toLowerCase().includes('captcha') || err.message.toLowerCase().includes('robot');
            const isShortLink = $('#importLinkUrl').val().includes('amzn.to') || $('#importLinkUrl').val().includes('a.co');

            let hint = '';
            if (isCaptcha || isShortLink) {
                hint = `<div class="mt-2 small">
                    <strong>💡 Tips to fix this:</strong>
                    <ul class="mb-1 mt-1">
                        <li>Avoid short links (amzn.to). Open the product page on Amazon, copy the full URL from the address bar, and paste it here.</li>
                        <li>Amazon actively blocks automated access — if it still fails, add the product manually using the button below.</li>
                    </ul>
                </div>`;
            } else {
                hint = `<div class="mt-1 small text-muted">The site may be blocking automated access. Try a different URL or add details manually.</div>`;
            }

            showImportStatus('danger',
                `❌ <strong>Could not fetch product details.</strong><br><small>${err.message}</small>${hint}`
            );
            // Show the "open empty form" button so user isn't stuck
            $('#importFillFormBtn').removeClass('d-none').text('Open Empty Form');
        } finally {
            setFetchBtnLoading(false);
        }
    });

    // Also allow pressing Enter in the URL input
    $('#importLinkUrl').on('keydown', function (e) {
        if (e.key === 'Enter') $('#fetchDetailsBtn').trigger('click');
    });

    $('#importFillFormBtn').on('click', function () {
        if (!importLinkCategory) return;

        // Hide import modal, then open product modal
        importLinkModal.hide();

        setTimeout(() => {
            openProductModal(importLinkCategory);

            if (!lastScrapedData) {
                $('#importFillFormBtn').text('Open in Product Form'); // Reset text for next time
                return;
            }

            const d = lastScrapedData;

            // Pre-fill product form fields
            $('#prodName').val(d.name || '');
            $('#prodPrice').val(d.price || '');
            $('#prodCurrency').val(d.currency || '₹');

            // Pre-fill specs in Quill editor
            if (d.specs) {
                let specsHtml = d.specs;
                // Clean common Amazon noise from specs
                specsHtml = specsHtml
                    .replace(/About this item/i, '')
                    .replace(/See more product details/i, '')
                    .replace(/Report an issue with this product/i, '')
                    .replace(/›/g, '')
                    .trim();

                // If text contains bullets like "-" or "•" but no HTML tags, convert to list
                if (!specsHtml.includes('<') && (specsHtml.includes('\n') || specsHtml.includes('•') || specsHtml.includes('- '))) {
                    const lines = specsHtml.split(/\n|•|(?:\s-\s)/).map(l => l.trim()).filter(l => l.length > 0);
                    specsHtml = '<ul>' + lines.map(line => `<li>${line}</li>`).join('') + '</ul>';
                } else if (!specsHtml.includes('<ul') && !specsHtml.includes('<li') && specsHtml.includes('\n')) {
                    specsHtml = '<ul>' + specsHtml.split('\n').map(line => `<li>${line.trim()}</li>`).join('') + '</ul>';
                }

                // Final sanitize: if it's just raw text now, wrap in a simple tag or leave as is
                quill.root.innerHTML = specsHtml;
            }

            // Pre-fill link
            $('#linksContainer').empty();
            addLinkField(d.platform, d.url);

            // Pre-fill imported image URL if available
            if (d.imageUrl) {
                showImportedImagePreview(d.imageUrl);
            }

            $('#importFillFormBtn').text('Open in Product Form'); // Reset text
        }, 450);
    });
});
