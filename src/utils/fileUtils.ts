import { MindMapData, MindMapNode } from '../types/MindMap';

// 格式化日期函数
const formatDate = (date: Date): string => {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

// 获取优先级文本
const getPriorityText = (priority: string): string => {
  const priorityMap: Record<string, string> = {
    'low': '低',
    'medium': '中',
    'high': '高'
  };
  return priorityMap[priority] || priority;
};

// 获取状态文本
const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    'todo': '待办',
    'in_progress': '进行中',
    'done': '已完成'
  };
  return statusMap[status] || status;
};

// 检查是否支持 File System Access API
const isFileSystemAccessSupported = () => {
  return 'showSaveFilePicker' in window;
};

// 检查是否支持目录访问 API
const isDirectoryAccessSupported = () => {
  return 'showDirectoryPicker' in window;
};

// 创建下载链接并触发下载
const downloadFile = (content: string, fileName: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
};

// 使用目录句柄保存文件
export const saveFileToDirectory = async (
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string,
  content: string,
  contentType: string
): Promise<boolean> => {
  try {
    // 创建文件
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    
    // 创建可写流
    const writable = await fileHandle.createWritable();
    
    // 写入内容
    if (contentType === 'application/json') {
      await writable.write(content);
    } else {
      const blob = new Blob([content], { type: contentType });
      await writable.write(blob);
    }
    
    // 关闭流
    await writable.close();
    
    return true;
  } catch (error) {
    console.error('保存文件到目录时出错:', error);
    return false;
  }
};

export const saveToFile = async (
  data: MindMapData, 
  canvasName: string = '思维导图',
  directoryHandle?: FileSystemDirectoryHandle | null
) => {
  try {
    // 处理文件名，移除不合法字符
    const safeFileName = canvasName.replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `${safeFileName}.json`;
    const content = JSON.stringify(data, null, 2);
    
    // 如果提供了目录句柄，直接保存到该目录
    if (directoryHandle && isDirectoryAccessSupported()) {
      return await saveFileToDirectory(
        directoryHandle,
        fileName,
        content,
        'application/json'
      );
    }
    
    // 检查是否支持 File System Access API
    if (isFileSystemAccessSupported()) {
      // 使用现代 File System Access API
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'JSON Files',
          accept: { 'application/json': ['.json'] },
        }],
      });
      
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } else {
      // 使用传统下载方法
      return downloadFile(
        content,
        fileName,
        'application/json'
      );
    }
  } catch (error) {
    console.error('Error saving file:', error);
    return false;
  }
};

export const loadFromFile = async (): Promise<MindMapData | null> => {
  try {
    // 创建一个文件输入元素
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    
    // 等待用户选择文件
    const fileSelected = new Promise<File | null>((resolve) => {
      fileInput.onchange = (event) => {
        const files = (event.target as HTMLInputElement).files;
        resolve(files && files.length > 0 ? files[0] : null);
      };
      
      // 如果用户取消选择，也要解析Promise
      fileInput.oncancel = () => resolve(null);
      
      // 模拟点击，打开文件选择对话框
      fileInput.click();
    });
    
    const file = await fileSelected;
    if (!file) {
      console.log('用户取消了文件选择');
      return null;
    }
    
    // 读取文件内容
    const fileContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });
    
    // 解析JSON
    try {
      const data = JSON.parse(fileContent);
      console.log('成功加载文件:', data);
      
      // 验证数据结构
      if (!data.mindMaps || !Array.isArray(data.mindMaps)) {
        console.error('文件格式不正确: 缺少mindMaps数组');
        return null;
      }
      
      return data as MindMapData;
    } catch (parseError) {
      console.error('解析JSON失败:', parseError);
      throw new Error('文件格式不正确，无法解析JSON');
    }
  } catch (error) {
    console.error('加载文件时出错:', error);
    throw error;
  }
};

