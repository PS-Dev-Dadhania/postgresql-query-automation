// SQL Workspace Client State Manager
let editor = null;
let currentQuestionId = null;
let dbConnected = false;
let queriesData = {}; // Cache for queries metadata and saved queries
let currentSchema = {}; // Cache for DB tables and columns schema
let currentTheme = 'dark';
let activeTableRows = []; // Cache of the current results dataset rows for sorting
let activeTableHeaders = []; // Cache of current results headers

// Sidebar and Workbench Drag Splitter States
let isResizingWorkbench = false;
let isResizingSidebar = false;

// Connection parameters cache
let connectionParameters = {
    host: 'localhost',
    port: '5432',
    database: 'dvdrental',
    user: 'postgres',
    password: ''
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSettings();
    initSplitters();
    initMonaco();
    initConnectionForm();
    loadQueriesCatalog();
    initWorkspaceControls();
    initExportControls();
    initGridActions();
});

// 1. Navigation Tabs Routing
function initTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.dataset.tab;
            
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.tab-view').forEach(view => {
                view.classList.remove('active');
            });
            
            const targetView = document.getElementById(`view-${targetTab}`);
            if (targetView) targetView.classList.add('active');

            // Refresh specific view metrics
            if (targetTab === 'dashboard') {
                updateDashboard();
            } else if (targetTab === 'export-panel') {
                updateExportStatus();
            } else if (targetTab === 'queries') {
                // Monaco editor layout reflow when switching tabs
                if (editor) {
                    setTimeout(() => editor.layout(), 100);
                }
            }
        });
    });

    // Sub-panel tabs in Results Grid
    const resultTabs = document.querySelectorAll('.results-tab');
    resultTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            resultTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetContentId = `result-tab-${tab.dataset.resultTab}`;
            document.querySelectorAll('.result-tab-content').forEach(c => {
                c.classList.remove('active');
            });
            const targetContent = document.getElementById(targetContentId);
            if (targetContent) targetContent.classList.add('active');
        });
    });
}

// 2. Monaco Editor Initialization
function initMonaco() {
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: '-- Select an exercise from the left panel to begin.\n',
            language: 'sql',
            theme: currentTheme === 'dark' ? 'vs-dark' : 'vs',
            automaticLayout: true,
            fontSize: 13,
            fontFamily: 'Fira Code, Consolas, monospace',
            minimap: { enabled: false },
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false
        });

        // Resize layout listener
        window.addEventListener('resize', () => {
            if (editor) editor.layout();
        });
        
        // Load initial question
        if (currentQuestionId) {
            selectQuery(currentQuestionId);
        }
    });
}

// 3. Database Connection Actions
function initConnectionForm() {
    const testBtn = document.getElementById('btn-test-conn');
    const connectBtn = document.getElementById('btn-connect');

    testBtn.addEventListener('click', async () => {
        const params = getFormConnectionParams();
        testBtn.disabled = true;
        testBtn.innerText = 'Testing...';

        try {
            const res = await fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...params, test_only: true })
            });
            const data = await res.json();
            alert(data.message);
        } catch (err) {
            alert('Failed to contact backend: ' + err.message);
        } finally {
            testBtn.disabled = false;
            testBtn.innerText = 'Test Connection';
        }
    });

    connectBtn.addEventListener('click', async () => {
        const params = getFormConnectionParams();
        connectBtn.disabled = true;
        connectBtn.innerText = 'Connecting...';

        try {
            const res = await fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...params, test_only: false })
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                dbConnected = true;
                connectionParameters = params;
                updateConnectionState(true, params);
                loadSchemaTree();
            } else {
                dbConnected = false;
                updateConnectionState(false);
                alert('Connection Failed: ' + data.message);
            }
        } catch (err) {
            alert('Network error connecting: ' + err.message);
        } finally {
            connectBtn.disabled = false;
            connectBtn.innerText = 'Connect';
        }
    });

    // Auto-fetch credentials config from server
    fetch('/api/queries')
        .then(res => res.json())
        .then(data => {
            if (data.db_config) {
                document.getElementById('db-host').value = data.db_config.host || 'localhost';
                document.getElementById('db-port').value = data.db_config.port || '5432';
                document.getElementById('db-name').value = data.db_config.database || 'dvdrental';
                document.getElementById('db-user').value = data.db_config.user || 'postgres';
                if (data.db_config.connected) {
                    dbConnected = true;
                    connectionParameters = {
                        host: data.db_config.host,
                        port: data.db_config.port,
                        database: data.db_config.database,
                        user: data.db_config.user,
                        password: ''
                    };
                    updateConnectionState(true, connectionParameters);
                    loadSchemaTree();
                }
            }
        });
}

