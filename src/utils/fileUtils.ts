import { MindMapData } from '../types/MindMap';

export const saveToFile = async (data: MindMapData) => {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'mindmap.json',
      types: [{
        description: 'JSON Files',
        accept: { 'application/json': ['.json'] },
      }],
    });
    
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return true;
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
  let markdown = '# 思维导图\n\n';
  
  if (!data.mindMaps || data.mindMaps.length === 0) {
    return markdown + '无内容';
  }
  
  const theme = data.mindMaps[0];
  markdown += `## ${theme.title || '主题'}\n\n`;
  
  // 递归处理节点
  const processNode = (node: any, level: number): string => {
    let nodeMarkdown = '';
    const prefix = '#'.repeat(Math.min(level + 2, 6)); // 最多6级标题
    
    // 添加标题
    nodeMarkdown += `${prefix} ${node.title || '无标题'}\n\n`;
    
    // 添加描述
    if (node.description) {
      nodeMarkdown += `${node.description}\n\n`;
    }
    
    // 添加元数据
    const metaData = [];
    if (node.priority) {
      const priorityMap: Record<string, string> = {
        'low': '低',
        'medium': '中',
        'high': '高'
      };
      metaData.push(`- **优先级**: ${priorityMap[node.priority] || node.priority}`);
    }
    
    if (node.status) {
      const statusMap: Record<string, string> = {
        'todo': '待办',
        'in_progress': '进行中',
        'done': '已完成'
      };
      metaData.push(`- **状态**: ${statusMap[node.status] || node.status}`);
    }
    
    if (node.start_date) {
      metaData.push(`- **开始日期**: ${node.start_date}`);
    }
    
    if (node.due_date) {
      metaData.push(`- **截止日期**: ${node.due_date}`);
    }
    
    if (metaData.length > 0) {
      nodeMarkdown += metaData.join('\n') + '\n\n';
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
export const saveToMarkdown = async (data: MindMapData): Promise<boolean> => {
  try {
    const markdown = convertToMarkdown(data);
    
    // 创建Blob对象
    const blob = new Blob([markdown], { type: 'text/markdown' });
    
    // 使用文件选择器保存文件
    const handle = await window.showSaveFilePicker({
      suggestedName: 'mindmap.md',
      types: [{
        description: 'Markdown Files',
        accept: { 'text/markdown': ['.md'] },
      }],
    });
    
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    
    return true;
  } catch (error) {
    console.error('保存Markdown文件时出错:', error);
    return false;
  }
}; 