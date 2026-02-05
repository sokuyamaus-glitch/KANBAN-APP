document.addEventListener('DOMContentLoaded', () => {
    // データ保存キー（必要なら変更してください）
    const KEY_DATA = 'kanbanDataV27_TagSystem'; 
    const PALETTE = ['#64748B', '#71717A', '#EF4444', '#F97316', '#F59E0B', '#854D0E', '#84CC16', '#22C55E', '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E'];
    
    const TYPE_LABELS = { text: '文字', number: '数値', url: 'URL', user: 'ユーザー', textarea: 'メモ', select: '選択肢(ボード固有)', checklist: 'チェックリスト', tags: '共通タグ(グループ)' };
    
    // アイコンカテゴリ（変更なし）
    const ICON_CATEGORIES = [
        { name: '基本・ステータス', icons: ['label', 'star', 'flag', 'bolt', 'priority_high', 'check_circle', 'cancel', 'error', 'info', 'help', 'verified', 'favorite', 'bookmark', 'lock', 'visibility', 'key'] },
        { name: 'アクション', icons: ['edit', 'delete', 'save', 'add', 'remove', 'search', 'settings', 'more_horiz', 'refresh', 'undo', 'done', 'close', 'check', 'thumb_up', 'thumb_down'] },
        { name: '人・連絡', icons: ['person', 'group', 'face', 'support_agent', 'sentiment_satisfied', 'mail', 'call', 'chat', 'forum', 'notifications', 'send', 'share', 'campaign'] },
        { name: '時間・場所', icons: ['schedule', 'event', 'history', 'timer', 'update', 'calendar_month', 'location_on', 'map', 'home', 'flight', 'commute', 'directions_car'] },
        { name: 'ファイル・オフィス', icons: ['attach_file', 'description', 'folder', 'topic', 'edit_note', 'checklist', 'image', 'link', 'upload', 'download', 'cloud', 'content_copy', 'archive', 'unarchive'] },
        { name: '機器・ツール', icons: ['computer', 'smartphone', 'camera_alt', 'headphones', 'keyboard', 'mouse', 'wifi', 'battery_full', 'lightbulb', 'build', 'construction', 'print'] },
        { name: 'ビジネス・お金', icons: ['paid', 'shopping_cart', 'account_balance', 'credit_card', 'receipt', 'trending_up', 'work', 'rocket_launch', 'savings', 'calculate'] },
        { name: 'その他', icons: ['nature', 'pets', 'restaurant', 'local_cafe', 'school', 'sports_soccer', 'palette', 'auto_awesome', 'diamond', 'extension', 'music_note', 'movie'] }
    ];

    const INITIAL_DATA = {
        users: [{ id: 'u1', name: '佐藤', color: '#3B82F6' }],
        // ★ 変更点: tags配列を廃止し、tagGroupsへ
        tagGroups: [
            {
                id: 'g_sample', 
                name: 'サンプルグループ', 
                tags: [{id:'t_sample1', name:'重要', color:'#EF4444'}]
            }
        ],
        settings: { theme: 'light', shortcuts: { toFocus: 'f', toBoard: 'b', toArchive: 'a', search: '/' }, alertEnabled: true, alertDays: 3 },
        archive: [],
        boards: [{
            id: 'b1', title: '✨ 開発プロジェクト', color: '#3B82F6', maxHeight: 0,
            fields: [
                { id: 'f_prio', name: '優先度', type: 'select', visible: true, icon: 'flag', options: [{id:'op1', name:'高', color:'#EF4444'}] },
                { id: 'f_user', name: '担当者', type: 'user', visible: true, icon: 'person' },
                { id: 'f_link', name: 'リンク', type: 'url', visible: true, icon: 'link' } 
            ],
            columns: [{ id: 'c1', name: 'TODO', color: '#64748B' }],
            cards: { c1: [{ id: 'c_demo', title: '機能実装', date: '', customValues: { 'f_prio': 'op1', 'f_user': 'u1' }, subtasks: [], isToday: false }] } 
        }]
    };

    let appData = loadData();
    // データ構造のマイグレーション（古いtags配列があったら消す）
    if (appData.tags && Array.isArray(appData.tags)) {
        delete appData.tags;
        if (!appData.tagGroups) appData.tagGroups = [];
    }
    if (!appData.tagGroups) appData.tagGroups = []; 
    if (!appData.archive) appData.archive = [];
    if (appData.settings.alertEnabled === undefined) appData.settings.alertEnabled = true;

    // 状態変数
    let editingCardInfo = null;
    let editingBoardId = null;
    let activeContextMenu = null;
    let currentView = 'board'; 
    let searchMode = 'filter'; 
    let activeFilters = { overdue: false, today: false, week: false, nodate: false, users: [], tags: [] };
    let isRecordingKey = false;
    let recordingTarget = null;
    
    // タグ管理用変数
    let selectedGroupId = null;

    // DOM要素
    const appContainer = document.getElementById('boards-app');
    const appSlider = document.getElementById('app-slider');
    const contextMenu = document.getElementById('context-menu');
    const fileInput = document.getElementById('file-input');
    const modalUser = document.getElementById('modal-user-mgmt');
    const modalBoard = document.getElementById('modal-board-settings');
    const modalCard = document.getElementById('modal-card-edit');
    const modalAppSettings = document.getElementById('modal-app-settings');
    const modalTagMgmt = document.getElementById('modal-global-tags');
    const searchInput = document.getElementById('search-input');
    const searchSettingsBtn = document.getElementById('search-settings-btn');
    const searchPopover = document.getElementById('search-popover');

    // 初期化実行
    renderApp();
    setupBackup();
    setupViewSwitch(); 
    setupShortcuts();
    setupAlertSettings();
    setupModalBackdropClicks();
    setupSettingsNavigation();
    setupBoardReorder();
    
    // 基本イベントリスナー
    document.getElementById('btn-add-board').addEventListener('click', createNewBoard);
    document.getElementById('btn-user-mgmt').addEventListener('click', openUserMgmt);
    document.getElementById('btn-app-settings').addEventListener('click', () => toggleModal('modal-app-settings', true));
    document.getElementById('btn-close-app-settings').addEventListener('click', () => toggleModal('modal-app-settings', false));
    
    // 共通タグ管理関連
    if(document.getElementById('btn-tag-mgmt')) document.getElementById('btn-tag-mgmt').addEventListener('click', openTagMgmt);
    if(document.getElementById('btn-close-tag-mgmt')) document.getElementById('btn-close-tag-mgmt').addEventListener('click', () => { modalTagMgmt.classList.remove('active'); renderApp(); });
    
    // グループ追加ボタン
    document.getElementById('btn-add-group').onclick = () => {
        const name = document.getElementById('new-group-name').value.trim();
        if(name) {
            const newGroup = { id: 'g_' + Date.now(), name: name, tags: [] };
            appData.tagGroups.push(newGroup);
            document.getElementById('new-group-name').value = '';
            renderGlobalTagGroups();
            saveAll();
            // 追加したグループを即選択
            selectTagGroup(newGroup.id);
        }
    };

    // タグ追加ボタン（グループ選択時のみ表示）
    document.getElementById('btn-add-global-tag').onclick = () => {
        if(!selectedGroupId) return;
        const name = document.getElementById('new-tag-name').value.trim();
        const color = document.getElementById('new-tag-color-btn').dataset.value;
        const group = appData.tagGroups.find(g => g.id === selectedGroupId);
        if(name && group) {
            group.tags.push({ id: 't_' + Date.now(), name: name, color: color });
            document.getElementById('new-tag-name').value = '';
            renderGlobalTagList(); // リスト再描画
            saveAll();
        }
    };

    // 検索関連
    searchSettingsBtn.addEventListener('click', (e) => { e.stopPropagation(); renderDynamicFilters(); searchPopover.classList.toggle('active'); });
    searchInput.addEventListener('input', performSearch);
    document.getElementsByName('search-mode').forEach(radio => radio.addEventListener('change', (e) => { searchMode = e.target.value; performSearch(); }));
    
    // クリックイベント（閉じる処理など）
    document.addEventListener('click', (e) => {
        if(!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
        if(!e.target.closest('.color-picker-wrapper')) closeAllColorPopovers();
        if(!e.target.closest('.search-wrapper')) searchPopover.classList.remove('active');
        if(!e.target.closest('.icon-picker-popover')) document.querySelectorAll('.icon-picker-popover').forEach(p => p.classList.remove('active'));
    });

    // ----------------------------------------------------
    // ★ 共通タグ管理ロジック (V2 Updated)
    // ----------------------------------------------------
    
    // サイドバーのグループ一覧を描画
    function renderGlobalTagGroups() {
        const list = document.getElementById('tag-group-list');
        list.innerHTML = '';
        
        appData.tagGroups.forEach(group => {
            const div = document.createElement('div');
            // クラス名を変更: selectable-item -> group-item
            div.className = 'group-item';
            if(group.id === selectedGroupId) div.classList.add('active');
            
            // HTML構造を変更（名前、カウント、削除ボタン）
            div.innerHTML = `
                <div class="group-info">
                    <span class="material-symbols-outlined" style="font-size:16px; opacity:0.7;">folder</span>
                    <span class="group-name">${group.name}</span>
                    <span class="group-count">${group.tags.length}</span>
                </div>
            `;
            
            // 削除ボタン
            const delBtn = document.createElement('button');
            delBtn.className = 'group-delete-btn';
            delBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">close</span>';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if(confirm(`グループ「${group.name}」を削除しますか？\n登録されているタグも全て削除されます。`)) {
                    appData.tagGroups = appData.tagGroups.filter(g => g.id !== group.id);
                    if(selectedGroupId === group.id) selectedGroupId = null;
                    saveAll();
                    renderGlobalTagGroups();
                    updateTagViewArea();
                }
            };

            div.onclick = () => selectTagGroup(group.id);
            div.appendChild(delBtn);
            list.appendChild(div);
        });
    }

    // メインエリアの表示切り替え（Empty State vs コンテンツ）
    function updateTagViewArea() {
        const emptyState = document.getElementById('tag-empty-state');
        const contentArea = document.getElementById('tag-content-area');
        
        // グループ未選択時
        if(!selectedGroupId) {
            emptyState.style.display = 'flex';
            contentArea.style.display = 'none';
            return;
        }

        const group = appData.tagGroups.find(g => g.id === selectedGroupId);
        if(!group) { // 万が一見つからない場合
             emptyState.style.display = 'flex';
             contentArea.style.display = 'none';
             return;
        }

        // 選択時
        emptyState.style.display = 'none';
        contentArea.style.display = 'flex';
        
        document.getElementById('current-group-name').textContent = group.name;
        renderGlobalTagList();
    }

    // ----------------------------------------------------
    // ★ 手順1: この関数を上書きしてください
    // ----------------------------------------------------
    function renderGlobalTagList() {
        const container = document.getElementById('tag-list-container');
        const group = appData.tagGroups.find(g => g.id === selectedGroupId);
        if(!group) return;

        container.innerHTML = '';
        if(group.tags.length === 0) {
            container.innerHTML = '<div style="width:100%; text-align:center; padding:40px; color:#ccc; font-size:13px;">タグがまだありません。<br>下から追加してください。</div>';
            return;
        }

        group.tags.forEach((tag, idx) => {
            const chip = document.createElement('div');
            chip.className = 'tag-chip-item';
            
            chip.innerHTML = `
                <div class="tag-color-dot" style="background-color:${tag.color};"></div>
                <span style="font-weight:600;">${tag.name}</span>
                <span class="material-symbols-outlined del-tag-btn" style="font-size:14px; cursor:pointer; opacity:0.4; margin-left:4px;">close</span>
            `;

            // ★ ここが追加機能: 右クリックでメニューを開く
            chip.addEventListener('contextmenu', (e) => {
                e.preventDefault(); // ブラウザの右クリックメニューを出さない
                
                // 既存のメニュー関数を呼び出す
                openContextMenu(e, tag, 'tag', () => {
                    saveAll();              // 保存
                    renderGlobalTagList();  // リスト再描画 (色や名前を反映)
                });
            });
            
            // 削除ボタン処理
            chip.querySelector('.del-tag-btn').onclick = (e) => {
                e.stopPropagation();
                if(confirm(`タグ「${tag.name}」を削除しますか？`)) {
                    group.tags.splice(idx, 1);
                    saveAll();
                    renderGlobalTagList();
                    renderGlobalTagGroups(); 
                }
            };
            container.appendChild(chip);
        });
    }
    
    // ▼ この関数が不足していたため追加してください
    function openTagMgmt() {
        // 1. データを描画
        renderGlobalTagGroups();
        
        // 2. 選択状態をリセット
        selectedGroupId = null;
        updateTagViewArea(); // これで「左側から選択してください」が表示されます

        // 3. モーダルを表示
        const modal = document.getElementById('modal-global-tags');
        if(modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // 背景スクロール停止
        }

        // 4. 新規タグ追加用のカラーピッカーをセットアップ
        // (新しいUIのIDに合わせて初期化)
        setupColorPickerBtn(
            'new-tag-color-btn', 
            'new-tag-color-popover', 
            'new-tag-color-grid', 
            (c) => {
                const btn = document.getElementById('new-tag-color-btn');
                if(btn) {
                    btn.dataset.value = c;
                    btn.style.backgroundColor = c;
                }
            }
        );
        
        // カラーピッカーの初期色を設定
        const btn = document.getElementById('new-tag-color-btn');
        if(btn && !btn.dataset.value) {
            btn.dataset.value = '#10B981';
            btn.style.backgroundColor = '#10B981';
        }
    }

    function selectTagGroup(groupId) {
        // 選ばれたIDを記憶する
        selectedGroupId = groupId;
        
        // リストを再描画（これでクリックした項目が青くなります）
        renderGlobalTagGroups(); 
        
        // 右側の表示を更新（タグ一覧を表示）
        updateTagViewArea();     
    }

    // ----------------------------------------------------
    // App Rendering (Board, Columns, Cards)
    // ----------------------------------------------------
    function getLightColor(hex, opacity = 0.1) {
        if(!/^#([0-9A-F]{3}){1,2}$/i.test(hex)) return hex;
        let c = hex.substring(1).split('');
        if(c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        c = '0x'+c.join('');
        return `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(',')},${opacity})`;
    }

    function renderApp() {
        if(!appContainer) return;
        appContainer.innerHTML = '';
        if(!appData.boards || appData.boards.length === 0) {
            appContainer.innerHTML = '<div style="text-align:center; color:#666; margin-top:50px;">ボードがありません。「新しいボードを追加」してください。</div>';
            return;
        }
        appData.boards.forEach(board => {
            const wrapper = document.createElement('div');
            wrapper.className = 'board-wrapper';
            const glowColor = getLightColor(board.color, 0.6);
            wrapper.style.boxShadow = `0 10px 20px -10px ${glowColor}`;
            wrapper.style.borderColor = getLightColor(board.color, 0.5);

            wrapper.innerHTML = `
                <div class="board-header">
                    <div class="board-title"><span class="board-color-bar" style="background-color: ${board.color}"></span>${board.title}</div>
                    <button class="btn btn-outline btn-sm settings-btn">⚙️ ボード設定</button>
                </div>
                <div class="board-columns" id="columns-${board.id}"></div>
            `;
            wrapper.querySelector('.settings-btn').addEventListener('click', () => openBoardSettings(board.id));
            const columnsContainer = wrapper.querySelector(`#columns-${board.id}`);

            if(board.columns) {
                board.columns.forEach(col => {
                    const colDiv = document.createElement('div');
                    colDiv.className = 'column';
                    const baseColor = col.color || '#64748B';
                    colDiv.style.backgroundColor = getLightColor(baseColor);
                    colDiv.style.borderTopColor = baseColor;
                    const cardCount = (board.cards[col.id] || []).length;
                    
                    colDiv.innerHTML = `
                        <div class="column-header-area">
                            <h3 style="color:${baseColor}">
                                ${col.name}
                                <span id="col-count-${col.id}" style="font-size:12px; color:var(--text-color); opacity:0.5; margin-left:8px; font-weight:normal;">${cardCount}</span>
                            </h3>
                            <span class="column-menu-btn">•••</span>
                        </div>
                        <div class="card-list" data-board-id="${board.id}" data-column-id="${col.id}"></div>
                        <button class="add-card-btn">＋ タスク追加</button>
                    `;
                    
                    const menuBtn = colDiv.querySelector('.column-menu-btn');
                    menuBtn.onclick = (e) => { e.stopPropagation(); openContextMenu(e, col, 'column', () => { renderApp(); saveAll(); }); };
                    colDiv.querySelector('.column-header-area').oncontextmenu = (e) => { e.preventDefault(); openContextMenu(e, col, 'column', () => { renderApp(); saveAll(); }); };
                    
                    const list = colDiv.querySelector('.card-list');
                    if(board.maxHeight && board.maxHeight > 0) list.style.maxHeight = board.maxHeight + 'px';
                    
                    // ドラッグ＆ドロップ設定
                    setupDragAndDrop(list);
                    
                    colDiv.querySelector('.add-card-btn').addEventListener('click', () => addNewCard(board.id, col.id));
                    
                    const cards = board.cards[col.id] || [];
                    cards.forEach(cardData => { list.appendChild(createCardElement(cardData, board)); });
                    columnsContainer.appendChild(colDiv);
                });
            }
            appContainer.appendChild(wrapper);
        });
        performSearch();
    }

    // ----------------------------------------------------
    // Create Card Element (Display)
    // ----------------------------------------------------
    function createCardElement(data, board) {
        const card = document.createElement('div');
        card.className = 'card';
        if (data.isToday) card.classList.add('is-today');

        // Alert Status
        let alertStatus = 'normal';
        if (appData.settings.alertEnabled !== false && data.date) {
            const today = new Date(); today.setHours(0,0,0,0);
            const targetDate = new Date(data.date); targetDate.setHours(0,0,0,0);
            const diffTime = targetDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            const warningDays = appData.settings.alertDays || 3;

            if (diffDays < 0) { alertStatus = 'danger'; card.classList.add('glow-danger'); } 
            else if (diffDays >= 0 && diffDays <= warningDays) { alertStatus = 'warning'; card.classList.add('glow-warning'); }
        }

        const pilotLight = document.createElement('span');
        pilotLight.className = 'pilot-light';
        if (alertStatus === 'warning') pilotLight.classList.add('status-warning');
        if (alertStatus === 'danger') pilotLight.classList.add('status-danger');

        const starBtn = document.createElement('span');
        starBtn.className = `star-btn ${data.isToday ? 'active' : ''}`;
        starBtn.textContent = '★';
        starBtn.onclick = (e) => { e.stopPropagation(); data.isToday = !data.isToday; saveAll(); if (currentView === 'board') renderApp(); else renderFocusMode(); };

        let html = `<div class="card-title" style="padding-right:20px;">${data.title}</div>`;
        if (data.date) {
            const dateColor = alertStatus === 'danger' ? 'color:#EF4444; font-weight:bold;' : '';
            html += `<div class="card-row"><span class="card-label">期限</span><span class="card-value" style="${dateColor}">${data.date}</span></div>`;
        }

        if (board.fields) {
            board.fields.forEach(f => {
                if (f.visible === false) return;
                const val = data.customValues ? data.customValues[f.id] : null;
                let content = '';

                if (f.type === 'select') {
                    // ボード固有の選択肢
                    const o = f.options ? f.options.find(op => op.id === val) : null;
                    if (o && val) content = `<span class="badge" style="background-color:${o.color}">${o.name}</span>`;
                } else if (f.type === 'tags') {
                    // ★ 共通タグ（グループ指定）
                    if (val && f.groupId) {
                        const group = appData.tagGroups.find(g => g.id === f.groupId);
                        if (group) {
                            const t = group.tags.find(tag => tag.id === val);
                            if (t) content = `<span class="badge" style="background-color:${t.color}">${t.name}</span>`;
                        }
                    }
                } else if (f.type === 'user') {
                    const u = appData.users.find(us => us.id === val);
                    if (u && val) {
                        // ★ ここを変更: lastNameがあればそれを、なければname(フルネーム)を表示
                        const displayName = u.lastName || u.name;
                        content = `<span class="badge" style="background-color:${u.color}">${displayName}</span>`;
                    }
                } else if (f.type === 'url' && val) content = `<a href="${val}" target="kanban_mail_window">🔗 Link</a>`;
                else if (f.type === 'textarea' && val) content = `📄 メモあり`;
                else if (f.type === 'checklist') {
                    const tasks = Array.isArray(val) ? val : [];
                    if (tasks.length > 0) {
                        const total = tasks.length; const done = tasks.filter(t => t.done).length; const isAllDone = total > 0 && total === done;
                        content = `<div class="progress-badge ${isAllDone ? 'completed' : ''}" style="margin:0;"><span>${isAllDone ? '☑' : '☐'}</span><span>${done}/${total}</span></div>`;
                    }
                } else {
                    if (val) content = val;
                }

                if (content) {
                    const iconHtml = f.icon ? `<span class="material-symbols-outlined" style="font-size:14px; color:var(--text-color); opacity:0.7;">${f.icon}</span>` : '';
                    html += `<div class="card-row"><span class="card-label">${iconHtml}${f.name}</span><div class="card-value">${content}</div></div>`;
                }
            });
        }

        card.innerHTML = html;
        card.querySelector('.card-title').prepend(starBtn);
        card.querySelector('.card-title').prepend(pilotLight);

        card.addEventListener('click', (e) => { e.stopPropagation(); openCardEdit(board.id, data); });
        card._cardData = data;
        return card;
    }
// ----------------------------------------------------
    // ▼ 消えてしまった関数を復元 (アイコンピッカー生成ヘルパー)
    // ----------------------------------------------------
    function createIconPickerContent(container, currentIcon, onSelect) {
        container.innerHTML = '';
        
        // 解除ボタン
        const clearBtn = document.createElement('div'); 
        clearBtn.innerHTML = '🚫 解除'; 
        clearBtn.style.textAlign='center'; clearBtn.style.cursor='pointer'; 
        clearBtn.style.fontSize='12px'; clearBtn.style.marginBottom='5px';
        clearBtn.onclick = (e) => { e.stopPropagation(); onSelect(null); }; 
        container.appendChild(clearBtn);

        // カテゴリごとのアイコン一覧
        ICON_CATEGORIES.forEach(cat => {
            const h = document.createElement('div'); 
            h.className = 'icon-category-header'; 
            h.textContent = cat.name; 
            container.appendChild(h);
            
            const g = document.createElement('div'); 
            g.className = 'icon-grid';
            cat.icons.forEach(ic => {
                const d = document.createElement('div'); 
                d.className = 'icon-option'; 
                if(currentIcon===ic) d.classList.add('selected');
                d.innerHTML = `<span class="material-symbols-outlined">${ic}</span>`;
                d.onclick = (e) => { e.stopPropagation(); onSelect(ic); }; 
                g.appendChild(d);
            });
            container.appendChild(g);
        });
    }
    // ----------------------------------------------------
    // Board Settings (Modified for New Design)
    // ----------------------------------------------------
    function openBoardSettings(boardId) { 
        editingBoardId = boardId; 
        const board = appData.boards.find(b => b.id === boardId); 
        
        // ▼▼▼ 修正コード ▼▼▼
        // 1回目(modal-content)か、2回目以降(bs-container)か、どちらでも取得できるようにする
        let contentArea = modalBoard.querySelector('.modal-content') || modalBoard.querySelector('.bs-container');
        
        // 万が一空っぽなら作成するガード処理
        if (!contentArea) {
            contentArea = document.createElement('div');
            modalBoard.appendChild(contentArea);
        }
        // HTML構造の生成 (New Design)
        // ※モーダルの外枠(modal-content)の中身を全部入れ替えます
        const html = `
            <div class="bs-header">
                <h2 class="bs-title">ボード設定</h2>
                <button class="bs-close-btn" id="board-close-btn-top">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>

            <div class="bs-body custom-scrollbar">
                
                <div class="bs-grid-row">
                    <div class="bs-input-group" style="flex:1;">
                        <label>ボード名</label>
                        <input type="text" class="bs-input-text" id="board-name-input" value="${board.title}">
                    </div>
                    <div class="bs-input-group" style="display:flex; flex-direction:column; align-items:flex-end;">
                        <label>テーマ色</label>
                        <div class="color-picker-wrapper">
                            <div class="bs-color-preview" id="board-color-btn" style="background-color: ${board.color};"></div>
                            <div class="color-picker-popover" id="board-color-popover">
                                <div class="color-grid" id="board-color-grid"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <div class="bs-slider-header">
                        <label class="bs-input-group" style="margin:0; font-size:14px; font-weight:600;">列の最大高さ</label>
                        <span class="bs-slider-val" id="height-val-disp">Auto</span>
                    </div>
                    <input type="range" class="bs-range-input" id="board-height-input" min="200" max="1000" step="50">
                </div>

                <div>
                    <div class="bs-section-title">
                        <span class="material-symbols-outlined" style="color:#9ca3af;">settings</span>
                        <span>入力項目の管理</span>
                    </div>
                    <div class="bs-list-container">
                        <div id="field-list-container"></div>
                        <div class="bs-add-row" id="field-add-form-area"></div>
                    </div>
                </div>

                <div>
                    <div class="bs-section-title">
                        <span class="material-symbols-outlined" style="color:#9ca3af;">view_column</span>
                        <span>列 (ワークフロー) と背景色</span>
                    </div>
                    <div class="bs-list-container">
                        <div id="column-list-container"></div>
                        <div class="bs-add-row">
                            <div class="color-picker-wrapper">
                                <div class="bs-color-preview" id="new-col-color-btn" style="width:32px; height:32px; background-color:#64748B;"></div>
                                <div class="color-picker-popover" id="new-col-color-popover">
                                    <div class="color-grid" id="new-col-color-grid"></div>
                                </div>
                            </div>
                            <input type="text" class="bs-add-input" id="new-column-name" placeholder="新しい列名">
                            <button class="bs-btn-sm" id="add-column-btn">追加</button>
                        </div>
                    </div>
                </div>

            </div>

            <div class="bs-footer">
                <button class="bs-btn-delete" id="board-delete-btn">
                    <span class="material-symbols-outlined" style="font-size:18px;">delete_forever</span>
                    ボードごと削除
                </button>
                <button class="bs-btn-primary" id="board-close-btn">完了</button>
            </div>
        `;
        
        // コンテナクラスの適用とHTML注入
        contentArea.className = 'bs-container'; // クラスを上書きしてスタイル適用
        contentArea.innerHTML = html;

        // --- イベント設定 ---

        // 名前変更
        const nameInput = document.getElementById('board-name-input');
        nameInput.onchange = (e) => { board.title = e.target.value; saveAll(); renderApp(); }; 
        
        // 色変更
        setupColorPickerBtn('board-color-btn', 'board-color-popover', 'board-color-grid', (c) => { 
            board.color = c; saveAll(); renderApp(); 
        }); 
        
        // 高さスライダー
        const slider = document.getElementById('board-height-input'); 
        slider.value = (board.maxHeight > 0) ? board.maxHeight : 1000; 
        document.getElementById('height-val-disp').textContent = (board.maxHeight===0) ? "Auto" : board.maxHeight+"px";
        slider.oninput = (e) => { 
            const val = parseInt(e.target.value); 
            board.maxHeight = (val === 1000) ? 0 : val; 
            document.getElementById('height-val-disp').textContent = (board.maxHeight===0) ? "Auto" : val+"px"; 
        }; 
        slider.onchange = () => { saveAll(); renderApp(); };

        // 列追加のカラーピッカー
        setupColorPickerBtn('new-col-color-btn', 'new-col-color-popover', 'new-col-color-grid', (c) => document.getElementById('new-col-color-btn').style.backgroundColor = c); 
        document.getElementById('add-column-btn').onclick = () => { 
            const n = document.getElementById('new-column-name').value; 
            const c = document.getElementById('new-col-color-btn').style.backgroundColor; 
            if(n) { 
                board.columns.push({ id:'c_'+Date.now(), name:n, color:c }); 
                document.getElementById('new-column-name').value = ''; 
                renderColumnList(board); saveAll(); 
            } 
        };

        // リスト描画
        renderFieldListNew(board); // ★新デザイン用の描画関数を呼ぶ
        renderColumnListNew(board); // ★新デザイン用の描画関数を呼ぶ

        // 閉じる・削除ボタン
        const closeAction = () => {toggleModal('modal-board-settings', false); renderApp();};
        document.getElementById('board-close-btn').onclick = closeAction;
        document.getElementById('board-close-btn-top').onclick = closeAction;
        
        document.getElementById('board-delete-btn').onclick = () => { 
            if(confirm('ボードを削除しますか？')) { 
                appData.boards = appData.boards.filter(b => b.id !== editingBoardId); 
                modalBoard.classList.remove('active'); 
                saveAll(); renderApp(); 
            }
        };

        toggleModal('modal-board-settings', true);
    }

    // ★既存の renderFieldListNew をこれに置き換えてください
    function renderFieldListNew(board) {
        const list = document.getElementById('field-list-container');
        list.innerHTML = '';
        if(!board.fields) board.fields = [];

        board.fields.forEach((f, idx) => {
            const div = document.createElement('div');
            // コンテナ自体のスタイル調整（中にオプションエリアが入るため column にする）
            div.className = 'bs-list-item';
            div.style.flexDirection = 'column'; 
            div.style.alignItems = 'stretch';
            
            addDnDHandlers(div, 'field', board.id, idx);
            
            // アイコン表示
            const iconDisplay = f.icon ? `<span class="material-symbols-outlined" style="font-size:20px;">${f.icon}</span>` : `<span class="material-symbols-outlined" style="font-size:20px; color:#ccc;">label</span>`;
            const typeLabel = TYPE_LABELS[f.type] || f.type;
            
            // 共通タグの場合のバッジ
            let extraInfo = '';
            if(f.type === 'tags' && f.groupId) {
                const grp = appData.tagGroups.find(g => g.id === f.groupId);
                const gName = grp ? grp.name : 'Unknown';
                extraInfo = `<span class="badge" style="background:#eff6ff; color:#1d4ed8; margin-left:8px;">🔗 ${gName}</span>`;
            }

            // メイン行のHTML (flex-row で横並びにする部分)
            const mainRowHtml = `
                <div style="display:flex; align-items:center; gap:12px; width:100%;">
                    <span class="material-symbols-outlined bs-drag-handle">drag_handle</span>
                    
                    <div class="setting-icon-wrapper" id="icon-edit-btn-${idx}">${iconDisplay}</div>
                    <div style="position:relative;"><div class="icon-picker-popover" id="icon-popover-${idx}"></div></div>

                    <div class="bs-item-content">
                        <span class="bs-item-name">${f.name}</span>
                        <span class="bs-item-type">[${typeLabel}]</span>
                        ${extraInfo}
                    </div>

                    <div style="display:flex; align-items:center; gap:16px;">
                        <label class="bs-check-label">
                            <input type="checkbox" ${f.visible!==false ? 'checked' : ''} onchange="toggleFieldVis('${board.id}', ${idx}, this.checked)">
                            表示
                        </label>
                        <button class="bs-btn-danger-sm" onclick="removeField('${board.id}', ${idx})">削除</button>
                    </div>
                </div>
            `;

            // 選択肢(select)タイプの場合の専用エリア
            let optionsAreaHtml = '';
            if (f.type === 'select') {
                optionsAreaHtml = `<div id="options-manager-${idx}" class="bs-options-area"></div>`;
            }

            div.innerHTML = mainRowHtml + optionsAreaHtml;
            list.appendChild(div);

            // アイコンピッカーのセットアップ
            setupIconPickerLogic(idx, f, board);

            // ★選択肢マネージャーのセットアップ（selectタイプのみ）
            if (f.type === 'select') {
                setupSelectOptionsManager(board, idx, `options-manager-${idx}`);
            }
        });

        // --- 以下、追加フォームの描画（以前と同じ） ---
        const formArea = document.getElementById('field-add-form-area');
        formArea.innerHTML = '';
        
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex'; wrapper.style.gap = '8px'; wrapper.style.alignItems = 'center'; wrapper.style.width = '100%';

        // アイコン選択ボタン
        const iconBtn = document.createElement('div');
        iconBtn.className = 'setting-icon-wrapper';
        iconBtn.style.border = '1px solid #ddd';
        iconBtn.innerHTML = '<span class="material-symbols-outlined">add_box</span>';
        iconBtn.dataset.value = 'label';
        
        const iconPop = document.createElement('div'); 
        iconPop.className = 'icon-picker-popover';
        createIconPickerContent(iconPop, 'label', (ic) => { 
            iconBtn.innerHTML = `<span class="material-symbols-outlined">${ic}</span>`; 
            iconBtn.dataset.value = ic; 
            iconPop.classList.remove('active'); 
        });
        iconBtn.onclick = (e) => { e.stopPropagation(); toggleSmartPopover(iconBtn, iconPop); };

        const nameInput = document.createElement('input'); nameInput.className = 'bs-add-input'; nameInput.placeholder = '項目名';
        const typeSelect = document.createElement('select'); typeSelect.className = 'bs-add-select';
        Object.keys(TYPE_LABELS).forEach(k => { 
            const op = document.createElement('option'); op.value = k; op.textContent = TYPE_LABELS[k]; typeSelect.appendChild(op); 
        });

        const groupSelect = document.createElement('select'); groupSelect.className = 'bs-add-select'; groupSelect.style.display = 'none';
        if(appData.tagGroups.length === 0) groupSelect.innerHTML = '<option value="">(グループなし)</option>';
        else appData.tagGroups.forEach(g => { const op = document.createElement('option'); op.value = g.id; op.textContent = g.name; groupSelect.appendChild(op); });

        typeSelect.onchange = () => { groupSelect.style.display = (typeSelect.value === 'tags') ? 'block' : 'none'; };

        const addBtn = document.createElement('button'); addBtn.className = 'bs-btn-sm'; addBtn.textContent = '追加';
        addBtn.onclick = () => {
            const n = nameInput.value; const t = typeSelect.value;
            if(n) {
                const newField = { id:'f_'+Date.now(), name:n, type:t, visible:true, icon: iconBtn.dataset.value };
                if(t === 'select') newField.options = []; // 初期化
                if(t === 'tags') {
                    if(!groupSelect.value) { alert('共通タグを使用するには、対象のグループを選択してください。'); return; }
                    newField.groupId = groupSelect.value;
                }
                board.fields.push(newField);
                renderFieldListNew(board); saveAll();
            }
        };

        wrapper.appendChild(iconBtn); wrapper.appendChild(iconPop); wrapper.appendChild(nameInput); wrapper.appendChild(typeSelect); wrapper.appendChild(groupSelect); wrapper.appendChild(addBtn);
        formArea.appendChild(wrapper);
    }

    function setupSelectOptionsManager(board, fieldIdx, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const field = board.fields[fieldIdx];
        if (!field.options) field.options = [];

        // 描画関数
        const renderOptions = () => {
            container.innerHTML = '';
            
            // ヘッダー
            const header = document.createElement('div');
            header.className = 'bs-opt-header';
            header.innerHTML = '▼ 選択肢の管理 <span style="font-weight:normal; font-size:10px;">(右クリックで編集)</span>';
            container.appendChild(header);

            // リスト表示エリア
            const listDiv = document.createElement('div');
            listDiv.className = 'bs-opt-list';
            
            if (field.options.length === 0) {
                listDiv.innerHTML = '<span style="font-size:11px; color:#999;">選択肢がありません</span>';
            } else {
                field.options.forEach((opt, optIdx) => {
                    const chip = document.createElement('div');
                    chip.className = 'bs-opt-chip';
                    chip.style.backgroundColor = opt.color;
                    chip.innerHTML = `
                        <span>${opt.name}</span>
                        <span class="material-symbols-outlined bs-opt-delete">close</span>
                    `;
                    
                    // ★ ここが追加機能：右クリックでメニューを開く
                    chip.addEventListener('contextmenu', (e) => {
                        e.preventDefault(); // ブラウザのメニューを出さない
                        // 既存のコンテキストメニュー関数を再利用
                        // optオブジェクトを渡すことで、nameやcolorを直接編集させます
                        openContextMenu(e, opt, 'option', () => {
                            saveAll();      // 保存
                            renderOptions(); // このエリアを再描画
                        });
                    });

                    // 削除ボタン
                    chip.querySelector('.bs-opt-delete').onclick = (e) => {
                        e.stopPropagation(); // 親のクリックイベントを止める
                        if(confirm(`選択肢「${opt.name}」を削除しますか？`)) {
                            field.options.splice(optIdx, 1);
                            saveAll();
                            renderOptions();
                        }
                    };
                    listDiv.appendChild(chip);
                });
            }
            container.appendChild(listDiv);

            // 追加フォーム
            const addRow = document.createElement('div');
            addRow.className = 'bs-opt-add-row';

            // 色選択ボタン
            const colorBtnId = `opt-color-btn-${field.id}`;
            const colorPopId = `opt-color-pop-${field.id}`;
            const colorGridId = `opt-color-grid-${field.id}`;
            
            const colorWrapper = document.createElement('div');
            colorWrapper.className = 'color-picker-wrapper';
            colorWrapper.innerHTML = `
                <div class="bs-color-preview" id="${colorBtnId}" style="width:24px; height:24px; background-color:#3B82F6;" data-value="#3B82F6"></div>
                <div class="color-picker-popover" id="${colorPopId}">
                    <div class="color-grid" id="${colorGridId}"></div>
                </div>
            `;
            addRow.appendChild(colorWrapper);

            // 入力欄
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'bs-add-input';
            input.style.padding = '4px 8px'; 
            input.style.fontSize = '12px';
            input.placeholder = '選択肢名 (例: 至急)';
            addRow.appendChild(input);

            // 追加ボタン
            const addBtn = document.createElement('button');
            addBtn.className = 'bs-btn-sm';
            addBtn.textContent = '追加';
            addBtn.onclick = () => {
                const name = input.value.trim();
                const color = document.getElementById(colorBtnId).dataset.value;
                if (name) {
                    field.options.push({ id: 'op_' + Date.now(), name: name, color: color });
                    saveAll();
                    renderOptions();
                }
            };
            addRow.appendChild(addBtn);

            container.appendChild(addRow);

            setupColorPickerBtn(colorBtnId, colorPopId, colorGridId, (c) => {
                document.getElementById(colorBtnId).style.backgroundColor = c;
                document.getElementById(colorBtnId).dataset.value = c;
            });
        };

        renderOptions();
        
    }
    

    // ★新デザイン用の列リスト描画関数
    function renderColumnListNew(board) {
        const list = document.getElementById('column-list-container');
        list.innerHTML = '';
        board.columns.forEach((col, idx) => {
            const div = document.createElement('div');
            div.className = 'bs-list-item';
            addDnDHandlers(div, 'column', board.id, idx);

            div.innerHTML = `
                <span class="material-symbols-outlined bs-drag-handle">drag_handle</span>
                <div style="width:16px; height:16px; border-radius:4px; background-color:${col.color};"></div>
                <div class="bs-item-content">
                    <span class="bs-item-name">${col.name}</span>
                </div>
                <button class="bs-btn-danger-sm" onclick="removeColumn('${board.id}', ${idx})">削除</button>
            `;
            // 右クリックメニュー（名前変更・色変更）は既存の仕組みを流用
            div.oncontextmenu = (e) => { 
                e.preventDefault(); 
                openContextMenu(e, col, 'column', () => { renderColumnListNew(board); saveAll(); }); 
            };
            list.appendChild(div);
        });
    }

    // 既存の removeField, removeColumn 関数を新しい描画関数を呼ぶようにラップ
    // (または既存関数内で renderFieldListNew を呼ぶように書き換える必要がありますが、
    //  ここではグローバル関数を上書きする形で対応します)
    window.removeField = function(bid, idx) { 
        if(confirm('削除しますか？')) { 
            const board = appData.boards.find(b => b.id === bid); 
            board.fields.splice(idx, 1); saveAll(); 
            renderFieldListNew(board); 
        } 
    };
    window.removeColumn = function(bid, idx) { 
        if(confirm('削除しますか？')) { 
            const board = appData.boards.find(b => b.id === bid); 
            board.columns.splice(idx, 1); saveAll(); 
            renderColumnListNew(board); 
        } 
    };
    window.toggleFieldVis = function(bid, idx, checked) { 
        const board = appData.boards.find(b => b.id === bid);
        board.fields[idx].visible = checked; saveAll(); 
        renderFieldListNew(board); 
    };

    function setupIconPickerLogic(idx, field, board) {
        const btn = document.getElementById(`icon-edit-btn-${idx}`);
        const pop = document.getElementById(`icon-popover-${idx}`);
        if(!pop) return;

        // 中身の生成
        createIconPickerContent(pop, field.icon, (ic) => {
            if(ic) field.icon = ic; else delete field.icon;
            saveAll();
            
            // ★ここを変更！
            // 古い renderFieldList(board) ではなく、新しい関数を呼びます
            renderFieldListNew(board); 
            
            pop.classList.remove('active');
        });

        // クリック処理（スマートポップオーバー使用）
        if(btn) btn.onclick = (e) => {
            e.stopPropagation();
            toggleSmartPopover(btn, pop);
        };
    }

    // ----------------------------------------------------
    // Card Edit (Dynamic Form)
    // ----------------------------------------------------
    function openCardEdit(bid, cardData) {
        const board = appData.boards.find(b => b.id === bid);
        editingCardInfo = { boardId: bid, cardData };

        const viewMode = document.getElementById('card-view-mode');
        const editMode = document.getElementById('card-edit-mode');
        viewMode.style.display = 'block'; 
        editMode.style.display = 'none';
        document.getElementById('footer-view-btns').style.display = 'flex';
        document.getElementById('footer-edit-btns').style.display = 'none';

        viewMode.style.display = 'block'; editMode.style.display = 'none';
        document.getElementById('btn-enable-edit').style.display = 'block'; document.getElementById('btn-duplicate-card').style.display = 'block';

        document.getElementById('view-card-title').textContent = cardData.title;
        const dateEl = document.getElementById('view-card-date');
        dateEl.textContent = cardData.date || '未設定';
        dateEl.style.color = (cardData.date && activeFilters.overdue && cardData.date < new Date().toISOString().slice(0,10)) ? '#EF4444' : '';

        const viewFields = document.getElementById('view-custom-fields');
        viewFields.innerHTML = '';

        board.fields.forEach(f => {
            if (f.visible === false) return;
            const val = cardData.customValues ? cardData.customValues[f.id] : null;
            if (!val && f.type !== 'checklist' && f.type !== 'textarea') return;

            const row = document.createElement('div');
            row.style.borderBottom = '1px dashed #eee'; row.style.paddingBottom = '10px'; row.style.marginBottom = '10px';
            const iconHtml = f.icon ? `<span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle; margin-right:4px; opacity:0.7;">${f.icon}</span>` : '';
            row.innerHTML = `<div style="font-size:11px; color:#888; margin-bottom:4px;">${iconHtml}${f.name}</div>`;
            const contentDiv = document.createElement('div');

            if (f.type === 'select') {
                const o = f.options ? f.options.find(op => op.id === val) : null;
                if (o) contentDiv.innerHTML = `<span class="badge" style="background-color:${o.color}; cursor:default;">${o.name}</span>`;
            } else if (f.type === 'tags') {
                // ★ 共通タグ（閲覧）
                if(f.groupId) {
                    const group = appData.tagGroups.find(g => g.id === f.groupId);
                    if(group) {
                        const t = group.tags.find(tag => tag.id === val);
                        if(t) contentDiv.innerHTML = `<span class="badge" style="background-color:${t.color}; cursor:default;">${t.name}</span>`;
                    }
                }
            } else if (f.type === 'user') {
                const u = appData.users.find(us => us.id === val);
                if (u && val) {
                    // ★ ここを変更: lastNameがあればそれを、なければname(フルネーム)を表示
                    const displayName = u.lastName || u.name;
                    content = `<span class="badge" style="background-color:${u.color}">${displayName}</span>`;
                }
            } else if (f.type === 'url') {
                contentDiv.innerHTML = `<a href="${val}" target="kanban_mail_window" style="color:#3B82F6; text-decoration:underline;">${val}</a>`;
            } else if (f.type === 'textarea') {
                const ta = document.createElement('textarea'); ta.className = 'form-control'; ta.style.background = '#f9fafb'; ta.value = val||'';
                ta.onchange = () => { if(!cardData.customValues) cardData.customValues = {}; cardData.customValues[f.id] = ta.value; saveAll(); if(currentView === 'board') renderApp(); };
                contentDiv.appendChild(ta);
            } else if (f.type === 'checklist') {
                                const tasks = Array.isArray(val) ? val : [];
                if (tasks.length > 0) {
                    const ul = document.createElement('ul'); ul.style.listStyle = 'none'; ul.style.padding = '0';
                    tasks.forEach((task) => {
                        const li = document.createElement('li'); li.style.display = 'flex'; li.style.alignItems = 'center'; li.style.gap = '8px'; li.style.cursor = 'pointer';
                        const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = task.done;
                        const txt = document.createElement('span'); txt.textContent = task.text; if (task.done) { txt.style.textDecoration = 'line-through'; txt.style.color = '#aaa'; }
                        const toggle = (e) => { if (e.target !== chk) chk.checked = !chk.checked; task.done = chk.checked; txt.style.textDecoration = task.done ? 'line-through' : 'none'; txt.style.color = task.done ? '#aaa' : 'inherit'; saveAll(); if(currentView === 'board') renderApp(); };
                        chk.onclick = (e) => { e.stopPropagation(); toggle(e); }; li.onclick = toggle;
                        li.appendChild(chk); li.appendChild(txt); ul.appendChild(li);
                    });
                    contentDiv.appendChild(ul);
                } else { contentDiv.innerHTML = '<span style="color:#aaa; font-size:12px;">(アイテムなし)</span>'; }
            } else { contentDiv.innerHTML = `<span>${val}</span>`; }
            row.appendChild(contentDiv); viewFields.appendChild(row);
        });
        
        // 編集モード切り替え
        document.getElementById('btn-enable-edit').onclick = () => {
            // 本文の切り替え
            viewMode.style.display = 'none'; 
            editMode.style.display = 'block';
            
            // ★フッターボタンの切り替え
            document.getElementById('footer-view-btns').style.display = 'none';
            document.getElementById('footer-edit-btns').style.display = 'flex';

            // 値のセット（既存のコード）
            document.getElementById('card-title').value = cardData.title; 
            document.getElementById('card-date').value = cardData.date;
            
            // 動的フォームの生成
            const area = document.getElementById('dynamic-form-area'); 
            area.innerHTML = '';

            board.fields.forEach(f => {
                const div = document.createElement('div'); 
                div.className = 'form-group';
                
                const iconHtml = f.icon ? `<span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle; margin-right:4px;">${f.icon}</span>` : '';
                div.innerHTML = `<label>${iconHtml}${f.name}</label>`;
                
                let val = cardData.customValues ? cardData.customValues[f.id] : '';
                let input; 
                const wrapper = document.createElement('div'); 
                wrapper.dataset.fieldId = f.id;

                if (f.type === 'textarea') {
                    input = document.createElement('textarea'); 
                    input.className = 'form-control'; 
                    input.rows = 3; 
                    input.value = val || '';

                } else if (f.type === 'select') {
                    const con = document.createElement('div'); 
                    con.className = 'badge-select-container'; 
                    con.dataset.value = val || '';
                    
                    if (f.options) {
                        f.options.forEach(opt => {
                            const b = document.createElement('div'); 
                            b.className = 'badge-option'; 
                            b.style.backgroundColor = opt.color; 
                            b.textContent = opt.name;
                            
                            if (val === opt.id) b.classList.add('selected');
                            
                            b.onclick = () => { 
                                Array.from(con.children).forEach(c => c.classList.remove('selected')); 
                                if (con.dataset.value === opt.id) { 
                                    con.dataset.value = ''; // 解除
                                } else { 
                                    con.dataset.value = opt.id; 
                                    b.classList.add('selected'); 
                                } 
                            };
                            con.appendChild(b);
                        });
                    }
                    input = con;

                } else if (f.type === 'tags') {
                    // ★ 共通タグ（編集プルダウン）
                    input = document.createElement('select'); 
                    input.className = 'form-control';
                    input.innerHTML = '<option value="">(未設定)</option>';
                    
                    if (f.groupId) {
                        const group = appData.tagGroups.find(g => g.id === f.groupId);
                        if (group) {
                            group.tags.forEach(t => {
                                const op = document.createElement('option'); 
                                op.value = t.id; 
                                op.textContent = t.name;
                                if (t.id === val) op.selected = true;
                                input.appendChild(op);
                            });
                        }
                    } else { 
                        input.disabled = true; 
                    }

                } else if (f.type === 'user') {
                    input = document.createElement('select'); 
                    input.className = 'form-control'; 
                    input.innerHTML = '<option value="">(未設定)</option>';
                    appData.users.forEach(u => { 
                        const op = document.createElement('option'); 
                        op.value = u.id; 
                        op.textContent = u.name; 
                        if (u.id === val) op.selected = true; 
                        input.appendChild(op); 
                    });

                } else if (f.type === 'checklist') {
                    // ★ 復元・整形したチェックリストロジック
                    if (!Array.isArray(val)) { val = []; }
                    
                    const subWrapper = document.createElement('div'); 
                    subWrapper.className = 'subtask-section';
                    
                    const listContainer = document.createElement('ul'); 
                    listContainer.className = 'subtask-list';
                    
                    const addArea = document.createElement('div'); 
                    addArea.style.display = 'flex'; 
                    addArea.style.gap = '5px';
                    addArea.innerHTML = `
                        <input type="text" class="form-control" placeholder="項目追加">
                        <button class="btn btn-secondary btn-sm">追加</button>
                    `;
                    
                    // リスト描画関数
                    const renderList = () => { 
                        listContainer.innerHTML = ''; 
                        val.forEach((task, idx) => { 
                            const li = document.createElement('li'); 
                            li.className = 'subtask-item'; 
                            
                            // チェックボックス
                            const chk = document.createElement('input');
                            chk.type = 'checkbox';
                            chk.className = 'subtask-checkbox';
                            chk.checked = task.done;
                            chk.onchange = (e) => { task.done = e.target.checked; renderList(); };

                            // テキスト
                            const span = document.createElement('span');
                            span.className = 'subtask-text' + (task.done ? ' done' : '');
                            span.textContent = task.text;

                            // 削除ボタン
                            const delBtn = document.createElement('button');
                            delBtn.className = 'subtask-del-btn'; // CSSのスタイルを適用
                            delBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">close</span>';
                            delBtn.onclick = () => { 
                                val.splice(idx, 1); 
                                renderList(); 
                            };
                            
                            li.appendChild(chk);
                            li.appendChild(span);
                            li.appendChild(delBtn);
                            listContainer.appendChild(li); 
                        }); 
                    };
                    
                    // 追加ボタンの動作
                    addArea.querySelector('button').onclick = () => { 
                        const inputEl = addArea.querySelector('input');
                        const txt = inputEl.value.trim(); 
                        if (txt) { 
                            val.push({ text: txt, done: false }); 
                            inputEl.value = ''; 
                            renderList(); 
                        } 
                    };
                    
                    renderList(); 
                    subWrapper.appendChild(addArea); 
                    subWrapper.appendChild(listContainer); 
                    input = subWrapper; 
                    
                    // 値取得用フック
                    input.getValue = () => val; 

                } else {
                    // その他（text, number, urlなど）
                    input = document.createElement('input'); 
                    input.className = 'form-control'; 
                    input.value = val || '';
                    if (f.type === 'number') input.type = 'number';
                }

                if (input) { 
                    wrapper.appendChild(input); 
                    div.appendChild(wrapper); 
                    area.appendChild(div); 
                }
            });
        };
// --- ✨ スマート・ペースト機能の実装 ---
    const smartPasteBox = document.getElementById('smart-paste-box');
    
    if (smartPasteBox) {
        smartPasteBox.addEventListener('paste', (e) => {
            // デフォルトの貼り付け動作を少し遅らせて、値を取得しやすくする（またはpreventDefaultしてデータ取得も可）
            setTimeout(() => {
                const text = smartPasteBox.value.trim();
                if (!text) return;

                // 1. URLかどうかを判定 (簡易的な正規表現)
                const isUrl = /^(http|https):\/\/[^ "]+$/.test(text);

                if (isUrl) {
                    // URLの場合
                    // タイトルが空ならURLをセット（後で変更可）
                    const titleInput = document.getElementById('card-title');
                    if (!titleInput.value) {
                        titleInput.value = '新規リンク: ' + text;
                    }

                    // "url" タイプのカスタムフィールドを探して自動入力
                    const { boardId } = editingCardInfo || {};
                    if (boardId) {
                        const board = appData.boards.find(b => b.id === boardId);
                        // タイプが 'url' のフィールドを探す
                        const urlField = board.fields.find(f => f.type === 'url');
                        
                        if (urlField) {
                            // そのフィールドの入力欄（動的に生成されたDOM）を探す
                            const wrapper = document.querySelector(`div[data-field-id="${urlField.id}"]`);
                            const input = wrapper ? wrapper.querySelector('input') : null;
                            if (input) {
                                input.value = text;
                                // 入力されたことを視覚的に知らせる（フラッシュ効果）
                                input.classList.add('flash-highlight');
                                setTimeout(() => input.classList.remove('flash-highlight'), 500);
                            }
                        }
                    }
                } else {
                    // 通常テキストの場合
                    // タイトルにセット
                    const titleInput = document.getElementById('card-title');
                    titleInput.value = text;
                    titleInput.classList.add('flash-highlight');
                    setTimeout(() => titleInput.classList.remove('flash-highlight'), 500);
                }

                // 入力ボックスをクリアして、完了演出
                smartPasteBox.value = '';
                smartPasteBox.placeholder = '✨ 貼り付け完了！';
                setTimeout(() => {
                    smartPasteBox.placeholder = 'ここにGmailの件名やURLを貼り付け (Ctrl+V)';
                }, 2000);

            }, 0);
        });
    }
        // 保存ボタン
        document.getElementById('card-save-btn').onclick = () => {
            const { boardId, cardData } = editingCardInfo;
            cardData.title = document.getElementById('card-title').value;
            cardData.date = document.getElementById('card-date').value;
            if(!cardData.customValues) cardData.customValues = {};
            
            const board = appData.boards.find(b => b.id === boardId);
            board.fields.forEach(f => {
                const wrapper = document.querySelector(`div[data-field-id="${f.id}"]`);
                if(wrapper) {
                    if (f.type === 'select') { const con = wrapper.querySelector('.badge-select-container'); if(con) cardData.customValues[f.id] = con.dataset.value; }
                    else if (f.type === 'checklist') { const el = wrapper.querySelector('.subtask-section'); if(el && el.parentElement.querySelector('div').getValue) cardData.customValues[f.id] = el.parentElement.querySelector('div').getValue(); } 
                    else if (f.type === 'textarea') { const ta = wrapper.querySelector('textarea'); if(ta) cardData.customValues[f.id] = ta.value; }
                    else { const inp = wrapper.querySelector('input, select'); if(inp) cardData.customValues[f.id] = inp.value; }
                }
            });
            saveAll();
            if(currentView === 'board') renderApp(); else renderFocusMode();
            modalCard.classList.remove('active');
            if(searchInput.value) performSearch();
        };

        modalCard.classList.add('active');
    }
    
    // その他カード操作ボタン
    document.getElementById('btn-duplicate-card').onclick = () => {
        if(!editingCardInfo) return;
        const { boardId, cardData } = editingCardInfo;
        const board = appData.boards.find(b => b.id === boardId);
        let targetColId = null; Object.keys(board.cards).forEach(cid => { if(board.cards[cid].includes(cardData)) targetColId = cid; });
        const newCard = JSON.parse(JSON.stringify(cardData)); newCard.id = 'c_'+Date.now(); newCard.title += ' (コピー)'; newCard.isToday = false;
        board.cards[targetColId].splice(board.cards[targetColId].indexOf(cardData)+1, 0, newCard);
        saveAll(); if(currentView === 'board') renderApp(); else renderFocusMode(); modalCard.classList.remove('active'); alert('複製しました');
    };
    document.getElementById('card-delete-btn').onclick = () => {
        if(confirm('削除しますか？')) {
            const { boardId, cardData } = editingCardInfo;
            const board = appData.boards.find(b => b.id === boardId);
            Object.values(board.cards).forEach(list => { const i = list.indexOf(cardData); if(i > -1) list.splice(i, 1); });
            saveAll(); if(currentView === 'board') renderApp(); else renderFocusMode(); modalCard.classList.remove('active');
        }
    };
    document.getElementById('view-close-btn').onclick = () => modalCard.classList.remove('active');
    document.getElementById('card-cancel-edit-btn').onclick = () => {
        // 閲覧モードに戻す
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        
        // フッターボタンも閲覧モードに戻す
        document.getElementById('footer-view-btns').style.display = 'flex';
        document.getElementById('footer-edit-btns').style.display = 'none';
    };

    // ----------------------------------------------------
    // Search & Filter (Dynamic Group Support)
    // ----------------------------------------------------
    window.renderDynamicFilters = function() {
        const area = document.getElementById('dynamic-filters-area');
        area.innerHTML = ''; 

        const createFilterBtn = (label, id, group, color) => {
            const btn = document.createElement('div'); btn.className = 'filter-btn dynamic-filter-btn';
            btn.dataset.id = id; btn.dataset.group = group; 
            if(activeFilters[group] && activeFilters[group].includes(id)) btn.classList.add('active');
            btn.style.borderLeft = `4px solid ${color}`; btn.textContent = label;
            btn.onclick = (e) => { e.stopPropagation(); toggleDynamicFilter(group, id); };
            return btn;
        };

        // 担当者フィルタ
        if(appData.users.length > 0) {
            const section = document.createElement('div'); section.className = 'filter-section';
            section.innerHTML = `<span class="filter-label">👤 担当者</span>`;
            const chips = document.createElement('div'); chips.className = 'filter-chips';
            appData.users.forEach(u => chips.appendChild(createFilterBtn(u.name, u.id, 'users', u.color)));
            section.appendChild(chips); area.appendChild(section);
        }

        // ★ 共通タグ（グループごと）
        appData.tagGroups.forEach(g => {
            if(g.tags.length === 0) return;
            const section = document.createElement('div'); section.className = 'filter-section';
            section.innerHTML = `<span class="filter-label">🏷️ ${g.name}</span>`;
            const chips = document.createElement('div'); chips.className = 'filter-chips';
            g.tags.forEach(t => chips.appendChild(createFilterBtn(t.name, t.id, 'tags', t.color)));
            section.appendChild(chips); area.appendChild(section);
        });

        // ボード固有の選択肢
        const otherOpts = [];
        appData.boards.forEach(b => { b.fields.forEach(f => { if(f.type === 'select' && f.options) { f.options.forEach(o => { if(!otherOpts.find(x=>x.id===o.id)) otherOpts.push(o); }); } }); });
        if(otherOpts.length > 0) {
            const section = document.createElement('div'); section.className = 'filter-section';
            section.innerHTML = `<span class="filter-label">⚙️ その他ステータス</span>`;
            const chips = document.createElement('div'); chips.className = 'filter-chips';
            otherOpts.forEach(o => chips.appendChild(createFilterBtn(o.name, o.id, 'tags', o.color))); // 便宜上tagsグループを使用
            section.appendChild(chips); area.appendChild(section);
        }
    };
    // ----------------------------------------------------
    // ★ 検索フィルタ修正: 不足していた関数を追加してください
    // ----------------------------------------------------

    // 1. 期限フィルタ（固定ボタン）の切り替え機能を追加
    window.toggleFilter = function(type) {
        // 状態を反転 (ON <-> OFF)
        activeFilters[type] = !activeFilters[type];
        
        // ボタンの見た目を更新 (クラスの付け外し)
        const btn = document.querySelector(`.filter-btn[data-type="${type}"]`);
        if(btn) {
            if(activeFilters[type]) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
        
        // 検索を実行して画面を更新
        performSearch();
    };

    // 2. 「条件をクリア」関数を更新 (固定ボタンの色も消えるように修正)
    window.clearAllFilters = function() {
        // フィルタ状態を初期化
        activeFilters = { overdue:false, today:false, week:false, nodate:false, users:[], tags:[] };
        
        // 固定ボタン（期限など）の見た目をリセット
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 動的ボタン（担当者など）を再描画してリセット
        renderDynamicFilters();
        
        // 検索実行（全表示に戻る）
        performSearch();
    };

    window.toggleDynamicFilter = function(group, id) {
        if(!activeFilters[group]) activeFilters[group] = [];
        const idx = activeFilters[group].indexOf(id);
        if(idx > -1) activeFilters[group].splice(idx, 1); else activeFilters[group].push(id);
        performSearch(); renderDynamicFilters();
    };

    // ----------------------------------------------------
    // ★ 検索ロジック修正: カテゴリ内はOR、カテゴリ間はAND
    // ----------------------------------------------------
    function performSearch() {
        const query = searchInput.value.trim().toLowerCase();
        const cards = document.querySelectorAll('.card');
        
        // 日付計算用の基準日
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
        now.setHours(0,0,0,0); // 時間をリセットして日数計算用にする

        // フィルタが有効かどうかを判定するフラグ
        const hasDateFilter = activeFilters.overdue || activeFilters.today || activeFilters.week || activeFilters.nodate;
        const hasUserFilter = activeFilters.users.length > 0;
        const hasTagFilter = activeFilters.tags.length > 0;
        const isFiltering = query || hasDateFilter || hasUserFilter || hasTagFilter;

        cards.forEach(card => {
            const data = card._cardData; 
            if(!data) return;

            let matches = true; // 基本は表示（AND条件で絞っていく）

            // 1. キーワード検索 (AND)
            if(query) { 
                const text = (data.title + ' ' + Object.values(data.customValues || {}).join(' ')).toLowerCase(); 
                if(!text.includes(query)) matches = false; 
            }

            // 2. 期日フィルタ (カテゴリ内は OR)
            if(matches && hasDateFilter) {
                let dateHit = false; // どれか一つにヒットすればOK

                // 期限なしチェック
                if (activeFilters.nodate && !data.date) {
                    dateHit = true;
                } 
                // 日付がある場合のチェック
                else if (data.date) {
                    if (activeFilters.overdue && data.date < todayStr) dateHit = true;
                    if (activeFilters.today && data.date === todayStr) dateHit = true;
                    if (activeFilters.week) {
                        const d = new Date(data.date);
                        d.setHours(0,0,0,0);
                        const diff = (d - now) / (1000*60*60*24);
                        if(diff >= 0 && diff <= 7) dateHit = true;
                    }
                }

                // 期日フィルタが有効なのに、どれにもヒットしなかったら非表示
                if (!dateHit) matches = false;
            }

            // 3. 担当者フィルタ (カテゴリ内は OR)
            if(matches && hasUserFilter) {
                const vals = Object.values(data.customValues || {});
                // データ内の値に、選択したユーザーIDの「どれか一つ」でも含まれていればOK
                const userHit = activeFilters.users.some(id => vals.includes(id));
                if (!userHit) matches = false;
            }

            // 4. タグ/その他フィルタ (カテゴリ内は OR)
            if(matches && hasTagFilter) {
                const vals = Object.values(data.customValues || {});
                // データ内の値に、選択したタグIDの「どれか一つ」でも含まれていればOK
                const tagHit = activeFilters.tags.some(id => vals.includes(id));
                if (!tagHit) matches = false;
            }

            // --- 表示の切り替え ---
            card.classList.remove('search-hidden', 'search-dimmed', 'search-highlight');
            
            if(matches) {
                // 検索中ならハイライト枠をつける
                if(isFiltering) card.classList.add('search-highlight');
            } else {
                // 非表示モードなら消す、スポットライトなら薄くする
                if(searchMode === 'filter') card.classList.add('search-hidden'); 
                else card.classList.add('search-dimmed');
            }
        });

        // 検索ボタンに「・」をつけるかどうか更新
        searchSettingsBtn.classList.toggle('has-filter', isFiltering);
    }
    // ----------------------------------------------------
    // ★ ユーザー管理ロジック V3 (View/Edit Switching)
    // ----------------------------------------------------
    let selectedUserId = null;

    function openUserMgmt() {
        const modal = document.getElementById('modal-user-mgmt');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        // ▼▼▼ ★追加：ここからコピペしてください ▼▼▼
        // 閉じるボタンの動作設定
        document.getElementById('btn-close-user-mgmt').onclick = () => {
            modal.classList.remove('active');
            document.body.style.overflow = ''; // スクロール再開
            
            // 閉じたときにもし選択中だったらリセットしておく（次回のため）
            selectedUserId = null;
            
            // カンバンボードを再描画（名前変更などが反映されるように）
            renderApp();
        };
        document.getElementById('user-search-input').value = '';
        renderUserListV2();
        
        selectedUserId = null;
        updateUserDetailView(); // 初期状態（未選択）

        // --- イベント設定 ---
        
        // 新規追加
        document.getElementById('btn-add-new-user').onclick = addNewUserV2;
        
        // 閲覧 -> 編集モードへ切り替え
        document.getElementById('btn-to-edit-mode').onclick = () => {
            switchUserMode('edit');
        };

        // 編集 -> キャンセル（閲覧モードへ戻る）
        document.getElementById('btn-cancel-edit').onclick = () => {
            switchUserMode('view');
        };

        // 保存
        document.getElementById('btn-save-user').onclick = saveSelectedUser;

        // 削除
        document.getElementById('btn-delete-user').onclick = deleteSelectedUser;

        // 検索
        document.getElementById('user-search-input').oninput = renderUserListV2;
    }

    // 表示モード切り替え関数
    function switchUserMode(mode) {
        const viewMode = document.getElementById('user-view-mode');
        const editMode = document.getElementById('user-edit-mode');
        
        if(mode === 'edit') {
            viewMode.style.display = 'none';
            editMode.style.display = 'flex';
            // 編集モードに入ったとき、フォームに現在の値をセット
            fillEditForm();
        } else {
            viewMode.style.display = 'flex';
            editMode.style.display = 'none';
        }
    }

    // リスト描画（変更なし）
    function renderUserListV2() {
        const listContainer = document.getElementById('user-list-v2');
        const query = document.getElementById('user-search-input').value.toLowerCase();
        listContainer.innerHTML = '';
        const filteredUsers = appData.users.filter(u => u.name.toLowerCase().includes(query) || (u.job && u.job.toLowerCase().includes(query)));

        filteredUsers.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-list-item';
            if(user.id === selectedUserId) div.classList.add('active');
            const initial = user.name.charAt(0).toUpperCase();
            const jobTitle = user.job || 'メンバー';
            div.innerHTML = `<div class="user-avatar-sm" style="background-color:${user.color}">${initial}</div><div class="user-info-sm"><span class="user-name-sm">${user.name}</span><span class="user-job-sm">${jobTitle}</span></div>`;
            div.onclick = () => {
                selectedUserId = user.id;
                renderUserListV2();
                // ユーザーを切り替えたら必ず閲覧モードから開始
                updateUserDetailView();
            };
            listContainer.appendChild(div);
        });
    }

    // 右側の表示更新（基本は閲覧モードを表示）
    function updateUserDetailView() {
        const emptyState = document.getElementById('user-empty-state');
        const detailContent = document.getElementById('user-detail-content');

        if(!selectedUserId) {
            emptyState.style.display = 'flex';
            detailContent.style.display = 'none';
            return;
        }

        const user = appData.users.find(u => u.id === selectedUserId);
        if(!user) return;

        emptyState.style.display = 'none';
        detailContent.style.display = 'flex';
        
        // まずは閲覧モードを表示
        switchUserMode('view');

        // ▼ 閲覧モードへのデータ流し込み
        const avatarEl = document.getElementById('view-avatar');
        avatarEl.style.backgroundColor = user.color;
        avatarEl.textContent = user.name.charAt(0).toUpperCase();
        
        document.getElementById('view-fullname').textContent = user.name;
        document.getElementById('view-id').textContent = `ID: ${user.id}`;
        
        document.getElementById('view-email').textContent = user.email || '';
        
        const deptJob = [user.dept, user.job].filter(Boolean).join(' / ');
        document.getElementById('view-dept-job').textContent = deptJob || '';
    }

    // 編集フォームに値をセットする関数
    function fillEditForm() {
        const user = appData.users.find(u => u.id === selectedUserId);
        if(!user) return;

        document.getElementById('input-lastname').value = user.lastName || '';
        document.getElementById('input-firstname').value = user.firstName || '';
        document.getElementById('input-email').value = user.email || '';
        document.getElementById('input-dept').value = user.dept || '';
        document.getElementById('input-job').value = user.job || '';

        // カラーピッカー設定
        setupColorPickerBtn('edit-user-color-btn', 'edit-user-color-popover', 'edit-user-color-grid', (c) => {
            document.getElementById('edit-user-color-btn').style.backgroundColor = c;
            document.getElementById('edit-user-color-btn').dataset.value = c;
        });
        document.getElementById('edit-user-color-btn').style.backgroundColor = user.color;
        document.getElementById('edit-user-color-btn').dataset.value = user.color;
    }

    function addNewUserV2() {
        const newId = 'u_' + Date.now();
        const newUser = { id: newId, name: '未設定 ユーザー', color: '#64748B', job: '新規メンバー', lastName:'未設定', firstName:'ユーザー' };
        appData.users.push(newUser);
        saveAll();
        selectedUserId = newId;
        renderUserListV2();
        updateUserDetailView();
        // 新規作成時はすぐに編集モードにする
        switchUserMode('edit');
    }

    function saveSelectedUser() {
        if(!selectedUserId) return;
        const user = appData.users.find(u => u.id === selectedUserId);
        
        const lName = document.getElementById('input-lastname').value.trim();
        const fName = document.getElementById('input-firstname').value.trim();
        const email = document.getElementById('input-email').value.trim();
        const dept = document.getElementById('input-dept').value.trim();
        const job = document.getElementById('input-job').value.trim();
        const color = document.getElementById('edit-user-color-btn').dataset.value;

        user.lastName = lName;
        user.firstName = fName;
        user.email = email;
        user.dept = dept;
        user.job = job;
        user.color = color;

        // フルネーム更新
        if(lName || fName) {
            user.name = `${lName} ${fName}`.trim();
        }

        saveAll();
        renderUserListV2(); 
        updateUserDetailView(); // 閲覧モードに戻り、新しい情報を表示
        renderApp(); // カンバンボードも更新（苗字のみ表示されるはず！）
    }

    function deleteSelectedUser() {
        if(!selectedUserId) return;
        if(confirm('削除しますか？')) {
            appData.users = appData.users.filter(u => u.id !== selectedUserId);
            saveAll();
            selectedUserId = null;
            renderUserListV2();
            updateUserDetailView();
            renderApp();
        }
    }

    // ----------------------------------------------------
    // Utilities (Drag & Drop, Color, etc)
    // ----------------------------------------------------
    function setupDragAndDrop(listElement) {
        new Sortable(listElement, {
            group: 'shared',
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            delay: 100,
            delayOnTouchOnly: true,
            onEnd: function (evt) {
                const itemEl = evt.item;
                const newIndex = evt.newIndex;
                const toColumnId = evt.to.dataset.columnId;
                const fromColumnId = evt.from.dataset.columnId;
                const boardId = evt.from.dataset.boardId;
                const board = appData.boards.find(b => b.id === boardId);
                const cardData = itemEl._cardData;
                const fromList = board.cards[fromColumnId];
                
                // データの移動処理
                const oldIndex = fromList.indexOf(cardData);
                if (oldIndex > -1) {
                    fromList.splice(oldIndex, 1);
                }
                if (!board.cards[toColumnId]) board.cards[toColumnId] = [];
                board.cards[toColumnId].splice(newIndex, 0, cardData);
                
                saveAll();

                // ▼▼▼ 追加: 列のカウント数を更新 ▼▼▼
                const fromCountEl = document.getElementById(`col-count-${fromColumnId}`);
                const toCountEl = document.getElementById(`col-count-${toColumnId}`);
                
                if (fromCountEl) {
                    fromCountEl.textContent = fromList.length;
                }
                if (toCountEl) {
                    toCountEl.textContent = board.cards[toColumnId].length;
                }
            }
        });
    }
    //document.getElementById('btn-add-user').addEventListener('click', () => { const n = document.getElementById('new-user-name').value; const c = document.getElementById('new-user-color-btn').dataset.value; if(n) { appData.users.push({ id: 'u_'+Date.now(), name: n, color: c }); document.getElementById('new-user-name').value = ''; renderUserList(); saveAll(); } });
    //document.getElementById('btn-close-user-mgmt').addEventListener('click', () => { modalUser.classList.remove('active'); renderApp(); });
    
    // ----------------------------------------------------
    // 🪄 スマート・ポップオーバー管理システム (新機能)
    // ----------------------------------------------------
    function toggleSmartPopover(triggerBtn, popoverEl) {
        // 1. 既に開いているか確認
        const isActive = popoverEl.classList.contains('active');

        // 2. 他のすべてのポップオーバーを閉じる
        document.querySelectorAll('.color-picker-popover, .icon-picker-popover').forEach(p => {
            p.classList.remove('active');
            // 元の場所に戻す必要があればここで戻すが、今回はbodyに出しっぱなしでも機能的には問題ない
        });

        if (isActive) {
            // 閉じたいだけならここで終了
            return;
        }

        // 3. ポップオーバーを body 直下に移動させる
        // (これでスライダーの transform や overflow:hidden の影響を無効化します)
        document.body.appendChild(popoverEl);

        // 4. 表示状態にしてサイズを測れるようにする
        popoverEl.classList.add('active');

        // 5. 座標計算ロジック
        const rect = triggerBtn.getBoundingClientRect(); // ボタンの画面上の位置
        const popRect = popoverEl.getBoundingClientRect(); // ポップオーバーのサイズ

        let top = rect.bottom + 5; // 基本はボタンの下
        let left = rect.left;      // 基本はボタンの左揃え

        // 画面下からはみ出るなら、ボタンの上に表示
        if (top + popRect.height > window.innerHeight) {
            top = rect.top - popRect.height - 5;
        }

        // 画面右からはみ出るなら、左に寄せる
        if (left + popRect.width > window.innerWidth) {
            left = window.innerWidth - popRect.width - 10;
        }
        // 画面左からはみ出るなら、右に寄せる
        if (left < 0) {
            left = 10;
        }

        // 6. 計算した位置を適用
        popoverEl.style.top = `${top}px`;
        popoverEl.style.left = `${left}px`;
    }

    // 画面外クリックですべて閉じる処理（既存のクリックイベントを強化）
    document.addEventListener('click', (e) => {
        // ポップオーバー内部や、トリガーボタンのクリックでなければ閉じる
        if (!e.target.closest('.color-picker-popover') && 
            !e.target.closest('.icon-picker-popover') &&
            !e.target.closest('.color-picker-btn') &&
            !e.target.closest('.icon-select-btn') &&
            !e.target.closest('.setting-icon-wrapper')) { // アイコン設定ボタン
            
            document.querySelectorAll('.color-picker-popover, .icon-picker-popover').forEach(p => p.classList.remove('active'));
        }
    });

    // ----------------------------------------------------
    // ★ Focus View (今日やるモード) - 整形・復元版
    // ----------------------------------------------------
    function renderFocusMode() {
        const listContainer = document.getElementById('focus-list');
        const doneZone = document.getElementById('focus-done-zone');
        
        // リセット
        listContainer.innerHTML = '';
        
        // 全ボードから「今日やる (isToday: true)」のカードを収集
        const todayCards = [];
        appData.boards.forEach(board => {
            if (board.cards) {
                Object.keys(board.cards).forEach(colId => {
                    board.cards[colId].forEach(card => {
                        if (card.isToday) {
                            // 参照情報を付与してリストに追加
                            card._refBoardId = board.id;
                            card._refColId = colId;
                            todayCards.push({ card, board });
                        }
                    });
                });
            }
        });

        // カードがない場合のメッセージ
        if (todayCards.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#9ca3af;">
                    <span class="material-symbols-outlined" style="font-size:48px; margin-bottom:10px; opacity:0.5;">sunny</span>
                    <p style="font-weight:bold;">今日のタスクはありません</p>
                    <p style="font-size:12px;">ボードから「★」を付けてタスクを追加しましょう！</p>
                </div>
            `;
            return;
        }

        // カードの描画
        todayCards.forEach(item => {
            const el = createCardElement(item.card, item.board);
            
            // どのボードのタスクか分かるように色を付ける
            el.style.borderLeft = `6px solid ${item.board.color}`;
            
            // Focusモード特有のスタイル調整
            el.style.marginBottom = '10px';
            el.style.background = 'white';
            
            listContainer.appendChild(el);
        });

        // ドラッグ＆ドロップの設定 (Sortable.js)
        new Sortable(listContainer, {
            group: 'focus-group',
            animation: 150,
            ghostClass: 'sortable-ghost'
        });

        // 「完了エリア」へのドロップ設定
        new Sortable(doneZone, {
            group: 'focus-group',
            ghostClass: 'sortable-ghost',
            onAdd: function (evt) {
                const itemEl = evt.item;
                const cardData = itemEl._cardData;
                
                // データ更新: 今日やるフラグを外す
                cardData.isToday = false;
                
                // 紙吹雪エフェクト (Canvas Confetti)
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#FFD700', '#FFA500', '#FF4500', '#3B82F6']
                });

                // 要素を削除
                itemEl.remove();
                
                // 保存
                saveAll();
                
                // 全部なくなったら再描画してメッセージを出す
                if(listContainer.children.length === 0) {
                    renderFocusMode();
                }
            }
        });
    }

    // ----------------------------------------------------
    // ★ Archive View (アーカイブ画面) - 機能拡張版
    // ----------------------------------------------------
    function renderArchiveView() {
        const container = document.getElementById('archive-list');
        const searchInput = document.getElementById('archive-search');
        const query = searchInput ? searchInput.value.toLowerCase() : '';
        
        container.innerHTML = '';

        // 検索フィルタリング と 並び替え（新しい順）
        const filteredArchive = appData.archive.filter(item => {
            return !query || item.title.toLowerCase().includes(query);
        }).slice().reverse();

        if (filteredArchive.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#9ca3af; padding:40px;">アーカイブされた項目はありません</div>';
            return;
        }

        filteredArchive.forEach((item, idx) => {
            const card = document.createElement('div');
            card.className = 'archive-card';
            
            // 日付フォーマット
            const dateStr = item.archivedAt ? new Date(item.archivedAt).toLocaleDateString() : '---';

            card.innerHTML = `
                <div style="font-weight:bold; font-size:14px; margin-bottom:8px; line-height:1.4;">${item.title}</div>
                <div class="archive-date">保管日: ${dateStr}</div>
                <div style="margin-top:10px; display:flex; gap:8px; justify-content:flex-end;">
                    <button class="btn btn-outline btn-sm btn-restore">復元</button>
                    <button class="btn btn-danger btn-sm btn-delete">削除</button>
                </div>
            `;

            // 復元ボタン (現在のボードの最初の列に戻す簡易実装)
            card.querySelector('.btn-restore').onclick = () => {
                if(confirm('メインボードに復元しますか？')) {
                    // アーカイブから削除
                    // (元配列のインデックスを探す必要があるため、filter前の配列から削除)
                    const realIdx = appData.archive.indexOf(item);
                    if (realIdx > -1) appData.archive.splice(realIdx, 1);

                    // 復元先: 最初のボードの最初の列
                    const targetBoard = appData.boards[0];
                    if (targetBoard && targetBoard.columns.length > 0) {
                        const targetCol = targetBoard.columns[0].id;
                        if (!targetBoard.cards[targetCol]) targetBoard.cards[targetCol] = [];
                        
                        // データ調整（アーカイブ情報を消すなど）
                        delete item.archivedAt;
                        item.isToday = false;
                        
                        targetBoard.cards[targetCol].push(item);
                        alert(`ボード「${targetBoard.title}」の「${targetBoard.columns[0].name}」列に復元しました。`);
                    } else {
                        alert('復元先のボードが見つかりませんでした。');
                    }
                    saveAll();
                    renderArchiveView();
                }
            };

            // 完全削除ボタン
            card.querySelector('.btn-delete').onclick = () => {
                if(confirm('完全に削除しますか？\nこの操作は取り消せません。')) {
                    const realIdx = appData.archive.indexOf(item);
                    if (realIdx > -1) appData.archive.splice(realIdx, 1);
                    saveAll();
                    renderArchiveView();
                }
            };

            container.appendChild(card);
        });
    }

    // アーカイブ検索窓のイベントリスナーもここで設定しておくと便利です
    const archiveSearchInput = document.getElementById('archive-search');
    if(archiveSearchInput) {
        archiveSearchInput.oninput = renderArchiveView;
    }
    
    // 画面切り替え & コンテキストメニュー
    function setupViewSwitch() { const switchMode = (mode) => { currentView = mode; appSlider.classList.remove('show-focus', 'show-archive'); if (mode === 'focus') { appSlider.classList.add('show-focus'); renderFocusMode(); } else if (mode === 'archive') { appSlider.classList.add('show-archive'); renderArchiveView(); } else { renderApp(); } }; document.getElementById('btn-go-focus').onclick = () => switchMode('focus'); document.getElementById('btn-go-archive').onclick = () => switchMode('archive'); document.getElementById('btn-back-from-focus').onclick = () => switchMode('board'); document.getElementById('btn-back-from-archive').onclick = () => switchMode('board'); }
    // ----------------------------------------------------
    // ★ 手順2: この関数も上書きしてください (メニューの出し分け機能を追加)
    // ----------------------------------------------------
    function openContextMenu(e, targetObj, type, cb) {
        activeContextMenu = { target: targetObj, cb: cb };
        const menu = document.getElementById('context-menu');
        
        // メニューの中身をタイプによって出し分ける
        const archiveBtn = document.getElementById('ctx-archive-col');
        if (archiveBtn) {
            // 'column' の時だけ「アーカイブ」ボタンを表示する
            archiveBtn.style.display = (type === 'column') ? 'flex' : 'none';
        }

        // 表示位置の計算
        menu.style.display = 'block';
        const rect = menu.getBoundingClientRect();
        let top = e.clientY;
        let left = e.clientX;
        
        // 画面からはみ出さないように調整
        if(left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 10;
        if(top + rect.height > window.innerHeight) top = e.clientY - rect.height;
        
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
        
        // --- クリックイベントの設定 ---
        
        // 名前変更
        const renameBtn = document.getElementById('ctx-rename');
        // イベントリスナーが重複しないように一度リセット(cloneNode)するか、onclickを上書きする
        renameBtn.onclick = () => {
            const currentName = activeContextMenu.target.name;
            const newName = prompt('名前を変更:', currentName);
            if(newName && newName.trim() !== "") {
                activeContextMenu.target.name = newName;
                activeContextMenu.cb(); // コールバック実行（再描画など）
                menu.style.display = 'none';
            }
        };

        // 色変更
        createColorGrid('ctx-color-grid', (c) => {
            activeContextMenu.target.color = c;
            activeContextMenu.cb(); // コールバック実行（再描画など）
            menu.style.display = 'none';
        });
    }
    
    function createColorGrid(id, cb) { const con = document.getElementById(id); con.innerHTML = ''; PALETTE.forEach(c => { const d = document.createElement('div'); d.className = 'color-swatch'; d.style.backgroundColor = c; d.onclick = (e) => { e.stopPropagation(); cb(c); }; con.appendChild(d); }); }
    function setupColorPickerBtn(btnId, popId, gridId, cb) {
        const btn = document.getElementById(btnId);
        const pop = document.getElementById(popId);
        
        // 色グリッドの生成（ここは変更なし）
        createColorGrid(gridId, (c) => {
            btn.style.backgroundColor = c;
            if(cb) cb(c);
            pop.classList.remove('active');
        });

        // クリック時の処理を「スマート関数」に委譲
        btn.onclick = (e) => {
            e.stopPropagation(); // 親への伝播を止める
            toggleSmartPopover(btn, pop);
        };
    }
    function closeAllColorPopovers() { document.querySelectorAll('.color-picker-popover').forEach(p => p.classList.remove('active')); }
    function addDnDHandlers(item, type, bid, idx) { item.draggable = true; item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({type, idx})); item.classList.add('dragging'); }); item.addEventListener('dragover', (e) => e.preventDefault()); item.addEventListener('drop', (e) => { e.stopPropagation(); const d = JSON.parse(e.dataTransfer.getData('text/plain')); if(d.type === type) { const board = appData.boards.find(b => b.id === bid); const list = (type === 'field') ? board.fields : board.columns; const val = list.splice(d.idx, 1)[0]; list.splice(idx, 0, val); saveAll(); if(type === 'field') renderFieldList(board); else renderColumnList(board); } return false; }); item.addEventListener('dragend', () => item.classList.remove('dragging')); }
    function renderColumnList(board) { const list = document.getElementById('column-list-container'); list.innerHTML = ''; board.columns.forEach((col, idx) => { const li = document.createElement('li'); li.className = 'settings-item'; addDnDHandlers(li, 'column', board.id, idx); li.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><span style="cursor:move;color:#aaa;">☰</span><span style="display:inline-block;width:12px;height:12px;background:${col.color};border:1px solid #ccc;"></span>${col.name}</div><button class="btn btn-danger btn-sm" onclick="removeColumn('${board.id}',${idx})">削除</button>`; li.oncontextmenu=(e)=>{e.preventDefault();openContextMenu(e,col,'column',()=>{renderColumnList(board);saveAll();})}; list.appendChild(li); }); }
    function addNewCard(bid, cid) { const board = appData.boards.find(b => b.id === bid); const newCard = { id:'c_'+Date.now(), title:'新規タスク', date:'', customValues:{}, subtasks:[], isToday: false }; if(!board.cards[cid]) board.cards[cid]=[]; board.cards[cid].push(newCard); saveAll(); renderApp(); openCardEdit(bid, newCard); }
    window.removeField = function(bid, idx) { if(confirm('削除しますか？')) { const board = appData.boards.find(b => b.id === bid); board.fields.splice(idx, 1); saveAll(); renderFieldList(board); } };
    window.removeColumn = function(bid, idx) { if(confirm('削除しますか？')) { const board = appData.boards.find(b => b.id === bid); board.columns.splice(idx, 1); saveAll(); renderColumnList(board); } };
    window.toggleFieldVis = function(bid, idx, checked) { appData.boards.find(b => b.id === bid).fields[idx].visible = checked; saveAll(); renderFieldList(appData.boards.find(b => b.id === bid)); };
    function setupBackup() { document.getElementById('btn-export').onclick = () => { const b = new Blob([JSON.stringify(appData, null, 2)], {type:"application/json"}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `kanban_backup.json`; a.click(); }; document.getElementById('btn-import').onclick = () => fileInput.click(); fileInput.onchange = (e) => { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (ev) => { try { appData = JSON.parse(ev.target.result); saveAll(); renderApp(); alert('復元しました'); } catch(err){ alert('エラー'); } fileInput.value = ''; }; r.readAsText(f); }; }
    function createNewBoard(){ const t = prompt('ボード名:'); if(t) { appData.boards.push({ id:'b_'+Date.now(), title:t, color:'#3B82F6', maxHeight:0, fields:[], columns:[{id:'c1', name:'TODO', color:'#64748B'}], cards:{c1:[]} }); saveAll(); renderApp(); } }
    function saveAll() { localStorage.setItem(KEY_DATA, JSON.stringify(appData)); }
    function loadData() { const d = localStorage.getItem(KEY_DATA); return d ? JSON.parse(d) : INITIAL_DATA; }
    window.changeTheme = function(t) { document.body.classList.remove('theme-dark', 'theme-sakura'); if(t !== 'light') document.body.classList.add('theme-'+t); appData.settings.theme = t; saveAll(); }; if(appData.settings.theme) changeTheme(appData.settings.theme);
    function setupShortcuts() {
        // 設定キーとボタンIDの対応マップ
        const keyMap = [
            { configKey: 'toFocus', btnId: 'key-btn-focus' },
            { configKey: 'toBoard', btnId: 'key-btn-board' },
            { configKey: 'toArchive', btnId: 'key-btn-archive' },
            { configKey: 'search', btnId: 'key-btn-search' }
        ];

        // 1. 設定画面のボタン動作（クリックで変更待ち状態にする）
        keyMap.forEach(item => {
            const btn = document.getElementById(item.btnId);
            if(!btn) return;

            // 現在の設定値を表示
            btn.textContent = (appData.settings.shortcuts[item.configKey] || '').toUpperCase();

            btn.onclick = () => {
                // 他のボタンが変更中ならキャンセル
                document.querySelectorAll('.kbd-key').forEach(b => {
                    b.classList.remove('recording');
                    // 元の表示に戻す（変更されなかった場合）
                    const key = keyMap.find(m => m.btnId === b.id).configKey;
                    b.textContent = appData.settings.shortcuts[key].toUpperCase();
                });
                
                // このボタンを変更待ちモードに
                btn.classList.add('recording');
                btn.textContent = '...'; // 入力待ち表示
                recordingTarget = item.configKey; // グローバル変数にターゲットをセット
                isRecordingKey = true;            // グローバル変数でフラグON
            };
        });

        // 2. キーボード入力の監視（実行 ＆ 設定変更）
        document.addEventListener('keydown', (e) => {
            // A. 入力フォーム使用中はショートカットを無視（Esc以外）
            if (!isRecordingKey && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                if(e.key === 'Escape') e.target.blur(); // Escでフォーカス解除は便利なので残す
                return;
            }

            // B. キー設定変更モードの場合
            if (isRecordingKey && recordingTarget) {
                e.preventDefault(); // ブラウザのデフォルト動作を阻止
                
                // 新しいキーを保存
                appData.settings.shortcuts[recordingTarget] = e.key.toLowerCase();
                saveAll();

                // UI反映 & モード終了
                const targetItem = keyMap.find(m => m.configKey === recordingTarget);
                const targetBtn = document.getElementById(targetItem.btnId);
                targetBtn.textContent = e.key.toUpperCase();
                targetBtn.classList.remove('recording');
                
                isRecordingKey = false;
                recordingTarget = null;
                return;
            }

            // C. 通常のショートカット実行
            // (画面上のボタンをクリックすることで動作を再現します)
            const s = appData.settings.shortcuts;
            const k = e.key.toLowerCase();

            if (k === s.toFocus) {
                // 今日の実行へ
                const btn = document.getElementById('btn-go-focus');
                if(btn) btn.click();
            } else if (k === s.toBoard) {
                // メインボードへ戻る（現在の画面に応じてボタンを押し分ける）
                if(appSlider.classList.contains('show-focus')) {
                    document.getElementById('btn-back-from-focus').click();
                } else if(appSlider.classList.contains('show-archive')) {
                    document.getElementById('btn-back-from-archive').click();
                }
            } else if (k === s.toArchive) {
                // アーカイブへ
                const btn = document.getElementById('btn-go-archive');
                if(btn) btn.click();
            } else if (k === s.search) {
                // 検索窓にフォーカス
                e.preventDefault(); // '/'などが入力されないようにする
                searchInput.focus();
            }
        });
    }
    function setupAlertSettings() {
        const toggle = document.getElementById('setting-alert-toggle');
        const daysInput = document.getElementById('setting-alert-days');

        // ① 初期値の反映
        // 設定がない場合はデフォルトtrue
        if (appData.settings.alertEnabled === undefined) appData.settings.alertEnabled = true;
        
        toggle.checked = appData.settings.alertEnabled;
        daysInput.value = appData.settings.alertDays || 3;
        
        // オフの場合は日数入力を無効化してあげる（親切設計）
        daysInput.disabled = !toggle.checked; 

        // ② トグル変更時の処理
        toggle.addEventListener('change', (e) => {
            appData.settings.alertEnabled = e.target.checked;
            daysInput.disabled = !e.target.checked; // 連動してグレーアウト
            saveAll();
            renderApp(); // すぐにカードの色に反映させる
        });

        // ③ 日数変更時の処理
        daysInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            if (val < 0) val = 0; // マイナス値防止
            appData.settings.alertDays = val;
            saveAll();
            renderApp(); // しきい値が変わったので再描画
        });
    }
    function updateClock() {
        const now = new Date();
        const dateEl = document.getElementById('focus-date');
        const timeEl = document.getElementById('focus-time');

        // 要素がまだ描画されていない等のエラー回避
        if (!dateEl || !timeEl) return;

        // 1. 日付のフォーマット (例: 1/27 (火))
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const dayIndex = now.getDay();
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        dateEl.textContent = `${month}/${date} (${days[dayIndex]})`;

        // 2. 時間のフォーマット (例: 12:34 56)
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');

        // 秒数だけCSSクラス(clock-sec)を適用して小さく表示
        timeEl.innerHTML = `${h}:${m}<span class="clock-sec">${s}</span>`;
    }
    setInterval(updateClock, 1000); updateClock();
// ----------------------------------------------------
    // ★ ボード並び替え機能 (正しい位置への配置版)
    // ----------------------------------------------------
    
    // 機能の初期化
    setupBoardReorder();

    // モーダルの背景クリック対応
    const reorderModal = document.getElementById('modal-board-reorder');
    if(reorderModal) {
        reorderModal.addEventListener('click', (e) => {
            if(e.target === reorderModal) {
                document.getElementById('btn-close-reorder').click();
            }
        });
    }

    function setupBoardReorder() {
        const btnOpen = document.getElementById('btn-reorder-boards');
        const modal = document.getElementById('modal-board-reorder');
        const btnClose = document.getElementById('btn-close-reorder');
        const btnSave = document.getElementById('btn-save-reorder');
        const listContainer = document.getElementById('board-reorder-list');

        if(!btnOpen || !modal) return;

        // モーダルを開く
        btnOpen.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            renderReorderList();
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        };

        // モーダルを閉じる
        const closeFunc = () => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        };
        if(btnClose) btnClose.onclick = closeFunc;

        // 保存実行
        if(btnSave) btnSave.onclick = () => {
            const newOrderIds = [];
            listContainer.querySelectorAll('.reorder-item').forEach(item => {
                newOrderIds.push(item.dataset.boardId);
            });

            const newBoards = [];
            newOrderIds.forEach(id => {
                const board = appData.boards.find(b => b.id === id);
                if(board) newBoards.push(board);
            });

            if(newBoards.length === appData.boards.length) {
                appData.boards = newBoards;
                saveAll();
                renderApp(); 
                closeFunc();
            } else {
                alert('エラー: データの不整合が発生しました');
            }
        };

        // リスト描画関数
        function renderReorderList() {
            listContainer.innerHTML = '';
            appData.boards.forEach(board => {
                const div = document.createElement('div');
                div.className = 'reorder-item';
                div.dataset.boardId = board.id;
                div.innerHTML = `
                    <span class="material-symbols-outlined reorder-handle">drag_indicator</span>
                    <div class="reorder-color-bar" style="background-color: ${board.color};"></div>
                    <span class="reorder-name">${board.title}</span>
                `;
                listContainer.appendChild(div);
            });

            if(window.Sortable) {
                new Sortable(listContainer, {
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    handle: '.reorder-handle'
                });
            }
        }
    }
});

    // ----------------------------------------------------
    // 🚪 モーダル共通管理 (Modal Manager) - DRY原則
    // ----------------------------------------------------
    function toggleModal(modalId, show) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        if (show) {
            // 開くときの処理
            modal.classList.add('active');
            // 背景のスクロールを止める（UX向上）
            document.body.style.overflow = 'hidden';
        } else {
            // 閉じるときの処理
            modal.classList.remove('active');
            // 背景のスクロールを許可する
            document.body.style.overflow = '';
            
            // もし中身が動的生成されたものなら、次回のためにリセットしても良い
            // (今回は必須ではありませんが、メモリ節約になります)
        }
    }
    
    // ----------------------------------------------------
    // 🌑 モーダル背景クリックでの保存＆閉じる機能 (厳密判定版)
    // ----------------------------------------------------
    function setupModalBackdropClicks() {
        const modalActionMap = {
            'modal-app-settings': 'btn-close-app-settings',
            'modal-user-mgmt':    'btn-close-user-mgmt',
            'modal-global-tags':  'btn-close-tag-mgmt',
            'modal-board-settings': 'board-close-btn', // ここはtopボタンでもOK
            'modal-card-edit': () => {
                const isEditing = document.getElementById('card-edit-mode').style.display !== 'none';
                return isEditing ? 'card-save-btn' : 'view-close-btn';
            }
        };

        const overlays = document.querySelectorAll('.modal-overlay');
        
        overlays.forEach(overlay => {
            // マウスが押された場所を記憶する変数
            let mouseDownTarget = null;

            // 1. マウスボタンが「押された」瞬間
            overlay.addEventListener('mousedown', (e) => {
                // 押されたのが「背景そのもの」か「中身」かを記録
                mouseDownTarget = e.target;
            });

            // 2. マウスボタンが「離された」瞬間
            overlay.addEventListener('mouseup', (e) => {
                const mouseUpTarget = e.target;

                // 【厳密な判定ルール】
                // ① 離した場所が「背景(overlay)」である
                // ② 最初に押した場所も「背景(overlay)」であった
                // → これなら「背景をクリックした」とみなして閉じる！
                if (mouseUpTarget === overlay && mouseDownTarget === overlay) {
                    
                    const action = modalActionMap[overlay.id];
                    let btnId = null;

                    if (typeof action === 'function') {
                        btnId = action(); 
                    } else {
                        btnId = action;
                    }

                    const btn = document.getElementById(btnId);
                    if (btn) {
                        // 既存の保存・閉じるボタンを押したことにする（DRY）
                        btn.click();
                    }
                }
                
                // リセット
                mouseDownTarget = null;
            });
        });
    }
    // ----------------------------------------------------
    // 🧭 設定画面のナビゲーション機能 (スクロールスパイ & スムーススクロール)
    // ----------------------------------------------------
    function setupSettingsNavigation() {
        const container = document.querySelector('.settings-main-content');
        const navLinks = document.querySelectorAll('.settings-nav-item');
        const sections = document.querySelectorAll('.settings-section');

        // --- 1. クリック時のスムーススクロール ---
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault(); // デフォルトのジャンプをキャンセル
                
                const targetId = link.getAttribute('href').substring(1);
                const targetSection = document.getElementById(targetId);

                if (targetSection && container) {
                    // コンテナ内での相対位置を計算
                    // section.offsetTop: 親要素からの距離
                    // container.offsetTop: コンテナ自体の位置
                    // ★ -20 : これが「上の余白」です。数値を増やせばもっと余白が空きます。
                    const topPos = targetSection.offsetTop - container.offsetTop - 50;

                    // 高速かつ滑らかに移動
                    container.scrollTo({
                        top: topPos,
                        behavior: 'smooth' 
                    });
                }
            });
        });

        // --- 2. スクロールスパイ (現在地の強調表示) ---
        if (container) {
            container.addEventListener('scroll', () => {
                let currentSectionId = '';

                // ★ここが新機能: スクロールが一番下まで到達したかチェック
                // (スクロール量 + 表示領域の高さ >= 全体の高さ - 誤差1px)
                const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 1;

                if (isAtBottom) {
                    // 一番下なら、無条件で最後のセクションをアクティブにする
                    const lastSection = sections[sections.length - 1];
                    currentSectionId = lastSection.getAttribute('id');
                } else {
                    // 通常の判定（上からの距離）
                    sections.forEach(section => {
                        const sectionTop = section.offsetTop - container.offsetTop;
                        if (container.scrollTop >= sectionTop - 250) {currentSectionId = section.getAttribute('id');}
                    });
                }

                // 一番上のセクションより上にいる場合（初期位置など）は最初のセクションを選択
                if (container.scrollTop < 50) {
                     currentSectionId = 'sec-general'; 
                }

                // ナビゲーションのクラスを付け替え
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href').substring(1) === currentSectionId) {
                        link.classList.add('active');
                    }
                });
            });
        }
    }
    