function getFormConnectionParams() {
    return {
        host: document.getElementById('db-host').value.trim(),
        port: document.getElementById('db-port').value.trim(),
        database: document.getElementById('db-name').value.trim(),
        user: document.getElementById('db-user').value.trim(),
        password: document.getElementById('db-password').value
    };
}

function updateConnectionState(connected, params = null) {
    const dot = document.querySelector('.status-dot');
    const card = document.getElementById('db-status-card');
    const title = document.getElementById('db-status-title');
    const msg = document.getElementById('db-status-msg');
    const details = document.getElementById('db-status-details');

    if (connected && params) {
        dot.className = 'status-dot connected';
        card.className = 'status-card-box connected';
        title.innerText = 'Connected';
        msg.innerText = `Connected successfully to PostgreSQL database: "${params.database}". Schema information is available in the SQL Workspace side menu.`;
        
        details.style.display = 'block';
        document.getElementById('active-meta-host').innerText = params.host;
        document.getElementById('active-meta-port').innerText = params.port;
        document.getElementById('active-meta-db').innerText = params.database;
        document.getElementById('active-meta-user').innerText = params.user;
    } else {
        dot.className = 'status-dot disconnected';
        card.className = 'status-card-box disconnected';
        title.innerText = 'Disconnected';
        msg.innerText = 'Database is currently offline. Input connection parameters on the left and click "Connect" to establish a connection to PostgreSQL.';
        details.style.display = 'none';
        
        // Reset Schema Explorer view
        document.getElementById('schema-tree').innerHTML = '<div class="tree-placeholder">Database disconnected. Connect to load schema tables.</div>';
    }
}

// 4. Schema Explorer (Dynamic database object tree view)
async function loadSchemaTree() {
    const container = document.getElementById('schema-tree');
    if (!dbConnected) {
        container.innerHTML = '<div class="tree-placeholder">Database disconnected. Connect to load schema tables.</div>';
        return;
    }

    container.innerHTML = '<div class="tree-placeholder">Loading database schema...</div>';

    try {
        const res = await fetch('/api/schema');
        const data = await res.json();
        
        if (data.status === 'success') {
            currentSchema = data.schema;
            renderSchemaTree(currentSchema);
        } else {
            container.innerHTML = `<div class="tree-placeholder text-secondary">Failed to load schema: ${data.message}</div>`;
        }
    } catch (err) {
        container.innerHTML = `<div class="tree-placeholder text-secondary">Connection failed: ${err.message}</div>`;
    }
}

function renderSchemaTree(schema) {
    const container = document.getElementById('schema-tree');
    container.innerHTML = '';

    const tables = Object.keys(schema).sort();
    if (tables.length === 0) {
        container.innerHTML = '<div class="tree-placeholder">No public tables found.</div>';
        return;
    }

    // Root schema node
    const rootNode = document.createElement('div');
    rootNode.className = 'tree-node-item';
    
    const rootTitle = document.createElement('div');
    rootTitle.className = 'tree-node-title';
    rootTitle.innerHTML = `
        <span class="tree-arrow expanded">▶</span>
        <span class="tree-node-icon">📦</span>
        <strong>public</strong>
    `;
    
    const rootChildren = document.createElement('div');
    rootChildren.className = 'tree-children expanded';

    // Loop over tables
    tables.forEach(tableName => {
        const tableNode = document.createElement('div');
        tableNode.className = 'tree-node';
        tableNode.dataset.tableName = tableName.toLowerCase();

        const tableTitle = document.createElement('div');
        tableTitle.className = 'tree-node-title';
        tableTitle.innerHTML = `
            <span class="tree-arrow">▶</span>
            <span class="tree-node-icon">📊</span>
            <span>${tableName}</span>
        `;

        const tableChildren = document.createElement('div');
        tableChildren.className = 'tree-children';

        // Columns leaves
        schema[tableName].forEach(col => {
            const colLeaf = document.createElement('div');
            colLeaf.className = 'tree-leaf';
            colLeaf.dataset.colName = col.name.toLowerCase();
            colLeaf.innerHTML = `
                <span>${col.name}</span>
                <span class="leaf-type">${col.type}</span>
            `;
            tableChildren.appendChild(colLeaf);
        });

        // Expand/Collapse table nodes
        tableTitle.addEventListener('click', (e) => {
            e.stopPropagation();
            const arrow = tableTitle.querySelector('.tree-arrow');
            arrow.classList.toggle('expanded');
            tableChildren.classList.toggle('expanded');
        });

        tableNode.appendChild(tableTitle);
        tableNode.appendChild(tableChildren);
        rootChildren.appendChild(tableNode);
    });

    // Expand/Collapse root node
    rootTitle.addEventListener('click', () => {
        const arrow = rootTitle.querySelector('.tree-arrow');
        arrow.classList.toggle('expanded');
        rootChildren.classList.toggle('expanded');
    });

    rootNode.appendChild(rootTitle);
    rootNode.appendChild(rootChildren);
    container.appendChild(rootNode);

    // Init schema filter search listener
    initSchemaSearchFilter();
}