// 将思维导图数据转换为Markdown格式
export const convertToMarkdown = (data: MindMapData): string => {
  let markdown = '# 思维导图导出\n\n';
  
  if (!data.mindMaps || data.mindMaps.length === 0) {
    return markdown + '无内容';
  }
  
  const theme = data.mindMaps[0];
  markdown += `## ${theme.title || '主题'}\n\n`;
  
  // 添加主题信息
  if (theme.start_date || theme.due_date) {
    markdown += '### 主题信息\n\n';
    if (theme.start_date) {
      markdown += `- **开始日期**: ${theme.start_date}\n`;
    }
    if (theme.due_date) {
      markdown += `- **截止日期**: ${theme.due_date}\n`;
    }
    if (theme.created_at) {
      markdown += `- **创建时间**: ${new Date(theme.created_at).toLocaleString()}\n`;
    }
    if (theme.updated_at) {
      markdown += `- **更新时间**: ${new Date(theme.updated_at).toLocaleString()}\n`;
    }
    markdown += '\n';
  }
  
  // 递归处理节点
  const processNode = (node: any, level: number): string => {
    let nodeMarkdown = '';
    const prefix = '#'.repeat(Math.min(level + 2, 6)); // 最多6级标题
    
    // 添加标题
    nodeMarkdown += `${prefix} ${node.title || '无标题'}\n\n`;
    
    // 添加元数据（状态信息）
    const metaData = [];
    
    if (node.priority) {
      const priorityMap: Record<string, string> = {
        'low': '低',
        'medium': '中',
        'high': '高'
      };
      const priorityEmoji = node.priority === 'high' ? '🔴' : (node.priority === 'medium' ? '🟡' : '🟢');
      metaData.push(`- **优先级**: ${priorityEmoji} ${priorityMap[node.priority] || node.priority}`);
    }
    
    if (node.status) {
      const statusMap: Record<string, string> = {
        'todo': '待办',
        'in_progress': '进行中',
        'done': '已完成'
      };
      const statusEmoji = node.status === 'done' ? '✅' : (node.status === 'in_progress' ? '🔄' : '📝');
      metaData.push(`- **状态**: ${statusEmoji} ${statusMap[node.status] || node.status}`);
    }
    
    if (node.start_date) {
      metaData.push(`- **开始日期**: 📅 ${node.start_date}`);
    }
    
    if (node.due_date) {
      metaData.push(`- **截止日期**: ⏰ ${node.due_date}`);
    }
    
    if (node.created_at) {
      metaData.push(`- **创建时间**: ${new Date(node.created_at).toLocaleString()}`);
    }
    
    if (metaData.length > 0) {
      nodeMarkdown += metaData.join('\n') + '\n\n';
    }
    
    // 添加描述
    if (node.description) {
      nodeMarkdown += `**描述**:\n\n${node.description}\n\n`;
    }
    
    // 处理子节点
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => {
        nodeMarkdown += processNode(child, level + 1);
      });
    }
    
    return nodeMarkdown;
  };
  
  // 处理所有根节点
  if (theme.children && theme.children.length > 0) {
    theme.children.forEach((child: any) => {
      markdown += processNode(child, 1);
    });
  }
  
  return markdown;
};

// 保存Markdown文件
export const saveToMarkdown = async (
  data: MindMapData, 
  canvasName: string = '思维导图',
  directoryHandle?: FileSystemDirectoryHandle | null
): Promise<boolean> => {
  try {
    const markdown = convertToMarkdown(data);
    
    // 处理文件名，移除不合法字符
    const safeFileName = canvasName.replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `${safeFileName}.md`;
    
    // 如果提供了目录句柄，直接保存到该目录
    if (directoryHandle && isDirectoryAccessSupported()) {
      return await saveFileToDirectory(
        directoryHandle,
        fileName,
        markdown,
        'text/markdown'
      );
    }
    
    // 检查是否支持 File System Access API
    if (isFileSystemAccessSupported()) {
      // 使用现代 File System Access API
      // 创建Blob对象
      const blob = new Blob([markdown], { type: 'text/markdown' });
      
      // 使用文件选择器保存文件
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'Markdown Files',
          accept: { 'text/markdown': ['.md'] },
        }],
      });
      
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      
      return true;
    } else {
      // 使用传统下载方法
      return downloadFile(
        markdown,
        fileName,
        'text/markdown'
      );
    }
  } catch (error) {
    console.error('保存Markdown文件时出错:', error);
    return false;
  }
};

function processNode(node: MindMapNode, depth: number, path: string, result: string[] = []): string[] {
  if (!node) return result;
  
  // 确保节点有一个初始化的 children 数组
  node.children = node.children || [];
  
  // 创建当前节点的Markdown标记
  const indent = '  '.repeat(depth);
  const bullet = depth === 0 ? '# ' : '- ';
  const title = node.title || '未命名任务';
  const pathPrefix = path ? `${path} > ` : '';
  const fullPath = `${pathPrefix}${title}`;
  
  // 添加基本信息
  result.push(`${indent}${bullet}${title}`);
  
  // 添加详细信息（如果有的话）
  const details: string[] = [];
  
  if (node.description && node.description.trim()) {
    details.push(`${indent}  描述: ${node.description.trim()}`);
  }
  
  if (node.priority) {
    details.push(`${indent}  优先级: ${getPriorityText(node.priority)}`);
  }
  
  if (node.status) {
    details.push(`${indent}  状态: ${getStatusText(node.status)}`);
  }
  
  if (node.created_at) {
    const createdDate = new Date(node.created_at);
    if (!isNaN(createdDate.getTime())) {
      details.push(`${indent}  创建时间: ${formatDate(createdDate)}`);
    }
  }
  
  if (node.start_date) {
    details.push(`${indent}  开始日期: ${node.start_date}`);
  }
  
  if (node.due_date) {
    details.push(`${indent}  截止日期: ${node.due_date}`);
  }
  
  if (node.tags && node.tags.length > 0) {
    details.push(`${indent}  标签: ${node.tags.join(', ')}`);
  }
  
  // 如果有详细信息，添加到结果中
  if (details.length > 0) {
    result.push('');
    result.push(...details);
    result.push('');
  }
  
  // 递归处理子节点
  for (const child of node.children) {
    processNode(child, depth + 1, fullPath, result);
  }
  
  return result;
} 