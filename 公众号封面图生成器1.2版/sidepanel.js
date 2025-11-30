// 侧边栏主要逻辑脚本
// 处理用户交互、配置管理、API调用等功能

(function() {
  'use strict';
  
  console.log('侧边栏脚本已加载');
  
  // DOM 元素引用
  const elements = {
    // 配置相关
    cozeToken: null,
    workflowId: null,
    saveConfig: null,
    configStatus: null,
    configSection: null,
    mainSection: null,
    toggleToken: null,
    
    // 功能相关
    articleTitle: null,
    extractTitle: null,
    generateCover: null,
    loadingIndicator: null,
    previewCard: null,
    previewImage: null,
    downloadImage: null,
    regenerateCover: null,
    messageArea: null,
    
    // 配置管理相关
    editConfig: null,
    configInfo: null,
    tokenStatus: null,
    workflowIdDisplay: null,
    backToMain: null
  };
  
  // 应用状态
  const state = {
    isConfigured: false,
    isGenerating: false,
    currentImageUrl: null,
    currentTitle: null
  };
  
  // 初始化函数
  function initialize() {
    console.log('初始化侧边栏');
    
    // 获取DOM元素
    initializeElements();
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 加载保存的配置
    loadConfiguration();
    
    // 检查当前页面是否支持
    checkPageSupport();
  }
  
  // 获取DOM元素
  function initializeElements() {
    elements.cozeToken = document.getElementById('cozeToken');
    elements.workflowId = document.getElementById('workflowId');
    elements.saveConfig = document.getElementById('saveConfig');
    elements.configStatus = document.getElementById('configStatus');
    elements.configSection = document.getElementById('configSection');
    elements.mainSection = document.getElementById('mainSection');
    elements.toggleToken = document.getElementById('toggleToken');
    
    elements.articleTitle = document.getElementById('articleTitle');
    elements.extractTitle = document.getElementById('extractTitle');
    elements.generateCover = document.getElementById('generateCover');
    elements.loadingIndicator = document.getElementById('loadingIndicator');
    elements.previewCard = document.getElementById('previewCard');
    elements.previewImage = document.getElementById('previewImage');
    elements.downloadImage = document.getElementById('downloadImage');
    elements.regenerateCover = document.getElementById('regenerateCover');
    elements.messageArea = document.getElementById('messageArea');
    
    // 配置管理相关元素
    elements.editConfig = document.getElementById('editConfig');
    elements.configInfo = document.getElementById('configInfo');
    elements.tokenStatus = document.getElementById('tokenStatus');
    elements.workflowIdDisplay = document.getElementById('workflowIdDisplay');
    elements.backToMain = document.getElementById('backToMain');
  }
  
  // 绑定事件监听器
  function bindEventListeners() {
    // 配置相关事件
    elements.saveConfig?.addEventListener('click', handleSaveConfig);
    elements.toggleToken?.addEventListener('click', handleTogglePassword);
    elements.editConfig?.addEventListener('click', handleEditConfig);
    elements.backToMain?.addEventListener('click', handleBackToMain);
    
    // 功能相关事件
    elements.extractTitle?.addEventListener('click', handleExtractTitle);
    elements.generateCover?.addEventListener('click', handleGenerateCover);
    elements.downloadImage?.addEventListener('click', handleDownloadImage);
    elements.regenerateCover?.addEventListener('click', handleRegenerateCover);
    
    // 输入框事件
    elements.articleTitle?.addEventListener('input', handleTitleInput);
    elements.cozeToken?.addEventListener('input', handleConfigInput);
    elements.workflowId?.addEventListener('input', handleConfigInput);
    
    // 键盘快捷键
    document.addEventListener('keydown', handleKeyboardShortcuts);
  }
  
  // 加载保存的配置
  async function loadConfiguration() {
    try {
      const result = await chrome.storage.local.get(['cozeToken', 'workflowId']);
      
      if (result.cozeToken) {
        elements.cozeToken.value = result.cozeToken;
      }
      
      if (result.workflowId) {
        elements.workflowId.value = result.workflowId;
      }
      
      // 检查配置是否完整
      if (result.cozeToken && result.workflowId) {
        state.isConfigured = true;
        updateConfigDisplay(result.cozeToken, result.workflowId);
        showMainSection();
        showMessage('API配置已加载，可以开始使用', 'success');
      } else {
        state.isConfigured = false;
        updateConfigDisplay('', '');
        showMainSection();
        showMessage('请先配置API信息才能使用生成功能', 'warning');
      }
      
    } catch (error) {
      console.error('加载配置失败:', error);
      showMessage('加载配置失败: ' + error.message, 'error');
      showMainSection();
    }
  }
  
  // 保存配置
  async function handleSaveConfig() {
    const token = elements.cozeToken.value.trim();
    const workflowId = elements.workflowId.value.trim();
    
    if (!token || !workflowId) {
      showConfigStatus('请填写完整的配置信息', 'error');
      return;
    }
    
    try {
      // 保存到本地存储
      await chrome.storage.local.set({
        cozeToken: token,
        workflowId: workflowId
      });
      
      state.isConfigured = true;
      showConfigStatus('配置保存成功', 'success');
      showMessage('API配置已保存，可以开始使用了', 'success');
      updateConfigDisplay(token, workflowId);
      
      // 显示主功能区域
      setTimeout(() => {
        showMainSection();
      }, 1500);
      
    } catch (error) {
      console.error('保存配置失败:', error);
      showConfigStatus('保存失败: ' + error.message, 'error');
    }
  }
  
  // 切换密码显示
  function handleTogglePassword() {
    const input = elements.cozeToken;
    const isPassword = input.type === 'password';
    
    input.type = isPassword ? 'text' : 'password';
    
    // 更新图标
    const icon = elements.toggleToken.querySelector('svg');
    if (isPassword) {
      icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
      icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
  }
  
  // 提取文章标题
  async function handleExtractTitle() {
    if (!state.isConfigured) {
      showMessage('请先完成API配置', 'warning');
      return;
    }
    
    try {
      elements.extractTitle.disabled = true;
      elements.extractTitle.textContent = '识别中...';
      
      // 发送消息到后台脚本
      const response = await chrome.runtime.sendMessage({
        action: 'getTitleFromContent'
      });
      
      if (response.success) {
        elements.articleTitle.value = response.title;
        state.currentTitle = response.title;
        showMessage('标题识别成功', 'success');
      } else {
        showMessage('标题识别失败: ' + response.error, 'error');
      }
      
    } catch (error) {
      console.error('提取标题失败:', error);
      showMessage('提取标题失败: ' + error.message, 'error');
    } finally {
      elements.extractTitle.disabled = false;
      elements.extractTitle.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
        </svg>
        自动识别标题
      `;
    }
  }
  
  // 生成封面图
  async function handleGenerateCover() {
    const title = elements.articleTitle.value.trim();
    
    if (!title) {
      showMessage('请先输入或识别文章标题', 'warning');
      return;
    }
    
    if (!state.isConfigured) {
      showMessage('请先完成API配置', 'warning');
      return;
    }
    
    try {
      state.isGenerating = true;
      setGeneratingState(true);
      
      // 显示详细的生成进度
      showMessage('正在启动AI工作流...', 'info');
      
      // 发送生成请求到后台脚本
      const response = await chrome.runtime.sendMessage({
        action: 'generateCover',
        title: title
      });
      
      if (response.success) {
        state.currentImageUrl = response.imageUrl;
        showPreview(response.imageUrl);
        showMessage('🎉 封面生成成功！图片已准备就绪', 'success');
      } else {
        showMessage('❌ 生成失败: ' + response.error, 'error');
        
        // 提供一些常见问题的解决建议
        if (response.error.includes('工作流执行超时')) {
          setTimeout(() => {
            showMessage('💡 提示：工作流可能需要更长时间，请稍后重试', 'info');
          }, 2000);
        } else if (response.error.includes('未找到图片URL')) {
          setTimeout(() => {
            showMessage('💡 提示：请检查Coze工作流是否正确配置了图片输出', 'info');
          }, 2000);
        }
      }
      
    } catch (error) {
      console.error('生成封面失败:', error);
      showMessage('❌ 生成封面失败: ' + error.message, 'error');
    } finally {
      state.isGenerating = false;
      setGeneratingState(false);
    }
  }
  
  // 下载图片
  async function handleDownloadImage() {
    if (!state.currentImageUrl) {
      showMessage('没有可下载的图片', 'warning');
      return;
    }
    
    try {
      const title = elements.articleTitle.value.trim();
      const filename = `cover_${title.substring(0, 20)}_${Date.now()}.png`;
      
      // 发送下载请求到后台脚本
      const response = await chrome.runtime.sendMessage({
        action: 'downloadImage',
        imageUrl: state.currentImageUrl,
        filename: filename
      });
      
      if (response.success) {
        showMessage('图片下载已开始', 'success');
      } else {
        showMessage('下载失败: ' + response.error, 'error');
      }
      
    } catch (error) {
      console.error('下载图片失败:', error);
      showMessage('下载图片失败: ' + error.message, 'error');
    }
  }
  
  // 重新生成封面
  function handleRegenerateCover() {
    handleGenerateCover();
  }
  
  // 处理标题输入
  function handleTitleInput() {
    state.currentTitle = elements.articleTitle.value.trim();
  }
  
  // 处理配置输入
  function handleConfigInput() {
    const token = elements.cozeToken.value.trim();
    const workflowId = elements.workflowId.value.trim();
    
    if (token && workflowId) {
      elements.saveConfig.disabled = false;
    } else {
      elements.saveConfig.disabled = true;
    }
  }
  
  // 处理键盘快捷键
  function handleKeyboardShortcuts(event) {
    // Ctrl/Cmd + Enter: 生成封面
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!state.isGenerating) {
        handleGenerateCover();
      }
    }
    
    // Ctrl/Cmd + R: 识别标题
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
      event.preventDefault();
      handleExtractTitle();
    }
  }
  
  // 设置生成状态
  function setGeneratingState(isGenerating) {
    elements.generateCover.disabled = isGenerating;
    elements.extractTitle.disabled = isGenerating;
    
    if (isGenerating) {
      elements.loadingIndicator.style.display = 'flex';
      elements.generateCover.innerHTML = `
        <svg class="icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 12a9 9 0 11-6.219-8.56"/>
        </svg>
        AI生成中...
      `;
      
      // 添加进度提示
      let dots = 0;
      const progressInterval = setInterval(() => {
        if (!state.isGenerating) {
          clearInterval(progressInterval);
          return;
        }
        
        dots = (dots + 1) % 4;
        const dotString = '.'.repeat(dots);
        elements.generateCover.innerHTML = `
          <svg class="icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          AI生成中${dotString}
        `;
      }, 500);
      
    } else {
      elements.loadingIndicator.style.display = 'none';
      elements.generateCover.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
        </svg>
        生成封面图
      `;
    }
  }
  
  // 显示图片预览
  function showPreview(imageUrl) {
    elements.previewImage.src = imageUrl;
    elements.previewCard.style.display = 'block';
    elements.previewCard.classList.add('fade-in');
    
    // 滚动到预览区域
    elements.previewCard.scrollIntoView({ behavior: 'smooth' });
  }
  
  // 显示配置区域
  function showConfigSection() {
    elements.configSection.style.display = 'block';
    elements.mainSection.style.display = 'none';
  }
  
  // 显示主功能区域
  function showMainSection() {
    elements.configSection.style.display = 'none';
    elements.mainSection.style.display = 'block';
  }
  
  // 显示配置状态
  function showConfigStatus(message, type) {
    elements.configStatus.textContent = message;
    elements.configStatus.className = `config-status ${type}`;
    elements.configStatus.style.display = 'block';
  }
  
  // 显示消息
  function showMessage(message, type = 'info', duration = 5000) {
    if (!elements.messageArea) return;
    
    // 将换行符转换为HTML换行标签
    const formattedMessage = message.replace(/\n/g, '<br>');
    
    elements.messageArea.innerHTML = formattedMessage;
    elements.messageArea.className = `message ${type}`;
    elements.messageArea.style.display = 'block';
    
    // 为成功和错误消息设置不同的持续时间
    if (type === 'success') {
      duration = 3000;
    } else if (type === 'error') {
      duration = 8000; // 错误消息显示更长时间
    } else if (type === 'info' && message.includes('生成中')) {
      duration = 0; // 进度消息不自动隐藏
      return;
    }
    
    // 自动隐藏消息
    if (duration > 0) {
      setTimeout(() => {
        if (elements.messageArea.textContent === message.replace(/<[^>]*>/g, '')) {
          elements.messageArea.style.display = 'none';
        }
      }, duration);
    }
  }
  
  // 检查页面支持
  async function checkPageSupport() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab) return;
      
      const url = currentTab.url;
      const supportedDomains = [
        'mp.weixin.qq.com',
        'xiumi.us',
        '135editor.com'
      ];
      
      const isSupported = supportedDomains.some(domain => url.includes(domain));
      
      if (!isSupported) {
        showMessage('当前页面可能不是支持的编辑器，标题识别功能可能无法正常工作', 'warning');
      }
      
    } catch (error) {
      console.error('检查页面支持失败:', error);
    }
  }
  
  // 处理编辑配置
  function handleEditConfig() {
    showConfigSection();
    showMessage('您可以在此修改API配置信息', 'info');
  }
  
  // 处理返回主页
  function handleBackToMain() {
    showMainSection();
  }
  
  // 更新配置显示
  function updateConfigDisplay(token, workflowId) {
    if (!elements.tokenStatus || !elements.workflowIdDisplay) return;
    
    const configCard = document.querySelector('.config-card');
    const isConfigured = token && token.length > 0 && workflowId && workflowId.length > 0;
    
    // 更新配置卡片样式
    if (configCard) {
      if (isConfigured) {
        configCard.classList.remove('unconfigured');
      } else {
        configCard.classList.add('unconfigured');
      }
    }
    
    // 显示令牌状态（隐藏实际内容，只显示状态）
    if (token && token.length > 0) {
      const maskedToken = token.substring(0, 8) + '***' + token.substring(token.length - 4);
      elements.tokenStatus.textContent = `已配置 (${maskedToken})`;
      elements.tokenStatus.className = 'config-value';
    } else {
      elements.tokenStatus.textContent = '未配置';
      elements.tokenStatus.className = 'config-value error';
    }
    
    // 显示工作流ID
    if (workflowId && workflowId.length > 0) {
      elements.workflowIdDisplay.textContent = workflowId;
      elements.workflowIdDisplay.className = 'config-value';
    } else {
      elements.workflowIdDisplay.textContent = '未配置';
      elements.workflowIdDisplay.className = 'config-value error';
    }
  }
  
  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  // 导出函数供测试使用
  if (typeof window !== 'undefined') {
    window.CoverGenerator = {
      initialize,
      handleExtractTitle,
      handleGenerateCover,
      handleDownloadImage,
      showMessage,
      state
    };
  }
  
})();