function initSchemaSearchFilter() {
    const searchInput = document.getElementById('schema-search');
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const tableNodes = document.querySelectorAll('#schema-tree .tree-node');

        tableNodes.forEach(node => {
            const tableName = node.dataset.tableName;
            const columns = node.querySelectorAll('.tree-leaf');
            
            let tableMatches = tableName.includes(query);
            let anyColumnMatches = false;

            columns.forEach(col => {
                const colName = col.dataset.colName;
                if (colName.includes(query)) {
                    col.style.display = 'flex';
                    anyColumnMatches = true;
                } else {
                    col.style.display = query === '' ? 'flex' : 'none';
                }
            });

            if (query === '') {
                node.style.display = 'block';
                // Collapse everything back
                node.querySelector('.tree-children').classList.remove('expanded');
                node.querySelector('.tree-arrow').classList.remove('expanded');
            } else if (tableMatches || anyColumnMatches) {
                node.style.display = 'block';
                // Auto expand matches
                node.querySelector('.tree-children').classList.add('expanded');
                node.querySelector('.tree-arrow').classList.add('expanded');
            } else {
                node.style.display = 'none';
            }
        });
    });
}

// 5. Exercises Catalog Loading
async function loadQueriesCatalog() {
    try {
        const res = await fetch('/api/queries');
        const data = await res.json();
        queriesData = data.queries;

        const container = document.getElementById('query-list-container');
        container.innerHTML = '';

        Object.keys(queriesData).forEach(qId => {
            const q = queriesData[qId];
            
            // Sync status variables
            q.savedSql = q.savedSql || '';
            q.status = q.status || 'pending';
            q.rowsCount = q.rowsCount || 0;
            q.duration = q.duration || 0;
            q.lastExecuted = q.lastExecuted || null;
            q.errorMessage = q.errorMessage || '';

            const item = document.createElement('div');
            item.className = `query-item ${q.status}`;
            item.id = `query-item-${qId}`;
            item.dataset.qId = qId;
            item.dataset.searchKey = `${qId.toLowerCase()} ${q.question_title.toLowerCase()}`;

            let statusSymbol = '○';
            if (q.status === 'completed') statusSymbol = '✓';
            if (q.status === 'failed') statusSymbol = '✕';

            item.innerHTML = `
                <span class="q-title">${qId} - ${q.question_title}</span>
                <span class="q-status-icon">${statusSymbol}</span>
            `;

            item.addEventListener('click', () => selectQuery(qId));
            container.appendChild(item);
        });

        // Initialize Exercises filter search listener
        initExerciseSearchFilter();

        // Load Q1 by default on load
        if (Object.keys(queriesData).length > 0) {
            selectQuery(Object.keys(queriesData)[0]);
        }
        updateCompletedBadge();
    } catch (err) {
        console.error('Error loading exercises: ', err);
    }
}

function initExerciseSearchFilter() {
    const searchInput = document.getElementById('exercise-search');
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const items = document.querySelectorAll('.query-item');
        
        items.forEach(item => {
            const key = item.dataset.searchKey;
            if (key.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

function selectQuery(qId) {
    // Save draft SQL for the currently active question before switching
    if (currentQuestionId && editor && queriesData[currentQuestionId]) {
        const currentVal = editor.getValue();
        queriesData[currentQuestionId].savedSql = currentVal;
        
        // Autosave draft backend call (non-blocking)
        fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q_id: currentQuestionId, sql: currentVal })
        }).catch(err => console.warn('Autosave failed:', err));
    }

    currentQuestionId = qId;
    const q = queriesData[qId];

    // Toggle active list item indicators
    document.querySelectorAll('.query-item').forEach(item => {
        item.classList.remove('active');
    });
    const selectedItem = document.getElementById(`query-item-${qId}`);
    if (selectedItem) selectedItem.classList.add('active');

    // Fill objectives labels
    document.getElementById('active-question-id').innerText = qId;
    document.getElementById('active-question-title').innerText = q.question_title;
    document.getElementById('active-question-desc').innerText = q.description;

    // Load Monaco SQL code
    if (editor) {
        if (q.savedSql) {
            editor.setValue(q.savedSql);
        } else {
            editor.setValue(`-- ${qId}: ${q.question_title}\n-- Type or paste your PostgreSQL query below:\n\n`);
        }
    }

    // Refresh datagrid and panel states
    updateResultsGridUI(q);
}

