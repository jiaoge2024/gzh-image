// Service Worker 后台脚本
// 处理扩展的生命周期事件和侧边栏管理

// 扩展安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('公众号封面图生成器扩展已安装');
  
  // 初始化存储
  chrome.storage.local.get(['cozeToken', 'workflowId'], (result) => {
    if (!result.cozeToken || !result.workflowId) {
      console.log('首次安装，需要用户配置API密钥');
    }
  });
});

// 处理扩展图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // 检查当前标签页是否支持侧边栏
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      console.log('当前页面不支持侧边栏功能');
      return;
    }
    
    // 打开侧边栏
    await chrome.sidePanel.open({ tabId: tab.id });
    console.log('侧边栏已打开');
    
  } catch (error) {
    console.error('打开侧边栏失败:', error);
    
    // 如果侧边栏打开失败，尝试打开弹窗
    try {
      chrome.action.setPopup({ popup: 'popup.html' });
    } catch (popupError) {
      console.error('设置弹窗失败:', popupError);
    }
  }
});

// 处理来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到消息:', request);
  
  switch (request.action) {
    case 'getTitleFromContent':
      // 转发标题识别请求到内容脚本
      if (sender.tab && sender.tab.id) {
        handleGetTitle(sender.tab.id, sendResponse);
      } else {
        // 如果没有tab信息，尝试获取当前活动标签页
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            handleGetTitle(tabs[0].id, sendResponse);
          } else {
            sendResponse({ success: false, error: '无法获取当前标签页信息' });
          }
        });
      }
      return true; // 保持消息通道开放
      
    case 'generateCover':
      // 处理封面生成请求
      handleGenerateCover(request.title, sendResponse);
      return true;
      
    case 'downloadImage':
      // 处理图片下载请求
      handleDownloadImage(request.imageUrl, request.filename, sendResponse);
      return true;
      
    default:
      console.log('未知的消息类型:', request.action);
  }
});

// 处理标题获取
async function handleGetTitle(tabId, sendResponse) {
  try {
    console.log('向标签页发送标题提取请求, tabId:', tabId);
    
    // 首先检查标签页是否存在
    const tab = await chrome.tabs.get(tabId);
    console.log('目标标签页信息:', tab.url);
    
    // 检查是否为受限页面
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
      throw new Error('当前页面不支持内容脚本注入，请在普通网页中使用此功能');
    }
    
    // 向内容脚本发送获取标题的请求
    const response = await chrome.tabs.sendMessage(tabId, { action: 'extractTitle' });
    console.log('收到内容脚本响应:', response);
    
    if (response && response.success) {
      sendResponse({ success: true, title: response.title });
    } else {
      sendResponse({ success: false, error: response?.error || '未知错误' });
    }
  } catch (error) {
    console.error('获取标题失败:', error);
    
    // 提供更详细的错误信息
    let errorMessage = error.message;
    if (error.message.includes('Could not establish connection')) {
      errorMessage = '无法连接到页面内容脚本，请刷新页面后重试';
    } else if (error.message.includes('Cannot access')) {
      errorMessage = '当前页面不支持标题提取功能，请在文章编辑页面中使用';
    }
    
    sendResponse({ success: false, error: errorMessage });
  }
}

