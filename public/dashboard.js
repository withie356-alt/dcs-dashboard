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
            draggedElement: null,
            // 터치 드래그 관련
            touchStartX: 0,
            touchStartY: 0,
            touchTimer: null,
            isTouching: false,
            touchElement: null,
            selectedWidget: null,  // 모바일에서 선택된 위젯
            tagSettings: new Map(),  // 태그별 커스텀 설정 (이름, 가중치, 단위)
            availableUnits: []  // 사용 가능한 단위 목록
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

            // 위젯 외부 클릭 시 선택 해제
            if (!e.target.closest('.widget')) {
                this.clearWidgetSelection();
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
                window.scrollTo(0, 0);
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

        // 태그 설정 및 단위 로드
        await Promise.all([
            this.loadTagSettings(),
            this.loadUnits()
        ]);

        // 위젯 렌더링 (선택된 태그가 없으면 안내 메시지 표시)
        this.renderWidgets();

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

                // 스크롤을 맨 위로 이동
                window.scrollTo(0, 0);

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

            // 터치 이벤트 (모바일)
            widget.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
            widget.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            widget.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });

            // 클릭 이벤트
            widget.addEventListener('click', (e) => {
                // 데스크톱 드래그 중이면 무시
                if (this.state.draggedElement) {
                    return;
                }

                // 모바일 위젯 선택/이동 처리
                const shouldOpenModal = this.handleWidgetClick(widget);
                if (shouldOpenModal) {
                    this.openChartModal(tagName);
                }
            });

            // 메타데이터에서 태그 정보 찾기 (대소문자 구분 없이)
            const tagData = this.state.availableTagsData.find(t =>
                t.tag_name && t.tag_name.toLowerCase() === tagName.toLowerCase()
            );
            const desc = tagData?.tag_desc || tagData?.description || this.getTagDescription(tagName);

            // 커스텀 설정 적용
            const displayName = this.getDisplayName(tagName, desc);

            // 디버깅: 메타데이터 매칭 확인
            if (tagData) {
                console.log(`📋 ${tagName} 설명:`, desc);
            } else {
                console.warn(`⚠️ ${tagName}의 메타데이터를 찾을 수 없습니다. 기본 설명 사용:`, desc);
            }

            widget.innerHTML = `
                <div class="widget-header">
                    <div class="widget-title">${displayName}</div>
                    <button class="widget-close" onclick="event.stopPropagation(); dashboard.removeWidget('${tagName}')">×</button>
                </div>
                <div class="widget-desc">${tagName}</div>
                <div class="widget-value">
                    <span id="value-${tagName}">--</span>
                </div>
            `;

            grid.appendChild(widget);
        });

        // 선택 상태 복원 (모바일)
        if (this.state.selectedWidget) {
            const selectedTag = this.state.selectedWidget.getAttribute('data-tag');
            const newSelectedWidget = document.querySelector(`[data-tag="${selectedTag}"]`);

            if (newSelectedWidget) {
                this.state.selectedWidget = newSelectedWidget;
                newSelectedWidget.classList.add('selected');

                // 다른 위젯들을 타겟으로 표시
                document.querySelectorAll('.widget').forEach(w => {
                    if (w !== newSelectedWidget) {
                        w.classList.add('target');
                    }
                });
            }
        }
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

        // 새로고침 시 dateTo를 현재 시간으로 업데이트 (최신 데이터 가져오기)
        this.state.dateTo = new Date();
        document.getElementById('dateTo').value = this.formatDate(this.state.dateTo);
        console.log('🔄 dateTo 업데이트:', this.formatDate(this.state.dateTo));

        const refreshBtns = document.querySelectorAll('.refresh-btn');
        const loadingOverlay = document.getElementById('loadingOverlay');
        refreshBtns.forEach(btn => btn.classList.add('loading'));
        if (loadingOverlay) {
            loadingOverlay.classList.add('show');
        }

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
            refreshBtns.forEach(btn => btn.classList.remove('loading'));
            if (loadingOverlay) {
                loadingOverlay.classList.remove('show');
            }
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

            // 최신 값 표시 (가중치 및 단위 적용)
            if (values.length > 0) {
                const lastValue = values[values.length - 1];
                const valueEl = document.getElementById(`value-${tagName}`);
                if (valueEl) {
                    const adjustedValue = this.applyMultiplier(lastValue, tagName);
                    valueEl.textContent = this.formatDisplayValue(adjustedValue, tagName);
                    console.log(`✅ ${tagName} 값 표시:`, adjustedValue);
                }

                // 단위 표시 (제거 - formatDisplayValue에 포함됨)
                const unitEl = document.getElementById(`unit-${tagName}`);
                if (unitEl) {
                    unitEl.textContent = '';
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

        // 설정 버튼에 이벤트 연결
        const settingsBtn = document.getElementById('chartSettingsBtn');
        if (settingsBtn) {
            settingsBtn.onclick = (e) => {
                e.stopPropagation();
                this.openWidgetSettings(tagName);
            };
        }

        // 메타데이터에서 설명 가져오기 (대소문자 구분 없이)
        const tagData = this.state.availableTagsData.find(t =>
            t.tag_name && t.tag_name.toLowerCase() === tagName.toLowerCase()
        );
        const desc = tagData?.tag_desc || tagData?.description || this.getTagDescription(tagName);
        const displayName = this.getDisplayName(tagName, desc);
        title.innerHTML = `${displayName}<br><span style="font-size: 14px; font-weight: 400; color: #86868B;">(${tagName})</span>`;

        const chartData = this.state.chartData.get(tagName);
        if (!chartData || chartData.length === 0) {
            this.showNotification('표시할 데이터가 없습니다.', 'error');
            return;
        }

        modal.classList.add('active');

        // 통계 계산 (가중치 적용)
        const values = chartData.map(item => this.applyMultiplier(item.tag_val, tagName));
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;

        // 통계 표시 (단위 포함)
        document.getElementById('statMin').textContent = this.formatDisplayValue(min, tagName);
        document.getElementById('statAvg').textContent = this.formatDisplayValue(avg, tagName);
        document.getElementById('statMax').textContent = this.formatDisplayValue(max, tagName);

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
                    label: this.getTagSetting(tagName).unit || '값',
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

    // 모달 열기
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
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

        // DOM 순서를 기반으로 selectedTags 배열 순서 변경
        const widgets = [...document.querySelectorAll('.widget')];
        this.state.selectedTags = widgets.map(w => w.getAttribute('data-tag'));

        console.log('🖱️ 데스크톱 드래그 완료, 새로운 순서:', this.state.selectedTags);

        // 위젯 재렌더링
        this.renderWidgets();

        // 캐시된 데이터로 현재 값 복원 (가중치 및 단위 적용)
        for (const [tagName, items] of this.state.chartData.entries()) {
            if (items && items.length > 0) {
                const lastValue = items[items.length - 1].tag_val;
                const valueEl = document.getElementById(`value-${tagName}`);
                if (valueEl) {
                    const adjustedValue = this.applyMultiplier(lastValue, tagName);
                    valueEl.textContent = this.formatDisplayValue(adjustedValue, tagName);
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

    // ==================== 터치 선택 (모바일) ====================

    handleTouchStart(e) {
        const widget = e.currentTarget;
        this.state.touchElement = widget;
        this.state.touchStartX = e.touches[0].clientX;
        this.state.touchStartY = e.touches[0].clientY;

        // 500ms 롱프레스 감지
        this.state.touchTimer = setTimeout(() => {
            // 이미 선택된 위젯이 있으면 선택 해제
            if (this.state.selectedWidget) {
                this.clearWidgetSelection();
            }

            // 새로운 위젯 선택
            this.state.selectedWidget = widget;
            widget.classList.add('selected');

            // 다른 모든 위젯을 타겟으로 표시
            document.querySelectorAll('.widget').forEach(w => {
                if (w !== widget) {
                    w.classList.add('target');
                }
            });

            // 햅틱 피드백
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            console.log('📱 위젯 선택됨:', widget.getAttribute('data-tag'));
        }, 500);
    }

    handleTouchMove(e) {
        // 터치가 움직이면 선택 취소 (스크롤 중)
        const moveX = Math.abs(e.touches[0].clientX - this.state.touchStartX);
        const moveY = Math.abs(e.touches[0].clientY - this.state.touchStartY);

        if (moveX > 10 || moveY > 10) {
            if (this.state.touchTimer) {
                clearTimeout(this.state.touchTimer);
                this.state.touchTimer = null;
            }
        }
    }

    handleTouchEnd(e) {
        // 타이머 정리
        if (this.state.touchTimer) {
            clearTimeout(this.state.touchTimer);
            this.state.touchTimer = null;
        }
    }

    // 위젯 클릭 시 이동 처리
    handleWidgetClick(targetWidget) {
        if (!this.state.selectedWidget) {
            // 선택된 위젯이 없으면 차트 모달 열기
            return true;
        }

        // 선택된 위젯과 같으면 선택 해제
        if (this.state.selectedWidget === targetWidget) {
            this.clearWidgetSelection();
            return false;
        }

        // 타겟 위젯이 아니면 무시
        if (!targetWidget.classList.contains('target')) {
            return true;
        }

        // 위치 이동 (교환이 아닌 삽입 방식)
        const selectedTag = this.state.selectedWidget.getAttribute('data-tag');
        const targetTag = targetWidget.getAttribute('data-tag');

        const selectedIndex = this.state.selectedTags.indexOf(selectedTag);
        const targetIndex = this.state.selectedTags.indexOf(targetTag);

        // 배열에서 선택한 위젯 제거
        this.state.selectedTags.splice(selectedIndex, 1);

        // 타겟 위치에 삽입 (제거 후 인덱스 재조정)
        // selectedIndex < targetIndex인 경우, 제거로 인해 targetIndex가 1 감소
        const newTargetIndex = selectedIndex < targetIndex ? targetIndex - 1 : targetIndex;
        this.state.selectedTags.splice(newTargetIndex, 0, selectedTag);

        console.log('📱 위젯 이동:', selectedTag, '→ 위치', newTargetIndex, ', 새 순서:', this.state.selectedTags);

        // 선택 해제
        this.clearWidgetSelection();

        // 위젯 재렌더링
        this.renderWidgets();

        // 캐시된 데이터로 현재 값 복원 (가중치 및 단위 적용)
        for (const [tagName, items] of this.state.chartData.entries()) {
            if (items && items.length > 0) {
                const lastValue = items[items.length - 1].tag_val;
                const valueEl = document.getElementById(`value-${tagName}`);
                if (valueEl) {
                    const adjustedValue = this.applyMultiplier(lastValue, tagName);
                    valueEl.textContent = this.formatDisplayValue(adjustedValue, tagName);
                }

                const unitEl = document.getElementById(`unit-${tagName}`);
                if (unitEl) {
                    unitEl.textContent = this.getUnit(tagName);
                }
            }
        }

        return false;
    }

    // 위젯 선택 해제
    clearWidgetSelection() {
        if (this.state.selectedWidget) {
            this.state.selectedWidget.classList.remove('selected');
            this.state.selectedWidget = null;
        }

        document.querySelectorAll('.widget').forEach(w => {
            w.classList.remove('target');
        });
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

        // DOM 순서를 기준으로 현재 순서 가져오기 (드래그 후 순서 보장)
        const widgets = [...document.querySelectorAll('.widget')];
        const currentOrder = widgets.map(w => w.getAttribute('data-tag'));

        console.log('💾 저장할 순서:', currentOrder);

        try {
            const response = await fetch(`${this.apiBaseUrl}/saved-selections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    tag_names: currentOrder  // DOM 순서 사용
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

    // 태그 설정 로드
    async loadTagSettings() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/tag-settings`);
            const result = await response.json();

            if (result.success && result.data) {
                this.state.tagSettings.clear();
                result.data.forEach(setting => {
                    this.state.tagSettings.set(setting.tag_name, {
                        customName: setting.custom_name,
                        multiplier: parseFloat(setting.multiplier) || 1.0,
                        unit: setting.unit || ''
                    });
                });
                console.log('✅ 태그 설정 로드 완료:', this.state.tagSettings.size);
            }
        } catch (error) {
            console.error('태그 설정 로드 실패:', error);
            // 로드 실패해도 계속 진행
        }
    }

    // 단위 목록 로드
    async loadUnits() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/units`);
            const result = await response.json();

            if (result.success && result.data) {
                this.state.availableUnits = result.data.map(u => u.unit_name);
                console.log('✅ 단위 목록 로드 완료:', this.state.availableUnits.length);
            }
        } catch (error) {
            console.error('단위 목록 로드 실패:', error);
            // 기본 단위 사용
            this.state.availableUnits = ['°C', '°F', 'bar', 'psi', 'kPa', 'MPa', 'L/min', 'm³/h', 'kg/h', 'rpm', '%', 'kW', 'MW', 'A', 'V'];
        }
    }

    // 태그 설정 가져오기
    getTagSetting(tagName) {
        return this.state.tagSettings.get(tagName) || {
            customName: null,
            multiplier: 1.0,
            unit: ''
        };
    }

    // 값에 가중치 적용
    applyMultiplier(value, tagName) {
        const setting = this.getTagSetting(tagName);
        if (value === null || value === undefined || isNaN(value)) return value;
        return value * setting.multiplier;
    }

    // 표시 이름 가져오기
    getDisplayName(tagName, description) {
        const setting = this.getTagSetting(tagName);
        return setting.customName || description;
    }

    // 표시 값 포맷팅 (값 + 단위)
    formatDisplayValue(value, tagName) {
        const setting = this.getTagSetting(tagName);
        if (value === null || value === undefined) return '--';

        const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
        const unit = setting.unit ? setting.unit : '';
        return unit ? `${formattedValue} ${unit}` : formattedValue;
    }

    // 설정 관리 모달 열기
    openSettingsManager() {
        this.loadUnitsToManager();
        this.loadTagSettingsToManager();
        this.switchSettingsTab('tags'); // 기본 탭: 태그 설정
        this.openModal('settingsManagerModal');
    }

    // 설정 탭 전환
    switchSettingsTab(tab) {
        const unitsTab = document.getElementById('unitsTab');
        const tagsTab = document.getElementById('tagsTab');
        const unitsContent = document.getElementById('unitsTabContent');
        const tagsContent = document.getElementById('tagsTabContent');

        if (tab === 'units') {
            unitsTab.style.background = '#007AFF';
            unitsTab.style.color = 'white';
            tagsTab.style.background = 'white';
            tagsTab.style.color = '#1D1D1F';
            unitsContent.style.display = 'block';
            tagsContent.style.display = 'none';
        } else {
            unitsTab.style.background = 'white';
            unitsTab.style.color = '#1D1D1F';
            tagsTab.style.background = '#007AFF';
            tagsTab.style.color = 'white';
            unitsContent.style.display = 'none';
            tagsContent.style.display = 'block';
            this.loadTagSettingsToManager(); // 태그 설정 새로고침
        }
    }

    // 단위 관리 모달에 단위 목록 로드
    async loadUnitsToManager() {
        await this.loadUnits();
        const container = document.getElementById('unitsList');

        container.innerHTML = this.state.availableUnits.map(unit => `
            <div class="unit-item">
                <span class="unit-name">${unit}</span>
                <button class="delete-btn" onclick="dashboard.deleteUnit('${unit}')">삭제</button>
            </div>
        `).join('');
    }

    // 단위 추가
    async addUnit() {
        const input = document.getElementById('newUnitInput');
        const unitName = input.value.trim();

        if (!unitName) {
            this.showNotification('단위를 입력하세요', 'error');
            return;
        }

        if (this.state.availableUnits.includes(unitName)) {
            this.showNotification('이미 존재하는 단위입니다', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/units`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unit_name: unitName })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('단위가 추가되었습니다', 'success');
                input.value = '';
                await this.loadUnitsToManager();
            } else {
                this.showNotification('추가 실패: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('단위 추가 실패:', error);
            this.showNotification('추가 중 오류 발생', 'error');
        }
    }

    // 단위 삭제
    async deleteUnit(unitName) {
        if (!confirm(`"${unitName}" 단위를 삭제하시겠습니까?`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/units/${encodeURIComponent(unitName)}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('단위가 삭제되었습니다', 'success');
                await this.loadUnitsToManager();
            } else {
                this.showNotification('삭제 실패: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('단위 삭제 실패:', error);
            this.showNotification('삭제 중 오류 발생', 'error');
        }
    }

    // 태그 설정 목록 로드 (설정 관리 모달용)
    async loadTagSettingsToManager() {
        const container = document.getElementById('tagSettingsList');

        if (this.state.selectedTags.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #86868B; padding: 40px;">선택된 태그가 없습니다<br><br>먼저 계기를 선택해주세요</div>';
            return;
        }

        await this.loadUnits();
        await this.loadTagSettings();

        container.innerHTML = this.state.selectedTags.map((tagName, index) => {
            const tag = this.state.availableTagsData.find(t => t.tagname === tagName || t.tag_name === tagName);
            const desc = tag?.description || tag?.tag_desc || tagName;
            const setting = this.getTagSetting(tagName);

            return `
                <div style="background: white; border: 1px solid #E5E5EA; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'">
                    <div style="display: flex; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #F5F5F7;">
                        <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; margin-right: 12px; font-size: 14px;">${index + 1}</div>
                        <div style="flex: 1;">
                            <div style="font-family: monospace; color: #007AFF; font-weight: 700; font-size: 15px; margin-bottom: 2px;">${tagName}</div>
                            <div style="font-size: 12px; color: #86868B;">${desc}</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr; gap: 14px;">
                        <div>
                            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #1D1D1F;">
                                <span style="color: #007AFF;">●</span> 표시 이름
                            </label>
                            <input type="text" id="customName_${tagName}" value="${setting.customName || ''}" placeholder="비워두면 원래 이름 사용" style="width: 100%; padding: 10px 12px; border: 1px solid #E5E5EA; border-radius: 8px; font-size: 14px; transition: border-color 0.2s;" onfocus="this.style.borderColor='#007AFF'" onblur="this.style.borderColor='#E5E5EA'">
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #1D1D1F;">
                                    <span style="color: #007AFF;">●</span> 가중치
                                </label>
                                <input type="number" id="multiplier_${tagName}" value="${setting.multiplier}" step="0.1" min="0.001" style="width: 100%; padding: 10px 12px; border: 1px solid #E5E5EA; border-radius: 8px; font-size: 14px; transition: border-color 0.2s;" onfocus="this.style.borderColor='#007AFF'" onblur="this.style.borderColor='#E5E5EA'">
                                <div style="font-size: 11px; color: #86868B; margin-top: 4px;">예: 2.0 = 2배</div>
                            </div>
                            <div>
                                <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #1D1D1F;">
                                    <span style="color: #007AFF;">●</span> 단위
                                </label>
                                <select id="unit_${tagName}" style="width: 100%; padding: 10px 12px; border: 1px solid #E5E5EA; border-radius: 8px; font-size: 14px; background: white; cursor: pointer; transition: border-color 0.2s;" onfocus="this.style.borderColor='#007AFF'" onblur="this.style.borderColor='#E5E5EA'">
                                    <option value="">없음</option>
                                    ${this.state.availableUnits.map(unit =>
                                        `<option value="${unit}" ${setting.unit === unit ? 'selected' : ''}>${unit}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 개별 태그 설정 저장
    async saveTagSetting(tagName) {
        const customName = document.getElementById(`customName_${tagName}`).value.trim() || null;
        const multiplier = parseFloat(document.getElementById(`multiplier_${tagName}`).value) || 1.0;
        const unit = document.getElementById(`unit_${tagName}`).value || null;

        try {
            const response = await fetch(`${this.apiBaseUrl}/tag-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tag_name: tagName,
                    custom_name: customName,
                    multiplier: multiplier,
                    unit: unit
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('설정이 저장되었습니다', 'success');
                await this.loadTagSettings();
                this.renderWidgets();
                this.refreshData();
            } else {
                this.showNotification('저장 실패: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('설정 저장 실패:', error);
            this.showNotification('저장 중 오류 발생', 'error');
        }
    }

    // 개별 태그 설정 초기화
    async resetTagSetting(tagName) {
        if (!confirm(`"${tagName}" 태그의 설정을 초기화하시겠습니까?`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/tag-settings/${encodeURIComponent(tagName)}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('설정이 초기화되었습니다', 'success');
                await this.loadTagSettings();
                this.renderWidgets();
                this.refreshData();
                await this.loadTagSettingsToManager();
            } else {
                this.showNotification('초기화 실패: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('설정 초기화 실패:', error);
            this.showNotification('초기화 중 오류 발생', 'error');
        }
    }

    // 모든 태그 설정 일괄 저장
    async saveAllTagSettings() {
        if (this.state.selectedTags.length === 0) {
            this.showNotification('선택된 태그가 없습니다', 'error');
            return;
        }

        try {
            let successCount = 0;
            let errorCount = 0;

            for (const tagName of this.state.selectedTags) {
                const customName = document.getElementById(`customName_${tagName}`)?.value.trim() || null;
                const multiplier = parseFloat(document.getElementById(`multiplier_${tagName}`)?.value) || 1.0;
                const unit = document.getElementById(`unit_${tagName}`)?.value || null;

                try {
                    const response = await fetch(`${this.apiBaseUrl}/tag-settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tag_name: tagName,
                            custom_name: customName,
                            multiplier: multiplier,
                            unit: unit
                        })
                    });

                    const result = await response.json();
                    if (result.success) {
                        successCount++;
                    } else {
                        errorCount++;
                        console.error(`${tagName} 저장 실패:`, result.message);
                    }
                } catch (err) {
                    errorCount++;
                    console.error(`${tagName} 저장 오류:`, err);
                }
            }

            if (errorCount === 0) {
                this.showNotification(`${successCount}개 태그 설정이 모두 저장되었습니다`, 'success');
            } else {
                this.showNotification(`${successCount}개 저장 완료, ${errorCount}개 실패`, 'error');
            }

            await this.loadTagSettings();
            this.renderWidgets();
            this.refreshData();
        } catch (error) {
            console.error('일괄 저장 실패:', error);
            this.showNotification('저장 중 오류 발생', 'error');
        }
    }

    // 모든 태그 설정 일괄 초기화
    async resetAllTagSettings() {
        if (this.state.selectedTags.length === 0) {
            this.showNotification('선택된 태그가 없습니다', 'error');
            return;
        }

        if (!confirm(`모든 태그(${this.state.selectedTags.length}개)의 설정을 초기화하시겠습니까?`)) {
            return;
        }

        try {
            let successCount = 0;
            let errorCount = 0;

            for (const tagName of this.state.selectedTags) {
                try {
                    const response = await fetch(`${this.apiBaseUrl}/tag-settings/${encodeURIComponent(tagName)}`, {
                        method: 'DELETE'
                    });

                    const result = await response.json();
                    if (result.success) {
                        successCount++;
                    } else {
                        // 설정이 없어도 성공으로 처리
                        successCount++;
                    }
                } catch (err) {
                    errorCount++;
                    console.error(`${tagName} 초기화 오류:`, err);
                }
            }

            if (errorCount === 0) {
                this.showNotification(`${successCount}개 태그 설정이 모두 초기화되었습니다`, 'success');
            } else {
                this.showNotification(`${successCount}개 초기화 완료, ${errorCount}개 실패`, 'error');
            }

            await this.loadTagSettings();
            this.renderWidgets();
            this.refreshData();
            await this.loadTagSettingsToManager();
        } catch (error) {
            console.error('일괄 초기화 실패:', error);
            this.showNotification('초기화 중 오류 발생', 'error');
        }
    }

    // 위젯 설정 모달 열기
    openWidgetSettings(tagName) {
        const tag = this.state.availableTagsData.find(t => t.tagname === tagName);
        if (!tag) return;

        const setting = this.getTagSetting(tagName);

        // 모달에 현재 값 설정
        document.getElementById('settingsTagName').textContent = tagName;
        document.getElementById('settingsOriginalName').textContent = tag.description;
        document.getElementById('settingsCustomName').value = setting.customName || '';
        document.getElementById('settingsMultiplier').value = setting.multiplier;

        // 단위 선택 드롭다운 생성
        const unitSelect = document.getElementById('settingsUnit');
        unitSelect.innerHTML = '<option value="">없음</option>' +
            this.state.availableUnits.map(unit =>
                `<option value="${unit}" ${setting.unit === unit ? 'selected' : ''}>${unit}</option>`
            ).join('');

        // 현재 태그 저장
        this.currentSettingTag = tagName;

        this.openModal('widgetSettingsModal');
    }

    // 위젯 설정 저장
    async saveWidgetSettings() {
        const tagName = this.currentSettingTag;
        const customName = document.getElementById('settingsCustomName').value.trim() || null;
        const multiplier = parseFloat(document.getElementById('settingsMultiplier').value) || 1.0;
        const unit = document.getElementById('settingsUnit').value || null;

        try {
            const response = await fetch(`${this.apiBaseUrl}/tag-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tag_name: tagName,
                    custom_name: customName,
                    multiplier: multiplier,
                    unit: unit
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('설정이 저장되었습니다', 'success');
                await this.loadTagSettings();
                this.renderWidgets();
                this.refreshData();
                this.closeModal('widgetSettingsModal');
            } else {
                this.showNotification('저장 실패: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('설정 저장 실패:', error);
            this.showNotification('저장 중 오류 발생', 'error');
        }
    }

    // 위젯 설정 초기화
    async resetWidgetSettings() {
        const tagName = this.currentSettingTag;

        if (!confirm('이 태그의 설정을 초기화하시겠습니까?')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/tag-settings/${encodeURIComponent(tagName)}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('설정이 초기화되었습니다', 'success');
                await this.loadTagSettings();
                this.renderWidgets();
                this.refreshData();
                this.closeModal('widgetSettingsModal');
            } else {
                this.showNotification('초기화 실패: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('설정 초기화 실패:', error);
            this.showNotification('초기화 중 오류 발생', 'error');
        }
    }
}

// 전역 인스턴스 생성
const dashboard = new Dashboard();