// 6. Workbench controls (Run, Save, Clear, Template)
function initWorkspaceControls() {
    const runBtn = document.getElementById('btn-run');
    const saveBtn = document.getElementById('btn-save');
    const clearBtn = document.getElementById('btn-clear-editor');
    const loadSolutionBtn = document.getElementById('btn-load-solution');

    // Hotkeys binding (Ctrl+Enter or F5 to execute)
    window.addEventListener('keydown', (e) => {
        if (((e.ctrlKey || e.metaKey) && e.key === 'Enter') || e.key === 'F5') {
            // Verify active view is workspace queries first
            const activeTab = document.querySelector('.sidebar-nav .nav-item.active').dataset.tab;
            if (activeTab === 'queries') {
                e.preventDefault();
                runBtn.click();
            }
        }
    });

    runBtn.addEventListener('click', async () => {
        if (!currentQuestionId) return;
        if (!dbConnected) {
            alert('Database disconnected. Configure database settings inside the connection panel first.');
            document.querySelector('[data-tab="database"]').click();
            return;
        }

        const sql = editor.getValue();
        queriesData[currentQuestionId].savedSql = sql;

        runBtn.disabled = true;
        runBtn.innerHTML = '<span class="icon">⌛</span> Running...';
        updateStatusMeta('Running...', '0', '0ms');

        try {
            const res = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    q_id: currentQuestionId,
                    sql: sql,
                    connection: connectionParameters
                })
            });
            const data = await res.json();
            
            const q = queriesData[currentQuestionId];
            q.lastExecuted = new Date().toLocaleString();

            if (data.status === 'success') {
                q.status = 'completed';
                q.rowsCount = data.count;
                q.duration = data.duration;
                q.errorMessage = '';
                q.headers = data.headers;
                q.rows = data.rows;
                
                // Load result dataset cache for sorting/copy
                activeTableHeaders = data.headers;
                activeTableRows = data.rows;

                // Show Grid panel
                document.querySelector('[data-result-tab="grid"]').click();
            } else {
                q.status = 'failed';
                q.rowsCount = 0;
                q.duration = 0;
                q.errorMessage = data.message;
                q.headers = null;
                q.rows = null;
                
                activeTableHeaders = [];
                activeTableRows = [];

                // Display Error panels
                document.getElementById('tab-btn-errors').style.display = 'flex';
                document.querySelector('[data-result-tab="errors"]').click();
            }

            updateQueryListItemUI(currentQuestionId, q);
            updateResultsGridUI(q);
            updateCompletedBadge();
        } catch (err) {
            alert('Execution transport error: ' + err.message);
        } finally {
            runBtn.disabled = false;
            runBtn.innerHTML = `
                <svg viewBox="0 0 16 16" class="btn-icon-svg" fill="currentColor"><path d="M3 2.697L13.396 8 3 13.303V2.697z"/></svg>
                Run Query
            `;
        }
    });

    saveBtn.addEventListener('click', async () => {
        if (!currentQuestionId) return;
        const sql = editor.getValue();
        queriesData[currentQuestionId].savedSql = sql;

        try {
            const res = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q_id: currentQuestionId, sql: sql })
            });
            const data = await res.json();
            if (data.status === 'success') {
                alert('Query draft saved successfully.');
            }
        } catch (err) {
            alert('Save failed: ' + err.message);
        }
    });

    clearBtn.addEventListener('click', () => {
        if (editor && confirm('Clear Monaco editor code?')) {
            editor.setValue('');
        }
    });

    loadSolutionBtn.addEventListener('click', () => {
        if (!currentQuestionId) return;
        if (confirm('Load preloaded solution query template? This will replace current editor contents.')) {
            fetch('/api/queries')
                .then(res => res.json())
                .then(data => {
                    const sol = data.queries[currentQuestionId].solution_sql;
                    if (sol) {
                        editor.setValue(sol);
                        queriesData[currentQuestionId].savedSql = sol;
                    }
                });
        }
    });
}

function updateQueryListItemUI(qId, q) {
    const item = document.getElementById(`query-item-${qId}`);
    if (item) {
        item.className = `query-item ${q.status}`;
        if (qId === currentQuestionId) item.classList.add('active');

        const statusIcon = item.querySelector('.q-status-icon');
        if (q.status === 'completed') statusIcon.innerText = '✓';
        else if (q.status === 'failed') statusIcon.innerText = '✕';
        else statusIcon.innerText = '○';
    }
}

function updateCompletedBadge() {
    let count = 0;
    Object.keys(queriesData).forEach(qId => {
        if (queriesData[qId].status === 'completed') count++;
    });
    const badge = document.getElementById('completed-badge');
    if (badge) badge.innerText = `${count}/15`;
}