// 处理封面生成
async function handleGenerateCover(title, sendResponse) {
  try {
    // 获取用户配置
    const config = await chrome.storage.local.get(['cozeToken', 'workflowId']);
    
    if (!config.cozeToken || !config.workflowId) {
      throw new Error('请先配置Coze API密钥和工作流ID');
    }
    
    // 启动工作流
    const runResponse = await fetch('https://api.coze.cn/v1/workflow/run', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.cozeToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workflow_id: config.workflowId,
        parameters: {
          input: title
        }
      })
    });
    
    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      throw new Error(`启动工作流失败: ${runResponse.status} ${runResponse.statusText} - ${errorText}`);
    }
    
    const runResult = await runResponse.json();
    console.log('工作流启动响应:', JSON.stringify(runResult, null, 2));
    
    // 检查是否为同步执行（直接返回结果）
    if (runResult.code === 0 && runResult.data) {
      console.log('工作流同步执行成功');
      
      // 解析最终结果获取图片URL
      const imageUrl = extractImageUrlFromSyncResult(runResult);
      
      if (!imageUrl) {
        console.log('完整的API响应:', JSON.stringify(runResult, null, 2));
        throw new Error('API响应中未找到图片URL，请检查工作流配置');
      }
      
      sendResponse({ success: true, imageUrl: imageUrl });
      return;
    }
    
    // 异步执行模式：获取执行ID
    let executeId = null;
    if (runResult.data?.execute_id) {
      executeId = runResult.data.execute_id;
    } else if (runResult.execute_id) {
      executeId = runResult.execute_id;
    } else if (runResult.id) {
      executeId = runResult.id;
    } else if (runResult.data?.id) {
      executeId = runResult.data.id;
    } else if (runResult.debug_url) {
      // 从debug_url中提取execute_id
      const match = runResult.debug_url.match(/execute_id=([0-9]+)/);
      if (match) {
        executeId = match[1];
        console.log('从debug_url提取到执行ID:', executeId);
      }
    }
    
    if (!executeId) {
      console.error('完整的启动响应:', JSON.stringify(runResult, null, 2));
      throw new Error(`未获取到工作流执行ID。响应结构: ${JSON.stringify(Object.keys(runResult), null, 2)}`);
    }
    
    console.log('获取到执行ID:', executeId);
    
    // 轮询工作流状态直到完成
    const finalResult = await pollWorkflowStatus(config.cozeToken, executeId);
    
    // 解析最终结果获取图片URL
    const imageUrl = extractImageUrl(finalResult);
    
    if (!imageUrl) {
      console.log('完整的API响应:', JSON.stringify(finalResult, null, 2));
      throw new Error('API响应中未找到图片URL，请检查工作流配置');
    }
    
    sendResponse({ success: true, imageUrl: imageUrl });
    
  } catch (error) {
    console.error('生成封面失败:', error);
    
    // 提供更详细的错误信息
    let errorMessage = error.message;
    if (error.message.includes('未获取到工作流执行ID')) {
      errorMessage = '工作流启动失败，请检查：\n1. Coze API密钥是否正确\n2. 工作流ID是否有效\n3. 网络连接是否正常';
    } else if (error.message.includes('启动工作流失败')) {
      errorMessage = '无法连接到Coze API，请检查：\n1. API密钥是否正确\n2. 网络连接是否正常\n3. 工作流ID是否存在';
    } else if (error.message.includes('工作流执行失败')) {
      errorMessage = '工作流执行出错，请检查工作流配置是否正确';
    } else if (error.message.includes('API响应中未找到图片URL')) {
      errorMessage = '工作流执行成功但未生成图片，请检查工作流输出配置';
    }
    
    sendResponse({ success: false, error: errorMessage });
  }
}

