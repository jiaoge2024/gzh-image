// 弹窗脚本 - 处理弹窗界面的交互逻辑
// 主要用作侧边栏的备用方案

(function() {
  'use strict';
  
  console.log('弹窗脚本已加载');
  
  // DOM 元素引用
  const elements = {
    openSidepanel: null,
    quickExtract: null,
    configReminder: null,
    statusMessage: null
  };
  
  // 初始化函数
  function initialize() {
    console.log('初始化弹窗');
    
    // 获取DOM元素
    initializeElements();
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 检查配置状态
    checkConfiguration();
    
    // 检查当前页面
    checkCurrentPage();
  }
  
  // 获取DOM元素
  function initializeElements() {
    elements.openSidepanel = document.getElementById('openSidepanel');
    elements.quickExtract = document.getElementById('quickExtract');
    elements.configReminder = document.getElementById('configReminder');
    elements.statusMessage = document.getElementById('statusMessage');
  }
  
  // 绑定事件监听器
  function bindEventListeners() {
    elements.openSidepanel?.addEventListener('click', handleOpenSidepanel);
    elements.quickExtract?.addEventListener('click', handleQuickExtract);
  }
  
  // 打开侧边栏
  async function handleOpenSidepanel() {
    try {
      // 获取当前活动标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab) {
        showStatus('无法获取当前标签页', 'error');
        return;
      }
      
      // 检查是否为特殊页面
      if (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://')) {
        showStatus('当前页面不支持侧边栏功能', 'warning');
        return;
      }
      
      // 尝试打开侧边栏
      await chrome.sidePanel.open({ tabId: currentTab.id });
      
      // 关闭弹窗
      window.close();
      
    } catch (error) {
      console.error('打开侧边栏失败:', error);
      showStatus('侧边栏打开失败，请尝试刷新页面后重试', 'error');
    }
  }
  
  // 快速提取标题
  async function handleQuickExtract() {
    try {
      elements.quickExtract.disabled = true;
      elements.quickExtract.textContent = '识别中...';
      
      // 检查配置
      const config = await chrome.storage.local.get(['cozeToken', 'workflowId']);
      if (!config.cozeToken || !config.workflowId) {
        showStatus('请先在侧边栏中完成API配置', 'warning');
        return;
      }
      
      // 发送消息到后台脚本
      const response = await chrome.runtime.sendMessage({
        action: 'getTitleFromContent'
      });
      
      if (response.success) {
        showStatus(`识别到标题: ${response.title}`, 'success');
        
        // 可以选择自动生成封面
        setTimeout(() => {
          if (confirm('是否立即生成封面图？')) {
            generateCoverQuick(response.title);
          }
        }, 1000);
        
      } else {
        showStatus('标题识别失败: ' + response.error, 'error');
      }
      
    } catch (error) {
      console.error('快速提取失败:', error);
      showStatus('提取失败: ' + error.message, 'error');
    } finally {
      elements.quickExtract.disabled = false;
      elements.quickExtract.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
        </svg>
        识别标题
      `;
    }
  }
  
  // 快速生成封面
  async function generateCoverQuick(title) {
    try {
      showStatus('正在生成封面图...', 'info');
      
      const response = await chrome.runtime.sendMessage({
        action: 'generateCover',
        title: title
      });
      
      if (response.success) {
        showStatus('封面生成成功！请打开侧边栏查看', 'success');
        
        // 提示用户打开侧边栏查看结果
        setTimeout(() => {
          if (confirm('封面已生成，是否打开侧边栏查看？')) {
            handleOpenSidepanel();
          }
        }, 1500);
        
      } else {
        showStatus('生成失败: ' + response.error, 'error');
      }
      
    } catch (error) {
      console.error('快速生成失败:', error);
      showStatus('生成失败: ' + error.message, 'error');
    }
  }
  
  // 检查配置状态
  async function checkConfiguration() {
    try {
      const config = await chrome.storage.local.get(['cozeToken', 'workflowId']);
      
      if (config.cozeToken && config.workflowId) {
        // 配置完整，隐藏配置提醒
        elements.configReminder.style.display = 'none';
        showStatus('配置已完成，可以正常使用', 'success');
      } else {
        // 配置不完整，显示提醒
        elements.configReminder.style.display = 'block';
        showStatus('请先完成API配置', 'warning');
      }
      
    } catch (error) {
      console.error('检查配置失败:', error);
      showStatus('检查配置失败', 'error');
    }
  }
  
  // 检查当前页面
  async function checkCurrentPage() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab) return;
      
      const url = currentTab.url;
      
      // 检查是否为支持的编辑器页面
      const supportedDomains = [
        'mp.weixin.qq.com',
        'xiumi.us',
        '135editor.com'
      ];
      
      const isSupported = supportedDomains.some(domain => url.includes(domain));
      
      if (!isSupported) {
        showStatus('当前页面可能不是支持的编辑器', 'warning');
      }
      
      // 检查是否为特殊页面
      if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
        elements.openSidepanel.disabled = true;
        elements.quickExtract.disabled = true;
        showStatus('当前页面不支持扩展功能', 'error');
      }
      
    } catch (error) {
      console.error('检查页面失败:', error);
    }
  }
  
  // 显示状态消息
  function showStatus(message, type = 'info') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status ${type}`;
    elements.statusMessage.classList.remove('hidden');
    
    // 自动隐藏成功和信息消息
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        elements.statusMessage.classList.add('hidden');
      }, 3000);
    }
  }
  
  // 监听来自后台脚本的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('弹窗收到消息:', request);
    
    switch (request.action) {
      case 'updateStatus':
        showStatus(request.message, request.type);
        break;
        
      case 'closePopup':
        window.close();
        break;
        
      default:
        console.log('未知的消息类型:', request.action);
    }
  });
  
  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  // 导出函数供测试使用
  if (typeof window !== 'undefined') {
    window.PopupController = {
      initialize,
      handleOpenSidepanel,
      handleQuickExtract,
      showStatus,
      checkConfiguration
    };
  }
  
})();