// 7. Results Grid rendering and enhancements
function updateResultsGridUI(q) {
    const gridContent = document.getElementById('result-tab-grid');
    const logsContent = document.getElementById('execution-logs-output');
    const errorTabBtn = document.getElementById('tab-btn-errors');
    
    // Status Metadata values
    let displayStatus = 'Idle';
    if (q.status === 'completed') displayStatus = 'Success';
    if (q.status === 'failed') displayStatus = 'Error';
    updateStatusMeta(displayStatus, q.rowsCount, `${Math.round(q.duration)}ms`);

    // Reset toolbar action buttons visibility
    const copyBtn = document.getElementById('btn-copy-selection');
    const csvBtn = document.getElementById('btn-export-csv');
    copyBtn.style.display = 'none';
    csvBtn.style.display = 'none';

    // Renders table
    if (q.status === 'completed' && q.headers && q.headers.length > 0) {
        errorTabBtn.style.display = 'none';
        copyBtn.style.display = 'inline-block';
        csvBtn.style.display = 'inline-block';
        renderResultsTable(q.headers, q.rows);
    } else if (q.status === 'failed') {
        errorTabBtn.style.display = 'flex';
        gridContent.innerHTML = `
            <div class="grid-placeholder text-secondary">
                <span>Query failed. Check "Execution Log" or "Errors & Details" for error diagnostics.</span>
            </div>
        `;

        // Render error panels details
        document.getElementById('error-box-msg').innerText = q.errorMessage;
        document.getElementById('error-box-location').innerText = q.lastExecuted || 'Unknown';
        document.getElementById('error-box-hints').innerText = getTroubleshootingHints(q.errorMessage);
    } else {
        errorTabBtn.style.display = 'none';
        gridContent.innerHTML = `
            <div class="grid-placeholder">
                <span>No active results dataset. Run a successful query.</span>
            </div>
        `;
    }

    // Render Logs view
    if (q.status === 'failed') {
        logsContent.className = 'logs-container error';
        logsContent.innerText = `[ERROR] Execution failed at ${q.lastExecuted}\n\n${q.errorMessage}`;
    } else if (q.status === 'completed') {
        logsContent.className = 'logs-container';
        logsContent.innerText = `[SUCCESS] Run successfully completed at ${q.lastExecuted}\nRows returned: ${q.rowsCount}\nDuration: ${q.duration} ms`;
    } else {
        logsContent.className = 'logs-container';
        logsContent.innerText = 'No execution logs yet. Write SQL and click Run.';
    }
}

function updateStatusMeta(status, rows, time) {
    document.getElementById('meta-status').querySelector('span').innerText = status;
    document.getElementById('meta-rows').querySelector('span').innerText = rows;
    document.getElementById('meta-time').querySelector('span').innerText = time;
}

function renderResultsTable(headers, rows) {
    const gridContent = document.getElementById('result-tab-grid');
    
    let theadHtml = '<tr>';
    headers.forEach((h, idx) => {
        theadHtml += `<th class="sortable-th" data-col-idx="${idx}" title="Click to sort column">${h} <span class="sort-indicator"></span></th>`;
    });
    theadHtml += '</tr>';

    let tbodyHtml = '';
    if (rows && rows.length > 0) {
        rows.forEach((row, rowIdx) => {
            tbodyHtml += `<tr data-row-idx="${rowIdx}">`;
            row.forEach(val => {
                let cellClass = '';
                let displayVal = val;
                
                if (val === null) {
                    displayVal = 'NULL';
                    cellClass = 'text-secondary';
                } else if (typeof val === 'number') {
                    cellClass = 'num';
                    displayVal = Number.isInteger(val) ? val.toLocaleString() : val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                } else if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
                    cellClass = 'date';
                }
                tbodyHtml += `<td class="${cellClass}">${displayVal}</td>`;
            });
            tbodyHtml += '</tr>';
        });
    } else {
        tbodyHtml = `<tr><td colspan="${headers.length}" class="text-secondary" style="text-align: center; padding: 24px;">Zero records returned.</td></tr>`;
    }

    gridContent.innerHTML = `
        <div class="grid-table-container">
            <table id="results-table">
                <thead>${theadHtml}</thead>
                <tbody>${tbodyHtml}</tbody>
            </table>
        </div>
    `;

    // Hook sort event handlers
    const headerTHs = gridContent.querySelectorAll('.sortable-th');
    headerTHs.forEach(th => {
        th.addEventListener('click', () => {
            const idx = parseInt(th.dataset.colIdx);
            sortTableByColumn(idx, th);
        });
    });

    // Grid selection cell copy setup
    initGridTableSelection();
}

