class Dashboard {
    constructor() {
        // 환경에 따라 API URL 자동 설정
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        this.apiBaseUrl = isLocalhost ? 'http://localhost:3001/api' : '/api';

        this.state = {
            dateFrom: new Date(Date.now() - 3 * 24 * 3600000),
            dateTo: new Date(),
            selectedTags: [],
            availableTagsData: [],
            chartData: new Map(),
            editMode: false,
            draggedElement: null
        };

        // 자동 로그인 체크
        this.checkAutoLogin();

        // 메뉴 외부 클릭시 닫기
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('headerDropdown');
            const menuBtn = document.getElementById('menuBtn');
            if (dropdown && menuBtn && !dropdown.contains(e.target) && !menuBtn.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }

    // 자동 로그인 체크 (7일 유효)
    checkAutoLogin() {
        const loginData = localStorage.getItem('dcs_login');
        if (!loginData) return;

        try {
            const { username, expiresAt } = JSON.parse(loginData);
            const now = new Date().getTime();

            // 만료되지 않았으면 자동 로그인
            if (now < expiresAt) {
                console.log('🔐 자동 로그인:', username);
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainContainer').style.display = 'block';
                this.init();
            } else {
                // 만료되었으면 localStorage 삭제
                console.log('⏰ 로그인 세션 만료 (7일 경과)');
                localStorage.removeItem('dcs_login');
            }
        } catch (error) {
            console.error('자동 로그인 실패:', error);
            localStorage.removeItem('dcs_login');
        }
    }

    // 로그아웃
    logout() {
        localStorage.removeItem('dcs_login');
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainContainer').style.display = 'none';
        console.log('👋 로그아웃 완료');
    }

    // 메뉴 토글
    toggleMenu() {
        const dropdown = document.getElementById('headerDropdown');
        dropdown.classList.toggle('active');
    }

    // 메뉴 닫기
    closeMenu() {
        const dropdown = document.getElementById('headerDropdown');
        dropdown.classList.remove('active');
    }

    async init() {
        // 날짜 초기화
        document.getElementById('dateFrom').value = this.formatDate(this.state.dateFrom);
        document.getElementById('dateTo').value = this.formatDate(this.state.dateTo);

        // 메타데이터 미리 로드
        await this.loadMetadata(false);

        console.log('✅ DCS 대시보드 준비 완료');
    }

    // 로그인 (Supabase 사용)
    async login() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');

        errorEl.style.display = 'none';

        try {
            console.log('🔐 로그인 시도:', username);

            const response = await fetch(`${this.apiBaseUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ 로그인 성공!');

                // 로그인 정보를 localStorage에 저장 (7일 유효)
                const expiresAt = new Date().getTime() + (7 * 24 * 60 * 60 * 1000); // 7일
                localStorage.setItem('dcs_login', JSON.stringify({
                    username: username,
                    expiresAt: expiresAt
                }));
                console.log('💾 로그인 세션 저장 (7일간 유효)');

                // 화면 전환
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainContainer').style.display = 'block';

                // 대시보드 초기화
                this.init();
            } else {
                console.error('❌ 로그인 실패:', result.message);
                errorEl.textContent = result.message;
                errorEl.style.display = 'block';
            }
        } catch (error) {
            console.error('❌ 로그인 에러:', error);
            errorEl.textContent = '로그인 실패: ' + error.message;
            errorEl.style.display = 'block';
        }
    }

    // 메타데이터 로드
    async loadMetadata(forceRefresh = false) {
        try {
            const url = forceRefresh
                ? `${this.apiBaseUrl}/meta?force_refresh=true`
                : `${this.apiBaseUrl}/meta`;

            const response = await fetch(url);
            const result = await response.json();

            if (result.success && result.data) {
                this.state.availableTagsData = result.data;
                const source = result.cached ? 'Supabase 캐시' : 'API';
                console.log(`✅ 메타데이터 로드 완료 (${source}):`, this.state.availableTagsData.length, '개');

                // 마지막 업데이트 날짜 표시
                const lastUpdatedEl = document.getElementById('metaLastUpdated');
                if (result.updated_at && lastUpdatedEl) {
                    const date = new Date(result.updated_at);
                    const formatted = date.toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                    lastUpdatedEl.textContent = `${formatted} 목록`;
                    console.log('📅 마지막 업데이트:', formatted);
                } else if (lastUpdatedEl && !result.cached) {
                    lastUpdatedEl.textContent = `방금 가져온 목록`;
                }
            }
        } catch (error) {
            console.error('메타데이터 로드 실패:', error);
            this.showNotification('메타데이터를 불러올 수 없습니다.', 'error');
        }
    }

    // 태그 선택 모달 열기
    async openTagSelector() {
        document.getElementById('tagSelectorModal').classList.add('active');

        // 로딩 표시
        const container = document.getElementById('tagListContainer');
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #86868B;">계기 목록을 불러오는 중...</div>';

        // 메타데이터 로드 (캐시 우선)
        await this.loadMetadata(false);

        if (this.state.availableTagsData.length > 0) {
            this.displayAvailableTags();
        } else {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #FF3B30;">계기 목록을 불러올 수 없습니다.</div>';
        }
    }

    // 메타데이터 강제 새로고침 (API에서 최신 데이터 가져오기)
    async refreshMetadata() {
        const headerBtn = document.getElementById('refreshMetaHeaderBtn');
        const container = document.getElementById('tagListContainer');

        if (headerBtn) headerBtn.classList.add('loading');
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #86868B;">API에서 최신 목록을 가져오는 중...</div>';

        try {
            await this.loadMetadata(true); // force refresh = true로 API 호출

            if (this.state.availableTagsData.length > 0) {
                this.displayAvailableTags();
                this.showNotification('계기 목록이 업데이트되었습니다.', 'success');
            } else {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #FF3B30;">계기 목록을 불러올 수 없습니다.</div>';
            }
        } catch (error) {
            console.error('새로고침 실패:', error);
            this.showNotification('새로고침에 실패했습니다.', 'error');
        } finally {
            if (headerBtn) headerBtn.classList.remove('loading');
        }
    }

    // 사용 가능한 태그 표시
    displayAvailableTags() {
        const container = document.getElementById('tagListContainer');
        const groupedTags = this.groupTagsByCompany(this.state.availableTagsData);

        let html = '';
        // WIE를 먼저, INTECO를 나중에 표시
        const orderedCompanies = ['WIE', 'INTECO'];

        orderedCompanies.forEach(company => {
            const tags = groupedTags[company];
            if (!tags || tags.length === 0) return;

            html += `
                <div class="company-section">
                    <h3>${company}</h3>
                    <div class="company-tags-grid">`;

            tags.forEach(tag => {
                const isSelected = this.state.selectedTags.includes(tag.tag_name);
                const desc = tag.tag_desc || tag.description || this.getTagDescription(tag.tag_name);
                html += `
                    <div class="tag-item ${isSelected ? 'selected' : ''}"
                         onclick="dashboard.toggleTag('${tag.tag_name}')">
                        <div class="tag-item-name">${tag.tag_name}</div>
                        <div class="tag-item-desc">${desc}</div>
                    </div>`;
            });

            html += `
                    </div>
                </div>`;
        });

        container.innerHTML = html;
        this.updateSelectedCount();
    }

    // 회사별로 태그 그룹화
    groupTagsByCompany(tags) {
        const grouped = {};
        tags.forEach(tag => {
            const company = tag.company ? tag.company.toUpperCase() : 'INTECO';
            if (!grouped[company]) grouped[company] = [];
            grouped[company].push(tag);
        });
        return grouped;
    }

    // 태그 설명 가져오기
    getTagDescription(tagName) {
        const nameLower = tagName.toLowerCase();
        const descriptions = {
            'kepco_power_': '전력',
            'kepco_voltage_': '전압',
            'kepco_current_': '전류',
            'kepco_frequency_': '주파수',
            'kepco_pf_': '역률',
            'posco_temp_': '온도',
            'posco_pressure_': '압력',
            'posco_flow_': '유량',
            'posco_level_': '레벨',
            'posco_speed_': '속도'
        };

        for (const [prefix, desc] of Object.entries(descriptions)) {
            if (nameLower.startsWith(prefix)) return desc;
        }
        return '계측기';
    }

    // 태그 토글
    toggleTag(tagName) {
        const index = this.state.selectedTags.indexOf(tagName);
        if (index > -1) {
            this.state.selectedTags.splice(index, 1);
        } else {
            this.state.selectedTags.push(tagName);
        }
        this.displayAvailableTags();
    }

    // 전체 선택
    selectAllTags() {
        this.state.selectedTags = this.state.availableTagsData.map(t => t.tag_name);
        this.displayAvailableTags();
    }

    // 전체 해제
    clearAllTags() {
        this.state.selectedTags = [];
        this.displayAvailableTags();
    }

    // 선택 개수 업데이트
    updateSelectedCount() {
        document.getElementById('selectedCount').textContent =
            `선택된 계기: ${this.state.selectedTags.length}개`;
    }

    // 태그 검색
    searchTags() {
        const searchTerm = document.getElementById('tagSearchInput').value.toLowerCase();
        const allItems = document.querySelectorAll('.tag-item');

        allItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    // 선택된 태그 적용
    applySelectedTags() {
        this.closeModal('tagSelectorModal');
        this.renderWidgets();
        this.refreshData();
    }

    // 위젯 렌더링
    renderWidgets() {
        const grid = document.getElementById('dashboardGrid');
        grid.innerHTML = '';

        // 선택된 태그가 없을 때 안내 메시지 표시
        if (this.state.selectedTags.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <h3>모니터링할 계기를 선택해주세요</h3>
                    <p>
                        좌측 상단의 <strong>☰ 메뉴</strong>를 클릭하여<br>
                        <strong>레이아웃 관리</strong>에서 저장된 레이아웃을 불러오거나<br>
                        <strong>계기 선택</strong>에서 모니터링할 계기를 선택하세요
                    </p>
                    <div class="empty-state-actions">
                        <button class="btn btn-primary" onclick="dashboard.openLayoutManager()">
                            ☰ 레이아웃 관리
                        </button>
                        <button class="btn btn-primary" onclick="dashboard.openTagSelector()">
                            📊 계기 선택
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        this.state.selectedTags.forEach((tagName, index) => {
            const widget = document.createElement('div');
            widget.className = 'widget';
            widget.id = `widget-${tagName}`;
            widget.setAttribute('data-tag', tagName);
            widget.setAttribute('data-index', index);
            widget.draggable = true;

            // 드래그 이벤트
            widget.addEventListener('dragstart', (e) => this.handleDragStart(e));
            widget.addEventListener('dragend', (e) => this.handleDragEnd(e));
            widget.addEventListener('dragover', (e) => this.handleDragOver(e));
            widget.addEventListener('drop', (e) => this.handleDrop(e));
            widget.addEventListener('dragleave', (e) => this.handleDragLeave(e));

            // 클릭 이벤트 (드래그 중이 아닐 때만)
            widget.addEventListener('click', (e) => {
                if (!this.state.draggedElement) {
                    this.openChartModal(tagName);
                }
            });

            // 메타데이터에서 태그 정보 찾기 (대소문자 구분 없이)
            const tagData = this.state.availableTagsData.find(t =>
                t.tag_name && t.tag_name.toLowerCase() === tagName.toLowerCase()
            );
            const desc = tagData?.tag_desc || tagData?.description || this.getTagDescription(tagName);

            // 디버깅: 메타데이터 매칭 확인
            if (tagData) {
                console.log(`📋 ${tagName} 설명:`, desc);
            } else {
                console.warn(`⚠️ ${tagName}의 메타데이터를 찾을 수 없습니다. 기본 설명 사용:`, desc);
            }

            widget.innerHTML = `
                <div class="widget-header">
                    <div class="widget-title">${tagName}</div>
                    <button class="widget-close" onclick="event.stopPropagation(); dashboard.removeWidget('${tagName}')">×</button>
                </div>
                <div class="widget-desc">${desc}</div>
                <div class="widget-value">
                    <span id="value-${tagName}">--</span>
                    <span class="widget-unit" id="unit-${tagName}"></span>
                </div>
            `;

            grid.appendChild(widget);
        });
    }

    // 위젯 삭제
    removeWidget(tagName) {
        const index = this.state.selectedTags.indexOf(tagName);
        if (index > -1) {
            this.state.selectedTags.splice(index, 1);
        }

        const widget = document.getElementById(`widget-${tagName}`);
        if (widget) widget.remove();

        // 차트 데이터도 삭제
        this.state.chartData.delete(tagName);
    }

    // 데이터 새로고침
    async refreshData() {
        if (this.state.selectedTags.length === 0) {
            this.showNotification('모니터링할 계기를 선택해주세요.', 'error');
            return;
        }

        const refreshBtn = document.getElementById('refreshBtn');
        const loadingOverlay = document.getElementById('loadingOverlay');
        refreshBtn.classList.add('loading');
        loadingOverlay.classList.add('show');

        try {
            // 태그 이름을 소문자로 변환
            const tagNamesLower = this.state.selectedTags.map(tag => tag.toLowerCase());
            console.log('📤 요청할 태그 (소문자):', tagNamesLower);

            const response = await fetch(`${this.apiBaseUrl}/data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exec_from_dt: this.formatDate(this.state.dateFrom),
                    exec_to_dt: this.formatDate(this.state.dateTo),
                    tag_names: tagNamesLower
                })
            });

            const result = await response.json();

            if (result.success && result.data) {
                this.updateCharts(result.data);

                // 시간 표시 업데이트
                if (result.data.length > 0) {
                    const lastItem = result.data[result.data.length - 1];
                    const timestamp = lastItem.dtm || lastItem.timestamp || lastItem.exec_tm;
                    if (timestamp) {
                        this.updateLastTime(timestamp);
                    }
                }

                this.showNotification('데이터가 업데이트되었습니다.', 'success');
            } else {
                throw new Error(result.message || '데이터를 가져올 수 없습니다.');
            }
        } catch (error) {
            console.error('데이터 로드 실패:', error);
            this.showNotification('데이터를 불러오는데 실패했습니다.', 'error');
            this.showConnectionError();
        } finally {
            refreshBtn.classList.remove('loading');
            loadingOverlay.classList.remove('show');
        }
    }

    // 차트 업데이트
    updateCharts(data) {
        console.log('📊 받은 데이터:', data);
        console.log('📊 첫 번째 데이터 항목:', data[0]);
        console.log('📊 데이터 키들:', data[0] ? Object.keys(data[0]) : []);

        if (!data || data.length === 0) {
            console.warn('⚠️ 데이터가 없습니다');
            this.showNotification('조회된 데이터가 없습니다.', 'error');
            return;
        }

        // 태그 이름 매핑 (소문자 -> 원본 대문자)
        const tagNameMap = {};
        this.state.selectedTags.forEach(tag => {
            tagNameMap[tag.toLowerCase()] = tag;
        });

        console.log('🔤 태그 매핑:', tagNameMap);

        // Wide format → Long format 변환
        // 각 행의 컬럼들이 태그 이름입니다
        const groupedData = {};

        data.forEach((row, index) => {
            const timestamp = row.dtm || row.timestamp || row.exec_tm;

            // dtm을 제외한 모든 필드가 태그입니다
            Object.keys(row).forEach(fieldName => {
                if (fieldName === 'dtm' || fieldName === 'timestamp' || fieldName === 'exec_tm') {
                    return; // 시간 필드는 건너뛰기
                }

                const fieldNameLower = fieldName.toLowerCase();
                const originalTagName = tagNameMap[fieldNameLower];

                if (!originalTagName) {
                    // 선택되지 않은 태그는 건너뛰기
                    return;
                }

                // 태그별 데이터 배열 생성
                if (!groupedData[originalTagName]) {
                    groupedData[originalTagName] = [];
                }

                // Long format으로 변환
                groupedData[originalTagName].push({
                    dtm: timestamp,
                    tag_val: row[fieldName],
                    tag_name: originalTagName
                });
            });
        });

        console.log('📊 그룹화된 데이터:', groupedData);

        // 각 태그의 값 업데이트
        for (const [tagName, items] of Object.entries(groupedData)) {
            this.state.chartData.set(tagName, items);

            const values = items.map(item => item.tag_val);
            console.log(`📈 ${tagName} 데이터:`, values);

            // 최신 값 표시
            if (values.length > 0) {
                const lastValue = values[values.length - 1];
                const valueEl = document.getElementById(`value-${tagName}`);
                if (valueEl) {
                    valueEl.textContent = Number(lastValue).toFixed(2);
                    console.log(`✅ ${tagName} 값 표시:`, lastValue);
                }

                // 단위 표시
                const unitEl = document.getElementById(`unit-${tagName}`);
                if (unitEl) {
                    unitEl.textContent = this.getUnit(tagName);
                }
            } else {
                console.warn(`⚠️ ${tagName}에 값이 없습니다`);
            }
        }
    }

    // 단위 가져오기
    getUnit(tagName) {
        const nameLower = tagName.toLowerCase();
        if (nameLower.includes('power')) return 'kW';
        if (nameLower.includes('voltage')) return 'V';
        if (nameLower.includes('current')) return 'A';
        if (nameLower.includes('frequency')) return 'Hz';
        if (nameLower.includes('pf')) return '';
        if (nameLower.includes('temp')) return '°C';
        if (nameLower.includes('pressure')) return 'MPa';
        if (nameLower.includes('flow')) return 'm³/h';
        if (nameLower.includes('level')) return 'm';
        if (nameLower.includes('speed')) return 'rpm';
        return '';
    }

    // 시간 표시 업데이트
    updateLastTime(timestamp) {
        const timeEl = document.getElementById('currentDateTime');
        const timeDisplay = document.getElementById('timeDisplay');

        if (timeEl && timestamp) {
            const date = new Date(timestamp);
            const hours = date.getHours();
            timeEl.textContent = `${hours}시 Data`;

            if (timeDisplay) {
                timeDisplay.classList.remove('error');
            }
        }
    }

    // 연결 오류 표시
    showConnectionError() {
        const timeEl = document.getElementById('currentDateTime');
        const timeDisplay = document.getElementById('timeDisplay');

        if (timeEl) {
            timeEl.textContent = '연결실패';
        }
        if (timeDisplay) {
            timeDisplay.classList.add('error');
        }
    }

    // 차트 모달 열기
    openChartModal(tagName) {
        const modal = document.getElementById('chartModal');
        const title = document.getElementById('chartModalTitle');
        const canvas = document.getElementById('chartModalCanvas');

        if (!modal || !canvas) return;

        // 메타데이터에서 설명 가져오기 (대소문자 구분 없이)
        const tagData = this.state.availableTagsData.find(t =>
            t.tag_name && t.tag_name.toLowerCase() === tagName.toLowerCase()
        );
        const desc = tagData?.tag_desc || tagData?.description || this.getTagDescription(tagName);
        title.innerHTML = `${tagName}<br><span style="font-size: 14px; font-weight: 400; color: #86868B;">(${desc})</span>`;

        const chartData = this.state.chartData.get(tagName);
        if (!chartData || chartData.length === 0) {
            this.showNotification('표시할 데이터가 없습니다.', 'error');
            return;
        }

        modal.classList.add('active');

        // 통계 계산
        const values = chartData.map(item => item.tag_val);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;

        // 통계 표시
        document.getElementById('statMin').textContent = min.toFixed(2);
        document.getElementById('statAvg').textContent = avg.toFixed(2);
        document.getElementById('statMax').textContent = max.toFixed(2);

        // 기존 차트가 있다면 삭제
        if (this.modalChart) {
            this.modalChart.destroy();
        }

        // 새 차트 생성
        const ctx = canvas.getContext('2d');
        this.modalChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.map(item =>
                    new Date(item.dtm || item.timestamp || item.exec_tm).toLocaleString('ko-KR', {
                        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
                    })
                ),
                datasets: [{
                    label: `${this.getUnit(tagName)}`,
                    data: values,
                    borderColor: '#007AFF',
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true }
                },
                scales: {
                    x: { display: true },
                    y: { display: true }
                }
            }
        });
    }

    // 날짜 변경
    onDateChange() {
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;

        if (dateFrom && dateTo) {
            this.state.dateFrom = new Date(dateFrom);
            this.state.dateTo = new Date(dateTo);
        }
    }

    // 날짜 포맷
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 모달 닫기
    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');

        if (modalId === 'chartModal' && this.modalChart) {
            this.modalChart.destroy();
            this.modalChart = null;
        }
    }

    // 알림 표시
    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification show ${type}`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // ==================== 드래그 앤 드롭 ====================

    handleDragStart(e) {
        this.state.draggedElement = e.currentTarget;
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
        this.state.draggedElement = null;
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const afterElement = this.getDragAfterElement(e.currentTarget.parentElement, e.clientY);
        if (afterElement == null) {
            e.currentTarget.parentElement.appendChild(this.state.draggedElement);
        } else {
            e.currentTarget.parentElement.insertBefore(this.state.draggedElement, afterElement);
        }
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();

        const draggedTag = this.state.draggedElement.getAttribute('data-tag');
        const targetTag = e.currentTarget.getAttribute('data-tag');

        if (draggedTag === targetTag) return;

        // selectedTags 배열 순서 변경
        const draggedIndex = this.state.selectedTags.indexOf(draggedTag);
        const targetIndex = this.state.selectedTags.indexOf(targetTag);

        this.state.selectedTags.splice(draggedIndex, 1);
        this.state.selectedTags.splice(targetIndex, 0, draggedTag);

        // 위젯 재렌더링
        this.renderWidgets();

        // 캐시된 데이터로 현재 값 복원
        for (const [tagName, items] of this.state.chartData.entries()) {
            if (items && items.length > 0) {
                const lastValue = items[items.length - 1].tag_val;
                const valueEl = document.getElementById(`value-${tagName}`);
                if (valueEl) {
                    valueEl.textContent = Number(lastValue).toFixed(2);
                }

                const unitEl = document.getElementById(`unit-${tagName}`);
                if (unitEl) {
                    unitEl.textContent = this.getUnit(tagName);
                }
            }
        }
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.widget:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // ==================== 레이아웃 관리 ====================

    // 수정 모드 토글
    toggleEditMode() {
        this.state.editMode = !this.state.editMode;
        const grid = document.getElementById('dashboardGrid');
        const btn = document.getElementById('editModeBtn');

        if (this.state.editMode) {
            grid.classList.add('edit-mode');
            btn.textContent = '✅ 저장';
            btn.style.background = '#34C759';
            this.showNotification('수정 모드 활성화', 'success');
        } else {
            grid.classList.remove('edit-mode');
            btn.textContent = '✏️ 수정 모드';
            btn.style.background = '';
            this.showNotification('수정 모드 종료', 'success');
        }
    }

    // 레이아웃 관리 모달 열기
    async openLayoutManager() {
        document.getElementById('layoutManagerModal').classList.add('active');
        await this.loadSavedLayouts();
    }

    // 저장된 레이아웃 목록 불러오기
    async loadSavedLayouts() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/saved-selections`);
            const result = await response.json();

            if (result.success && result.data) {
                // 레이아웃 리스트 업데이트
                const layoutList = document.getElementById('layoutList');
                layoutList.innerHTML = '';

                result.data.forEach(item => {
                    // 레이아웃 리스트 아이템 추가
                    const listItem = document.createElement('div');
                    listItem.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #F5F5F7; border-radius: 8px; margin-bottom: 8px;';

                    const nameDiv = document.createElement('div');
                    nameDiv.style.cssText = 'flex: 1;';
                    nameDiv.innerHTML = `
                        <div style="font-size: 13px; font-weight: 600; color: #1D1D1F; margin-bottom: 2px;">${item.name}</div>
                        <div style="font-size: 11px; color: #86868B;">${item.tag_names.length}개 계기</div>
                    `;

                    const btnGroup = document.createElement('div');
                    btnGroup.style.cssText = 'display: flex; gap: 8px;';

                    const loadBtn = document.createElement('button');
                    loadBtn.className = 'btn btn-primary';
                    loadBtn.textContent = '불러오기';
                    loadBtn.style.cssText = 'height: 36px; padding: 0 12px; font-size: 13px;';
                    loadBtn.onclick = async () => {
                        // 메타데이터가 없으면 먼저 로드
                        if (this.state.availableTagsData.length === 0) {
                            await this.loadMetadata(false);
                        }
                        this.state.selectedTags = item.tag_names;
                        this.renderWidgets();
                        this.refreshData();
                        this.closeModal('layoutManagerModal');
                        this.showNotification(`"${item.name}" 레이아웃 적용 완료!`, 'success');
                    };

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn';
                    deleteBtn.textContent = '삭제';
                    deleteBtn.style.cssText = 'height: 36px; padding: 0 12px; font-size: 13px; background: #F5F5F7; color: #86868B; border: 1px solid #D1D1D6;';
                    deleteBtn.onclick = () => this.deleteLayout(item.id, item.name);

                    btnGroup.appendChild(loadBtn);
                    btnGroup.appendChild(deleteBtn);
                    listItem.appendChild(nameDiv);
                    listItem.appendChild(btnGroup);
                    layoutList.appendChild(listItem);
                });

                console.log(`✅ 저장된 레이아웃 ${result.data.length}개 로드`);
            }
        } catch (error) {
            console.error('레이아웃 로드 실패:', error);
        }
    }

    // 현재 레이아웃 저장
    async saveCurrentLayout() {
        if (this.state.selectedTags.length === 0) {
            this.showNotification('저장할 계기가 없습니다.', 'error');
            return;
        }

        const name = prompt('레이아웃 이름을 입력하세요:', `레이아웃 ${new Date().toLocaleDateString()}`);
        if (!name) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/saved-selections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    tag_names: this.state.selectedTags
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('레이아웃이 저장되었습니다!', 'success');
                await this.loadSavedLayouts();
            } else {
                this.showNotification('저장 실패: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('레이아웃 저장 실패:', error);
            this.showNotification('저장 중 오류 발생', 'error');
        }
    }

    // 레이아웃 불러오기
    async loadLayout() {
        const select = document.getElementById('savedLayoutsList');
        const id = select.value;

        if (!id) {
            this.showNotification('불러올 레이아웃을 선택해주세요.', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/saved-selections/${id}`);
            const result = await response.json();

            if (result.success && result.data) {
                // 메타데이터가 없으면 먼저 로드
                if (this.state.availableTagsData.length === 0) {
                    await this.loadMetadata(false);
                }
                this.state.selectedTags = result.data.tag_names;
                this.renderWidgets();
                this.refreshData();
                this.closeModal('layoutManagerModal');
                this.showNotification(`"${result.data.name}" 레이아웃 적용 완료!`, 'success');
            } else {
                this.showNotification('불러오기 실패', 'error');
            }
        } catch (error) {
            console.error('레이아웃 불러오기 실패:', error);
            this.showNotification('불러오기 중 오류 발생', 'error');
        }
    }

    // 레이아웃 삭제
    async deleteLayout(id, name) {
        if (!confirm(`"${name}" 레이아웃을 삭제하시겠습니까?`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/saved-selections/${id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification(`"${name}" 레이아웃이 삭제되었습니다.`, 'success');
                await this.loadSavedLayouts();
            } else {
                this.showNotification('삭제 실패: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('레이아웃 삭제 실패:', error);
            this.showNotification('삭제 중 오류 발생', 'error');
        }
    }
}

// 전역 인스턴스 생성
const dashboard = new Dashboard();
