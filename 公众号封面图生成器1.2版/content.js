// 内容脚本 - 用于识别公众号编辑器中的文章标题
// 支持多种主流编辑器平台

(function() {
  'use strict';
  
  console.log('公众号封面图生成器内容脚本已加载');
  
  // 不同编辑器的标题选择器配置
  const TITLE_SELECTORS = {
    // 微信公众平台
    'mp.weixin.qq.com': [
      '#title',
      '.rich_media_title',
      'input[placeholder*="标题"]',
      'input[placeholder*="请输入标题"]',
      '.weui-desktop-form__input[placeholder*="标题"]'
    ],
    
    // 秀米编辑器
    'xiumi.us': [
      '#title',
      '.title-input',
      'input[placeholder*="标题"]',
      '.editor-title input'
    ],
    
    // 135编辑器
    '135editor.com': [
      '#title',
      '.title-input',
      'input[name="title"]',
      'input[placeholder*="标题"]',
      '.article-title input'
    ],
    
    // 通用选择器（作为后备）
    'default': [
      'input[placeholder*="标题"]',
      'input[placeholder*="title"]',
      'input[name="title"]',
      '#title',
      '.title',
      '.article-title',
      'h1[contenteditable]',
      'div[contenteditable][placeholder*="标题"]'
    ]
  };
  
  // 获取当前网站的域名
  function getCurrentDomain() {
    return window.location.hostname;
  }
  
  // 根据域名获取对应的选择器
  function getTitleSelectors() {
    const domain = getCurrentDomain();
    
    // 查找匹配的域名配置
    for (const [key, selectors] of Object.entries(TITLE_SELECTORS)) {
      if (domain.includes(key)) {
        return selectors;
      }
    }
    
    // 如果没有找到匹配的域名，使用默认选择器
    return TITLE_SELECTORS.default;
  }
  
  // 提取文章标题
  function extractTitle() {
    const selectors = getTitleSelectors();
    console.log('使用选择器:', selectors);
    
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        
        for (const element of elements) {
          let title = '';
          
          // 根据元素类型获取文本内容
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            title = element.value.trim();
          } else {
            title = (element.textContent || element.innerText || '').trim();
          }
          
          // 验证标题是否有效
          if (title && title.length > 0 && title.length < 200) {
            console.log('找到标题:', title, '选择器:', selector);
            return title;
          }
        }
      } catch (error) {
        console.warn('选择器执行失败:', selector, error);
      }
    }
    
    // 如果所有选择器都失败，尝试智能识别
    return smartTitleExtraction();
  }
  
  // 智能标题识别（后备方案）
  function smartTitleExtraction() {
    console.log('尝试智能标题识别');
    
    // 查找可能的标题元素
    const possibleTitles = [];
    
    // 查找所有输入框
    const inputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea');
    console.log('找到输入框数量:', inputs.length);
    
    inputs.forEach((input, index) => {
      const value = input.value.trim();
      const placeholder = input.placeholder || '';
      const id = input.id || '';
      const className = input.className || '';
      
      console.log(`输入框${index}:`, { value, placeholder, id, className });
      
      if (value && (placeholder.includes('标题') || placeholder.includes('title') || id.includes('title') || className.includes('title'))) {
        possibleTitles.push({ text: value, confidence: 0.9, source: 'input-title' });
      } else if (value && value.length > 5 && value.length < 100) {
        possibleTitles.push({ text: value, confidence: 0.5, source: 'input-text' });
      }
    });
    
    // 查找可编辑的标题元素
    const editables = document.querySelectorAll('[contenteditable="true"], [contenteditable=""]');
    console.log('找到可编辑元素数量:', editables.length);
    
    editables.forEach((editable, index) => {
      const text = editable.textContent.trim();
      const id = editable.id || '';
      const className = editable.className || '';
      
      console.log(`可编辑元素${index}:`, { text, id, className });
      
      if (text && text.length > 5 && text.length < 100) {
        let confidence = 0.7;
        if (id.includes('title') || className.includes('title')) {
          confidence = 0.8;
        }
        possibleTitles.push({ text: text, confidence: confidence, source: 'contenteditable' });
      }
    });
    
    // 查找页面标题相关元素
    const titleElements = document.querySelectorAll('h1, h2, .title, .article-title, [data-title]');
    console.log('找到标题元素数量:', titleElements.length);
    
    titleElements.forEach((element, index) => {
      const text = element.textContent.trim();
      console.log(`标题元素${index}:`, text);
      
      if (text && text.length > 5 && text.length < 100) {
        possibleTitles.push({ text: text, confidence: 0.6, source: 'title-element' });
      }
    });
    
    console.log('所有候选标题:', possibleTitles);
    
    // 按置信度排序并返回最佳匹配
    if (possibleTitles.length > 0) {
      possibleTitles.sort((a, b) => b.confidence - a.confidence);
      console.log('智能识别到标题:', possibleTitles[0].text, '来源:', possibleTitles[0].source);
      return possibleTitles[0].text;
    }
    
    console.log('智能识别未找到任何标题');
    return null;
  }
  
  // 监听来自后台脚本的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('内容脚本收到消息:', request);
    
    if (request.action === 'extractTitle') {
      try {
        console.log('开始提取标题，当前URL:', window.location.href);
        const title = extractTitle();
        
        if (title) {
          console.log('标题提取成功:', title);
          sendResponse({ success: true, title: title });
        } else {
          console.log('标题提取失败，未找到有效标题');
          sendResponse({ 
            success: false, 
            error: '未能识别到文章标题，请确保在支持的编辑器页面中操作。当前页面: ' + window.location.hostname
          });
        }
      } catch (error) {
        console.error('提取标题时发生错误:', error);
        sendResponse({ success: false, error: '提取标题异常: ' + error.message });
      }
      return true; // 保持消息通道开放
    }
  });
  
  // 页面加载完成后的初始化
  function initialize() {
    console.log('内容脚本初始化完成，当前域名:', getCurrentDomain());
    
    // 检测页面是否为支持的编辑器
    const domain = getCurrentDomain();
    const isSupported = Object.keys(TITLE_SELECTORS).some(key => 
      key !== 'default' && domain.includes(key)
    );
    
    if (isSupported) {
      console.log('检测到支持的编辑器平台');
    } else {
      console.log('当前页面可能不是支持的编辑器，将使用通用识别方式');
    }
  }
  
  // 等待页面完全加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  // 监听页面动态变化（SPA应用）
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('页面URL发生变化，重新初始化');
      setTimeout(initialize, 1000); // 延迟初始化以等待页面渲染
    }
  }).observe(document, { subtree: true, childList: true });
  
})();