// 8. Sorting & Copy Actions
let sortDirection = {}; // stores column index -> direction ('asc' / 'desc')

function sortTableByColumn(colIdx, thEl) {
    const direction = sortDirection[colIdx] === 'asc' ? 'desc' : 'asc';
    sortDirection = {}; // Clear others
    sortDirection[colIdx] = direction;

    // Reset other headers indicators
    document.querySelectorAll('.sortable-th').forEach(el => {
        el.querySelector('.sort-indicator').innerText = '';
    });
    thEl.querySelector('.sort-indicator').innerText = direction === 'asc' ? ' ▴' : ' ▾';

    // Sort rows logic
    activeTableRows.sort((a, b) => {
        let valA = a[colIdx];
        let valB = b[colIdx];

        if (valA === null) return direction === 'asc' ? -1 : 1;
        if (valB === null) return direction === 'asc' ? 1 : -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
            return direction === 'asc' ? valA - valB : valB - valA;
        }
        
        // String sort fallback
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    // Re-render table body
    const tbody = document.querySelector('#results-table tbody');
    let tbodyHtml = '';
    
    activeTableRows.forEach((row, rowIdx) => {
        tbodyHtml += `<tr data-row-idx="${rowIdx}">`;
        row.forEach(val => {
            let cellClass = '';
            let displayVal = val;
            
            if (val === null) {
                displayVal = 'NULL';
                cellClass = 'text-secondary';
            } else if (typeof val === 'number') {
                cellClass = 'num';
                displayVal = Number.isInteger(val) ? val.toLocaleString() : val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            } else if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
                cellClass = 'date';
            }
            tbodyHtml += `<td class="${cellClass}">${displayVal}</td>`;
        });
        tbodyHtml += '</tr>';
    });

    tbody.innerHTML = tbodyHtml;
    initGridTableSelection(); // Rebind selection event listeners
}

function initGridTableSelection() {
    const cells = document.querySelectorAll('#results-table tbody td');
    cells.forEach(cell => {
        cell.addEventListener('mousedown', (e) => {
            // Drag grid cell selector (simulate DBeaver highlight cells copy)
            if (e.shiftKey) {
                cell.classList.toggle('grid-cell-selected');
            } else {
                document.querySelectorAll('.grid-cell-selected').forEach(c => {
                    c.classList.remove('grid-cell-selected');
                });
                cell.classList.add('grid-cell-selected');
            }
        });
    });
}