// 轮询工作流状态
async function pollWorkflowStatus(token, executeId, maxAttempts = 30, interval = 2000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`https://api.coze.cn/v1/workflow/run/retrieve?execute_id=${executeId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`查询工作流状态失败: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`轮询第${attempt + 1}次，完整响应:`, JSON.stringify(result, null, 2));
      
      // 支持多种可能的状态字段位置
      let status = null;
      if (result.data?.status) {
        status = result.data.status;
      } else if (result.status) {
        status = result.status;
      } else if (result.data?.state) {
        status = result.data.state;
      } else if (result.state) {
        status = result.state;
      }
      
      console.log(`轮询第${attempt + 1}次，状态: ${status}`);
      
      // 检查工作流状态
      if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'FINISHED') {
        console.log('工作流执行成功:', result);
        return result;
      } else if (status === 'FAILED' || status === 'ERROR') {
        const errorMsg = result.data?.error_message || result.error_message || result.data?.error || result.error || '未知错误';
        throw new Error('工作流执行失败: ' + errorMsg);
      } else if (status === 'RUNNING' || status === 'PENDING' || status === 'IN_PROGRESS') {
        // 继续等待
        await new Promise(resolve => setTimeout(resolve, interval));
        continue;
      } else {
        console.log('未知状态:', status, '完整响应:', result);
        // 如果没有明确的状态，也继续等待
        await new Promise(resolve => setTimeout(resolve, interval));
        continue;
      }
    } catch (error) {
      console.error(`轮询第${attempt + 1}次失败:`, error);
      if (attempt === maxAttempts - 1) {
        throw new Error('工作流执行超时或查询失败');
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  throw new Error('工作流执行超时，请稍后重试');
}

// 从同步执行结果中提取图片URL
function extractImageUrlFromSyncResult(runResult) {
  try {
    console.log('开始从同步结果提取图片URL:', JSON.stringify(runResult, null, 2));
    
    // 1. 尝试解析data字段（可能是JSON字符串）
    if (runResult.data && typeof runResult.data === 'string') {
      try {
        const parsedData = JSON.parse(runResult.data);
        console.log('解析后的data:', parsedData);
        
        if (parsedData.image) {
          console.log('从parsedData.image找到URL:', parsedData.image);
          return parsedData.image;
        }
        if (parsedData.image_url) {
          console.log('从parsedData.image_url找到URL:', parsedData.image_url);
          return parsedData.image_url;
        }
        if (parsedData.url) {
          console.log('从parsedData.url找到URL:', parsedData.url);
          return parsedData.url;
        }
      } catch (e) {
        console.log('data字段不是JSON格式，尝试直接提取URL');
        const url = extractUrlFromString(runResult.data);
        if (url) {
          console.log('从data字符串提取到URL:', url);
          return url;
        }
      }
    }
    
    // 2. 检查data字段是否直接是对象
    if (runResult.data && typeof runResult.data === 'object') {
      if (runResult.data.image) {
        console.log('从data.image找到URL:', runResult.data.image);
        return runResult.data.image;
      }
      if (runResult.data.image_url) {
        console.log('从data.image_url找到URL:', runResult.data.image_url);
        return runResult.data.image_url;
      }
      if (runResult.data.url) {
        console.log('从data.url找到URL:', runResult.data.url);
        return runResult.data.url;
      }
    }
    
    // 3. 递归搜索整个响应
    console.log('开始递归搜索URL...');
    const foundUrl = findUrlInObject(runResult);
    if (foundUrl) {
      console.log('递归搜索找到URL:', foundUrl);
      return foundUrl;
    }
    
    console.log('未找到任何图片URL');
    return null;
  } catch (error) {
    console.error('从同步结果提取图片URL失败:', error);
    return null;
  }
}

// 从异步执行结果中提取图片URL
function extractImageUrl(result) {
  try {
    console.log('开始提取图片URL，完整结果:', JSON.stringify(result, null, 2));
    
    // 尝试多种可能的路径来获取图片URL
    const data = result.data || result;
    
    // 路径1: data.output 直接是字符串
    if (typeof data?.output === 'string') {
      console.log('尝试从data.output字符串提取URL:', data.output);
      const url = extractUrlFromString(data.output);
      if (url) {
        console.log('从data.output提取到URL:', url);
        return url;
      }
    }
    
    // 路径2: data.output 是对象，包含image或image_url字段
    if (data?.output && typeof data.output === 'object') {
      console.log('检查data.output对象:', data.output);
      if (data.output.image_url) {
        console.log('找到data.output.image_url:', data.output.image_url);
        return data.output.image_url;
      }
      if (data.output.image) {
        console.log('找到data.output.image:', data.output.image);
        return data.output.image;
      }
      if (data.output.url) {
        console.log('找到data.output.url:', data.output.url);
        return data.output.url;
      }
    }
    
    // 路径3: 检查result字段
    if (data?.result) {
      console.log('检查data.result:', data.result);
      if (typeof data.result === 'string') {
        const url = extractUrlFromString(data.result);
        if (url) {
          console.log('从data.result提取到URL:', url);
          return url;
        }
      } else if (typeof data.result === 'object') {
        const foundUrl = findUrlInObject(data.result);
        if (foundUrl) {
          console.log('从data.result对象找到URL:', foundUrl);
          return foundUrl;
        }
      }
    }
    
    // 路径4: 在data.debug_url或其他字段中查找
    if (data?.debug_url) {
      console.log('检查data.debug_url:', data.debug_url);
      const url = extractUrlFromString(data.debug_url);
      if (url) {
        console.log('从data.debug_url提取到URL:', url);
        return url;
      }
    }
    
    // 路径5: 递归搜索所有字段中的URL
    console.log('开始递归搜索URL...');
    const foundUrl = findUrlInObject(data);
    if (foundUrl) {
      console.log('递归搜索找到URL:', foundUrl);
      return foundUrl;
    }
    
    console.log('未找到任何图片URL');
    return null;
  } catch (error) {
    console.error('解析图片URL失败:', error);
    return null;
  }
}

// 从字符串中提取URL
function extractUrlFromString(str) {
  if (!str || typeof str !== 'string') return null;
  
  // 匹配HTTP/HTTPS URL
  const urlRegex = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp|bmp)/gi;
  const matches = str.match(urlRegex);
  
  if (matches && matches.length > 0) {
    return matches[0];
  }
  
  // 如果字符串本身就是URL
  if (str.startsWith('http') && (str.includes('.jpg') || str.includes('.png') || str.includes('.jpeg') || str.includes('.gif') || str.includes('.webp'))) {
    return str;
  }
  
  return null;
}

// 递归搜索对象中的URL
function findUrlInObject(obj, visited = new Set()) {
  if (!obj || typeof obj !== 'object' || visited.has(obj)) return null;
  visited.add(obj);
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const url = extractUrlFromString(value);
      if (url) return url;
    } else if (typeof value === 'object' && value !== null) {
      const url = findUrlInObject(value, visited);
      if (url) return url;
    }
  }
  
  return null;
}

// 处理图片下载
async function handleDownloadImage(imageUrl, filename, sendResponse) {
  try {
    // 使用Chrome下载API
    const downloadId = await chrome.downloads.download({
      url: imageUrl,
      filename: filename || `cover_${Date.now()}.png`,
      saveAs: true
    });
    
    sendResponse({ success: true, downloadId: downloadId });
    
  } catch (error) {
    console.error('下载图片失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 监听下载完成事件
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    console.log('图片下载完成:', downloadDelta.id);
  }
});

// 处理扩展更新
chrome.runtime.onUpdateAvailable.addListener(() => {
  console.log('扩展有新版本可用');
});

// 处理扩展启动
chrome.runtime.onStartup.addListener(() => {
  console.log('扩展已启动');
});

// 错误处理
chrome.runtime.onSuspend.addListener(() => {
  console.log('Service Worker即将被挂起');
});

// 导出函数供测试使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleGetTitle,
    handleGenerateCover,
    handleDownloadImage
  };
}