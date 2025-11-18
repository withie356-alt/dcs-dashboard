class Dashboard {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3001/api';
        this.state = {
            dateFrom: new Date(Date.now() - 3 * 24 * 3600000),
            dateTo: new Date(),
            selectedTags: [],
            availableTagsData: [],
            chartData: new Map()
        };

        // 저장된 로그인 확인 및 자동 로그인
        this.checkSavedLogin();
    }

    // 저장된 로그인 상태 확인
    checkSavedLogin() {
        const savedUser = localStorage.getItem('savedUser');
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                console.log('✅ 저장된 로그인 정보 발견:', user.username);

                // 사용자 정보 복원
                localStorage.setItem('user', savedUser);

                // 로그인 화면 숨기고 대시보드 표시
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainContainer').style.display = 'block';

                // 대시보드 초기화
                this.init();
            } catch (error) {
                console.error('저장된 로그인 정보 로드 실패:', error);
                localStorage.removeItem('savedUser');
            }
        }
    }

    async init() {
        // 날짜 초기화
        document.getElementById('dateFrom').value = this.formatDate(this.state.dateFrom);
        document.getElementById('dateTo').value = this.formatDate(this.state.dateTo);

        // 메타데이터는 계기 선택 버튼을 눌렀을 때 로드
    }

    // 로그인
    async login() {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');
        const loginBtn = document.querySelector('#loginScreen button');

        if (!username || !password) {
            errorEl.textContent = '아이디와 비밀번호를 입력해주세요.';
            errorEl.style.display = 'block';
            return;
        }

        try {
            // 로딩 상태 표시
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.textContent = '로그인 중...';
            }
            errorEl.style.display = 'none';

            // 로그인 API 호출
            const response = await fetch(`${this.apiBaseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (result.success) {
                // 로그인 성공
                console.log('✅ 로그인 성공:', result.user.username);

                // 사용자 정보 저장
                localStorage.setItem('user', JSON.stringify(result.user));

                // 로그인 상태 유지 체크 확인
                const rememberMe = document.getElementById('rememberMe').checked;
                if (rememberMe) {
                    // 로그인 정보를 영구 저장
                    localStorage.setItem('savedUser', JSON.stringify(result.user));
                    console.log('💾 로그인 상태 저장됨');
                } else {
                    // 저장된 로그인 정보 제거
                    localStorage.removeItem('savedUser');
                }

                // 화면 전환
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainContainer').style.display = 'block';

                // 대시보드 초기화
                this.init();
            } else {
                // 로그인 실패
                errorEl.textContent = result.message || '로그인에 실패했습니다.';
                errorEl.style.display = 'block';
            }
        } catch (error) {
            console.error('로그인 오류:', error);
            errorEl.textContent = '로그인 처리 중 오류가 발생했습니다.';
            errorEl.style.display = 'block';
        } finally {
            // 로딩 상태 해제
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = '로그인';
            }
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
                        minute: '2-digit'
                    });
                    lastUpdatedEl.textContent = `마지막 업데이트: ${formatted} ${source === 'Supabase 캐시' ? '(캐시)' : '(신규)'}`;
                    console.log('📅 마지막 업데이트:', formatted);
                } else if (lastUpdatedEl && !result.cached) {
                    lastUpdatedEl.textContent = `방금 API에서 가져옴`;
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

        this.state.selectedTags.forEach(tagName => {
            const widget = document.createElement('div');
            widget.className = 'widget';
            widget.id = `widget-${tagName}`;
            widget.onclick = () => this.openChartModal(tagName);

            // 메타데이터에서 태그 정보 찾기
            const tagData = this.state.availableTagsData.find(t => t.tag_name === tagName);
            const desc = tagData?.tag_desc || tagData?.description || this.getTagDescription(tagName);

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

        // 메타데이터에서 설명 가져오기
        const tagData = this.state.availableTagsData.find(t => t.tag_name === tagName);
        const desc = tagData?.tag_desc || tagData?.description || this.getTagDescription(tagName);
        title.textContent = `${tagName} (${desc})`;

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
                        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })
                ),
                datasets: [{
                    label: `${tagName} ${this.getUnit(tagName)}`,
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
                    legend: { display: true },
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
}

// 전역 인스턴스 생성
const dashboard = new Dashboard();