function initGridActions() {
    const copyBtn = document.getElementById('btn-copy-selection');
    const csvBtn = document.getElementById('btn-export-csv');

    copyBtn.addEventListener('click', () => {
        const selected = document.querySelectorAll('.grid-cell-selected');
        let textToCopy = '';

        if (selected.length > 0) {
            // Copy highlighted cells only
            let currentStr = '';
            let lastRow = null;
            selected.forEach(c => {
                const parentRow = c.parentElement;
                if (lastRow !== null && parentRow !== lastRow) {
                    textToCopy += currentStr.trim() + '\n';
                    currentStr = '';
                }
                currentStr += c.innerText + '\t';
                lastRow = parentRow;
            });
            textToCopy += currentStr.trim();
        } else {
            // Export complete table representation as CSV/TSV format to clipboard
            textToCopy += activeTableHeaders.join('\t') + '\n';
            activeTableRows.forEach(row => {
                const formatted = row.map(v => v === null ? 'NULL' : v);
                textToCopy += formatted.join('\t') + '\n';
            });
        }

        navigator.clipboard.writeText(textToCopy)
            .then(() => alert('Table cells copied to clipboard.'))
            .catch(err => alert('Failed to copy to clipboard: ' + err.message));
    });

    csvBtn.addEventListener('click', () => {
        if (activeTableHeaders.length === 0) return;
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += activeTableHeaders.map(h => `"${h}"`).join(",") + "\n";
        
        activeTableRows.forEach(row => {
            const formatted = row.map(v => {
                if (v === null) return '""';
                if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;
                return v;
            });
            csvContent += formatted.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `query_result_${currentQuestionId || 'export'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

function getTroubleshootingHints(msg) {
    const m = msg.toLowerCase();
    if (m.includes('relation') && m.includes('does not exist')) {
        return 'The query references a table name that does not exist in the public schema of the dvdrental database. Check spelling or check the Tables list in the Schema Explorer (e.g. film, customer, payment, rental).';
    }
    if (m.includes('syntax error')) {
        return 'Syntax error in SQL text. Check spelling of SELECT keywords, verify commas separating fields, check that open parentheses match closing parentheses, and ensure semicolons terminate instructions blocks.';
    }
    if (m.includes('column') && m.includes('does not exist')) {
        return 'The query references a column name that is missing or misspelled. Look up the columns and their respective names in the Schema Explorer under the corresponding Table card.';
    }
    if (m.includes('ambiguous')) {
        return 'A column name references multiple tables in a JOIN. Specify the table source alias explicitly for this column (e.g. c.customer_id instead of customer_id).';
    }
    return 'Database driver returned query exception. Please verify your join conditions, syntax, and verify group by definitions for aggregate fields.';
}

// 9. Dashboard Refresh Logic
function updateDashboard() {
    const dbLabel = document.getElementById('dash-db-name');
    const compRate = document.getElementById('dash-completion-rate');
    const compFill = document.getElementById('dash-progress-fill');
    const compCount = document.getElementById('dash-completed-count');
    const pendCount = document.getElementById('dash-pending-count');
    const tableBody = document.getElementById('dash-table-body');
    const wbStatus = document.getElementById('dash-workbook-status');

    dbLabel.innerText = dbConnected ? `${connectionParameters.database}@${connectionParameters.host}` : 'Disconnected';

    let completed = 0;
    let failed = 0;
    let pending = 0;

    Object.keys(queriesData).forEach(qId => {
        const q = queriesData[qId];
        if (q.status === 'completed') completed++;
        else if (q.status === 'failed') failed++;
        else pending++;
    });

    const total = 15;
    const rate = Math.round((completed / total) * 100);

    compRate.innerText = `${rate}%`;
    compFill.style.width = `${rate}%`;
    compCount.innerText = `${completed} / ${total} completed`;
    pendCount.innerText = pending;

    // Refresh exercises progress grid table
    tableBody.innerHTML = '';
    Object.keys(queriesData).forEach(qId => {
        const q = queriesData[qId];
        let badge = `<span class="activity-badge none">Not Run</span>`;
        if (q.status === 'completed') badge = `<span class="activity-badge run">Success</span>`;
        else if (q.status === 'failed') badge = `<span class="activity-badge error">Failed</span>`;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${qId}</strong></td>
            <td>${q.question_title}</td>
            <td>${badge}</td>
            <td>${q.status === 'completed' ? q.rowsCount.toLocaleString() : '-'}</td>
            <td>${q.status === 'completed' ? Math.round(q.duration) + ' ms' : '-'}</td>
            <td>${q.lastExecuted ? q.lastExecuted : '-'}</td>
        `;

        row.addEventListener('click', () => {
            document.querySelector('[data-tab="queries"]').click();
            selectQuery(qId);
        });

        tableBody.appendChild(row);
    });
}

// 10. Excel Export compiling logic
function updateExportStatus() {
    let completedCount = 0;
    Object.keys(queriesData).forEach(qId => {
        if (queriesData[qId].status === 'completed') completedCount++;
    });
    document.getElementById('export-active-count').innerText = `${completedCount} / 15 sheets`;
}

function initExportControls() {
    const exportBtn = document.getElementById('btn-export-excel');
    const progressPanel = document.querySelector('.export-progress-panel');
    const progressFill = document.getElementById('export-progress-fill');
    const successMsg = document.getElementById('export-success-message');
    const errorMsg = document.getElementById('export-error-message');
    const consoleLog = document.getElementById('export-log-output');

    exportBtn.addEventListener('click', async () => {
        let exportSheets = [];
        let logLines = ["Initiating Excel report compiler..."];
        consoleLog.innerText = logLines.join("\n");

        Object.keys(queriesData).forEach(qId => {
            const q = queriesData[qId];
            if (q.status === 'completed' || q.status === 'failed') {
                exportSheets.push({
                    q_id: qId,
                    status: q.status,
                    title: q.question_title,
                    description: q.description,
                    sql_query: q.savedSql,
                    headers: q.headers || [],
                    rows: q.rows || [],
                    errorMessage: q.errorMessage || '',
                    duration: q.duration,
                    timestamp: q.lastExecuted || new Date().toLocaleString(),
                    database: dbConnected ? connectionParameters.database : 'dvdrental'
                });
                if (q.status === 'completed') {
                    logLines.push(`[COMPILE] Staging worksheet "${qId}" (Success, ${q.rowsCount} rows)...`);
                } else {
                    logLines.push(`[COMPILE] Staging worksheet "${qId}" (FAILED)...`);
                }
            } else {
                logLines.push(`[SKIP] Worksheet "${qId}" has not been executed yet. Skipping.`);
            }
        });

        if (exportSheets.length === 0) {
            alert('No executed queries to export. Run at least one query successfully or failed first.');
            return;
        }

        exportBtn.disabled = true;
        progressPanel.style.display = 'block';
        successMsg.style.display = 'none';
        errorMsg.style.display = 'none';
        progressFill.style.width = '15%';
        consoleLog.innerText = logLines.join("\n");

        try {
            // Mock incremental progress transitions
            setTimeout(() => { progressFill.style.width = '45%'; }, 300);
            setTimeout(() => { progressFill.style.width = '80%'; }, 700);

            const res = await fetch('/api/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheets: exportSheets })
            });
            const data = await res.json();
            progressFill.style.width = '100%';

            if (data.status === 'success') {
                successMsg.style.display = 'block';
                successMsg.innerHTML = `<strong>Success:</strong> Excel workbook generated successfully at: <code>${data.path}</code>`;
                
                logLines.push(`[SUCCESS] Excel workbook generated successfully at "${data.path}".`);
                logLines.push("Compilation finished.");
                
                // Update Dashboard Workbook label
                document.getElementById('dash-workbook-status').innerText = `Generated (${new Date().toLocaleTimeString()})`;
                document.getElementById('dash-workbook-status').className = 'metric-value text-success';
            } else {
                errorMsg.style.display = 'block';
                errorMsg.innerText = `Export compiler failed: ${data.message}`;
                logLines.push(`[ERROR] Save failed: ${data.message}`);
            }
        } catch (err) {
            progressFill.style.width = '100%';
            errorMsg.style.display = 'block';
            errorMsg.innerText = `Network communication error: ${err.message}`;
            logLines.push(`[FATAL] Network error: ${err.message}`);
        } finally {
            exportBtn.disabled = false;
            consoleLog.innerText = logLines.join("\n");
        }
    });
}

// 11. Custom Settings Handlers
function initSettings() {
    const themeSelect = document.getElementById('setting-theme');
    const fontsizeSelect = document.getElementById('setting-fontsize');
    const resetBtn = document.getElementById('btn-reset-session');

    // Theme selector
    themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        currentTheme = theme;
        if (theme === 'light') {
            document.body.className = 'light-theme';
            if (editor) monaco.editor.setTheme('vs');
        } else {
            document.body.className = 'dark-theme';
            if (editor) monaco.editor.setTheme('vs-dark');
        }
    });

    // Fontsize selector
    fontsizeSelect.addEventListener('change', () => {
        const size = parseInt(fontsizeSelect.value);
        if (editor) {
            editor.updateOptions({ fontSize: size });
        }
    });

    // Reset drafts
    resetBtn.addEventListener('click', () => {
        if (confirm('Clear saved SQL drafts cache? This resets workspace editors but does not modify backend server databases.')) {
            Object.keys(queriesData).forEach(qId => {
                queriesData[qId].savedSql = '';
            });
            if (editor) {
                editor.setValue('');
            }
            alert('Drafts cleared. Reloading exercises...');
            loadQueriesCatalog();
        }
    });
}

// 12. Workspace Resizable Splitters
function initSplitters() {
    const splitter = document.getElementById('workbench-splitter');
    const editorPanel = document.getElementById('editor-panel-wrapper');
    const resultsPanel = document.getElementById('results-panel-wrapper');
    const parentContainer = document.querySelector('.workspace-workbench');

    splitter.addEventListener('mousedown', (e) => {
        isResizingWorkbench = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizingWorkbench) return;

        const containerRect = parentContainer.getBoundingClientRect();
        const relativeY = e.clientY - containerRect.top;
        const totalHeight = containerRect.height;
        const percentage = (relativeY / totalHeight) * 100;

        // Constraint limits (20% to 80%)
        if (percentage >= 20 && percentage <= 80) {
            editorPanel.style.height = `${percentage}%`;
            resultsPanel.style.height = `${100 - percentage}%`;
            if (editor) editor.layout();
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizingWorkbench) {
            isResizingWorkbench = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    });

    // Sidebar Inner Splitter
    const sidebarSplitter = document.querySelector('.sidebar-inner-splitter');
    const exercisesSec = document.querySelector('.exercises-section');
    const schemaSec = document.querySelector('.schema-section');
    const sidebar = document.querySelector('.workspace-sidebar');

    sidebarSplitter.addEventListener('mousedown', () => {
        isResizingSidebar = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizingSidebar) return;

        const sidebarRect = sidebar.getBoundingClientRect();
        const relativeY = e.clientY - sidebarRect.top;
        const totalHeight = sidebarRect.height;
        const percentage = (relativeY / totalHeight) * 100;

        if (percentage >= 15 && percentage <= 85) {
            exercisesSec.style.height = `${percentage}%`;
            schemaSec.style.height = `${100 - percentage}%`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizingSidebar) {
            isResizingSidebar = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    });
}
